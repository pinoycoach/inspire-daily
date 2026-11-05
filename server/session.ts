// Anonymous sessions: each browser gets a random ID plus a signature only this server can make,
// so nobody can read or change someone else's data by guessing an ID.
import crypto from 'crypto';

export const createSessions = (secret: string) => {
  const sign = (value: string) => crypto.createHmac('sha256', secret).update(value).digest('base64url');
  const safeEqual = (a: string, b: string) => {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && crypto.timingSafeEqual(x, y);
  };
  return {
    /** A new anonymous user: returns the token the browser keeps ("uid.signature"). */
    issue() {
      const uid = crypto.randomBytes(16).toString('hex');
      return { uid, token: `${uid}.${sign(`uid:${uid}`)}` };
    },
    /** The token for an existing uid (signing in on another device). */
    tokenFor(uid: string) {
      return `${uid}.${sign(`uid:${uid}`)}`;
    },
    /** The uid if the token is genuine, otherwise null. */
    verify(token: unknown): string | null {
      if (typeof token !== 'string') return null;
      const [uid, sig] = token.split('.');
      if (!uid || !sig || !/^[a-f0-9]{32}$/.test(uid)) return null;
      return safeEqual(sig, sign(`uid:${uid}`)) ? uid : null;
    },
    /** A signature for one media file, so an <img> link works without headers but can't be guessed. */
    mediaSig(path: string) {
      return sign(`media:${path}`).slice(0, 32);
    },
    mediaSigValid(path: string, sig: unknown) {
      return typeof sig === 'string' && safeEqual(sig, sign(`media:${path}`).slice(0, 32));
    },
  };
};
