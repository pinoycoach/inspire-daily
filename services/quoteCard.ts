// Draws a quote card in the browser: no AI, no server cost. Three house styles, one per daily slot.
import type { DayPiece } from '../shared/daily';

export type CardStyle = 'paper' | 'storm' | 'bold';
export const STYLES: CardStyle[] = ['paper', 'storm', 'bold'];
export const STYLE_NAMES: Record<CardStyle, string> = { paper: 'Paper', storm: 'Storm', bold: 'Bold' };

const SIZE = 1080;
const AMBER = '#f5b301';

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Largest font size (from `start` down) at which the text fits in `maxLines` lines. */
function fit(ctx: CanvasRenderingContext2D, font: (px: number) => string, text: string, maxWidth: number, maxLines: number, start: number) {
  for (let px = start; px >= 34; px -= 4) {
    ctx.font = font(px);
    const lines = wrap(ctx, text, maxWidth);
    if (lines.length <= maxLines) return { px, lines };
  }
  ctx.font = font(34);
  return { px: 34, lines: wrap(ctx, text, maxWidth) };
}

const credit = (p: DayPiece) => ({ who: p.author, where: p.source || '' });

export async function drawCard(piece: DayPiece, style: CardStyle, brand = 'INSPIRE DAILY'): Promise<HTMLCanvasElement> {
  try {
    await document.fonts?.ready;
  } catch {
    /* fonts not ready: system fonts are fine */
  }
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Could not draw the card.');
  const { who, where } = credit(piece);
  const serif = (px: number, weight = '700', italic = false) => `${italic ? 'italic ' : ''}${weight} ${px}px Georgia, "Times New Roman", serif`;
  const sans = (px: number, weight = '600') => `${weight} ${px}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = 'alphabetic';

  if (style === 'paper') {
    ctx.fillStyle = '#f6efe0';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.strokeStyle = '#e6dcc6';
    ctx.lineWidth = 2;
    for (let y = 60; y < SIZE; y += 44) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(SIZE, y);
      ctx.stroke();
    }
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 28;
    ctx.strokeRect(14, 14, SIZE - 28, SIZE - 28);
    ctx.fillStyle = AMBER;
    ctx.font = serif(300);
    ctx.fillText('“', 80, 300);
    const { px, lines } = fit(ctx, (n) => serif(n), piece.text, SIZE - 220, 6, 76);
    const lh = px * 1.25;
    let y = 500 - (lines.length * lh) / 2 + px * 0.6;
    ctx.fillStyle = '#1a1a1a';
    for (const l of lines) (ctx.fillText(l, 110, y), (y += lh));
    ctx.fillStyle = AMBER;
    ctx.fillRect(110, 850, 70, 8);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = sans(34, '700');
    ctx.fillText(who, 110, 910);
    ctx.fillStyle = '#6b6253';
    ctx.font = sans(28, '400');
    if (where) ctx.fillText(where, 110, 952);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = sans(22, '800');
    ctx.textAlign = 'right';
    ctx.fillText(brand, SIZE - 110, 1005);
    ctx.textAlign = 'left';
  } else if (style === 'storm') {
    const g = ctx.createRadialGradient(SIZE / 2, SIZE, 50, SIZE / 2, SIZE, SIZE);
    g.addColorStop(0, '#2b4a78');
    g.addColorStop(1, '#07101f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 40;
    for (let a = 0; a < 360; a += 10) {
      const r = (a * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(SIZE / 2, SIZE + 100);
      ctx.lineTo(SIZE / 2 + 1600 * Math.cos(r), SIZE + 100 - 1600 * Math.sin(r));
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = AMBER;
    ctx.font = sans(26, '800');
    ctx.fillText(brand, SIZE / 2, 150);
    ctx.fillRect(SIZE / 2 - 70, 176, 140, 4);
    const { px, lines } = fit(ctx, (n) => serif(n, '400', true), `“${piece.text}”`, SIZE - 200, 6, 70);
    const lh = px * 1.3;
    let y = 540 - (lines.length * lh) / 2 + px * 0.6;
    ctx.fillStyle = '#f4f1ea';
    for (const l of lines) (ctx.fillText(l, SIZE / 2, y), (y += lh));
    ctx.font = sans(34, '700');
    ctx.fillText(who, SIZE / 2, 930);
    ctx.fillStyle = '#9fb2cc';
    ctx.font = sans(28, '400');
    if (where) ctx.fillText(where, SIZE / 2, 972);
    ctx.textAlign = 'left';
  } else {
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.strokeStyle = AMBER;
    ctx.lineWidth = 12;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      ctx.moveTo(780 + i * 40, SIZE);
      ctx.lineTo(SIZE, 780 + i * 40);
      ctx.stroke();
    }
    ctx.fillStyle = AMBER;
    ctx.fillRect(0, 0, 36, SIZE);
    ctx.font = sans(28, '800');
    ctx.fillText(brand, 100, 140);
    const { px, lines } = fit(ctx, (n) => sans(n, '900'), `“${piece.text.toUpperCase()}”`, SIZE - 200, 6, 80);
    const lh = px * 1.15;
    let y = 500 - (lines.length * lh) / 2 + px * 0.6;
    ctx.fillStyle = '#ffffff';
    for (const l of lines) (ctx.fillText(l, 100, y), (y += lh));
    ctx.font = sans(34, '700');
    ctx.fillText(who, 100, 890);
    ctx.fillStyle = '#9a968d';
    ctx.font = sans(28, '400');
    if (where) ctx.fillText(where, 100, 933);
  }
  return c;
}

/** The text to paste with the picture. */
export const captionFor = (p: DayPiece) =>
  `“${p.text}”\n— ${p.author}${p.source ? `, ${p.source}` : ''}${p.translation ? `\n(${p.translation})` : ''}`;
