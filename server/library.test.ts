import assert from 'node:assert/strict';
import test from 'node:test';
import { looksLikeCrisis, applyLabels, quotesAreReal, rankPieces, failedChecks, starterPieces, type LibraryPiece } from './library';
import { MemoryStore } from './store';
import { QUOTES_DATABASE } from '../data/quotesDatabase';

const piece = (id: string, text: string, extra: Partial<LibraryPiece> = {}): LibraryPiece => ({
  id, text, author: 'A', kind: 'quote', status: 'approved', flags: [], createdAt: '1', ...extra,
});

test('the safety gate catches crisis words in English and Tagalog, not ordinary bad days', () => {
  for (const t of ['I want to kill myself', 'thinking about suicide', "I don't want to live anymore", 'gusto ko nang mamatay', 'ayoko nang mabuhay', 'everyone is better off without me']) {
    assert.ok(looksLikeCrisis(t), t);
  }
  for (const t of ['I am so tired of work', 'my boss is killing me with deadlines', 'pagod na ako', 'I feel lost']) {
    assert.ok(!looksLikeCrisis(t), t);
  }
});

test('labels turn into curator flags', () => {
  const r = applyLabels({ theme: { choice: 'grief' }, mood: { choice: 'sad' }, prediction: { noul: 0.8 }, preachy: { noul: 0.1 }, attribution: { noul: 0.2 } });
  assert.equal(r.labels?.theme, 'grief');
  assert.deepEqual(r.flags, ['Sounds like a prediction or fortune-telling', 'Check who really said this']);
  assert.deepEqual(applyLabels(null).flags, ['Not labeled yet (JEV unavailable)']);
  assert.equal(applyLabels({ theme: { choice: 'astrology' } }).labels?.theme, undefined); // unknown choices are dropped
});

test('a reply may only quote words that are in the chosen pieces', () => {
  const chosen = [piece('a', 'We suffer more often in imagination than in reality.')];
  assert.ok(quotesAreReal('As Seneca put it, "we suffer more often in imagination than in reality." Rest tonight.', chosen));
  assert.ok(!quotesAreReal('As Seneca said, "the stars have a plan for you today." Rest tonight.', chosen));
  assert.ok(quotesAreReal('Take one small step. "You got this" works too.', chosen)); // short phrases are not quotes
});

test('ranking uses meaning first, then the mood and theme JEV read', () => {
  const pool = [
    piece('far', 'x', { embedding: [0, 1] }),
    piece('near', 'y', { embedding: [1, 0.1] }),
    piece('mood', 'z', { embedding: [0.7, 0.7], labels: { mood: 'tired' } }),
  ];
  assert.deepEqual(rankPieces(pool, { text: 'q', embedding: [1, 0] }, 3).map((p) => p.id), ['near', 'mood', 'far']);
  // Without embeddings: shared words.
  const plain = [piece('a', 'patience brings harvest'), piece('b', 'courage before fear')];
  assert.equal(rankPieces(plain, { text: 'I have no courage', }, 1)[0].id, 'b');
});

test('failed draft checks are the ones JEV thinks are likely', () => {
  assert.deepEqual(failedChecks({ predicts: { noul: 0.9 }, promises: { noul: 0.2 }, sells: { noul: 0.5 } }), ['predicts', 'sells']);
});

test('starter pieces wait for review, and seeding twice adds nothing', async () => {
  const pieces = starterPieces(QUOTES_DATABASE);
  assert.ok(pieces.every((p) => p.status === 'pending'));
  const s = new MemoryStore();
  assert.equal(await s.seedLibrary(pieces), pieces.length);
  assert.equal(await s.seedLibrary(pieces), 0);
  assert.equal((await s.listLibrary('approved')).length, 0);
});

test('the draft check includes misreading the person or talking about itself', async () => {
  const { checkQuestions, checkState } = await import('./library');
  assert.ok('misreads' in checkQuestions());
  assert.ok(checkState('i am ok', "I'm doing well", []).startsWith('What the person wrote:\ni am ok'));
  assert.deepEqual(failedChecks({ misreads: { noul: 0.8 }, predicts: { noul: 0.1 } }), ['misreads']);
});
