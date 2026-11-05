import React, { useCallback, useEffect, useState } from 'react';
import { curatorBeta, curatorInviteFromWaitlist, curatorMakeInvites, type BetaOverview } from '../services/inspireApi';

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '–');

// The curator's view of the invite-only beta: make codes, see who joined, invite the waitlist.
export const CuratorBeta: React.FC = () => {
  const [data, setData] = useState<BetaOverview | null>(null);
  const [count, setCount] = useState(5);
  const [note, setNote] = useState('');
  const [fresh, setFresh] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => curatorBeta().then(setData).catch((e) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  const make = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await curatorMakeInvites(count, note.trim() || undefined);
      setFresh(r.codes);
      setNote('');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const inviteWaitlist = async (email: string) => {
    setError(null);
    try {
      await curatorInviteFromWaitlist(email);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const copy = (text: string) => navigator.clipboard?.writeText(text).catch(() => window.prompt('Copy:', text));

  if (!data) return <p className="text-sm text-gray-400">{error || 'Loading…'}</p>;
  const openCodes = data.invites.filter((i) => !i.used);

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-300">{error}</p>}

      <section className="rounded-xl bg-gray-800 border border-gray-700 p-4 space-y-3">
        <h2 className="font-semibold text-white">Make invite codes</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            className="w-20 rounded-lg bg-gray-900 border border-gray-700 p-2 text-white"
            aria-label="How many codes"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional), e.g. coaching group"
            className="flex-1 min-w-0 rounded-lg bg-gray-900 border border-gray-700 p-2 text-white text-sm"
          />
          <button onClick={make} disabled={busy} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg">
            {busy ? '…' : 'Make codes'}
          </button>
        </div>
        {fresh.length > 0 && (
          <div className="rounded-lg bg-gray-900 p-3">
            <p className="text-xs text-gray-400 mb-2">New codes:</p>
            <p className="font-mono text-amber-200 text-sm break-words">{fresh.join('  ')}</p>
            <button onClick={() => copy(fresh.join('\n'))} className="text-xs text-indigo-300 underline mt-2">Copy all</button>
          </div>
        )}
        <p className="text-xs text-gray-500">
          {openCodes.length} of your codes are unused, {data.invites.length - openCodes.length} used.
        </p>
        {openCodes.length > 0 && (
          <details>
            <summary className="text-sm text-gray-300 cursor-pointer">Unused codes</summary>
            <ul className="mt-2 grid sm:grid-cols-2 gap-1 text-sm">
              {openCodes.map((i) => (
                <li key={i.code} className="font-mono text-amber-200">
                  <button onClick={() => copy(i.code)} className="hover:underline">{i.code}</button>
                  {i.note && <span className="text-gray-500 font-sans"> · {i.note}</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="rounded-xl bg-gray-800 border border-gray-700 p-4">
        <h2 className="font-semibold text-white mb-2">Members ({data.members.filter((m) => m.member).length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-gray-400 text-left">
              <tr>
                <th className="py-1 pr-3">Name</th>
                <th className="py-1 pr-3">Joined</th>
                <th className="py-1">Invited by</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.email} className="border-t border-gray-700">
                  <td className="py-1.5 pr-3 text-white">
                    {m.name}
                    <span className="block text-xs text-gray-500">{m.email}</span>
                  </td>
                  <td className="py-1.5 pr-3 text-gray-300">{m.member ? day(m.since) : <span className="text-amber-300">no invite yet</span>}</td>
                  <td className="py-1.5 text-gray-300">{m.invitedBy || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl bg-gray-800 border border-gray-700 p-4">
        <h2 className="font-semibold text-white mb-2">Waitlist ({data.waitlist.length})</h2>
        <ul className="space-y-2 text-sm">
          {data.waitlist.length === 0 && <li className="text-gray-500">No one yet.</li>}
          {data.waitlist.map((w) => (
            <li key={w.email} className="flex flex-wrap items-center gap-2">
              <span className="text-white">{w.email}</span>
              <span className="text-gray-500">{day(w.createdAt)}</span>
              {w.invitedCode ? (
                <button onClick={() => copy(w.invitedCode!)} className="ml-auto font-mono text-amber-200 hover:underline">{w.invitedCode}</button>
              ) : (
                <button onClick={() => inviteWaitlist(w.email)} className="ml-auto text-indigo-300 underline">Make their invite</button>
              )}
            </li>
          ))}
        </ul>
        <p className="text-xs text-gray-500 mt-2">Copy the code and send it to them yourself. Inspire doesn't send emails.</p>
      </section>
    </div>
  );
};
