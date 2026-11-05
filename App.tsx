import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { TodayView } from './components/TodayView';
import { MessageBox } from './components/MessageBox';
import { LockScreen } from './components/LockScreen';
import { getPasscode, LOCKED_EVENT, NOT_MEMBER_EVENT, resetSession } from './services/apiFetch';
import { deleteMyData } from './services/inspireApi';
import { PrivacyView } from './components/PrivacyView';
import { CurateView } from './components/CurateView';
import { SaveImageSheet } from './components/SaveImageSheet';
import { InviteGate } from './components/InviteGate';
import { InvitesCard } from './components/InvitesCard';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { getStatus, signInWithGoogle, type AccountStatus } from './services/inspireApi';

type View = 'today' | 'privacy' | 'curate';

// The curator's desk opens straight from the address (it has no button).
const viewFromHash = (): View | null => (window.location.hash === '#curate' ? 'curate' : null);

function App() {
  const [view, setView] = useState<View>(() => viewFromHash() || 'today');
  useEffect(() => {
    const onHash = () => {
      const v = viewFromHash();
      if (v) setView(v);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  // The server may require a passcode (APP_PASSCODE); any 401 brings the lock back.
  const [locked, setLocked] = useState(false);
  // Invite-only beta: Google sign-in + an invite code; `gated` shows the invite page.
  const [inviteOnly, setInviteOnly] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [gated, setGated] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadKey, setLoadKey] = useState(0);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => (r.ok ? r.json() : null))
      .then(async (config) => {
        setGoogleClientId(config?.googleClientId || null);
        setInviteOnly(!!config?.inviteOnly);
        if (config?.locked && !getPasscode()) setLocked(true);
        else {
          const s = await getStatus().catch(() => null);
          setStatus(s);
          if (config?.inviteOnly && !s?.member) setGated(true);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
    const onLocked = () => setLocked(true);
    const onNotMember = () => setGated(true);
    window.addEventListener(LOCKED_EVENT, onLocked);
    window.addEventListener(NOT_MEMBER_EVENT, onNotMember);
    return () => {
      window.removeEventListener(LOCKED_EVENT, onLocked);
      window.removeEventListener(NOT_MEMBER_EVENT, onNotMember);
    };
  }, []);

  const handleBecameMember = async () => {
    setStatus(await getStatus().catch(() => null));
    setGated(false);
    setLoadKey((k) => k + 1);
  };

  // Outside the invite-only beta, signing in is optional.
  const handleFooterSignIn = async (credential: string) => {
    try {
      const r = await signInWithGoogle(credential);
      if (r.token) return window.location.reload(); // switched to this account's progress
      setStatus(await getStatus().catch(() => null));
      showMessage(`Signed in as ${r.email}`, 'success');
    } catch (e: any) {
      showMessage(e.message || 'Google sign-in failed.', 'error');
    }
  };

  const handleSignOut = () => {
    resetSession();
    window.location.reload();
  };

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDeleteMyData = async () => {
    await deleteMyData();
    resetSession();
    window.location.reload();
  };

  const handleToday = () => {
    if (window.location.hash) history.replaceState(null, '', window.location.pathname);
    setView('today');
  };

  if (locked) return <LockScreen onUnlocked={() => { setLocked(false); setLoadKey((k) => k + 1); }} />;
  if (gated && view !== 'curate') {
    return <InviteGate googleClientId={googleClientId} status={status} onMember={handleBecameMember} onStatus={setStatus} />;
  }

  return (
    <div className="bg-gray-900 text-gray-100 min-h-screen font-sans print:min-h-0 print:bg-white print:text-black">
      {message && <MessageBox message={message.text} type={message.type} />}
      <SaveImageSheet />
      <Header onToday={handleToday} currentView={view} />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:p-0">
        {view === 'today' && inviteOnly && status?.member && <InvitesCard key={loadKey} />}
        {view === 'today' && <TodayView />}
        {view === 'curate' && <CurateView onBack={handleToday} />}
        {view === 'privacy' && <PrivacyView onBack={handleToday} onDeleteMyData={handleDeleteMyData} />}
      </main>

      <footer className="print:hidden max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 text-center text-xs text-gray-500">
        Inspire Daily · Quotes checked by a person · Free to save and share ·{' '}
        <button onClick={() => setView('privacy')} className="underline hover:text-gray-300">
          Privacy &amp; Terms
        </button>
        {status?.signedIn ? (
          <p className="mt-2">
            Signed in as {status.email} ·{' '}
            <button onClick={handleSignOut} className="underline hover:text-gray-300">Sign out</button>
          </p>
        ) : (
          googleClientId && !inviteOnly && (
            <div className="mt-3 space-y-1">
              <p>Sign in to keep your invites on every device.</p>
              <GoogleSignInButton clientId={googleClientId} onCredential={handleFooterSignIn} />
            </div>
          )
        )}
      </footer>

    </div>
  );
}

export default App;