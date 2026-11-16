import { describe, expect, it } from 'vitest';
import { emptyStoryProgress, isDictStepDone, isStepAvailable, isStoryComplete, isUseItUnlocked, medalIcon, nextStep, upgradeMedal, type StoryProgress } from './unlock';

function progress(patch: Partial<StoryProgress['steps']>, listenCount = 0): StoryProgress {
  const p = emptyStoryProgress();
  return { ...p, steps: { ...p.steps, ...patch }, listenCount };
}

describe('Use It! unlock (input before output)', () => {
  const inputDone = { look: true, read: true, dict: true, bedtime: true };
  it('is locked until steps 1–4 are done AND the story was heard 3 times', () => {
    expect(isUseItUnlocked(progress({}, 10))).toBe(false);
    expect(isUseItUnlocked(progress(inputDone, 2))).toBe(false);
    expect(isUseItUnlocked(progress({ ...inputDone, bedtime: false }, 5))).toBe(false);
    expect(isUseItUnlocked(progress(inputDone, 3))).toBe(true);
  });
  it('steps open strictly in order', () => {
    const fresh = progress({});
    expect(isStepAvailable(fresh, 'look')).toBe(true);
    expect(isStepAvailable(fresh, 'read')).toBe(false);
    expect(isStepAvailable(progress({ look: true }), 'read')).toBe(true);
    expect(isStepAvailable(progress({ look: true, read: true }), 'bedtime')).toBe(false);
    expect(isStepAvailable(progress(inputDone, 1), 'useIt')).toBe(false);
  });
  it('nextStep and completion', () => {
    expect(nextStep(progress({}))).toBe('look');
    expect(nextStep(progress({ look: true, read: true }))).toBe('dict');
    const all = progress({ ...inputDone, useIt: true }, 3);
    expect(nextStep(all)).toBeNull();
    expect(isStoryComplete(all)).toBe(true);
  });
  it('dictionary step needs 3 words (or all, for tiny stories)', () => {
    expect(isDictStepDone(2, 8)).toBe(false);
    expect(isDictStepDone(3, 8)).toBe(true);
    expect(isDictStepDone(2, 2)).toBe(true);
  });
  it('speed medals only go up', () => {
    expect(upgradeMedal('none', 'slow')).toBe('bronze');
    expect(upgradeMedal('bronze', 'native')).toBe('gold');
    expect(upgradeMedal('gold', 'slow')).toBe('gold');
    expect(medalIcon('silver')).toBe('🥈');
    expect(medalIcon('none')).toBe('');
  });
});
