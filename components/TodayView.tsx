import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/apiFetch';
import { drawCard, captionFor, STYLES, STYLE_NAMES, type CardStyle } from '../services/quoteCard';
import { saveImage, canvasToBlob } from '../services/saveImage';
import type { DayDoc, DayPiece } from '../shared/daily';

const getJson = async <T,>(url: string): Promise<T> => {
  const res = await apiFetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Something went wrong (status ${res.status})`);
  return data as T;
};

const niceDay = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

const Card: React.FC<{ piece: DayPiece; style: CardStyle; day: string }> = ({ piece, style, day }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    drawCard(piece, style).then((c) => alive && setSrc(c.toDataURL('image/png')));
    return () => {
      alive = false;
    };
  }, [piece, style]);

  const flash = (t: string) => {
    setNote(t);
    setTimeout(() => setNote(null), 2000);
  };
  const save = async () => saveImage(await canvasToBlob(await drawCard(piece, style)), `inspire-${day}-${style}.png`);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(captionFor(piece));
      flash('Caption copied');
    } catch {
      flash('Copy failed: press and hold the text instead');
    }
  };

  return (
    <figure className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden">
      {src ? (
        <img src={src} alt={`${piece.text} (${piece.author})`} className="w-full aspect-square object-cover" />
      ) : (
        <div className="w-full aspect-square bg-gray-900 animate-pulse" />
      )}
      <figcaption className="p-4 space-y-3">
        <p className="text-xs uppercase tracking-widest text-gray-500">{STYLE_NAMES[style]}</p>
        <p className="text-sm text-gray-300 whitespace-pre-wrap">{captionFor(piece)}</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={save} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            Save image
          </button>
          <button onClick={copy} className="bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            Copy caption
          </button>
          {note && <span className="text-sm text-green-300 self-center">{note}</span>}
        </div>
      </figcaption>
    </figure>
  );
};

const DayCards: React.FC<{ doc: DayDoc }> = ({ doc }) => (
  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
    {doc.pieces.map((p, i) => (
      <Card key={p.id} piece={p} style={STYLES[i % STYLES.length]} day={doc.day} />
    ))}
  </div>
);

/** Today's three quote cards, then past days. Everything here comes from quotes a person approved. */
export const TodayView: React.FC = () => {
  const [today, setToday] = useState<DayDoc | null>(null);
  const [past, setPast] = useState<DayDoc[]>([]);
  const [more, setMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson<DayDoc>('/api/today').then(setToday).catch((e) => setError(e.message));
    getJson<{ days: DayDoc[] }>('/api/archive?limit=7')
      .then((r) => {
        setPast(r.days);
        setMore(r.days.length === 7);
      })
      .catch(() => {});
  }, []);

  const loadMore = async () => {
    const before = past[past.length - 1]?.day;
    if (!before) return;
    const r = await getJson<{ days: DayDoc[] }>(`/api/archive?limit=7&before=${before}`).catch(() => ({ days: [] as DayDoc[] }));
    setPast((p) => [...p, ...r.days]);
    setMore(r.days.length === 7);
  };

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-black text-white">Today's three</h2>
          {today && <p className="text-sm text-gray-400">{niceDay(today.day)}. Every quote and credit was checked by a person.</p>}
        </div>
        {error && <p className="text-red-400">{error}</p>}
        {today && today.pieces.length === 0 && (
          <p className="text-gray-400">No approved quotes yet. They appear here as soon as the curator approves some.</p>
        )}
        {today && today.pieces.length > 0 && <DayCards doc={today} />}
        <p className="text-xs text-gray-500">Free to save and share. Nothing posts by itself: you choose, and you post it.</p>
      </section>

      {past.length > 0 && (
        <section className="space-y-8">
          <h2 className="text-xl font-bold text-white">Earlier</h2>
          {past.map((d) => (
            <div key={d.day} className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-400">{niceDay(d.day)}</h3>
              <DayCards doc={d} />
            </div>
          ))}
          {more && (
            <button onClick={loadMore} className="text-sm text-indigo-300 underline">
              Show older days
            </button>
          )}
        </section>
      )}
    </div>
  );
};
