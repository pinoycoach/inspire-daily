// Where Inspire keeps its data. Firestore in production (only this server can reach it, using the
// Cloud Run identity); an in-memory copy for local runs and tests (DATA_STORE=memory).
import type { Post, Persona, UserBrandSettings } from '../types';
import type { TimelessQuote } from '../data/quotesDatabase';
import type { LibraryPiece, PieceStatus } from './library';
import type { DayDoc } from '../shared/daily';
import { checkRedeem, type AccountDoc, type InviteDoc, type Membership, type RedeemResult, type WaitlistDoc } from './accounts';

export interface UserDoc {
  brandSettings?: UserBrandSettings;
  /** Set once an invite is redeemed (or for the founder). */
  member?: Membership;
  /** The Google account signed in on this user, for display. */
  account?: { email: string; name: string };
  createdAt: string;
  updatedAt: string;
}

// A saved post. The picture lives in media storage; `imagePath` points at it.
export type StoredPost = Omit<Post, 'imageUrl'> & { imagePath?: string; createdAt: string };

export interface Store {
  kind: 'firestore' | 'memory';
  getUser(uid: string): Promise<UserDoc | null>;
  /** Read-modify-write in one transaction, so two quick taps can't overwrite each other. */
  updateUser(uid: string, fn: (current: UserDoc | null) => UserDoc): Promise<UserDoc>;
  deleteUser(uid: string): Promise<void>;
  listPosts(uid: string, limit: number): Promise<StoredPost[]>;
  addPost(uid: string, post: StoredPost): Promise<void>;
  listPersonas(uid: string): Promise<Persona[]>;
  addPersona(uid: string, persona: Persona): Promise<void>;
  listQuotes(): Promise<TimelessQuote[]>;
  seedQuotes(quotes: TimelessQuote[]): Promise<number>;
  /** Adds 1 to a daily counter and returns the new count. */
  bumpUsage(key: string): Promise<number>;
  getUsage(key: string): Promise<number>;
  listLibrary(status?: PieceStatus): Promise<LibraryPiece[]>;
  getPiece(id: string): Promise<LibraryPiece | null>;
  putPiece(piece: LibraryPiece): Promise<void>;
  /** Adds pieces whose ids aren't there yet; returns how many were added. */
  seedLibrary(pieces: LibraryPiece[]): Promise<number>;
  getDay(day: string): Promise<DayDoc | null>;
  /** Saves the day unless it exists; returns what's stored (the first one wins, so two visitors see the same three). */
  createDay(doc: DayDoc): Promise<DayDoc>;
  /** Saved days, newest first, before `before` (exclusive) when given. */
  listDays(limit: number, before?: string): Promise<DayDoc[]>;
  getAccount(sub: string): Promise<AccountDoc | null>;
  /** Creates the link unless one exists; returns the link that's stored (the existing one wins). */
  linkAccount(account: AccountDoc): Promise<AccountDoc>;
  listAccounts(limit: number): Promise<AccountDoc[]>;
  deleteAccountsForUid(uid: string): Promise<void>;
  addInvites(invites: InviteDoc[]): Promise<void>;
  listInvites(createdBy: string, limit: number): Promise<InviteDoc[]>;
  /** Marks the invite used by `uid` if allowed, in one transaction. */
  redeemInvite(code: string, uid: string): Promise<{ result: RedeemResult; createdBy?: string }>;
  deleteUnusedInvites(createdBy: string): Promise<void>;
  /** False when the email is already on the list. */
  addToWaitlist(entry: WaitlistDoc): Promise<boolean>;
  listWaitlist(limit: number): Promise<WaitlistDoc[]>;
  markWaitlistInvited(email: string, code: string): Promise<void>;
}

export interface MediaStore {
  put(path: string, data: Buffer, contentType: string): Promise<void>;
  get(path: string): Promise<{ data: Buffer; contentType: string } | null>;
  deletePrefix(prefix: string): Promise<void>;
}

// ---------- In memory ----------

export class MemoryStore implements Store {
  kind = 'memory' as const;
  private users = new Map<string, UserDoc>();
  private posts = new Map<string, StoredPost[]>();
  private personas = new Map<string, Persona[]>();
  private quotes: TimelessQuote[] = [];
  private usage = new Map<string, number>();
  private library = new Map<string, LibraryPiece>();
  private days = new Map<string, DayDoc>();
  private accounts = new Map<string, AccountDoc>();
  private invites = new Map<string, InviteDoc>();
  private waitlist = new Map<string, WaitlistDoc>();

  async getUser(uid: string) {
    const u = this.users.get(uid);
    return u ? structuredClone(u) : null;
  }
  async updateUser(uid: string, fn: (current: UserDoc | null) => UserDoc) {
    const next = fn(await this.getUser(uid));
    this.users.set(uid, structuredClone(next));
    return next;
  }
  async deleteUser(uid: string) {
    this.users.delete(uid);
    this.posts.delete(uid);
    this.personas.delete(uid);
  }
  async listPosts(uid: string, limit: number) {
    return (this.posts.get(uid) || []).slice(0, limit);
  }
  async addPost(uid: string, post: StoredPost) {
    this.posts.set(uid, [post, ...(this.posts.get(uid) || [])]);
  }
  async listPersonas(uid: string) {
    return [...(this.personas.get(uid) || [])];
  }
  async addPersona(uid: string, persona: Persona) {
    this.personas.set(uid, [...(this.personas.get(uid) || []), persona]);
  }
  async listQuotes() {
    return [...this.quotes];
  }
  async seedQuotes(quotes: TimelessQuote[]) {
    const ids = new Set(this.quotes.map((q) => q.id));
    const fresh = quotes.filter((q) => !ids.has(q.id));
    this.quotes.push(...fresh);
    return fresh.length;
  }
  async bumpUsage(key: string) {
    const n = (this.usage.get(key) || 0) + 1;
    this.usage.set(key, n);
    return n;
  }
  async getUsage(key: string) {
    return this.usage.get(key) || 0;
  }
  async listLibrary(status?: PieceStatus) {
    return [...this.library.values()].filter((p) => !status || p.status === status).map((p) => structuredClone(p));
  }
  async getPiece(id: string) {
    const p = this.library.get(id);
    return p ? structuredClone(p) : null;
  }
  async putPiece(piece: LibraryPiece) {
    this.library.set(piece.id, structuredClone(piece));
  }
  async seedLibrary(pieces: LibraryPiece[]) {
    const fresh = pieces.filter((p) => !this.library.has(p.id));
    fresh.forEach((p) => this.library.set(p.id, structuredClone(p)));
    return fresh.length;
  }
  async getDay(day: string) {
    const d = this.days.get(day);
    return d ? structuredClone(d) : null;
  }
  async createDay(doc: DayDoc) {
    if (!this.days.has(doc.day)) this.days.set(doc.day, structuredClone(doc));
    return structuredClone(this.days.get(doc.day)!);
  }
  async listDays(limit: number, before?: string) {
    return [...this.days.values()]
      .filter((d) => !before || d.day < before)
      .sort((a, b) => b.day.localeCompare(a.day))
      .slice(0, limit)
      .map((d) => structuredClone(d));
  }
  async getAccount(sub: string) {
    const a = this.accounts.get(sub);
    return a ? { ...a } : null;
  }
  async linkAccount(account: AccountDoc) {
    const existing = this.accounts.get(account.sub);
    if (existing) return { ...existing };
    this.accounts.set(account.sub, { ...account });
    return { ...account };
  }
  async listAccounts(limit: number) {
    return [...this.accounts.values()].sort((a, b) => b.linkedAt.localeCompare(a.linkedAt)).slice(0, limit);
  }
  async deleteAccountsForUid(uid: string) {
    for (const [sub, a] of this.accounts) if (a.uid === uid) this.accounts.delete(sub);
  }
  async addInvites(invites: InviteDoc[]) {
    invites.forEach((i) => this.invites.set(i.code, { ...i }));
  }
  async listInvites(createdBy: string, limit: number) {
    return [...this.invites.values()].filter((i) => i.createdBy === createdBy).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }
  async redeemInvite(code: string, uid: string) {
    const invite = this.invites.get(code) || null;
    const result = checkRedeem(invite, uid);
    if (result === 'ok' && invite && !invite.usedBy) this.invites.set(code, { ...invite, usedBy: uid, usedAt: new Date().toISOString() });
    return { result, createdBy: invite?.createdBy };
  }
  async deleteUnusedInvites(createdBy: string) {
    for (const [code, i] of this.invites) if (i.createdBy === createdBy && !i.usedBy) this.invites.delete(code);
  }
  async addToWaitlist(entry: WaitlistDoc) {
    if (this.waitlist.has(entry.email)) return false;
    this.waitlist.set(entry.email, { ...entry });
    return true;
  }
  async listWaitlist(limit: number) {
    return [...this.waitlist.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, limit);
  }
  async markWaitlistInvited(email: string, code: string) {
    const w = this.waitlist.get(email);
    if (w) this.waitlist.set(email, { ...w, invitedCode: code });
  }
}

export class MemoryMedia implements MediaStore {
  private files = new Map<string, { data: Buffer; contentType: string }>();
  async put(path: string, data: Buffer, contentType: string) {
    this.files.set(path, { data, contentType });
  }
  async get(path: string) {
    return this.files.get(path) || null;
  }
  async deletePrefix(prefix: string) {
    for (const k of [...this.files.keys()]) if (k.startsWith(prefix)) this.files.delete(k);
  }
}

// ---------- Firestore ----------

export async function createFirestoreStore(): Promise<Store> {
  const { Firestore, FieldValue } = await import('@google-cloud/firestore');
  // FIRESTORE_DATABASE picks a named database, so this app never shares data with another app in the same project.
  const db = new Firestore({
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    ...(process.env.FIRESTORE_DATABASE ? { databaseId: process.env.FIRESTORE_DATABASE } : {}),
    ignoreUndefinedProperties: true,
  });
  const userRef = (uid: string) => db.collection('users').doc(uid);

  const deleteCollection = async (ref: FirebaseFirestore.CollectionReference) => {
    for (;;) {
      const snap = await ref.limit(200).get();
      if (snap.empty) return;
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  };

  return {
    kind: 'firestore',
    async getUser(uid) {
      const snap = await userRef(uid).get();
      return snap.exists ? (snap.data() as UserDoc) : null;
    },
    async updateUser(uid, fn) {
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef(uid));
        const next = fn(snap.exists ? (snap.data() as UserDoc) : null);
        tx.set(userRef(uid), next);
        return next;
      });
    },
    async deleteUser(uid) {
      await deleteCollection(userRef(uid).collection('posts'));
      await deleteCollection(userRef(uid).collection('personas'));
      await userRef(uid).delete();
    },
    async listPosts(uid, limit) {
      const snap = await userRef(uid).collection('posts').orderBy('createdAt', 'desc').limit(limit).get();
      return snap.docs.map((d) => d.data() as StoredPost);
    },
    async addPost(uid, post) {
      await userRef(uid).collection('posts').doc(post.id).set(post);
    },
    async listPersonas(uid) {
      const snap = await userRef(uid).collection('personas').get();
      return snap.docs.map((d) => d.data() as Persona);
    },
    async addPersona(uid, persona) {
      await userRef(uid).collection('personas').doc(String(persona.id)).set(persona);
    },
    async listQuotes() {
      const snap = await db.collection('quotes').get();
      return snap.docs.map((d) => d.data() as TimelessQuote).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    },
    async seedQuotes(quotes) {
      const existing = new Set((await db.collection('quotes').select().get()).docs.map((d) => d.id));
      const fresh = quotes.filter((q) => !existing.has(q.id));
      for (let i = 0; i < fresh.length; i += 400) {
        const batch = db.batch();
        fresh.slice(i, i + 400).forEach((q) => batch.set(db.collection('quotes').doc(q.id), q));
        await batch.commit();
      }
      return fresh.length;
    },
    async bumpUsage(key) {
      const ref = db.collection('usage').doc(key);
      await ref.set({ count: FieldValue.increment(1), updatedAt: new Date().toISOString() }, { merge: true });
      return ((await ref.get()).data()?.count as number) || 1;
    },
    async getUsage(key) {
      return ((await db.collection('usage').doc(key).get()).data()?.count as number) || 0;
    },
    async listLibrary(status) {
      const ref = db.collection('library');
      const snap = await (status ? ref.where('status', '==', status) : ref).get();
      return snap.docs.map((d) => d.data() as LibraryPiece);
    },
    async getPiece(id) {
      const snap = await db.collection('library').doc(id).get();
      return snap.exists ? (snap.data() as LibraryPiece) : null;
    },
    async putPiece(piece) {
      await db.collection('library').doc(piece.id).set(piece);
    },
    async seedLibrary(pieces) {
      const existing = new Set((await db.collection('library').select().get()).docs.map((d) => d.id));
      const fresh = pieces.filter((p) => !existing.has(p.id));
      for (let i = 0; i < fresh.length; i += 400) {
        const batch = db.batch();
        fresh.slice(i, i + 400).forEach((p) => batch.set(db.collection('library').doc(p.id), p));
        await batch.commit();
      }
      return fresh.length;
    },
    async getDay(day) {
      const snap = await db.collection('days').doc(day).get();
      return snap.exists ? (snap.data() as DayDoc) : null;
    },
    async createDay(doc) {
      const ref = db.collection('days').doc(doc.day);
      try {
        await ref.create(doc);
        return doc;
      } catch (err: any) {
        // ALREADY_EXISTS: someone else saved today first; theirs stands.
        if (err?.code !== 6) throw err;
        return (await ref.get()).data() as DayDoc;
      }
    },
    async listDays(limit, before) {
      let q = db.collection('days').orderBy('day', 'desc');
      if (before) q = q.where('day', '<', before);
      const snap = await q.limit(limit).get();
      return snap.docs.map((d) => d.data() as DayDoc);
    },
    async getAccount(sub) {
      const snap = await db.collection('accounts').doc(sub).get();
      return snap.exists ? (snap.data() as AccountDoc) : null;
    },
    async linkAccount(account) {
      const ref = db.collection('accounts').doc(account.sub);
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists) return snap.data() as AccountDoc;
        tx.set(ref, account);
        return account;
      });
    },
    async listAccounts(limit) {
      const snap = await db.collection('accounts').orderBy('linkedAt', 'desc').limit(limit).get();
      return snap.docs.map((d) => d.data() as AccountDoc);
    },
    async deleteAccountsForUid(uid) {
      const snap = await db.collection('accounts').where('uid', '==', uid).get();
      await Promise.all(snap.docs.map((d) => d.ref.delete()));
    },
    async addInvites(invites) {
      const batch = db.batch();
      invites.forEach((i) => batch.set(db.collection('invites').doc(i.code), i));
      await batch.commit();
    },
    async listInvites(createdBy, limit) {
      const snap = await db.collection('invites').where('createdBy', '==', createdBy).get();
      return snap.docs
        .map((d) => d.data() as InviteDoc)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    },
    async redeemInvite(code, uid) {
      const ref = db.collection('invites').doc(code);
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const invite = snap.exists ? (snap.data() as InviteDoc) : null;
        const result = checkRedeem(invite, uid);
        if (result === 'ok' && invite && !invite.usedBy) tx.update(ref, { usedBy: uid, usedAt: new Date().toISOString() });
        return { result, createdBy: invite?.createdBy };
      });
    },
    async deleteUnusedInvites(createdBy) {
      const snap = await db.collection('invites').where('createdBy', '==', createdBy).get();
      await Promise.all(snap.docs.filter((d) => !d.data().usedBy).map((d) => d.ref.delete()));
    },
    async addToWaitlist(entry) {
      try {
        await db.collection('waitlist').doc(entry.email).create(entry);
        return true;
      } catch (err: any) {
        if (err?.code === 6) return false; // ALREADY_EXISTS
        throw err;
      }
    },
    async listWaitlist(limit) {
      const snap = await db.collection('waitlist').orderBy('createdAt', 'asc').limit(limit).get();
      return snap.docs.map((d) => d.data() as WaitlistDoc);
    },
    async markWaitlistInvited(email, code) {
      await db.collection('waitlist').doc(email).set({ invitedCode: code }, { merge: true });
    },
  };
}

export async function createGcsMedia(bucketName: string): Promise<MediaStore> {
  const { Storage } = await import('@google-cloud/storage');
  const bucket = new Storage().bucket(bucketName);
  return {
    async put(path, data, contentType) {
      await bucket.file(path).save(data, { contentType, resumable: false });
    },
    async get(path) {
      const file = bucket.file(path);
      const [exists] = await file.exists();
      if (!exists) return null;
      const [[data], [meta]] = await Promise.all([file.download(), file.getMetadata()]);
      return { data, contentType: meta.contentType || 'application/octet-stream' };
    },
    async deletePrefix(prefix) {
      await bucket.deleteFiles({ prefix, force: true });
    },
  };
}
