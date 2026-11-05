// The app's own data: settings, saved posts, quotes and personas (stored by the server).
import { apiFetch, setSession } from './apiFetch';
import type { Post, Persona, UserBrandSettings } from '../types';
import type { TimelessQuote } from '../data/quotesDatabase';

const call = async <T,>(url: string, init: RequestInit = {}, fallback = 'Something went wrong'): Promise<T> => {
  const res = await apiFetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${fallback} (status ${res.status})`);
  return data as T;
};

export interface MeResponse {
  brandSettings: UserBrandSettings | null;
}

export const getMe = () => call<MeResponse>('/api/me', {}, 'Could not load your settings');

export const saveBrandSettings = (settings: UserBrandSettings) =>
  call<{ brandSettings: UserBrandSettings }>('/api/me/settings', { method: 'PUT', body: JSON.stringify(settings) }, 'Could not save settings');

export const listMyPosts = async () => (await call<{ posts: Post[] }>('/api/me/posts', {}, 'Could not load your posts')).posts;

export const savePost = (post: Omit<Post, 'id'>) =>
  call<{ post: Post; message: string }>(
    '/api/me/posts',
    { method: 'POST', body: JSON.stringify({ post }) },
    'Could not save your post'
  );

export const listQuotes = async () => (await call<{ quotes: TimelessQuote[] }>('/api/quotes', {}, 'Could not load quotes')).quotes;

export const getDailyQuote = async () => (await call<{ quote: TimelessQuote }>('/api/quotes/daily', {}, "Could not load today's quote")).quote;

export const listMyPersonas = async () => (await call<{ personas: Persona[] }>('/api/me/personas', {}, 'Could not load personas')).personas;

export const createMyPersona = async (data: { name: string; description: string; promptFragment: string }) =>
  (await call<{ persona: Persona }>('/api/me/personas', { method: 'POST', body: JSON.stringify(data) }, 'Could not save the persona')).persona;

export const deleteMyData = () => call<{ deleted: boolean }>('/api/me', { method: 'DELETE' }, 'Could not delete your data');

export interface LibraryPieceView {
  id: string;
  text: string;
  translation?: string;
  author: string;
  source?: string;
}

// ---------- Curator (needs the curator code) ----------

const CURATOR_KEY = 'inspire.curator';
export const getCuratorCode = () => {
  try {
    return sessionStorage.getItem(CURATOR_KEY) || '';
  } catch {
    return '';
  }
};
export const setCuratorCode = (code: string) => {
  try {
    if (code) sessionStorage.setItem(CURATOR_KEY, code);
    else sessionStorage.removeItem(CURATOR_KEY);
  } catch {
    /* private mode: the code just isn't remembered */
  }
};
const curator = <T,>(url: string, init: RequestInit = {}) =>
  call<T>(url, { ...init, headers: { 'x-admin-code': getCuratorCode(), ...(init.headers || {}) } }, 'Curator request failed');

export interface CuratorPiece extends LibraryPieceView {
  kind: 'quote' | 'proverb' | 'own' | 'teaching';
  status: 'pending' | 'approved' | 'rejected';
  labels?: { theme?: string; mood?: string; prediction?: number; preachy?: number; attribution?: number };
  flags: string[];
  indexed: boolean;
  /** A quote credited to a person: needs a human "source checked" tick before bulk approval. */
  needsSourceCheck: boolean;
  sourceChecked?: boolean;
  sourceCheck?: { wikiquote: 'found' | 'unsourced' | 'misattributed' | 'not-found' | 'unavailable'; url?: string; known?: string; checkedAt: string };
  createdAt: string;
}

export const curatorList = () => curator<{ pieces: CuratorPiece[]; waiting: number; jev: boolean }>('/api/admin/library');

export const curatorAdd = (
  kind: CuratorPiece['kind'],
  pieces: Array<{ text: string; author: string; source?: string; translation?: string }>
) => curator<{ added: number }>('/api/admin/library', { method: 'POST', body: JSON.stringify({ kind, pieces }) });

export const curatorProcess = () =>
  curator<{ processed: number; remaining: number; jev: boolean }>('/api/admin/library/process', { method: 'POST' });

export const curatorUpdate = (id: string, changes: Partial<Pick<CuratorPiece, 'status' | 'text' | 'author' | 'source' | 'translation' | 'sourceChecked'>>) =>
  curator<{ piece: CuratorPiece }>(`/api/admin/library/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(changes) });

// ---------- Beta: sign-in, invites, waitlist ----------

export interface AccountStatus {
  inviteOnly: boolean;
  member: boolean;
  signedIn: boolean;
  email: string | null;
  name: string | null;
}
export const getStatus = () => call<AccountStatus>('/api/me/status', {}, 'Could not load your account');

/** Sends Google's sign-in token; switches this browser to the account's user when it already exists. */
export const signInWithGoogle = async (credential: string) => {
  const r = await call<{ member: boolean; email: string; name: string; token?: string }>(
    '/api/auth/google',
    { method: 'POST', body: JSON.stringify({ credential }) },
    'Google sign-in failed'
  );
  if (r.token) setSession(r.token);
  return r;
};

export const redeemInvite = (code: string) =>
  call<{ member: boolean }>('/api/invites/redeem', { method: 'POST', body: JSON.stringify({ code }) }, 'Could not use that invite');

export interface InviteView {
  code: string;
  used: boolean;
  createdAt: string;
  note?: string | null;
}
export const listMyInvites = async () => (await call<{ invites: InviteView[] }>('/api/me/invites', {}, 'Could not load your invites')).invites;

export const joinWaitlist = (email: string) =>
  call<{ ok: boolean; already: boolean }>('/api/waitlist', { method: 'POST', body: JSON.stringify({ email }) }, 'Could not join the waitlist');

export interface BetaOverview {
  members: Array<{ name: string; email: string; signedUp: string; member: boolean; since: string | null; invitedBy: string | null }>;
  invites: InviteView[];
  waitlist: Array<{ email: string; createdAt: string; invitedCode?: string }>;
}
export const curatorBeta = () => curator<BetaOverview>('/api/admin/beta');
export const curatorMakeInvites = (count: number, note?: string) =>
  curator<{ codes: string[] }>('/api/admin/invites', { method: 'POST', body: JSON.stringify({ count, note }) });
export const curatorInviteFromWaitlist = (email: string) =>
  curator<{ code: string }>('/api/admin/waitlist/invite', { method: 'POST', body: JSON.stringify({ email }) });
