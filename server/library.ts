// The curated library and the rules around it. Pure functions only (no network), so they can be
// unit-tested. server.ts does the calls to Gemini (embeddings, writer) and JEV (the judge).
import { noul, choice, pTrue, type JevAnswer, type JevQuestion } from "./jev";
import type { TimelessQuote } from "../data/quotesDatabase";
import type { SourceCheck } from "./sources";

export type PieceKind = "quote" | "proverb" | "own" | "teaching";
export type PieceStatus = "pending" | "approved" | "rejected";

export interface PieceLabels {
  theme?: string;
  mood?: string;
  /** Probabilities (0..1) from JEV. */
  prediction?: number;
  preachy?: number;
  attribution?: number;
}

export interface LibraryPiece {
  id: string;
  text: string;
  translation?: string;
  author: string;
  source?: string;
  kind: PieceKind;
  status: PieceStatus;
  labels?: PieceLabels;
  /** Reasons a curator should look twice. */
  flags: string[];
  embedding?: number[];
  /** What the misattribution list and Wikiquote said about who really said it. */
  sourceCheck?: SourceCheck;
  /** A person checked the source and vouches for the credit. Needed before bulk approval of named quotes. */
  sourceChecked?: boolean;
  createdAt: string;
  reviewedAt?: string;
}

export const THEMES: Record<string, string> = {
  resilience: "Getting through hardship, setbacks, starting again",
  grief: "Loss, mourning, missing someone",
  courage: "Facing fear, taking a step",
  focus: "Stillness, attention, peace of mind, worry",
  love: "Love, family, friendship, kindness",
  work: "Effort, patience, discipline, diligence",
  purpose: "Meaning, direction, who you are, where you came from",
  hope: "Hope, faith, a better tomorrow without promising one",
  humility: "Humility, character, being a good person",
};

export const MOODS: Record<string, string> = {
  anxious: "Worried, stressed, overthinking",
  tired: "Exhausted, burnt out, unseen effort",
  lost: "Unsure of direction or self",
  sad: "Down, lonely, grieving",
  angry: "Frustrated, wronged, resentful",
  afraid: "Scared to act or change",
  hopeful: "Doing well, wants to keep going",
};

export const KINDS = new Set<PieceKind>(["quote", "proverb", "own", "teaching"]);

// ---------- Safety ----------

// The hard gate in code. JEV is a second check; this one needs no network and never sleeps.
const CRISIS_PATTERNS = [
  /\bkill(ing)?\s+my\s*self\b/i,
  /\bsuicid/i,
  /\bend(ing)?\s+(it\s+all|my\s+life)\b/i,
  /\b(want|wanna|going)\s+to\s+die\b/i,
  /\bdon'?t\s+want\s+to\s+(live|be\s+alive|wake\s+up)\b/i,
  /\bno\s+reason\s+to\s+live\b/i,
  /\bself[-\s]?harm/i,
  /\b(cut|hurt)(ting)?\s+my\s*self\b/i,
  /\bbetter\s+off\s+(dead|without\s+me)\b/i,
  /\bkill\s+(him|her|them|someone)\b/i,
  /\bmagpakamatay\b/i,
  /\bpatayin\s+ko\s+(ang\s+)?sarili\b/i,
  /\bayoko\s+(nang?\s+)?(ng\s+)?mabuhay\b/i,
  /\bgusto\s+ko\s+(nang?\s+)?(ng\s+)?mamatay\b/i,
  /\bwala\s+nang\s+(saysay|silbi)\s+(ang\s+)?(buhay|mabuhay)\b/i,
];

export const looksLikeCrisis = (text: string) => CRISIS_PATTERNS.some((re) => re.test(text));

export const CRISIS_RESPONSE = {
  crisis: true,
  message:
    "It sounds like you're carrying something very heavy right now. You deserve to talk with a real person who can help, today. You don't have to go through this alone.",
  resources: [
    { name: "NCMH Crisis Hotline (Philippines)", contact: "Call 1553, 24/7" },
    { name: "Emergency (Philippines)", contact: "Call 911" },
    { name: "Outside the Philippines", contact: "findahelpline.com lists free, confidential lines" },
  ],
};

// ---------- JEV questions ----------

export const pieceState = (p: Pick<LibraryPiece, "text" | "translation" | "author" | "source">) =>
  [`Quote: ${p.text}`, p.translation ? `Translation: ${p.translation}` : "", `Credited to: ${p.author}`, p.source ? `Source: ${p.source}` : ""]
    .filter(Boolean)
    .join("\n");

export const labelQuestions = (): Record<string, JevQuestion> => ({
  theme: choice("Which one theme does this quote speak to most?", THEMES),
  mood: choice("Which feeling would this quote help most?", MOODS),
  prediction: noul(
    "Does the quote predict the future, or claim fate, luck, the stars or the universe will decide what happens?",
    "Makes a prediction or a fortune-telling claim",
    "Offers wisdom without predicting anything"
  ),
  preachy: noul(
    "Does the quote shame, scold or talk down to someone who is struggling?",
    "Shaming, scolding or condescending",
    "Kind, or neutral wisdom"
  ),
  attribution: noul(
    "Is the quote genuinely from the credited person or tradition, and not a well-known misattribution or a modern paraphrase?",
    "Genuinely theirs (or a traditional proverb credited as such)",
    "Misattributed, invented, or a paraphrase presented as their words"
  ),
});

/** Turns JEV's answers into labels and curator flags. */
export function applyLabels(answers: Record<string, JevAnswer> | null): { labels?: PieceLabels; flags: string[] } {
  if (!answers) return { flags: [NOT_LABELED] };
  const labels: PieceLabels = {
    theme: answers.theme?.choice && answers.theme.choice in THEMES ? answers.theme.choice : undefined,
    mood: answers.mood?.choice && answers.mood.choice in MOODS ? answers.mood.choice : undefined,
    prediction: pTrue(answers.prediction) ?? undefined,
    preachy: pTrue(answers.preachy) ?? undefined,
    attribution: pTrue(answers.attribution) ?? undefined,
  };
  return { labels, flags: labelFlags(labels) };
}

export const NOT_LABELED = "Not labeled yet (JEV unavailable)";

/** Curator flags for a piece's labels. */
export function labelFlags(labels: PieceLabels): string[] {
  const flags: string[] = [];
  if ((labels.prediction ?? 0) >= 0.5) flags.push("Sounds like a prediction or fortune-telling");
  if ((labels.preachy ?? 0) >= 0.5) flags.push("May sound preachy or shaming");
  // Famous misattributions sound genuine to a model, so anything short of confident gets a human look.
  if (labels.attribution !== undefined && labels.attribution < 0.8) flags.push("Check who really said this");
  return flags;
}

export const readQuestions = (): Record<string, JevQuestion> => ({
  crisis: noul(
    "Does the person describe thoughts of suicide, self-harm, harming someone else, or being in immediate danger?",
    "Yes: suicide, self-harm, harm to others, or danger",
    "No: an ordinary hard feeling or situation"
  ),
  mood: choice("Which feeling best describes the person right now?", MOODS),
  theme: choice("Which theme would help the person most?", THEMES),
});

export const fitState = (text: string, candidates: LibraryPiece[]) =>
  `What the person wrote:\n${text}\n\nPassages:\n${candidates
    .map((p, i) => `[${i + 1}] ${p.text}${p.translation ? ` (${p.translation})` : ""} — ${p.author}`)
    .join("\n")}`;

export const fitQuestions = (count: number): Record<string, JevQuestion> =>
  Object.fromEntries(
    Array.from({ length: count }, (_, i) => [
      `fit_${i + 1}`,
      noul(
        `Does passage [${i + 1}] speak directly to what the person wrote, in a way that would comfort or help them?`,
        "A close, helpful fit",
        "Off-topic, or would not help"
      ),
    ])
  );

export const checkState = (feeling: string, reply: string, pieces: LibraryPiece[]) =>
  `What the person wrote:\n${feeling}\n\nReply:\n${reply}\n\nThe only passages it may quote:\n${pieces
    .map((p) => `- "${p.text}"${p.translation ? ` (${p.translation})` : ""} — ${p.author}`)
    .join("\n")}`;

export const checkQuestions = (): Record<string, JevQuestion> => ({
  predicts: noul(
    "Does the reply predict the future, or claim fate, luck, the stars or the universe has a plan for the person?",
    "Predicts or tells fortunes",
    "No predictions"
  ),
  promises: noul(
    "Does the reply promise that things will definitely turn out well or that a problem will be solved?",
    "Makes a promise about the outcome",
    "Encourages without promising"
  ),
  sells: noul(
    "Does the reply encourage buying, paying, upgrading or subscribing to anything?",
    "Sells or upsells",
    "No selling"
  ),
  clinical: noul(
    "Does the reply diagnose the person or give medical or psychiatric advice?",
    "Diagnoses or gives medical advice",
    "No clinical advice"
  ),
  misreads: noul(
    "Does the reply talk about itself as if it had been asked how it is (for example \"I'm doing well, thanks for asking\"), or describe the person as struggling when they said they are okay?",
    "Talks about itself, or misreads how the person feels",
    "Speaks to the person and matches how they said they feel"
  ),
  misquotes: noul(
    "Does the reply quote words that are not in the listed passages, or credit a passage to the wrong person?",
    "Contains an invented or wrongly credited quote",
    "Quotes only the listed passages, correctly credited"
  ),
});

/** Names of the checks the draft failed (probability 0.5 or more). */
export const failedChecks = (answers: Record<string, JevAnswer>) =>
  Object.entries(answers)
    .filter(([, a]) => (pTrue(a) ?? 0) >= 0.5)
    .map(([k]) => k);

// ---------- Hard gate: every quotation in the reply must come from the chosen pieces ----------

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[‘’“”'"]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** True when every quoted passage of 4+ words in `reply` appears in one of the pieces. */
export function quotesAreReal(reply: string, pieces: LibraryPiece[]): boolean {
  const sources = pieces.map((p) => norm(`${p.text} ${p.translation || ""}`));
  const quoted = [...reply.matchAll(/["“]([^"“”]+)["”]/g)].map((m) => norm(m[1]));
  return quoted.filter((q) => q.split(" ").length >= 4).every((q) => sources.some((s) => s.includes(q)));
}

// ---------- Meaning search ----------

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

const words = (s: string) => new Set(norm(s).split(" ").filter((w) => w.length > 3));

/**
 * Ranks approved pieces for what the person wrote: meaning (embeddings) first, nudged by the
 * mood and theme JEV read. Without embeddings it falls back to shared words and labels.
 */
export function rankPieces(
  pieces: LibraryPiece[],
  query: { text: string; embedding?: number[]; mood?: string; theme?: string },
  limit: number
): LibraryPiece[] {
  const qWords = words(query.text);
  return pieces
    .map((p) => {
      let score = 0;
      if (query.embedding && p.embedding) score = cosine(query.embedding, p.embedding);
      else {
        const pw = words(`${p.text} ${p.translation || ""}`);
        score = [...qWords].filter((w) => pw.has(w)).length * 0.1;
      }
      if (query.mood && p.labels?.mood === query.mood) score += 0.05;
      if (query.theme && p.labels?.theme === query.theme) score += 0.05;
      return { p, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);
}

/** The text a piece is searched by. */
export const embedText = (p: Pick<LibraryPiece, "text" | "translation" | "author">) =>
  `${p.text}${p.translation ? `\n${p.translation}` : ""}\n— ${p.author}`;

// ---------- Starter pieces (all start "pending": the curator approves what gets used) ----------

const now = () => new Date().toISOString();

const fromQuote = (q: TimelessQuote): LibraryPiece => ({
  id: `lib-${q.id}`,
  text: q.originalQuote,
  author: q.author,
  source: q.context,
  kind: "quote",
  status: "pending",
  flags: [],
  createdAt: now(),
});

const SALAWIKAIN: Array<[string, string, string]> = [
  ["p-1", "Ang hindi lumingon sa pinanggalingan ay hindi makararating sa paroroonan.", "Whoever does not look back at where they came from will not reach where they are going."],
  ["p-2", "Kapag may tiyaga, may nilaga.", "Where there is perseverance, there is reward."],
  ["p-3", "Habang may buhay, may pag-asa.", "While there is life, there is hope."],
  ["p-4", "Ang lumalakad nang matulin, kung matinik ay malalim.", "Whoever walks too fast is pricked deeply by the thorn."],
  ["p-5", "Nasa Diyos ang awa, nasa tao ang gawa.", "Mercy is God's; the work is ours."],
  ["p-6", "Kapag may isinuksok, may madudukot.", "What you set aside today, you can reach for tomorrow."],
  ["p-7", "Ang sakit ng kalingkingan, damdam ng buong katawan.", "The pain of the little finger is felt by the whole body."],
  ["p-8", "Daig ng maagap ang masipag.", "The one who prepares beats the one who only works hard."],
  ["p-9", "Hindi lahat ng kumikinang ay ginto.", "Not everything that glitters is gold."],
  ["p-10", "Kung ano ang itinanim, siya ring aanihin.", "What you plant is what you will harvest."],
  ["p-11", "Madaling maging tao, mahirap magpakatao.", "It is easy to be human, hard to be humane."],
  ["p-12", "Pagkahaba-haba man ng prusisyon, sa simbahan din ang tuloy.", "However long the procession, it still ends at the church."],
];

export const starterPieces = (quotes: TimelessQuote[]): LibraryPiece[] => [
  ...quotes.map(fromQuote),
  ...SALAWIKAIN.map(([id, text, translation]) => ({
    id: `lib-${id}`,
    text,
    translation,
    author: "Filipino proverb (salawikain)",
    kind: "proverb" as const,
    status: "pending" as const,
    flags: [],
    createdAt: now(),
  })),
];
