import { describe, expect, it } from 'vitest';
import { contentWords, makeExercise, makeSet, rewriteScore, rng, shuffled, spellingScore } from './exercises';
import { ALL_PACKS, getPack } from '@/content/loader';
import { containsHangul } from '@/features/dictionary/hangul';
import { SKILLS, type Tier } from '@/types';

const TIERS: Tier[] = [1, 2, 3, 4, 5];

describe('skill exercises', () => {
  it('are deterministic for a seed and never contain Korean', () => {
    for (const skill of SKILLS) {
      for (const tier of TIERS) {
        const a = makeSet(skill, tier, ALL_PACKS, 42);
        expect(makeSet(skill, tier, ALL_PACKS, 42)).toEqual(a);
        expect(a.length).toBeGreaterThanOrEqual(1);
        expect(containsHangul(JSON.stringify(a))).toBe(false);
      }
    }
  });
  it('listening ladder: word→picture, sentence→scene, order, then key words at native speed', () => {
    const types = TIERS.map((t) => makeExercise('listening', t, ALL_PACKS, rng(7)).type);
    expect(types).toEqual(['wordPicture', 'sentenceScene', 'sceneOrder', 'keyWords', 'keyWords']);
  });
  it('every choice question has its answer among the options', () => {
    for (let seed = 0; seed < 40; seed++) {
      for (const tier of TIERS) {
        for (const skill of ['listening', 'reading'] as const) {
          const ex = makeExercise(skill, tier, ALL_PACKS, rng(seed));
          if (ex.type === 'wordPicture' || ex.type === 'sentenceScene' || ex.type === 'definition') {
            expect(ex.options).toContain(ex.answer);
            expect(new Set(ex.options).size).toBe(ex.options.length);
          }
          if (ex.type === 'sceneOrder') expect([...ex.options].sort()).toEqual([...ex.answer].sort());
          if (ex.type === 'keyWords') {
            const text = ex.sentenceIds.map((id) => getPack(ex.packId)!.story.sentences.find((s) => s.id === id)!.text.toLowerCase()).join(' ');
            expect(ex.answers.length).toBeGreaterThan(0);
            for (const a of ex.answers) expect(text).toContain(a);
            for (const o of ex.options.filter((x) => !ex.answers.includes(x))) expect(contentWords(text)).not.toContain(o);
          }
        }
      }
    }
  });
  it('reading has no audio mode; speaking goes echo → shadow → describe → roleplay; writing gets AI only at 4–5', () => {
    expect(makeExercise('reading', 1, ALL_PACKS, rng(1))).toMatchObject({ type: 'sentenceScene', mode: 'read' });
    expect(makeExercise('reading', 2, ALL_PACKS, rng(1)).type).toBe('definition');
    expect(TIERS.map((t) => makeExercise('speaking', t, ALL_PACKS, rng(3)).type)).toEqual(['echo', 'echo', 'describe', 'roleplay', 'roleplay']);
    expect(makeExercise('speaking', 2, ALL_PACKS, rng(3))).toMatchObject({ mode: 'shadow' });
    expect(TIERS.map((t) => makeExercise('writing', t, ALL_PACKS, rng(3)).type)).toEqual(['pictureWord', 'rewrite', 'diary', 'continue', 'email']);
  });
  it('helpers', () => {
    expect(contentWords("Mina walks into a big, bright classroom. It's fun!")).toEqual(['mina', 'walks', 'big', 'bright', 'classroom', 'fun']);
    expect(shuffled([1, 2, 3, 4], rng(1)).sort()).toEqual([1, 2, 3, 4]);
  });
  it('local writing scores', () => {
    expect(spellingScore('pencil', 'Pencil ')).toBe(1);
    expect(spellingScore('pencil', 'pensil')).toBe(0.83);
    expect(spellingScore('pencil', '')).toBe(0);
    expect(rewriteScore('Mina has a red ball.', 'Leo has a blue ball.')).toBe(1);
    expect(rewriteScore('Mina has a red ball.', 'mina has a red ball')).toBe(0.6);
    expect(rewriteScore('Mina has a red ball.', 'hi')).toBe(0.4);
    expect(rewriteScore('Mina has a red ball.', 'Dogs run very fast today')).toBe(0.7);
  });
});
