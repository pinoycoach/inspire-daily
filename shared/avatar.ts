// Built-in profile badges: a coloured circle with initials, made on the spot (no outside website,
// no real person's face). Works in <img>, in downloads and on the server.
const PALETTE: Array<[string, string]> = [
  ['#6366f1', '#a855f7'],
  ['#0ea5e9', '#22d3ee'],
  ['#f59e0b', '#ef4444'],
  ['#10b981', '#84cc16'],
  ['#ec4899', '#f43f5e'],
  ['#8b5cf6', '#06b6d4'],
];

const initials = (name: string) =>
  name
    .replace(/^the\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

export function avatarFor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [a, b] = PALETTE[h % PALETTE.length];
  const text = initials(name).replace(/[<>&"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="150" height="150" rx="75" fill="url(#g)"/><text x="75" y="75" dy=".35em" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="56" font-weight="700" fill="#fff">${text}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
