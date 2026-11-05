import React, { useCallback, useEffect, useState } from 'react';
import {
  curatorAdd, curatorList, curatorProcess, curatorUpdate, getCuratorCode, setCuratorCode, type CuratorPiece,
} from '../services/inspireApi';
import { CuratorBeta } from './CuratorBeta';
import { cleanForBulk } from '../shared/curation';

interface CurateViewProps {
  onBack: () => void;
}

type Tab = CuratorPiece['status'];
const KIND_LABELS: Record<CuratorPiece['kind'], string> = {
  quote: 'Quotes',
  proverb: 'Proverbs',
  own: 'My own writing',
  teaching: 'Teachings',
};

const pct = (p?: number) => (p === undefined ? '–' : `${Math.round(p * 100)}%`);

const WIKIQUOTE_LABELS: Record<NonNullable<CuratorPiece['sourceCheck']>['wikiquote'], { text: string; tone: string }> = {
  found: { text: 'Wikiquote: found', tone: 'text-green-300' },
  unsourced: { text: 'Wikiquote: disputed or unsourced', tone: 'text-amber-300' },
  misattributed: { text: 'Wikiquote: misattributed', tone: 'text-red-300' },
  'not-found': { text: 'Wikiquote: not found', tone: 'text-gray-400' },
  unavailable: { text: 'Wikiquote: couldn’t check', tone: 'text-gray-500' },
};


/** One piece per line: words | who said them | source (optional) | translation (optional). */
const parseLines = (raw: string) =>
  raw
    .split('\n')
    .map((line) => line.split('|').map((s) => s.trim()))
    .filter((cols) => cols[0] && cols[1])
    .map(([text, author, source, translation]) => ({ text, author, source: source || undefined, translation: translation || undefined }));

// The curator's desk: add pieces, let JEV label them, and approve what Inspire may use.
export const CurateView: React.FC<CurateViewProps> = ({ onBack }) => {
  const [code, setCode] = useState(getCuratorCode());
  const [codeInput, setCodeInput] = useState('');
  const [pieces, setPieces] = useState<CuratorPiece[]>([]);
  const [waiting, setWaiting] = useState(0);
  const [jev, setJev] = useState(true);
  const [tab, setTab] = useState<Tab>('pending');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [importKind, setImportKind] = useState<CuratorPiece['kind']>('quote');
  const [section, setSection] = useState<'library' | 'beta'>('library');
  const [editing, setEditing] = useState<{ id: string; text: string; author: string; source: string; translation: string; sourceChecked: boolean } | null>(null);

  const load = useCallback(async () => {
    if (!getCuratorCode()) return;
    try {
      const r = await curatorList();
      setPieces(r.pieces);
      setWaiting(r.waiting);
      setJev(r.jev);
      setError(null);
    } catch (e: any) {
      setError(e.message);
      if (/curator code/i.test(e.message)) {
        setCuratorCode('');
        setCode('');
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, code]);

  const signIn = (e: React.FormEvent) => {
    e.preventDefault();
    setCuratorCode(codeInput.trim());
    setCode(codeInput.trim());
    setCodeInput('');
  };

  const run = async (label: string, fn: () => Promise<string | void>) => {
    setBusy(label);
    setError(null);
    setNote(null);
    try {
      const msg = await fn();
      if (msg) setNote(msg);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const addPieces = () =>
    run('import', async () => {
      const rows = parseLines(importText);
      if (!rows.length) throw new Error('Nothing to add. Use one line per piece: words | who said them.');
      const r = await curatorAdd(importKind, rows);
      setImportText('');
      setTab('pending');
      return `Added ${r.added} for review.`;
    });

  const processAll = () =>
    run('process', async () => {
      const r = await curatorProcess();
      return `Labeled and indexed ${r.processed}.${r.remaining ? ` ${r.remaining} still waiting: press again.` : ''}`;
    });

  const setStatus = (p: CuratorPiece, status: Tab) => run(p.id, async () => void (await curatorUpdate(p.id, { status })));

  const approveClean = () =>
    run('approve-clean', async () => {
      const clean = pieces.filter(cleanForBulk);
      for (const p of clean) await curatorUpdate(p.id, { status: 'approved' });
      const unchecked = pieces.filter((p) => p.status === 'pending' && p.needsSourceCheck && !p.sourceChecked).length;
      return `Approved ${clean.length} with no flags.${unchecked ? ` ${unchecked} quotes credited to a person still need their source checked: open Edit, check it, and tick the box.` : ''}`;
    });

  if (!code) {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <button onClick={onBack} className="text-indigo-400 hover:text-indigo-300 font-semibold">← Back</button>
        <h1 className="text-2xl font-bold text-white">Curator</h1>
        <form onSubmit={signIn} className="space-y-3">
          <input
            type="password"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="Curator code"
            className="w-full rounded-xl bg-gray-800 border border-gray-700 p-3 text-white"
          />
          <button className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-5 rounded-xl">Open</button>
        </form>
        {error && <p className="text-red-300 text-sm">{error}</p>}
      </div>
    );
  }

  const saveEdit = () =>
    run(editing!.id, async () => {
      const { id, text, author, source, translation, sourceChecked } = editing!;
      await curatorUpdate(id, { text: text.trim(), author: author.trim(), source: source.trim(), translation: translation.trim(), sourceChecked });
      setEditing(null);
      return 'Saved.';
    });

  const shown = pieces.filter((p) => p.status === tab);
  const count = (s: Tab) => pieces.filter((p) => p.status === s).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-indigo-400 hover:text-indigo-300 font-semibold">← Back</button>
        <button onClick={() => { setCuratorCode(''); setCode(''); }} className="text-xs text-gray-500 underline">Lock curator</button>
      </div>
      <div className="flex gap-2">
        {(['library', 'beta'] as const).map((s2) => (
          <button
            key={s2}
            onClick={() => setSection(s2)}
            className={`py-1.5 px-4 rounded-lg text-sm font-semibold ${section === s2 ? 'bg-white text-gray-900' : 'bg-gray-800 text-gray-300'}`}
          >
            {s2 === 'library' ? 'Library' : 'Beta'}
          </button>
        ))}
      </div>
      {section === 'beta' ? <CuratorBeta /> : (<>
      <div>
        <h1 className="text-2xl font-bold text-white">Curated library</h1>
        <p className="text-sm text-gray-400 mt-1">
          Only <b>approved</b> pieces are ever used in replies. JEV labels each piece and flags anything that sounds like a
          prediction, sounds preachy, or may be misattributed. You have the final say.
        </p>
        {!jev && <p className="text-sm text-amber-300 mt-2">JEV isn't connected on this server, so pieces won't be labeled or flagged yet.</p>}
      </div>

      {waiting > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-gray-800 border border-gray-700 p-4">
          <span className="text-sm text-gray-300">{waiting} pieces still need labels or indexing.</span>
          <button onClick={processAll} disabled={!!busy} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold py-2 px-4 rounded-lg">
            {busy === 'process' ? 'Working…' : 'Label & index now'}
          </button>
        </div>
      )}

      <details className="rounded-xl bg-gray-800 border border-gray-700 p-4">
        <summary className="cursor-pointer font-semibold text-white">Add pieces</summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-gray-400">
            One per line: <code>words | who said them | source (optional) | translation (optional)</code>
          </p>
          <select
            value={importKind}
            onChange={(e) => setImportKind(e.target.value as CuratorPiece['kind'])}
            className="rounded-lg bg-gray-900 border border-gray-700 p-2 text-white"
          >
            {Object.entries(KIND_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={6}
            placeholder={'Habang may buhay, may pag-asa. | Filipino proverb (salawikain) | | While there is life, there is hope.'}
            className="w-full rounded-xl bg-gray-900 border border-gray-700 p-3 text-gray-100 text-sm"
          />
          <button onClick={addPieces} disabled={!!busy} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg">
            {busy === 'import' ? 'Adding and labeling…' : 'Add for review'}
          </button>
        </div>
      </details>

      <div className="flex flex-wrap gap-2">
        {(['pending', 'approved', 'rejected'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-1.5 px-4 rounded-full text-sm font-semibold ${tab === t ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300'}`}
          >
            {t === 'pending' ? 'To review' : t === 'approved' ? 'Approved' : 'Rejected'} ({count(t)})
          </button>
        ))}
        {tab === 'pending' && count('pending') > 0 && (
          <button onClick={approveClean} disabled={!!busy} className="ml-auto text-sm text-green-300 underline disabled:opacity-50">
            Approve all with no flags
          </button>
        )}
      </div>
      {tab === 'pending' && (
        <p className="text-xs text-gray-500 -mt-3">
          Quotes credited to a person are never approved in bulk until someone ticks “I checked the source”. JEV and Wikiquote help;
          a person decides.
        </p>
      )}

      {note && <p className="text-sm text-green-300">{note}</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}

      <ul className="space-y-3">
        {shown.length === 0 && <li className="text-gray-500 text-sm">Nothing here.</li>}
        {shown.map((p) => (
          <li key={p.id} className="rounded-xl bg-gray-800 border border-gray-700 p-4 space-y-2">
            <p className="text-white">“{p.text}”</p>
            {p.translation && <p className="text-sm text-gray-400">{p.translation}</p>}
            <p className="text-sm text-indigo-300">— {p.author}{p.source ? `, ${p.source}` : ''}</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-gray-900 px-2 py-1 text-gray-300">{KIND_LABELS[p.kind]}</span>
              {p.labels?.theme && <span className="rounded-full bg-gray-900 px-2 py-1 text-gray-300">theme: {p.labels.theme}</span>}
              {p.labels?.mood && <span className="rounded-full bg-gray-900 px-2 py-1 text-gray-300">helps: {p.labels.mood}</span>}
              {p.labels && (
                <span className="rounded-full bg-gray-900 px-2 py-1 text-gray-400">
                  prediction {pct(p.labels.prediction)} · preachy {pct(p.labels.preachy)} · genuine {pct(p.labels.attribution)}
                </span>
              )}
              {!p.indexed && <span className="rounded-full bg-gray-900 px-2 py-1 text-amber-300">not indexed</span>}
              {p.sourceCheck && (
                p.sourceCheck.url ? (
                  <a href={p.sourceCheck.url} target="_blank" rel="noreferrer" className={`rounded-full bg-gray-900 px-2 py-1 underline ${WIKIQUOTE_LABELS[p.sourceCheck.wikiquote].tone}`}>
                    {WIKIQUOTE_LABELS[p.sourceCheck.wikiquote].text}
                  </a>
                ) : (
                  <span className={`rounded-full bg-gray-900 px-2 py-1 ${WIKIQUOTE_LABELS[p.sourceCheck.wikiquote].tone}`}>{WIKIQUOTE_LABELS[p.sourceCheck.wikiquote].text}</span>
                )
              )}
              {p.needsSourceCheck && (
                p.sourceChecked
                  ? <span className="rounded-full bg-green-900/60 px-2 py-1 text-green-200">source checked ✓</span>
                  : <span className="rounded-full bg-gray-900 px-2 py-1 text-amber-300">source not checked yet</span>
              )}
            </div>
            {editing?.id === p.id && (
              <div className="space-y-2 rounded-lg bg-gray-900 p-3">
                {(['text', 'author', 'source', 'translation'] as const).map((f) => (
                  <label key={f} className="block text-xs text-gray-400">
                    {f === 'text' ? 'Words' : f === 'author' ? 'Who said them' : f === 'source' ? 'Source (optional)' : 'Translation (optional)'}
                    {f === 'text' ? (
                      <textarea value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} rows={3} className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 p-2 text-sm text-white" />
                    ) : (
                      <input value={editing[f]} onChange={(e) => setEditing({ ...editing, [f]: e.target.value })} className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 p-2 text-sm text-white" />
                    )}
                  </label>
                ))}
                <label className="flex items-start gap-2 text-sm text-gray-200">
                  <input
                    type="checkbox"
                    checked={editing.sourceChecked}
                    onChange={(e) => setEditing({ ...editing, sourceChecked: e.target.checked })}
                    className="mt-1"
                  />
                  <span>I checked the source: these words really are from who it says (a book, speech, letter or a trusted quote site with a citation).</span>
                </label>
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={!!busy} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold py-1.5 px-3 rounded-lg">
                    {busy === p.id ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditing(null)} className="text-sm text-gray-400 underline">Cancel</button>
                </div>
              </div>
            )}
            {p.flags.length > 0 && (
              <ul className="text-sm text-amber-300 list-disc pl-5">
                {p.flags.map((f) => <li key={f}>{f}</li>)}
              </ul>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {p.status !== 'approved' && (
                <button onClick={() => setStatus(p, 'approved')} disabled={!!busy} className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold py-1.5 px-3 rounded-lg">
                  {busy === p.id ? '…' : 'Approve'}
                </button>
              )}
              {p.status !== 'rejected' && (
                <button onClick={() => setStatus(p, 'rejected')} disabled={!!busy} className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-semibold py-1.5 px-3 rounded-lg">
                  Reject
                </button>
              )}
              {p.status !== 'pending' && (
                <button onClick={() => setStatus(p, 'pending')} disabled={!!busy} className="text-sm text-gray-400 underline">
                  Back to review
                </button>
              )}
              {editing?.id !== p.id && (
                <button
                  onClick={() => setEditing({ id: p.id, text: p.text, author: p.author, source: p.source || '', translation: p.translation || '', sourceChecked: !!p.sourceChecked })}
                  className="text-sm text-indigo-300 underline"
                >
                  Edit
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      </>)}
    </div>
  );
};
