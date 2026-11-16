import { describe, expect, it } from 'vitest';
import { buildQuests, currentStoryPack, listeningPlan, questStyle, questZones, recommendForStyle } from './quests';
import { defaultSave } from '@/save/schema';
import { ALL_PACKS } from '@/content/loader';
import { totalXpForLevel } from '@/features/progression/levels';
import { detectQuality, qualityConfig, resolveQuality } from '@/world/quality';
import { shouldShowUpdateBanner } from '@/app/updateBanner';

describe('quest log', () => {
  it('starts with the first story and locked output skills', () => {
    const quests = buildQuests(defaultSave(), ALL_PACKS, '2026-01-01');
    expect(quests[0]).toMatchObject({ kind: 'main', title: 'The New School', detail: 'Look & Listen', zoneId: 'classroom' });
    expect(quests.find((q) => q.id === 'skill-listening')?.locked).toBe(false);
    expect(quests.find((q) => q.id === 'skill-speaking')?.locked).toBe(true);
    expect(quests.find((q) => q.id === 'skill-writing')?.locked).toBe(true);
    expect(quests.find((q) => q.id === 'graduation')?.locked).toBe(true);
    expect(questZones(quests)).toEqual(['classroom']);
  });
  it('sends the player home for bedtime and tells them to listen again before Use It!', () => {
    const save = defaultSave();
    const id = ALL_PACKS[0]!.meta.id;
    save.stories[id] = { steps: { look: true, read: true, dict: true, bedtime: false, useIt: false }, listenCount: 2, medal: 'bronze', phrases: [], dictWords: [] };
    expect(buildQuests(save, ALL_PACKS, 'd')[0]).toMatchObject({ detail: 'Bedtime Listening', zoneId: 'home' });
    save.stories[id]!.steps.bedtime = true;
    expect(buildQuests(save, ALL_PACKS, 'd')[0]?.detail).toBe('Listen again! 👂 2/3');
    save.stories[id]!.steps.useIt = true;
    save.stories[id]!.listenCount = 3;
    expect(currentStoryPack(save, ALL_PACKS)?.meta.id).toBe(ALL_PACKS[1]!.meta.id);
  });
  it('daily quests track today only; graduation opens with level + input hours', () => {
    const save = defaultSave();
    save.daily = { day: '2026-01-01', listens: 2, words: 0 };
    save.input = { totalSeconds: 10 * 3600, bedtimeDay: '2026-01-01', bedtimeSeconds: 700 };
    save.xp = totalXpForLevel(20);
    const today = buildQuests(save, ALL_PACKS, '2026-01-01');
    expect(today.find((q) => q.id === 'daily-listen')?.done).toBe(true);
    expect(today.find((q) => q.id === 'daily-word')?.done).toBe(false);
    expect(today.find((q) => q.id === 'daily-bedtime')?.done).toBe(true);
    expect(today.find((q) => q.id === 'graduation')).toMatchObject({ locked: false, overlay: { type: 'exam' } });
    const tomorrow = buildQuests(save, ALL_PACKS, '2026-01-02');
    expect(tomorrow.find((q) => q.id === 'daily-listen')?.done).toBe(false);
    expect(tomorrow.find((q) => q.id === 'daily-bedtime')?.done).toBe(false);
  });
  it('J types get a checklist and a listening plan; P types get surprise events', () => {
    expect(questStyle('ISTJ')).toEqual({ checklistFirst: true, surpriseEvents: false });
    expect(questStyle('ENFP')).toEqual({ checklistFirst: false, surpriseEvents: true });
    expect(listeningPlan(defaultSave())).toEqual({ minutesPerDay: 20, daysLeft: 30, hoursLeft: 10 });
    const career = defaultSave();
    career.graduated = ['elementary', 'middle', 'high', 'college'];
    expect(listeningPlan(career)).toBeNull();
    expect(buildQuests(career, ALL_PACKS, 'd').some((q) => q.id === 'career')).toBe(true);
  });
});

describe('E / I recommendations', () => {
  it('puts talk quests first for E and library quests first for I, without unlocking anything', () => {
    const save = defaultSave();
    save.skills.listening.done = 1;
    const quests = buildQuests(save, ALL_PACKS, 'd');
    const subs = (mbti: 'ENFP' | 'ISTJ') => recommendForStyle(quests, mbti).filter((q) => q.kind === 'sub');
    expect(subs('ENFP')[0]).toMatchObject({ id: 'real-talk', title: 'Real Talk ⭐' });
    expect(subs('ISTJ')[0]).toMatchObject({ id: 'skill-reading', title: 'Reading practice ⭐' });
    // 잠긴 말하기·쓰기는 추천되어도 여전히 잠겨 있다
    expect(subs('ENFP').find((q) => q.id === 'skill-speaking')).toMatchObject({ locked: true, title: 'Speaking practice' });
    expect(recommendForStyle(quests, null)).toEqual(quests);
    expect(recommendForStyle(quests, 'ISTJ').filter((q) => q.kind !== 'sub')).toEqual(quests.filter((q) => q.kind !== 'sub'));
  });
});

describe('graphics quality', () => {
  it('picks Low for budget phones', () => {
    expect(detectQuality({ cores: 4, memoryGb: 3, mobile: true })).toBe('low');
    expect(detectQuality({ cores: 8, memoryGb: 6, mobile: true })).toBe('medium');
    expect(detectQuality({ cores: 12, memoryGb: 16, mobile: false })).toBe('high');
    expect(detectQuality({ cores: 2, memoryGb: null, mobile: false })).toBe('low');
    expect(detectQuality({ cores: 4, memoryGb: null, mobile: false })).toBe('medium');
    expect(resolveQuality('high', { cores: 1, memoryGb: 1, mobile: true })).toBe('high');
  });
  it('post-processing only on High; Low has no shadows and DPR 1', () => {
    expect(qualityConfig('low', 3)).toMatchObject({ dpr: 1, shadows: false, bloom: false });
    expect(qualityConfig('medium', 3)).toMatchObject({ dpr: 1.5, shadows: true, bloom: false });
    expect(qualityConfig('high', 3)).toMatchObject({ dpr: 2, bloom: true });
  });
});

describe('update banner', () => {
  it('shows only in the world screen, never during a quest or Bedtime Listening', () => {
    expect(shouldShowUpdateBanner({ needRefresh: true, overlay: null, dismissed: false })).toBe(true);
    expect(shouldShowUpdateBanner({ needRefresh: false, overlay: null, dismissed: false })).toBe(false);
    expect(shouldShowUpdateBanner({ needRefresh: true, overlay: { type: 'bedtime' }, dismissed: false })).toBe(false);
    expect(shouldShowUpdateBanner({ needRefresh: true, overlay: { type: 'story', packId: 'x' }, dismissed: false })).toBe(false);
    expect(shouldShowUpdateBanner({ needRefresh: true, overlay: null, dismissed: true })).toBe(false);
  });
});
