import { describe, expect, it } from 'vitest';
import { learningStyle, mbtiFromAnswers, MBTI_QUESTIONS, sortByTaste } from './style';

describe('MBTI learning style', () => {
  it('maps each axis to a recommendation, not a label', () => {
    expect(learningStyle('ESTJ')).toEqual({ social: 'E', storyTaste: 'daily', tone: 'reason', planning: 'plan' });
    expect(learningStyle('INFP')).toEqual({ social: 'I', storyTaste: 'adventure', tone: 'warm', planning: 'explore' });
  });
  it('recommends matching story themes first, keeping order inside a theme', () => {
    const packs = [
      { id: 'a', theme: 'daily' as const, order: 1 },
      { id: 'b', theme: 'adventure' as const, order: 2 },
      { id: 'c', theme: 'daily' as const, order: 3 },
    ];
    expect(sortByTaste(packs, 'INFP').map((p) => p.id)).toEqual(['b', 'a', 'c']);
    expect(sortByTaste(packs, 'ISTJ').map((p) => p.id)).toEqual(['a', 'c', 'b']);
    expect(sortByTaste(packs, null).map((p) => p.id)).toEqual(['a', 'c', 'b']);
  });
  it('builds a type from the 4-picture mini test', () => {
    expect(MBTI_QUESTIONS).toHaveLength(4);
    expect(mbtiFromAnswers(['E', 'N', 'F', 'P'])).toBe('ENFP');
    expect(mbtiFromAnswers(['I', 'S', 'T', 'J'])).toBe('ISTJ');
    expect(mbtiFromAnswers([])).toBe('INFP');
  });
});
