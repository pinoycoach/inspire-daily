import React, { useState, useEffect } from 'react';
import { Post, UserBrandSettings } from './types';
import { Header } from './components/Header';
import { FeedView } from './components/FeedView';
import { CreateView } from './components/CreateView';
import { QuoteVaultView } from './components/QuoteVaultView';
import { MessageBox } from './components/MessageBox';
import { INITIAL_POSTS } from './constants';
import { LockScreen } from './components/LockScreen';
import { getPasscode, LOCKED_EVENT, NOT_MEMBER_EVENT, resetSession } from './services/apiFetch';
import { getMe, listMyPosts, saveBrandSettings, savePost, deleteMyData } from './services/inspireApi';
import { PrivacyView } from './components/PrivacyView';
import { CurateView } from './components/CurateView';
import { SaveImageSheet } from './components/SaveImageSheet';
import { InviteGate } from './components/InviteGate';
import { InvitesCard } from './components/InvitesCard';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { getStatus, signInWithGoogle, type AccountStatus } from './services/inspireApi';

type View = 'feed' | 'create' | 'vault' | 'privacy' | 'curate';

// The curator's desk opens straight from the address (it has no button).
const viewFromHash = (): View | null => (window.location.hash === '#curate' ? 'curate' : null);

function App() {
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [view, setView] = useState<View>(() => viewFromHash() || 'feed');
  useEffect(() => {
    const onHash = () => {
      const v = viewFromHash();
      if (v) setView(v);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const [activeQuote, setActiveQuote] = useState<{ quoteText: string; suggestedPrompt: string } | null>(null);
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

  // Outside the invite-only beta, signing in is optional: it keeps your progress on every device.
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

  // Brand settings live on the server (per anonymous user); these are the defaults until loaded.
  const [brandSettings, setBrandSettings] = useState<UserBrandSettings>({
    isPro: false,
    brandName: '',
    brandHandle: '',
    removeWatermark: false,
    aspectRatio: 'feed',
  });

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // Loads this browser's saved settings and posts once the app is unlocked.
  useEffect(() => {
    if (locked || gated || !ready) return;
    let cancelled = false;
    (async () => {
      try {
        const [me, mine] = await Promise.all([getMe(), listMyPosts()]);
        if (cancelled) return;
        if (me.brandSettings) setBrandSettings(me.brandSettings);
        // The sample posts keep the feed from looking empty; they step aside after 3 of your own.
        setPosts(mine.length >= 3 ? mine : [...mine, ...INITIAL_POSTS]);
      } catch (e: any) {
        if (!cancelled) showMessage(e.message || 'Could not load your posts.', 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locked, gated, ready, loadKey]);

  const handleDeleteMyData = async () => {
    await deleteMyData();
    resetSession();
    window.location.reload();
  };

  const handleCreate = () => {
    setView('create');
  };

  const handleFeed = () => {
    if (window.location.hash) history.replaceState(null, '', window.location.pathname);
    setView('feed');
  };

  const handleQuoteVault = () => {
    setView('vault');
  };

  const handleUseQuote = (quoteText: string, suggestedPrompt: string) => {
    setActiveQuote({ quoteText, suggestedPrompt });
    setView('create');
    showMessage('Loaded quote into post creator!', 'success');
  };

  const handleSaveBrandSettings = (newSettings: UserBrandSettings) => {
    setBrandSettings(newSettings);
    saveBrandSettings(newSettings)
      .then(() => showMessage(newSettings.isPro ? 'Pro Brand Kit updated!' : 'Brand settings updated!', 'success'))
      .catch((e) => showMessage(e.message || 'Could not save your settings.', 'error'));
  };
  
  const handlePostCreated = async (newPost: Post) => {
    setPosts(prevPosts => [newPost, ...prevPosts]);
    setView('feed');
    setActiveQuote(null);
    // Saved on the server (with its picture).
    try {
      const { id: _localId, ...toSave } = newPost;
      const saved = await savePost(toSave);
      setPosts(prevPosts => prevPosts.map((p) => (p.id === newPost.id ? saved.post : p)));
      showMessage(saved.message, 'success');
    } catch (e: any) {
      showMessage(e.message || 'Posted here, but it could not be saved.', 'error');
    }
  };

  if (locked) return <LockScreen onUnlocked={() => { setLocked(false); setLoadKey((k) => k + 1); }} />;
  if (gated && view !== 'curate') {
    return <InviteGate googleClientId={googleClientId} status={status} onMember={handleBecameMember} onStatus={setStatus} />;
  }

  return (
    <div className="bg-gray-900 text-gray-100 min-h-screen font-sans print:min-h-0 print:bg-white print:text-black">
      {message && <MessageBox message={message.text} type={message.type} />}
      <SaveImageSheet />
      <Header onCreate={handleCreate} onFeed={handleFeed} onQuoteVault={handleQuoteVault} currentView={view} />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:p-0">
        {view === 'feed' && inviteOnly && status?.member && <InvitesCard key={loadKey} />}
        {view === 'curate' && <CurateView onBack={handleFeed} />}
        {view === 'feed' && (
          <FeedView 
            posts={posts} 
            onCreate={handleCreate} 
            brandSettings={brandSettings}
          />
        )}
        {view === 'privacy' && (
          <PrivacyView onBack={handleFeed} onDeleteMyData={handleDeleteMyData} />
        )}
        {view === 'vault' && (
          <QuoteVaultView onUseQuote={handleUseQuote} />
        )}
        {view === 'create' && (
          <CreateView 
            onPostCreated={handlePostCreated} 
            initialPrompt={activeQuote?.suggestedPrompt || ''}
            initialQuote={activeQuote?.quoteText || ''}
            brandSettings={brandSettings}
          />
        )}
      </main>

      <footer className="print:hidden max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 text-center text-xs text-gray-500">
        Inspire Daily · Images and captions are AI-generated · Nothing posts by itself ·{' '}
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
              <p>Sign in to keep your posts on every device.</p>
              <GoogleSignInButton clientId={googleClientId} onCredential={handleFooterSignIn} />
            </div>
          )
        )}
      </footer>

    </div>
  );
}

export default App;