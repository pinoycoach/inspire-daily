// JEV (TypeSafe) is the judge: give it some text and fixed-answer questions ("which theme?",
// "yes/no: does this predict the future?") and it answers each with a probability or a choice.
// It never writes anything. Only this server calls it, with JEV_API_KEY.

export type JevQuestion =
  | { type: "noul"; instructions: string; criteria: { true: string; false: string } }
  | { type: "choice"; instructions: string; criteria: Record<string, string> };

export type JevAnswer = { type?: string; choice?: string; noul?: number; confidence?: number };

export const noul = (instructions: string, yes: string, no: string): JevQuestion => ({
  type: "noul",
  instructions,
  criteria: { true: yes, false: no },
});

export const choice = (instructions: string, criteria: Record<string, string>): JevQuestion => ({
  type: "choice",
  instructions,
  criteria,
});

const JEV_URL = `${(process.env.JEV_BASE_URL || "https://api.typesafe.ai").replace(/\/$/, "")}/v1/systemone`;
const JEV_MODEL = process.env.JEV_MODEL || "jev-latest";

export const jevConfigured = () => (process.env.JEV_API_KEY || "").trim().length >= 8;

/** Asks JEV the questions about `state`. Returns null when JEV isn't set up, fails or times out. */
export async function askJev(state: string, questions: Record<string, JevQuestion>): Promise<Record<string, JevAnswer> | null> {
  if (!jevConfigured()) return null;
  try {
    const res = await fetch(JEV_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.JEV_API_KEY!.trim()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: JEV_MODEL, state, questions }),
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`JEV ${res.status}: ${text.slice(0, 200)}`);
      return null;
    }
    const answers = (JSON.parse(text) as { answers?: Record<string, JevAnswer> }).answers;
    return answers && typeof answers === "object" ? answers : null;
  } catch (err: any) {
    console.error("JEV:", err?.message || err);
    return null;
  }
}

/** Probability that a yes/no question is true, or null when missing. */
export const pTrue = (a: JevAnswer | undefined) => (typeof a?.noul === "number" && Number.isFinite(a.noul) ? a.noul : null);
