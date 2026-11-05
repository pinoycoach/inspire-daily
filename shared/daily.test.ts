import assert from 'node:assert/strict';
import test from 'node:test';
import { pickForDay, dayIn, isDay, type DayDoc } from './daily';

const piece = (id: string, reviewedAt: string) => ({ id, text: `t${id}`, author: 'A', kind: 'quote', createdAt: '2026-01-01', reviewedAt });

test('new pieces come first, in the order they were approved', () => {
  const approved = [piece('c', '2026-03-03'), piece('a', '2026-03-01'), piece('b', '2026-03-02'), piece('d', '2026-03-04')];
  assert.deepEqual(pickForDay(approved, []).map((p) => p.id), ['a', 'b', 'c']);
});

test('pieces already shown wait until the new ones run out, oldest showing first', () => {
  const approved = ['a', 'b', 'c', 'd', 'e'].map((id, i) => piece(id, `2026-03-0${i + 1}`));
  const past: DayDoc[] = [
    { day: '2026-03-10', pieces: [{ id: 'b', text: '', author: '', kind: 'quote' }], createdAt: '' },
    { day: '2026-03-09', pieces: [{ id: 'a', text: '', author: '', kind: 'quote' }], createdAt: '' },
  ];
  assert.deepEqual(pickForDay(approved, past).map((p) => p.id), ['c', 'd', 'e']);
  assert.deepEqual(pickForDay(approved.slice(0, 3), past).map((p) => p.id), ['c', 'a', 'b']);
});

test('never more than three, never the same piece twice, and only the public fields', () => {
  const picked = pickForDay([piece('a', '1'), piece('b', '2')], []);
  assert.equal(picked.length, 2);
  assert.deepEqual(Object.keys(picked[0]).sort(), ['author', 'id', 'kind', 'text']);
});

test('the day follows the chosen time zone', () => {
  const t = new Date('2026-11-05T20:00:00Z');
  assert.equal(dayIn('Asia/Manila', t), '2026-11-06');
  assert.equal(dayIn('America/New_York', t), '2026-11-05');
  assert.ok(isDay('2026-11-05') && !isDay('2026-11-5') && !isDay(undefined));
});
