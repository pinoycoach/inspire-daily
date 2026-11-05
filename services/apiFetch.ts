// Every call to the app's own API goes through here. It adds:
// - the passcode, when the server has one (a 401 "Locked" brings the lock screen back);
// - this browser's anonymous session, created on first use and renewed if the server rejects it.

const PASSCODE_KEY = 'inspire.passcode';
const SESSION_KEY = 'inspire.session';
export const LOCKED_EVENT = 'inspire:locked';
/** The beta is invite-only and this browser isn't a member yet. */
export const NOT_MEMBER_EVENT = 'inspire:not-member';

const read = (key: string) => {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
};
const write = (key: string, value: string) => {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // Blocked storage: works for this visit only.
  }
};

export const getPasscode = () => read(PASSCODE_KEY);
export const setPasscode = (code: string) => write(PASSCODE_KEY, code);

let sessionPromise: Promise<string> | null = null;
let memorySession = '';

/** This browser's session token, asking the server for one the first time. */
export const getSession = (): Promise<string> => {
  const saved = read(SESSION_KEY) || memorySession;
  if (saved) return Promise.resolve(saved);
  if (!sessionPromise) {
    sessionPromise = fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-passcode': getPasscode() },
      body: JSON.stringify({}),
    })
      .then(async (res) => {
        if (res.status === 401) window.dispatchEvent(new Event(LOCKED_EVENT));
        if (!res.ok) throw new Error('Could not start a session.');
        const { token } = await res.json();
        memorySession = token;
        write(SESSION_KEY, token);
        return token as string;
      })
      .finally(() => {
        sessionPromise = null;
      });
  }
  return sessionPromise;
};

/** Switches this browser to another identity (signing in on a second device). */
export const setSession = (token: string) => {
  memorySession = token;
  write(SESSION_KEY, token);
};

/** Forgets this browser's identity (used after "delete my data"). */
export const resetSession = () => {
  memorySession = '';
  write(SESSION_KEY, '');
};

export const apiFetch = async (url: string, init: RequestInit = {}, retried = false): Promise<Response> => {
  const headers = new Headers(init.headers);
  const code = getPasscode();
  if (code) headers.set('x-app-passcode', code);
  headers.set('x-inspire-session', await getSession());
  const response = await fetch(url, { ...init, headers });
  if (response.status === 401) {
    const body = await response.clone().json().catch(() => ({}));
    if (body.session === 'invalid' && !retried) {
      resetSession();
      return apiFetch(url, init, true);
    }
    if (!body.session) {
      setPasscode('');
      window.dispatchEvent(new Event(LOCKED_EVENT));
    }
  }
  if (response.status === 403) {
    const body = await response.clone().json().catch(() => ({}));
    if (body.invite === 'required') window.dispatchEvent(new Event(NOT_MEMBER_EVENT));
  }
  return response;
};

export const unlock = async (code: string): Promise<void> => {
  const response = await fetch('/api/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: code }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Could not unlock.');
  }
  setPasscode(code);
};
