import { describe, expect, it } from 'vitest';
import { containsHangul, validateEnglishInput } from './hangul';
import { dueCards, newCard, reviewCard } from './srs';
import { freeResponseScore, levenshtein, looksLikeFullSentence, speechAccuracy, toWords } from '@/features/skills/scoring';

describe('Hangul input block', () => {
  it('detects syllables and single jamo', () => {
    expect(containsHangul('very 큰 big')).toBe(true);
    expect(containsHangul('ㄱ')).toBe(true);
    expect(containsHangul('ㅏ')).toBe(true);
    expect(containsHangul('huge = very, very big! 🐘')).toBe(false);
  });
  it('rejects Hangul and empty input, accepts English', () => {
    expect(validateEnglishInput('  ')).toEqual({ ok: false, reason: 'empty' });
    expect(validateEnglishInput('크다')).toEqual({ ok: false, reason: 'hangul' });
    expect(validateEnglishInput('big 가')).toEqual({ ok: false, reason: 'hangul' });
    expect(validateEnglishInput(' very big ')).toEqual({ ok: true, value: 'very big' });
  });
});

describe('Leitner boxes', () => {
  const card = newCard({ word: 'huge', packId: 'p', kind: 'drawing', value: 'k', today: '2026-01-01', now: 1 });
  it('new cards are due tomorrow in box 1', () => {
    expect(card).toMatchObject({ box: 1, due: '2026-01-02' });
  });
  it('correct answers move up with longer gaps; wrong answers go back to box 1', () => {
    const up = reviewCard(card, true, '2026-01-02');
    expect(up).toMatchObject({ box: 2, due: '2026-01-04' });
    const top = reviewCard({ ...card, box: 5 }, true, '2026-01-02');
    expect(top).toMatchObject({ box: 5, due: '2026-01-18' });
    expect(reviewCard(top, false, '2026-01-18')).toMatchObject({ box: 1, due: '2026-01-19' });
  });
  it('lists due cards, lowest box first', () => {
    const a = { ...card, word: 'a', box: 3, due: '2026-01-01' };
    const b = { ...card, word: 'b', box: 1, due: '2026-01-02' };
    const c = { ...card, word: 'c', due: '2026-02-01' };
    expect(dueCards([a, b, c], '2026-01-02').map((x) => x.word)).toEqual(['b', 'a']);
  });
});

describe('local speech scoring', () => {
  it('normalizes words and contractions', () => {
    expect(toWords("Hi! I'm gonna show you.")).toEqual(['hi', 'i', 'am', 'going', 'to', 'show', 'you']);
  });
  it('levenshtein distance on word arrays', () => {
    expect(levenshtein(['a', 'b', 'c'], ['a', 'x', 'c'])).toBe(1);
    expect(levenshtein([], ['a'])).toBe(1);
    expect(levenshtein(['a'], [])).toBe(1);
  });
  it('accuracy is the share of matching words', () => {
    expect(speechAccuracy('Can I sit here?', 'can i sit here')).toBe(1);
    expect(speechAccuracy('Can I sit here?', 'can i sit')).toBe(0.75);
    expect(speechAccuracy('Can I sit here?', '')).toBe(0);
    expect(speechAccuracy('', 'hello')).toBe(0);
  });
  it('detects full sentences and scores free responses', () => {
    expect(looksLikeFullSentence('I like pizza')).toBe(true);
    expect(looksLikeFullSentence('pizza')).toBe(false);
    expect(freeResponseScore('', ['dog'], 5)).toBe(0);
    expect(freeResponseScore('The dog runs in the park', ['dog', 'park'], 5)).toBe(1);
    expect(freeResponseScore('It is fun', ['dog', 'park'], 6)).toBe(0.3);
  });
});
