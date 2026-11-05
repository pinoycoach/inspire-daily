import assert from 'node:assert/strict';
import test from 'node:test';
import { createSessions } from './session';

test('tokens verify, forged or tampered tokens do not', () => {
  const s = createSessions('secret-a');
  const { uid, token } = s.issue();
  assert.equal(s.verify(token), uid);
  const other = createSessions('secret-b');
  assert.equal(other.verify(token), null); // different server secret
  const [, sig] = token.split('.');
  const fakeUid = 'f'.repeat(32);
  assert.equal(s.verify(`${fakeUid}.${sig}`), null); // someone else's id with my signature
  assert.equal(s.verify('nonsense'), null);
  assert.equal(s.verify(undefined), null);
});

test('media signatures are per file', () => {
  const s = createSessions('secret-a');
  const sig = s.mediaSig('posts/abc/1.png');
  assert.equal(s.mediaSigValid('posts/abc/1.png', sig), true);
  assert.equal(s.mediaSigValid('posts/abc/2.png', sig), false);
});
