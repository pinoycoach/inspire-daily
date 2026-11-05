// Checking who really said a quote. JEV judges from memory, and famous misattributions sound genuine to
// it, so two checks run first: a hand-kept list of well-known misattributions (no network) and a lookup
// on Wikiquote, which sorts each person's page into sourced quotes and "Misattributed"/"Disputed" ones.
// Neither replaces the curator: named quotes still need a person's "source checked" tick.
import type { LibraryPiece } from "./library";

/** Lowercase words only: no punctuation, quotes, dashes or wiki markup. */
export const normalizeWords = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export interface Misattribution {
  /** A distinctive run of words from the quote (normalized when matched). */
  fragment: string;
  /** Who it's wrongly credited to. */
  credited: RegExp;
  /** Where it really comes from, in plain words. */
  truth: string;
  /** A credit naming the real source (e.g. "John Anster, after Goethe") is correct, not a misattribution. */
  real?: RegExp;
}

export const MISATTRIBUTIONS: Misattribution[] = [
  { fragment: "crazy enough to think they can change the world", credited: /steve jobs|\bjobs\b/i, truth: "Apple's 1997 “Think Different” ad, written by its agency", real: /apple|think different|chiat|siltanen|segall/i },
  { fragment: "whatever you can do or dream you can begin it", credited: /goethe/i, truth: "John Anster's loose 1835 rendering of Faust, not Goethe's text", real: /anster|murray/i },
  { fragment: "every great dream begins with a dreamer", credited: /tubman/i, truth: "no record of Harriet Tubman saying it; it appears only in recent decades" },
  { fragment: "doing the same thing over and over", credited: /einstein/i, truth: "first found in Narcotics Anonymous literature (1981), not Einstein", real: /narcotics anonymous/i },
  { fragment: "be the change you wish to see", credited: /gandhi/i, truth: "a modern paraphrase; Gandhi wrote something longer and different" },
  { fragment: "twenty years from now you will be more disappointed", credited: /twain|clemens/i, truth: "H. Jackson Brown Jr.'s book (1990), not Mark Twain", real: /jackson brown/i },
  { fragment: "only thing necessary for the triumph of evil", credited: /burke/i, truth: "not found in Edmund Burke's writings" },
  { fragment: "be yourself everyone else is already taken", credited: /wilde/i, truth: "no source in Oscar Wilde's writings" },
  { fragment: "not what happens to you but how you react", credited: /epictetus/i, truth: "a modern paraphrase of Enchiridion 5" },
  { fragment: "simplicity is the ultimate sophistication", credited: /leonardo|da vinci/i, truth: "not found in Leonardo's notebooks" },
  { fragment: "in the midst of chaos there is also opportunity", credited: /sun tzu|sunzi/i, truth: "not in The Art of War" },
  { fragment: "well behaved women seldom make history", credited: /monroe|roosevelt/i, truth: "historian Laurel Thatcher Ulrich (1976)", real: /ulrich/i },
  { fragment: "do not go where the path may lead", credited: /emerson/i, truth: "no source in Emerson's writings" },
];

/** The list entry this quote matches when credited to the wrong person, or null. */
export function knownMisattribution(text: string, author: string): Misattribution | null {
  const words = ` ${normalizeWords(text)} `;
  return (
    MISATTRIBUTIONS.find(
      (m) => m.credited.test(author) && !m.real?.test(author) && words.includes(` ${normalizeWords(m.fragment)} `)
    ) || null
  );
}

// ---------- Wikiquote ----------

/**
 * found: on the person's page among sourced quotes. unsourced: listed under "Attributed" or "Disputed".
 * misattributed: listed under "Misattributed". not-found: no page, or not on it. unavailable: couldn't ask.
 */
export type WikiquoteResult = "found" | "unsourced" | "misattributed" | "not-found" | "unavailable";

export interface SourceCheck {
  wikiquote: WikiquoteResult;
  url?: string;
  /** The known-misattribution note, when the list matched. */
  known?: string;
  checkedAt: string;
}

/** "Seneca (4 BC–65 AD)" → "Seneca". */
export const authorName = (author: string) => author.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();

/** Only quotes and teachings credited to a person get checked; proverbs and own writing don't. */
export const needsSourceCheck = (p: Pick<LibraryPiece, "kind" | "author">) =>
  (p.kind === "quote" || p.kind === "teaching") && !!authorName(p.author) && !/\b(proverb|salawikain|traditional|unknown|anonymous)\b/i.test(p.author);

/** Phrases to look for: the first words of each part of the quote (parts split at "…"). */
function searchPhrases(text: string): string[] {
  return text
    .split(/\.\.\.|…/)
    .map((part) => normalizeWords(part).split(" ").filter(Boolean))
    .filter((w) => w.length >= 4)
    .map((w) => w.slice(0, 8).join(" "));
}

/** Strips the wiki markup that would hide a match: links, bold/italics, refs and templates. */
const plainWikitext = (s: string) =>
  s
    .replace(/<ref[^>]*\/>/gi, " ")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, " ")
    .replace(/\{\{[^{}]*\}\}/g, " ")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/'{2,}/g, "");

/** Where on the page (by its top-level section) the quote appears. Pure, so it can be tested. */
export function classifyWikiquote(wikitext: string, text: string): Exclude<WikiquoteResult, "unavailable"> {
  const phrases = searchPhrases(text);
  if (!phrases.length) return "not-found";
  let top = "";
  const sections: Array<{ heading: string; body: string[] }> = [{ heading: "", body: [] }];
  for (const line of wikitext.split("\n")) {
    const h = line.match(/^(={2,6})\s*(.*?)\s*\1\s*$/);
    if (h) {
      // "Disputed" or "Misattributed" can sit one level down; other subheadings belong to their top section.
      if (h[1].length === 2) top = h[2];
      sections.push({ heading: h[1].length === 2 || /misattribut|disputed|attributed/i.test(h[2]) ? h[2] : top, body: [] });
    } else sections[sections.length - 1].body.push(line);
  }
  let best: Exclude<WikiquoteResult, "unavailable"> = "not-found";
  for (const s of sections) {
    const body = ` ${normalizeWords(plainWikitext(s.body.join("\n")))} `;
    if (!phrases.some((p) => body.includes(` ${p} `))) continue;
    if (/misattribut/i.test(s.heading)) return "misattributed";
    if (/disputed|attributed|unsourced/i.test(s.heading)) best = "unsourced";
    else if (/about\b/i.test(s.heading)) continue; // "Quotes about X" are other people's words
    else if (best === "not-found") best = "found";
  }
  return best;
}

// Wikimedia asks API users to go slowly and to say who they are. One lookup at a time.
const USER_AGENT = "InspireEngine/1.0 (https://github.com/pinoycoach/inspire-build-ship-release; quote source check)";
let queue: Promise<unknown> = Promise.resolve();
const oneAtATime = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
};

/** Looks the quote up on the author's Wikiquote page. `base` empty or "off" turns the lookup off. */
export async function checkWikiquote(
  text: string,
  author: string,
  base: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ result: WikiquoteResult; url?: string }> {
  if (!base || base === "off") return { result: "unavailable" };
  const title = authorName(author).replace(/ /g, "_");
  const url = `${base.replace(/\/$/, "")}/wiki/${encodeURIComponent(title)}`;
  const api = `${base.replace(/\/$/, "")}/w/api.php?action=parse&format=json&formatversion=2&redirects=1&prop=wikitext&page=${encodeURIComponent(title)}`;
  return oneAtATime(async () => {
    try {
      const r = await fetchImpl(api, { headers: { "User-Agent": USER_AGENT, "Api-User-Agent": USER_AGENT }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) return { result: "unavailable" as const };
      const data: any = await r.json();
      if (data?.error?.code === "missingtitle") return { result: "not-found" as const };
      const wikitext = data?.parse?.wikitext;
      if (typeof wikitext !== "string") return { result: "unavailable" as const };
      return { result: classifyWikiquote(wikitext, text), url };
    } catch {
      return { result: "unavailable" as const };
    }
  });
}

const KNOWN_PREFIX = "Known misattribution: ";
const WQ_MISATTRIBUTED = "Wikiquote lists this as misattributed";
const WQ_UNSOURCED = "Wikiquote lists this as disputed or unsourced";

/** True for the flags this module adds, so a re-check can replace them. */
export const isSourceFlag = (f: string) => f.startsWith(KNOWN_PREFIX) || f === WQ_MISATTRIBUTED || f === WQ_UNSOURCED;

/** Curator flags for a source check. "not-found" and "unavailable" aren't flagged: the human tick covers them. */
export function sourceFlags(check: SourceCheck): string[] {
  const flags: string[] = [];
  if (check.known) flags.push(`${KNOWN_PREFIX}${check.known}`);
  if (check.wikiquote === "misattributed") flags.push(WQ_MISATTRIBUTED);
  if (check.wikiquote === "unsourced") flags.push(WQ_UNSOURCED);
  return flags;
}

/** A check found it's not theirs: an approved piece goes back to review unless a person already vouched for it. */
export const sourceSaysWrong = (check: SourceCheck) => !!check.known || check.wikiquote === "misattributed";
