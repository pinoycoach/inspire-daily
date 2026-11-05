import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanForBulk } from './curation';

const base = { status: 'pending' as const, flags: [], labels: { theme: 'courage' }, needsSourceCheck: false };

test('approve-all takes clean proverbs but skips named quotes nobody has source-checked', () => {
  assert.equal(cleanForBulk(base), true);
  assert.equal(cleanForBulk({ ...base, needsSourceCheck: true }), false);
  assert.equal(cleanForBulk({ ...base, needsSourceCheck: true, sourceChecked: true }), true);
  assert.equal(cleanForBulk({ ...base, needsSourceCheck: true, sourceChecked: true, flags: ['Check who really said this'] }), false);
  assert.equal(cleanForBulk({ ...base, labels: undefined }), false);
  assert.equal(cleanForBulk({ ...base, status: 'approved' }), false);
});
