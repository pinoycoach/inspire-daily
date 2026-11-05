// Inspire Daily server: serves the built app and makes every AI call, so no key ever reaches
// the browser. Runs on Vertex AI (Google Cloud credit pays) or with a Gemini API key.
import express from "express";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { MemoryStore, MemoryMedia, createFirestoreStore, createGcsMedia, type Store, type MediaStore, type UserDoc, type StoredPost } from "./server/store";
import { askJev, jevConfigured } from "./server/jev";
import {
  KINDS, labelQuestions, applyLabels, labelFlags, NOT_LABELED, pieceState, embedText, starterPieces, type LibraryPiece, type PieceStatus,
} from "./server/library";
import { knownMisattribution, checkWikiquote, needsSourceCheck, sourceFlags, isSourceFlag, sourceSaysWrong, type SourceCheck } from "./server/sources";
import { createSessions } from "./server/session";
import { QUOTES_DATABASE } from "./data/quotesDatabase";
import { avatarFor } from "./shared/avatar";
import {
  STARTER_INVITES, REDEEM_MESSAGES, newInvite, normalizeCode, normalizeEmail, isValidEmail, parseAdminEmails,
} from "./server/accounts";
import type { Post, Persona, UserBrandSettings } from "./types";

/** Today in UTC, "YYYY-MM-DD": the key for daily limits. */
const utcDay = (date = new Date()) => date.toISOString().slice(0, 10);

dotenv.config({ path: ".env.local" });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
app.set("trust proxy", true); // Cloud Run sits behind Google's proxy; this gives the real visitor IP.
app.use(express.json({ limit: "15mb" }));

// ---------- AI mode and models ----------

// Vertex AI bills the Google Cloud project (and its credit) and signs in with the machine's identity.
const USE_VERTEX = /^(true|1)$/i.test(process.env.GOOGLE_GENAI_USE_VERTEXAI || "");
const GCS_BUCKET = process.env.GCS_BUCKET || "";
const TEXT_MODEL = process.env.MODEL_TEXT || "gemini-3.8-flash";
const MODELS = {
  text: TEXT_MODEL,
  // The "-latest" alias doesn't exist on Vertex AI, so there the busy-retry reuses the main model.
  textFallback: process.env.MODEL_TEXT_FALLBACK || (USE_VERTEX ? TEXT_MODEL : "gemini-flash-latest"),
  image: process.env.MODEL_IMAGE || "gemini-3.1-flash-lite-image",
  embed: process.env.MODEL_EMBED || "gemini-embedding-001",
};

const clients: Record<string, GoogleGenAI> = {};
const getAI = (purpose: "default" = "default") => {
  if (clients[purpose]) return clients[purpose];
  if (USE_VERTEX) {
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    if (!project) throw new Error("Vertex AI mode needs GOOGLE_CLOUD_PROJECT to be set.");
    const location = process.env.GOOGLE_CLOUD_LOCATION || "global";
    clients[purpose] = new GoogleGenAI({ vertexai: true, project, location });
  } else {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) throw new Error("No AI configured: set GEMINI_API_KEY, or GOOGLE_GENAI_USE_VERTEXAI=true with GOOGLE_CLOUD_PROJECT.");
    clients[purpose] = new GoogleGenAI({ apiKey });
  }
  return clients[purpose];
};

let storageClient: any = null;
const getStorage = async () => {
  if (!storageClient) {
    const { Storage } = await import("@google-cloud/storage");
    storageClient = new Storage();
  }
  return storageClient;
};

const isBusy = (err: any) =>
  [503, 429].includes(err?.status) ||
  [503, 429].includes(err?.code) ||
  /503|high demand|UNAVAILABLE|Resource exhausted/i.test(err?.message || "");

// Retries Google's brief busy spikes.
async function withRetry<T>(action: () => Promise<T>, retries = 3, initialDelayMs = 1500): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await action();
    } catch (err: any) {
      if (!isBusy(err) || attempt >= retries) throw err;
      const delay = initialDelayMs * 2 ** (attempt - 1) + Math.random() * 500;
      console.warn(`[Server] Model busy, retry ${attempt}/${retries} in ${Math.round(delay)}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

// Turns Google's errors into a message a person can act on, keeping Google's own words.
const friendlyError = (err: any, fallback: string) => {
  const status = err?.status || err?.code;
  const raw = String(err?.message || fallback);
  if (status === 401 || status === 403 || /permission|unauthori[sz]ed|forbidden/i.test(raw)) {
    return { status: 403, error: `Google refused this request (no permission for this model or feature). ${raw.slice(0, 300)}` };
  }
  if (isBusy(err)) return { status: 503, error: "Google's AI is busy right now. Try again in a minute." };
  return { status: 500, error: raw.slice(0, 400) };
};

// ---------- Data: database, media and sessions ----------

// DATA_STORE=memory keeps everything in memory (local runs, tests). Otherwise Firestore + Cloud Storage.
const USE_MEMORY = process.env.DATA_STORE === "memory";
const store: Store = USE_MEMORY ? new MemoryStore() : await createFirestoreStore();
const media: MediaStore = USE_MEMORY || !GCS_BUCKET ? new MemoryMedia() : await createGcsMedia(GCS_BUCKET);

let SESSION_SECRET = process.env.SESSION_SECRET || "";
if (!SESSION_SECRET) {
  SESSION_SECRET = crypto.randomBytes(32).toString("hex");
  console.warn("SESSION_SECRET is not set: using a temporary one, so everyone's progress resets when the server restarts.");
}
const sessions = createSessions(SESSION_SECRET);

// The quote library lives in the database; the bundled list seeds it (new ids only).
store
  .seedQuotes(QUOTES_DATABASE)
  .then((n) => n && console.log(`Seeded ${n} quotes.`))
  .catch((err) => console.error("Could not seed quotes:", err?.message || err));
// The curated library starts with the same quotes plus Filipino proverbs, all waiting for review.
store
  .seedLibrary(starterPieces(QUOTES_DATABASE))
  .then((n) => n && console.log(`Added ${n} starter pieces to the library for review.`))
  .catch((err) => console.error("Could not seed the library:", err?.message || err));

// ---------- Protection: headers, passcode, session, rate limits, daily caps ----------

const isProd = process.env.NODE_ENV === "production";
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (isProd) {
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        // Google's sign-in button (Google Identity Services) loads from accounts.google.com.
        "script-src 'self' https://accounts.google.com/gsi/client",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",
        "frame-src https://accounts.google.com/gsi/",
        "font-src 'self' data: https://fonts.gstatic.com",
        "img-src 'self' data: blob: https:",
        "media-src 'self' blob: data:",
        // Auto-post sends to the user's own webhook (Zapier, Make…) from the browser.
        "connect-src 'self' https:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; ")
    );
  }
  next();
});

const APP_PASSCODE = process.env.APP_PASSCODE || "";
const ADMIN_CODE = process.env.ADMIN_CODE || "";
const secretMatches = (given: unknown, secret: string) => {
  if (typeof given !== "string" || !given || !secret) return false;
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(secret).digest();
  return crypto.timingSafeEqual(a, b);
};
const passcodeMatches = (given: unknown) => secretMatches(given, APP_PASSCODE);

// ---------- Invite-only beta: Google sign-in + invite codes ----------

// INVITE_ONLY replaces the shared passcode: you sign in with Google and redeem an invite once.
const INVITE_ONLY = /^(true|1|on)$/i.test(process.env.INVITE_ONLY || "");
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const ADMIN_EMAILS = parseAdminEmails(process.env.ADMIN_EMAILS);
// Tests only: accept "test:<sub>:<email>:<signature>" instead of a real Google token.
const AUTH_TEST_SECRET = process.env.AUTH_TEST_SECRET || "";
if (AUTH_TEST_SECRET) console.warn("AUTH_TEST_SECRET is set: test sign-ins are accepted. Never set this on the real server.");
if (INVITE_ONLY && !GOOGLE_CLIENT_ID && !AUTH_TEST_SECRET) console.warn("INVITE_ONLY is on but GOOGLE_CLIENT_ID is not set: nobody can sign in.");

let googleClient: any = null;
/** Checks a Google sign-in token. Returns the account, or null when it isn't genuine. */
async function verifyGoogle(credential: unknown): Promise<{ sub: string; email: string; name: string } | null> {
  const token = String(credential || "");
  if (AUTH_TEST_SECRET && token.startsWith("test:")) {
    const [, sub, email, sig] = token.split(":");
    const want = crypto.createHmac("sha256", AUTH_TEST_SECRET).update(`${sub}|${email}`).digest("hex");
    return sub && email && sig && secretMatches(sig, want) ? { sub, email: normalizeEmail(email), name: email.split("@")[0] } : null;
  }
  if (!GOOGLE_CLIENT_ID || !token) return null;
  try {
    if (!googleClient) {
      const { OAuth2Client } = await import("google-auth-library");
      googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
    }
    const ticket = await googleClient.verifyIdToken({ idToken: token, audience: GOOGLE_CLIENT_ID });
    const p = ticket.getPayload();
    if (!p?.sub || !p.email || p.email_verified === false) return null;
    return { sub: p.sub, email: normalizeEmail(p.email), name: String(p.name || p.email.split("@")[0]).slice(0, 80) };
  } catch (err: any) {
    console.warn("Google sign-in rejected:", err?.message || err);
    return null;
  }
}

// Members rarely stop being members (only "Delete my data"), so remember the yeses.
const memberCache = new Set<string>();
const isMember = async (uid: string) => {
  if (memberCache.has(uid)) return true;
  const user = await store.getUser(uid);
  if (user?.member) memberCache.add(uid);
  return !!user?.member;
};

const WINDOW_MS = 10 * 60 * 1000;
// AI requests per visitor per 10 minutes, and all other requests.
const AI_RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_10MIN) || 40;
const GENERAL_RATE_LIMIT = Number(process.env.GENERAL_RATE_LIMIT_PER_10MIN) || 400;
const hits = new Map<string, number[]>();
const overLimit = (key: string, limit: number) => {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
};
// Forget idle visitors so the map can't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
}, WINDOW_MS).unref();

const IMAGE_DAILY_LIMIT = Number(process.env.IMAGE_DAILY_LIMIT) || 20;
const CAPTION_DAILY_LIMIT = Number(process.env.CAPTION_DAILY_LIMIT) || 60;
const GLOBAL_IMAGE_DAILY_LIMIT = Number(process.env.GLOBAL_IMAGE_DAILY_LIMIT) || 500;
/** Where quotes are looked up. "off" turns the lookup off; tests point it at a stand-in. */
const WIKIQUOTE_BASE_URL = process.env.WIKIQUOTE_BASE_URL ?? "https://en.wikiquote.org";

/** Counts one use against today's limit; false when the limit is already reached. */
const takeDaily = async (key: string, limit: number) => (await store.bumpUsage(`${utcDay()}_${key}`)) <= limit;

const AI_PATHS = new Set(["/api/generate-image", "/api/generate-post"]);
const OPEN_PATHS = new Set(["/api/config", "/api/unlock"]);
const SESSION_FREE = new Set(["/api/config", "/api/unlock", "/api/session", "/api/quotes", "/api/quotes/daily", "/api/waitlist"]);
// Reachable before you're a member (to sign in, redeem an invite or join the waitlist).
const MEMBER_FREE = new Set(["/api/config", "/api/unlock", "/api/session", "/api/me/status", "/api/auth/google", "/api/invites/redeem", "/api/waitlist"]);

declare global {
  namespace Express {
    interface Request {
      uid?: string;
    }
  }
}

app.use("/api", (req, res, next) => {
  const p = req.originalUrl.split("?")[0];
  // Media links are signed per file, so <img> tags work without headers.
  if (OPEN_PATHS.has(p) || p.startsWith("/api/media/")) return next();
  if (!INVITE_ONLY && APP_PASSCODE && !passcodeMatches(req.get("x-app-passcode"))) {
    return res.status(401).json({ error: "Locked. Enter the app passcode." });
  }
  if (!SESSION_FREE.has(p)) {
    const uid = sessions.verify(req.get("x-inspire-session"));
    if (!uid) return res.status(401).json({ error: "Session expired. Refresh the page.", session: "invalid" });
    req.uid = uid;
  }
  const who = req.uid || req.ip || "unknown";
  if (overLimit(`all:${who}`, GENERAL_RATE_LIMIT) || (AI_PATHS.has(p) && overLimit(`ai:${who}`, AI_RATE_LIMIT))) {
    return res.status(429).json({ error: "Too many requests. Please wait a few minutes and try again." });
  }
  // The curator area has its own code; everything else needs a member once the beta is invite-only.
  if (INVITE_ONLY && !MEMBER_FREE.has(p) && !p.startsWith("/api/admin")) {
    isMember(req.uid || "")
      .then((ok) => (ok ? next() : res.status(403).json({ error: "Inspire Daily is invite-only during the beta.", invite: "required" })))
      .catch((err) => {
        console.error("member check:", err);
        res.status(500).json({ error: "Could not check your invite. Please try again." });
      });
    return;
  }
  next();
});

app.post("/api/unlock", (req, res) => {
  if (!APP_PASSCODE || passcodeMatches(req.body?.passcode)) return res.json({ ok: true });
  setTimeout(() => res.status(401).json({ error: "That passcode isn't right." }), 800);
});

app.get("/api/config", async (_req, res) => {
  res.json({
    aiMode: USE_VERTEX ? "vertex" : "api-key",
    locked: !INVITE_ONLY && !!APP_PASSCODE,
    inviteOnly: INVITE_ONLY,
    googleClientId: GOOGLE_CLIENT_ID || null,
    dataStore: store.kind,
  });
});

/** A new anonymous identity, or confirms the one this browser already has. */
app.post("/api/session", (req, res) => {
  const existing = sessions.verify(req.body?.token);
  if (existing) return res.json({ uid: existing, token: req.body.token });
  return res.json(sessions.issue());
});

// ---------- Quotes ----------

app.get("/api/quotes", async (_req, res) => {
  try {
    res.json({ quotes: await store.listQuotes() });
  } catch (err: any) {
    console.error("quotes:", err);
    res.status(500).json({ error: "Could not load quotes." });
  }
});

app.get("/api/quotes/daily", async (_req, res) => {
  try {
    const quotes = await store.listQuotes();
    if (!quotes.length) return res.status(404).json({ error: "No quotes yet." });
    const dayNumber = Math.floor(Date.now() / 86_400_000);
    res.json({ quote: quotes[dayNumber % quotes.length], day: utcDay() });
  } catch (err: any) {
    console.error("daily quote:", err);
    res.status(500).json({ error: "Could not load today's quote." });
  }
});

// ---------- Me: settings, posts, personas ----------

const newUserDoc = (): UserDoc => {
  const now = new Date().toISOString();
  return { createdAt: now, updatedAt: now };
};

app.get("/api/me", async (req, res) => {
  try {
    const user = (await store.getUser(req.uid!)) || (await store.updateUser(req.uid!, (cur) => cur || newUserDoc()));
    res.json({ brandSettings: user.brandSettings || null });
  } catch (err: any) {
    console.error("me:", err);
    res.status(500).json({ error: "Could not load your settings." });
  }
});

const ASPECTS = new Set(["feed", "story", "square"]);
app.put("/api/me/settings", async (req, res) => {
  const b = req.body || {};
  const settings: UserBrandSettings = {
    isPro: !!b.isPro,
    brandName: String(b.brandName || "").slice(0, 60),
    brandHandle: String(b.brandHandle || "").slice(0, 40),
    removeWatermark: !!b.removeWatermark,
    aspectRatio: ASPECTS.has(b.aspectRatio) ? b.aspectRatio : "feed",
  };
  try {
    await store.updateUser(req.uid!, (cur) => ({ ...(cur || newUserDoc()), brandSettings: settings, updatedAt: new Date().toISOString() }));
    res.json({ brandSettings: settings });
  } catch (err: any) {
    console.error("settings:", err);
    res.status(500).json({ error: "Could not save your settings." });
  }
});

const mediaUrl = (path: string) => `/api/media/${path}?s=${sessions.mediaSig(path)}`;
const toClientPost = (p: StoredPost): Post => {
  const { imagePath, createdAt, ...rest } = p;
  return { ...rest, ...(imagePath ? { imageUrl: mediaUrl(imagePath) } : {}) } as Post;
};

app.get("/api/me/posts", async (req, res) => {
  try {
    res.json({ posts: (await store.listPosts(req.uid!, 100)).map(toClientPost) });
  } catch (err: any) {
    console.error("posts:", err);
    res.status(500).json({ error: "Could not load your posts." });
  }
});

const PLATFORMS = new Set(["Twitter", "Instagram", "Facebook", "LinkedIn", "TikTok", "Threads"]);
const ANGLE_TYPES = new Set(["inspirational", "question", "informative", "humorous", "cta"]);
const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

app.post("/api/me/posts", async (req, res) => {
  const p = req.body?.post || {};
  if (!PLATFORMS.has(p.platform)) return res.status(400).json({ error: "Unknown platform." });
  const id = crypto.randomBytes(8).toString("hex");
  const post: StoredPost = {
    id,
    platform: p.platform,
    // A web address, or one of our built-in badges (shared/avatar.ts); anything else gets a badge on display.
    avatar: /^https:\/\/\S{1,490}$/.test(String(p.avatar || "")) || /^data:image\/svg\+xml;charset=utf-8,[^\s]{1,4000}$/.test(String(p.avatar || ""))
      ? String(p.avatar)
      : "",
    username: String(p.username || "").slice(0, 80),
    handle: String(p.handle || "").slice(0, 60),
    content: String(p.content || "").slice(0, 5000),
    captionAngles: Array.isArray(p.captionAngles)
      ? p.captionAngles
          .filter((a: any) => ANGLE_TYPES.has(a?.angle))
          .slice(0, 5)
          .map((a: any) => ({
            angle: a.angle,
            title: String(a.title || "").slice(0, 60),
            content: String(a.content || "").slice(0, 3000),
            hashtags: (Array.isArray(a.hashtags) ? a.hashtags : []).slice(0, 10).map((h: any) => String(h).slice(0, 50)),
          }))
      : undefined,
    activeAngle: ANGLE_TYPES.has(p.activeAngle) ? p.activeAngle : undefined,
    prompt: String(p.prompt || "").slice(0, 2000),
    likes: Math.max(0, Math.floor(Number(p.likes) || 0)),
    comments: Math.max(0, Math.floor(Number(p.comments) || 0)),
    shares: Math.max(0, Math.floor(Number(p.shares) || 0)),
    createdAt: new Date().toISOString(),
  };
  const image = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/s.exec(String(p.imageUrl || ""));
  try {
    if (image) {
      const data = Buffer.from(image[2], "base64");
      if (data.length > 8 * 1024 * 1024) return res.status(413).json({ error: "That image is too large to save (8 MB max)." });
      post.imagePath = `posts/${req.uid}/${id}.${IMAGE_TYPES[image[1]]}`;
      await media.put(post.imagePath, data, image[1]);
    }
    await store.addPost(req.uid!, post);
    res.json({ post: toClientPost(post), message: "Saved." });
  } catch (err: any) {
    console.error("save post:", err);
    res.status(500).json({ error: "Could not save your post." });
  }
});

app.get("/api/media/*path", async (req, res) => {
  const path = ([] as string[]).concat((req.params as any).path).join("/");
  if (!/^posts\/[a-f0-9]{32}\/[a-f0-9]{16}\.(png|jpg|webp)$/.test(path) || !sessions.mediaSigValid(path, req.query.s)) {
    return res.status(404).end();
  }
  try {
    const file = await media.get(path);
    if (!file) return res.status(404).end();
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.send(file.data);
  } catch (err: any) {
    console.error("media:", err);
    res.status(500).end();
  }
});

app.get("/api/me/personas", async (req, res) => {
  try {
    res.json({ personas: await store.listPersonas(req.uid!) });
  } catch (err: any) {
    console.error("personas:", err);
    res.status(500).json({ error: "Could not load your personas." });
  }
});

const MAX_PERSONAS = 30;
app.post("/api/me/personas", async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || "").trim().slice(0, 60);
  const promptFragment = String(b.promptFragment || "").trim().slice(0, 1000);
  if (!name || !promptFragment) return res.status(400).json({ error: "A persona needs a name and a voice description." });
  try {
    if ((await store.listPersonas(req.uid!)).length >= MAX_PERSONAS) {
      return res.status(400).json({ error: `You can save up to ${MAX_PERSONAS} personas.` });
    }
    const persona: Persona = {
      id: `custom-${crypto.randomBytes(6).toString("hex")}`,
      name,
      description: String(b.description || "").trim().slice(0, 300),
      promptFragment,
      avatar: avatarFor(name),
      category: "custom",
    };
    await store.addPersona(req.uid!, persona);
    res.json({ persona });
  } catch (err: any) {
    console.error("add persona:", err);
    res.status(500).json({ error: "Could not save the persona." });
  }
});

/** "Delete my data": settings, posts, post images and personas. */
app.delete("/api/me", async (req, res) => {
  try {
    await media.deletePrefix(`posts/${req.uid}/`);
    await store.deleteAccountsForUid(req.uid!);
    await store.deleteUnusedInvites(req.uid!);
    await store.deleteUser(req.uid!);
    memberCache.delete(req.uid!);
    res.json({ deleted: true });
  } catch (err: any) {
    console.error("delete me:", err);
    res.status(500).json({ error: "Could not delete your data. Please try again." });
  }
});

// ---------- Curated library: meaning search (Gemini embeddings) + JEV judge ----------

/** Meaning fingerprints for search. Null when embeddings aren't available, so callers fall back. */
async function embed(texts: string[], taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"): Promise<number[][] | null> {
  try {
    const r = await withRetry(() =>
      getAI().models.embedContent({ model: MODELS.embed, contents: texts, config: { taskType, outputDimensionality: 768 } })
    );
    const out = (r.embeddings || []).map((e) => e.values || []);
    return out.length === texts.length && out.every((v) => v.length) ? out : null;
  } catch (err: any) {
    console.error("embed:", err?.message || err);
    return null;
  }
}

/** The list and Wikiquote's view of who really said it. */
async function checkSource(p: LibraryPiece): Promise<SourceCheck> {
  const known = knownMisattribution(p.text, p.author);
  const wq = await checkWikiquote(p.text, p.author, WIKIQUOTE_BASE_URL);
  return { wikiquote: wq.result, ...(wq.url ? { url: wq.url } : {}), ...(known ? { known: known.truth } : {}), checkedAt: new Date().toISOString() };
}

/** Labels (JEV), checks sources and indexes (embeddings) a piece. `force` redoes all of it, after an edit. */
async function processPiece(piece: LibraryPiece, force = false): Promise<LibraryPiece> {
  const next = { ...piece };
  if (force || !next.labels) {
    const { labels } = applyLabels(await askJev(pieceState(next), labelQuestions()));
    if (labels) next.labels = labels;
  }
  // Flags are rebuilt from the labels each time, so a stricter rule reaches pieces labeled before it.
  next.flags = [...(next.labels ? labelFlags(next.labels) : [NOT_LABELED]), ...next.flags.filter(isSourceFlag)];
  if (needsSourceCheck(next) && (force || !next.sourceCheck || next.sourceCheck.wikiquote === "unavailable")) {
    next.sourceCheck = await checkSource(next);
    next.flags = [...next.flags.filter((f) => !isSourceFlag(f)), ...sourceFlags(next.sourceCheck)];
    // Wrongly credited: take it out of use until a person looks, unless they already vouched for it.
    if (next.status === "approved" && !next.sourceChecked && sourceSaysWrong(next.sourceCheck)) next.status = "pending";
  }
  if (force || !next.embedding) {
    const e = await embed([embedText(next)], "RETRIEVAL_DOCUMENT");
    if (e) next.embedding = e[0];
  }
  return next;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const n = i++;
        out[n] = await fn(items[n]);
      }
    })
  );
  return out;
}

// ---------- Curator (ADMIN_CODE): import, review, approve ----------

app.use("/api/admin", (req, res, next) => {
  if (!ADMIN_CODE) return res.status(404).json({ error: "Curating is switched off on this server." });
  if (!secretMatches(req.get("x-admin-code"), ADMIN_CODE)) return res.status(403).json({ error: "That curator code isn't right." });
  next();
});

const curatorPiece = (p: LibraryPiece) => {
  const { embedding, ...rest } = p;
  return { ...rest, indexed: !!embedding?.length, needsSourceCheck: needsSourceCheck(p) };
};
const STATUS_ORDER: Record<PieceStatus, number> = { pending: 0, approved: 1, rejected: 2 };
const needsWork = (p: LibraryPiece) => !p.embedding?.length || !p.labels || (needsSourceCheck(p) && !p.sourceCheck);

app.get("/api/admin/library", async (_req, res) => {
  try {
    const pieces = (await store.listLibrary()).sort(
      (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.createdAt.localeCompare(a.createdAt)
    );
    res.json({
      pieces: pieces.map(curatorPiece),
      waiting: pieces.filter((p) => p.status !== "rejected" && needsWork(p)).length,
      jev: jevConfigured(),
    });
  } catch (err: any) {
    console.error("admin library:", err);
    res.status(500).json({ error: "Could not load the library." });
  }
});

const cleanPiece = (raw: any) => ({
  text: String(raw?.text || "").trim().slice(0, 800),
  translation: String(raw?.translation || "").trim().slice(0, 800) || undefined,
  author: String(raw?.author || "").trim().slice(0, 120),
  source: String(raw?.source || "").trim().slice(0, 200) || undefined,
});

app.post("/api/admin/library", async (req, res) => {
  const raw = (Array.isArray(req.body?.pieces) ? req.body.pieces : []).slice(0, 100);
  const kind = KINDS.has(req.body?.kind) ? req.body.kind : "quote";
  const fresh: LibraryPiece[] = raw
    .map(cleanPiece)
    .filter((p: ReturnType<typeof cleanPiece>) => p.text && p.author)
    .map((p: ReturnType<typeof cleanPiece>) => ({
      ...p,
      id: `lib-${crypto.randomBytes(6).toString("hex")}`,
      kind,
      status: "pending" as const,
      flags: [],
      createdAt: new Date().toISOString(),
    }));
  if (!fresh.length) return res.status(400).json({ error: "Nothing to add. Each line needs the words and who said them." });
  try {
    const done = await mapLimit(fresh, 4, (p) => processPiece(p));
    await mapLimit(done, 8, (p) => store.putPiece(p));
    res.json({ added: done.length });
  } catch (err: any) {
    console.error("admin add:", err);
    res.status(500).json({ error: "Could not add those pieces." });
  }
});

app.post("/api/admin/library/process", async (_req, res) => {
  try {
    const todo = (await store.listLibrary()).filter((p) => p.status !== "rejected" && needsWork(p));
    const batch = todo.slice(0, 40);
    const done = await mapLimit(batch, 4, (p) => processPiece(p));
    await mapLimit(done, 8, (p) => store.putPiece(p));
    res.json({ processed: done.length, remaining: todo.length - batch.length, jev: jevConfigured() });
  } catch (err: any) {
    console.error("admin process:", err);
    res.status(500).json({ error: "Could not label and index the library." });
  }
});

app.patch("/api/admin/library/:id", async (req, res) => {
  try {
    const piece = await store.getPiece(String(req.params.id));
    if (!piece) return res.status(404).json({ error: "That piece isn't in the library." });
    const b = req.body || {};
    let next: LibraryPiece = { ...piece };
    const edits = cleanPiece({ ...piece, ...b });
    const changed = edits.text !== piece.text || edits.translation !== piece.translation || edits.author !== piece.author || edits.source !== piece.source;
    if (!edits.text || !edits.author) return res.status(400).json({ error: "A piece needs its words and who said them." });
    next = { ...next, ...edits };
    // The tick vouches for these exact words and credit: editing either clears it unless it's ticked again.
    if (typeof b.sourceChecked === "boolean") next.sourceChecked = b.sourceChecked;
    else if (edits.text !== piece.text || edits.author !== piece.author) next.sourceChecked = false;
    if (["pending", "approved", "rejected"].includes(b.status)) {
      next.status = b.status;
      next.reviewedAt = new Date().toISOString();
    }
    if (changed || (next.status === "approved" && needsWork(next))) {
      const status = next.status;
      next = await processPiece(next, changed);
      next.status = status; // what the curator just chose stands
    }
    await store.putPiece(next);
    res.json({ piece: curatorPiece(next) });
  } catch (err: any) {
    console.error("admin update:", err);
    res.status(500).json({ error: "Could not update that piece." });
  }
});

// ---------- Beta: sign-in, invites, waitlist ----------

const clientInvite = (i: { code: string; usedAt?: string; createdAt: string }) => ({ code: i.code, used: !!i.usedAt, createdAt: i.createdAt });

app.get("/api/me/status", async (req, res) => {
  try {
    const user = await store.getUser(req.uid!);
    res.json({ inviteOnly: INVITE_ONLY, member: !!user?.member, signedIn: !!user?.account, email: user?.account?.email || null, name: user?.account?.name || null });
  } catch (err: any) {
    console.error("status:", err);
    res.status(500).json({ error: "Could not load your account." });
  }
});

/**
 * Sign in with Google. The first time, the Google account is linked to this browser's user (so today's
 * progress is kept). On another device it switches to that same user: same posts and settings.
 */
app.post("/api/auth/google", async (req, res) => {
  const who = await verifyGoogle(req.body?.credential);
  if (!who) return res.status(401).json({ error: "Google sign-in didn't work. Please try again.", session: "kept" });
  try {
    const link = await store.linkAccount({ sub: who.sub, uid: req.uid!, email: who.email, name: who.name, linkedAt: new Date().toISOString() });
    const uid = link.uid;
    const founder = ADMIN_EMAILS.has(who.email);
    let starter = false;
    const user = await store.updateUser(uid, (cur) => {
      const base = cur || newUserDoc();
      const next: UserDoc = { ...base, account: { email: who.email, name: who.name }, updatedAt: new Date().toISOString() };
      if (founder && !base.member) {
        next.member = { since: new Date().toISOString(), invitedBy: "founder" };
        starter = true;
      }
      return next;
    });
    if (starter) await store.addInvites(Array.from({ length: STARTER_INVITES }, () => newInvite(uid)));
    if (user.member) memberCache.add(uid);
    res.json({
      member: !!user.member,
      email: who.email,
      name: who.name,
      ...(uid !== req.uid ? { token: sessions.tokenFor(uid) } : {}),
    });
  } catch (err: any) {
    console.error("google sign-in:", err);
    res.status(500).json({ error: "Could not sign you in. Please try again." });
  }
});

app.post("/api/invites/redeem", async (req, res) => {
  const code = normalizeCode(req.body?.code);
  if (!code) return res.status(400).json({ error: REDEEM_MESSAGES["not-found"] });
  try {
    const user = await store.getUser(req.uid!);
    if (user?.member) return res.json({ member: true });
    if (!user?.account) return res.status(400).json({ error: "Sign in with Google first, so your invite stays with you." });
    const { result, createdBy } = await store.redeemInvite(code, req.uid!);
    if (result !== "ok") return res.status(400).json({ error: REDEEM_MESSAGES[result] });
    await store.updateUser(req.uid!, (cur) => ({
      ...(cur || newUserDoc()),
      member: { since: new Date().toISOString(), invitedBy: createdBy || "admin" },
      updatedAt: new Date().toISOString(),
    }));
    await store.addInvites(Array.from({ length: STARTER_INVITES }, () => newInvite(req.uid!)));
    memberCache.add(req.uid!);
    res.json({ member: true });
  } catch (err: any) {
    console.error("redeem:", err);
    res.status(500).json({ error: "Could not use that invite. Please try again." });
  }
});

app.get("/api/me/invites", async (req, res) => {
  try {
    res.json({ invites: (await store.listInvites(req.uid!, 50)).map(clientInvite) });
  } catch (err: any) {
    console.error("my invites:", err);
    res.status(500).json({ error: "Could not load your invites." });
  }
});

app.post("/api/waitlist", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!isValidEmail(email)) return res.status(400).json({ error: "That email address doesn't look right." });
  if (overLimit(`waitlist:${req.ip}`, 5)) return res.status(429).json({ error: "Please wait a few minutes and try again." });
  try {
    const added = await store.addToWaitlist({ email, createdAt: new Date().toISOString() });
    res.json({ ok: true, already: !added });
  } catch (err: any) {
    console.error("waitlist:", err);
    res.status(500).json({ error: "Could not add you to the waitlist. Please try again." });
  }
});

// Curator: make codes, see members and the waitlist.
app.post("/api/admin/invites", async (req, res) => {
  const count = Math.max(1, Math.min(50, Math.floor(Number(req.body?.count) || 1)));
  const note = String(req.body?.note || "").trim().slice(0, 120) || undefined;
  try {
    const invites = Array.from({ length: count }, () => newInvite("admin", note));
    await store.addInvites(invites);
    res.json({ codes: invites.map((i) => i.code) });
  } catch (err: any) {
    console.error("admin invites:", err);
    res.status(500).json({ error: "Could not make invite codes." });
  }
});

app.get("/api/admin/beta", async (_req, res) => {
  try {
    const [accounts, invites, waitlist] = await Promise.all([store.listAccounts(200), store.listInvites("admin", 200), store.listWaitlist(500)]);
    const members = await mapLimit(accounts, 8, async (a) => {
      const user = await store.getUser(a.uid);
      return {
        name: a.name,
        email: a.email,
        signedUp: a.linkedAt,
        member: !!user?.member,
        since: user?.member?.since || null,
        invitedBy: user?.member?.invitedBy || null,
      };
    });
    const names = new Map(accounts.map((a) => [a.uid, a.name]));
    res.json({
      members: members.map((m) => ({ ...m, invitedBy: m.invitedBy && names.has(m.invitedBy) ? names.get(m.invitedBy) : m.invitedBy })),
      invites: invites.map((i) => ({ ...clientInvite(i), note: i.note || null })),
      waitlist,
    });
  } catch (err: any) {
    console.error("admin beta:", err);
    res.status(500).json({ error: "Could not load the beta." });
  }
});

app.post("/api/admin/waitlist/invite", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!isValidEmail(email)) return res.status(400).json({ error: "That email address doesn't look right." });
  try {
    const invite = newInvite("admin", `for ${email}`);
    await store.addInvites([invite]);
    await store.markWaitlistInvited(email, invite.code);
    res.json({ code: invite.code });
  } catch (err: any) {
    console.error("waitlist invite:", err);
    res.status(500).json({ error: "Could not make that invite." });
  }
});

// ---------- Images ----------

app.post("/api/generate-image", async (req, res) => {
  const prompt = String(req.body?.prompt || "").trim().slice(0, 2000);
  if (!prompt) return res.status(400).json({ error: "Please provide a prompt for the image." });
  if (!(await takeDaily(`img_${req.uid}`, IMAGE_DAILY_LIMIT))) {
    return res.status(429).json({ error: `You've made ${IMAGE_DAILY_LIMIT} images today, the daily limit. Come back tomorrow, or upload your own photo.` });
  }
  if (!(await takeDaily("img_all", GLOBAL_IMAGE_DAILY_LIMIT))) {
    return res.status(429).json({ error: "Inspire Daily has reached today's image limit. Please try again tomorrow, or upload your own photo." });
  }
  try {
    const ai = getAI();
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: MODELS.image,
        // Vertex AI rejects a turn without a role, and may answer in text only unless asked for an image.
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { responseModalities: ["TEXT", "IMAGE"] },
      })
    );
    let textReply = "";
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) {
        return res.json({ image: `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}` });
      }
      if (part.text && !textReply) textReply = part.text;
    }
    return res.status(502).json({ error: `The image model returned no image.${textReply ? ` It said: "${textReply.slice(0, 200)}"` : ""}` });
  } catch (err: any) {
    console.error("generate-image:", err);
    const e = friendlyError(err, "Failed to generate an image.");
    return res.status(e.status).json({ error: e.error });
  }
});

// ---------- Captions (5 angles in a persona's voice) ----------

const postSchema = {
  type: Type.OBJECT,
  properties: {
    username: { type: Type.STRING },
    handle: { type: Type.STRING },
    avatar: { type: Type.STRING },
    content: { type: Type.STRING, description: "Primary inspirational post caption" },
    captionAngles: {
      type: Type.ARRAY,
      description: "5 distinct social media captions for this image across different angles: inspirational, question, informative, humorous, and cta",
      items: {
        type: Type.OBJECT,
        properties: {
          angle: { type: Type.STRING, description: "One of: inspirational, question, informative, humorous, cta" },
          title: { type: Type.STRING, description: "Name of the angle e.g. Question-Based, Informative, Humorous, Inspirational, Call to Action" },
          content: { type: Type.STRING, description: "The caption text formatted for the platform" },
          hashtags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3 to 6 relevant hashtags" },
        },
        required: ["angle", "title", "content", "hashtags"],
      },
    },
  },
  required: ["username", "handle", "avatar", "content", "captionAngles"],
};

const ANGLES_FOR_PROMPT = `Each of the 5 captions MUST have a distinct angle and purpose:
1. "inspirational": Uplifting, motivational, philosophical, or profound caption.
2. "question": Question-based angle. Hooks the reader with a thought-provoking question to maximize comments, replies, and community discussion.
3. "informative": Value-driven, instructional, structured takeaways, or behind-the-scenes insight.
4. "humorous": Relatable, witty, lighthearted, clever, or self-aware take on the visual.
5. "cta": Call to Action angle. Drives a specific action (e.g. save for later, share with a friend, tag someone, comment below).`;

const clean = (v: unknown, max: number) => String(v ?? "").slice(0, max);

app.post("/api/generate-post", async (req, res) => {
  const { mode, mediaPrompt, image, persona, platform, inspirationLevel } = req.body || {};
  if (!persona?.name) return res.status(400).json({ error: "Pick a persona first." });
  if (!(await takeDaily(`cap_${req.uid}`, CAPTION_DAILY_LIMIT))) {
    return res.status(429).json({ error: `You've written ${CAPTION_DAILY_LIMIT} posts today, the daily limit. Come back tomorrow!` });
  }
  const personaLine = `Persona: ${clean(persona.name, 120)} (${clean(persona.promptFragment, 2000)})
Intensity level: ${Math.max(1, Math.min(10, Number(inspirationLevel) || 5))}/10.`;
  const plat = clean(platform, 40) || "Instagram";

  let parts: any[];
  if (mode === "upload") {
    const match = /^data:([^;]+);base64,(.+)$/s.exec(String(image || ""));
    if (!match) return res.status(400).json({ error: "Upload an image first." });
    parts = [
      { inlineData: { mimeType: match[1], data: match[2] } },
      {
        text: `You are an AI for "Inspire Daily", a social media content machine.
Analyze this uploaded image carefully.

TASK:
Write 5 distinct social media captions for this image, tailored specifically for "${plat}", written in the voice of the persona:
${personaLine}

${ANGLES_FOR_PROMPT}

Include 3 to 6 targeted, high-performing hashtags for each caption suitable for ${plat}.
Return JSON matching the schema.`,
      },
    ];
  } else {
    parts = [
      {
        text: `You are an AI for "Inspire Daily", a high-end social media content machine.
An image was created from the prompt: "${clean(mediaPrompt, 2000)}".

TASK:
Write 5 distinct social media captions for this visual, tailored specifically for the platform "${plat}", written from the perspective and tone of the persona:
${personaLine}

${ANGLES_FOR_PROMPT}

Include 3 to 6 targeted, high-performing hashtags for each caption suitable for ${plat}.
Return JSON matching the schema.`,
      },
    ];
  }

  try {
    const ai = getAI();
    const contents = [{ role: "user", parts }];
    const config = { responseMimeType: "application/json", responseSchema: postSchema };
    const response = await withRetry(async () => {
      try {
        return await ai.models.generateContent({ model: MODELS.text, contents, config });
      } catch (err: any) {
        if (isBusy(err)) return await ai.models.generateContent({ model: MODELS.textFallback, contents, config });
        throw err;
      }
    });
    return res.json(JSON.parse(response.text || "{}"));
  } catch (err: any) {
    console.error("generate-post:", err);
    const e = friendlyError(err, "Failed to write the captions.");
    return res.status(e.status).json({ error: e.error });
  }
});


// ---------- App ----------

async function start() {
  if (process.env.NODE_ENV === "production") {
    const dist = path.resolve(__dirname, "dist");
    app.use(express.static(dist));
    app.get("/{*splat}", (_req, res) => res.sendFile(path.join(dist, "index.html")));
  } else {
    const { createServer } = await import("vite");
    const vite = await createServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  }
  app
    .listen(PORT, "0.0.0.0", () => {
      console.log(`Inspire Daily listening on http://0.0.0.0:${PORT}`);
      console.log(`AI mode: ${USE_VERTEX ? `Vertex AI (project ${process.env.GOOGLE_CLOUD_PROJECT || "NOT SET"})` : "Gemini API key"}`);
      if (!USE_VERTEX && !(process.env.GEMINI_API_KEY || process.env.API_KEY)) console.warn("No GEMINI_API_KEY set: AI calls will fail.");
      if (!APP_PASSCODE) console.warn("APP_PASSCODE is not set: anyone with the link can use the AI.");
    })
    .on("error", (err: any) => {
      if (err?.code === "EADDRINUSE") console.error(`Port ${PORT} is already in use. Stop the other copy first.`);
      else console.error(err);
      process.exit(1);
    });
}

start();
