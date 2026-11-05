import React, { useState } from 'react';
import { GoogleSignInButton } from './GoogleSignInButton';
import { Sparkles } from './icons/LucideIcons';
import { joinWaitlist, redeemInvite, signInWithGoogle, type AccountStatus } from '../services/inspireApi';

interface Props {
  googleClientId: string | null;
  status: AccountStatus | null;
  onMember: () => void;
  onStatus: (s: AccountStatus) => void;
}

// The public front door while the beta is invite-only: what it is, then sign in with Google and use an
// invite code once. Or join the waitlist.
export const InviteGate: React.FC<Props> = ({ googleClientId, status, onMember, onStatus }) => {
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waitlistNote, setWaitlistNote] = useState<string | null>(null);
  const signedIn = !!status?.signedIn;

  const onCredential = async (credential: string) => {
    setBusy('google');
    setError(null);
    try {
      const r = await signInWithGoogle(credential);
      if (r.member) return onMember();
      onStatus({ inviteOnly: true, member: false, signedIn: true, email: r.email, name: r.name });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const redeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy('code');
    setError(null);
    try {
      await redeemInvite(code.trim());
      onMember();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const waitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('waitlist');
    setWaitlistNote(null);
    try {
      const r = await joinWaitlist(email.trim());
      setWaitlistNote(r.already ? "You're already on the list. We'll be in touch." : "You're on the list. We'll email you an invite.");
      setEmail('');
    } catch (err: any) {
      setWaitlistNote(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-5 py-6">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2">
            <span className="bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 p-2 rounded-xl">
              <Sparkles className="w-5 h-5 text-white" />
            </span>
            <h1 className="text-3xl font-black bg-gradient-to-r from-indigo-400 to-pink-400 bg-clip-text text-transparent">Inspire Daily</h1>
          </div>
          <p className="text-lg text-white font-semibold">Posts for your page. You pick, you post.</p>
          <ul className="text-sm text-gray-300 space-y-1 text-left inline-block">
            <li>📷 Upload a photo of your product. Get ready-to-post captions in five angles.</li>
            <li>📜 Quotes with real, checked credits, ready to put on a picture.</li>
            <li>✋ Nothing posts by itself. You choose, and you post it.</li>
          </ul>
        </div>

        <p className="text-center text-sm text-gray-400">
          The app is <b className="text-gray-200">invite-only</b> during the beta. Every member gets 3 invites to share.
        </p>

        <div className="rounded-2xl bg-gray-800 border border-gray-700 p-5 space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-white">1. Sign in with Google</p>
            {signedIn ? (
              <p className="text-sm text-green-300">Signed in as {status?.email}</p>
            ) : googleClientId ? (
              <GoogleSignInButton clientId={googleClientId} onCredential={onCredential} />
            ) : (
              <p className="text-sm text-amber-300">Google sign-in isn't set up on this server yet.</p>
            )}
            <p className="text-xs text-gray-500">So your posts follow you to every device.</p>
          </div>

          <form onSubmit={redeem} className="space-y-2">
            <label htmlFor="invite" className="text-sm font-semibold text-white block">2. Your invite code</label>
            <div className="flex gap-2">
              <input
                id="invite"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="INSP-XXXX-XX"
                autoCapitalize="characters"
                disabled={!signedIn}
                className="flex-1 min-w-0 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white tracking-wider uppercase disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!signedIn || !code.trim() || busy === 'code'}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 rounded-lg disabled:opacity-50"
              >
                {busy === 'code' ? '…' : 'Join'}
              </button>
            </div>
          </form>
          {busy === 'google' && <p className="text-sm text-gray-400">Signing you in…</p>}
          {error && <p className="text-sm text-red-300">{error}</p>}
        </div>

        <form onSubmit={waitlist} className="rounded-2xl bg-gray-800/60 border border-gray-700 p-5 space-y-2">
          <label htmlFor="waitlist" className="text-sm font-semibold text-white block">No invite yet? Join the waitlist</label>
          <div className="flex gap-2">
            <input
              id="waitlist"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="flex-1 min-w-0 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white"
            />
            <button
              type="submit"
              disabled={!email.trim() || busy === 'waitlist'}
              className="bg-gray-700 hover:bg-gray-600 text-white font-semibold px-4 rounded-lg disabled:opacity-50"
            >
              Notify me
            </button>
          </div>
          {waitlistNote && <p className="text-sm text-gray-300">{waitlistNote}</p>}
          <p className="text-xs text-gray-500">We only use your email to send you an invite.</p>
        </form>
      </div>
    </div>
  );
};
