// Accounts, invites and the waitlist for the invite-only beta. Pure rules only; server.ts does the
// Google sign-in check and the database calls.
import crypto from "crypto";

/** A Google account, linked to one Inspire user id (the anonymous id it first signed in from). */
export interface AccountDoc {
  sub: string; // Google's stable account id
  uid: string;
  email: string;
  name: string;
  linkedAt: string;
}

export interface InviteDoc {
  code: string;
  /** A user id, or "admin" for codes the curator made. */
  createdBy: string;
  createdAt: string;
  usedBy?: string;
  usedAt?: string;
  /** For curator codes sent to someone on the waitlist. */
  note?: string;
}

export interface WaitlistDoc {
  email: string;
  createdAt: string;
  invitedCode?: string;
}

/** What a member's user record carries (on UserDoc.member). */
export interface Membership {
  since: string;
  invitedBy: string; // "admin", "founder" or the inviter's user id
}

export const STARTER_INVITES = 3;

// No 0/O, 1/I/L: codes get read aloud and typed on phones.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const pick = (n: number) => Array.from(crypto.randomBytes(n), (b) => ALPHABET[b % ALPHABET.length]).join("");

export const makeCode = () => `INSP-${pick(4)}-${pick(2)}`;

/** Accepts "insp 7k2q m9", "INSP-7K2Q-M9", "7k2qm9"… and returns the canonical form, or null. */
export function normalizeCode(input: unknown): string | null {
  const raw = String(input ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^INSP/, "");
  if (raw.length !== 6 || [...raw].some((c) => !ALPHABET.includes(c))) return null;
  return `INSP-${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export const normalizeEmail = (input: unknown) => String(input ?? "").trim().toLowerCase().slice(0, 254);
export const isValidEmail = (email: string) => /^[^\s@/]+@[^\s@/]+\.[^\s@/]{2,}$/.test(email);

/** Comma-separated ADMIN_EMAILS → a set of normalized addresses. */
export const parseAdminEmails = (value: string | undefined) =>
  new Set((value || "").split(",").map(normalizeEmail).filter(Boolean));

export type RedeemResult = "ok" | "not-found" | "used" | "own";

/** Whether `uid` may use this invite. */
export function checkRedeem(invite: InviteDoc | null, uid: string): RedeemResult {
  if (!invite) return "not-found";
  if (invite.usedBy) return invite.usedBy === uid ? "ok" : "used";
  if (invite.createdBy === uid) return "own";
  return "ok";
}

export const REDEEM_MESSAGES: Record<Exclude<RedeemResult, "ok">, string> = {
  "not-found": "That invite code isn't right. Check it and try again.",
  used: "That invite code has already been used. Ask your friend for another one.",
  own: "That's one of your own invites. Share it with a friend instead.",
};


export const newInvite = (createdBy: string, note?: string): InviteDoc => ({
  code: makeCode(),
  createdBy,
  createdAt: new Date().toISOString(),
  ...(note ? { note } : {}),
});
