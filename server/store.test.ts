import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryStore } from './store';

test('memory store keeps users, posts, personas, quotes and usage apart per user', async () => {
  const s = new MemoryStore();
  await s.updateUser('u1', () => ({ createdAt: 'x', updatedAt: 'x' }));
  assert.ok(await s.getUser('u1'));
  assert.equal(await s.getUser('u2'), null);
  await s.addPost('u1', { id: 'p1', platform: 'Instagram', avatar: '', username: 'a', handle: '@a', content: 'c', likes: 0, comments: 0, shares: 0, createdAt: '1' });
  assert.equal((await s.listPosts('u1', 10)).length, 1);
  assert.equal((await s.listPosts('u2', 10)).length, 0);
  assert.equal(await s.seedQuotes([{ id: 'q-1' } as any, { id: 'q-2' } as any]), 2);
  assert.equal(await s.seedQuotes([{ id: 'q-1' } as any]), 0); // seeding twice adds nothing
  assert.equal(await s.bumpUsage('k'), 1);
  assert.equal(await s.bumpUsage('k'), 2);
  await s.deleteUser('u1');
  assert.equal(await s.getUser('u1'), null);
  assert.equal((await s.listPosts('u1', 10)).length, 0);
});
