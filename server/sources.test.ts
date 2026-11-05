import assert from 'node:assert/strict';
import test from 'node:test';
import { knownMisattribution, classifyWikiquote, checkWikiquote, needsSourceCheck, sourceFlags, isSourceFlag, authorName } from './sources';
import { QUOTES_DATABASE } from '../data/quotesDatabase';

test('the known list catches the famous misattributions, only when credited to the wrong person', () => {
  assert.ok(knownMisattribution('The people who are crazy enough to think they can change the world are the ones who do.', 'Steve Jobs (1955–2011)'));
  assert.ok(knownMisattribution('Whatever you can do, or dream you can, begin it.', 'Johann Wolfgang von Goethe'));
  assert.ok(knownMisattribution('Every great dream begins with a dreamer.', 'Harriet Tubman'));
  assert.ok(knownMisattribution('Insanity is doing the same thing over and over and expecting different results.', 'Albert Einstein'));
  assert.equal(knownMisattribution('The people who are crazy enough to think they can change the world are the ones who do.', 'Apple’s “Think Different” ad (1997)'), null);
  assert.equal(knownMisattribution('Whatever you can do, or dream you can, begin it.', 'John Anster, after Goethe’s Faust (1835)'), null);
  assert.equal(knownMisattribution('We suffer more often in imagination than in reality.', 'Seneca'), null);
});

test('none of the starter quotes is on the known-misattributions list', () => {
  for (const q of QUOTES_DATABASE) assert.equal(knownMisattribution(q.originalQuote, q.author), null, q.author);
});

const PAGE = `Intro text.
== Quotes ==
* We suffer more often in [[imagination]] than in '''reality'''.
** Letter 13
=== Letters ===
* Luck is what happens when preparation meets opportunity.
== Disputed ==
* Sometimes even to live is an act of courage.
== Misattributed ==
* Every new beginning comes from some other beginning's end.
== Quotes about Seneca ==
* He was a wise man and an honest one, said someone else.`;

test('Wikiquote pages are read by section', () => {
  assert.equal(classifyWikiquote(PAGE, 'We suffer more often in imagination than in reality.'), 'found');
  assert.equal(classifyWikiquote(PAGE, 'Luck is what happens when preparation meets opportunity.'), 'found');
  assert.equal(classifyWikiquote(PAGE, 'Sometimes even to live is an act of courage.'), 'unsourced');
  assert.equal(classifyWikiquote(PAGE, 'Every new beginning comes from some other beginning’s end.'), 'misattributed');
  assert.equal(classifyWikiquote(PAGE, 'He was a wise man and an honest one.'), 'not-found');
  assert.equal(classifyWikiquote(PAGE, 'Nothing like this is on the page at all.'), 'not-found');
});

const fakeFetch = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

test('the lookup asks for the author page and fails safe', async () => {
  const wiki = 'https://wq.test';
  const ok = await checkWikiquote('We suffer more often in imagination than in reality.', 'Seneca (4 BC–65 AD)', wiki, fakeFetch({ parse: { wikitext: PAGE } }));
  assert.deepEqual(ok, { result: 'found', url: 'https://wq.test/wiki/Seneca' });
  assert.equal((await checkWikiquote('x y z w', 'Nobody', wiki, fakeFetch({ error: { code: 'missingtitle' } }))).result, 'not-found');
  assert.equal((await checkWikiquote('x y z w', 'Seneca', wiki, fakeFetch('Too many requests', 429))).result, 'unavailable');
  assert.equal((await checkWikiquote('x y z w', 'Seneca', 'off', fakeFetch({}))).result, 'unavailable');
  const boom = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
  assert.equal((await checkWikiquote('x y z w', 'Seneca', wiki, boom)).result, 'unavailable');
});

test('who gets checked, and the flags a check adds', () => {
  assert.equal(authorName('Marcus Aurelius (121–180 AD)'), 'Marcus Aurelius');
  assert.equal(needsSourceCheck({ kind: 'quote', author: 'Seneca' }), true);
  assert.equal(needsSourceCheck({ kind: 'proverb', author: 'Filipino proverb (salawikain)' }), false);
  assert.equal(needsSourceCheck({ kind: 'own', author: 'Napoleon' }), false);
  assert.equal(needsSourceCheck({ kind: 'quote', author: 'Japanese proverb' }), false);
  const flags = sourceFlags({ wikiquote: 'misattributed', known: 'Apple ad', checkedAt: '' });
  assert.equal(flags.length, 2);
  assert.ok(flags.every(isSourceFlag));
  assert.deepEqual(sourceFlags({ wikiquote: 'not-found', checkedAt: '' }), []);
});
