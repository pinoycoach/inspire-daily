// Today's three: picked from approved library pieces only, saved once per day so the archive never changes.

export interface DayPiece {
  id: string;
  text: string;
  translation?: string;
  author: string;
  source?: string;
  kind: string;
}

/** One day's cards, frozen when first shown: later edits to the library don't rewrite the past. */
export interface DayDoc {
  day: string; // YYYY-MM-DD
  pieces: DayPiece[];
  createdAt: string;
}

export const CARDS_PER_DAY = 3;

/** The calendar date in a time zone, as YYYY-MM-DD. */
export const dayIn = (timeZone: string, date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

export const isDay = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

type Candidate = DayPiece & { reviewedAt?: string; createdAt: string };

/**
 * Picks the day's pieces. New pieces come first, in the order they were approved, so whatever the
 * curator approves shows up within days. Once everything has been shown, the least recently shown
 * pieces come back around. Never repeats a piece within one day.
 */
export function pickForDay(approved: Candidate[], pastDays: DayDoc[], n = CARDS_PER_DAY): DayPiece[] {
  const lastShown = new Map<string, string>();
  for (const d of pastDays) for (const p of d.pieces) if (!lastShown.has(p.id) || lastShown.get(p.id)! < d.day) lastShown.set(p.id, d.day);
  const approvedAt = (p: Candidate) => p.reviewedAt || p.createdAt;
  const fresh = approved.filter((p) => !lastShown.has(p.id)).sort((a, b) => approvedAt(a).localeCompare(approvedAt(b)) || a.id.localeCompare(b.id));
  const shown = approved
    .filter((p) => lastShown.has(p.id))
    .sort((a, b) => lastShown.get(a.id)!.localeCompare(lastShown.get(b.id)!) || a.id.localeCompare(b.id));
  return [...fresh, ...shown].slice(0, n).map(({ id, text, translation, author, source, kind }) => ({
    id,
    text,
    ...(translation ? { translation } : {}),
    author,
    ...(source ? { source } : {}),
    kind,
  }));
}
