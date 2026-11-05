import React, { useState } from 'react';
import { unlock } from '../services/apiFetch';

// Shown while the server has APP_PASSCODE set and this browser hasn't entered it yet.
export const LockScreen: React.FC<{ onUnlocked: () => void }> = ({ onUnlocked }) => {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await unlock(code.trim());
      onUnlocked();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm p-6 rounded-2xl bg-gray-800 border border-gray-700 space-y-4">
        <div>
          <h1 className="text-xl font-black text-white">Inspire Daily</h1>
          <p className="text-sm text-gray-400">Private for now. Enter the passcode to continue.</p>
        </div>
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Passcode"
          autoFocus
          autoComplete="current-password"
          className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500"
        />
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-lg disabled:opacity-50"
        >
          {busy ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </div>
  );
};
