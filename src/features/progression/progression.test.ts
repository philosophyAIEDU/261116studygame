import { describe, expect, it } from 'vitest';
import { accuracyMultiplier, calcXp, deepListenerBonus, mbtiBonus, storyListenXp, streakMultiplier, talkTurnXp } from './xp';
import { levelFromXp, MAX_LEVEL, totalXpForLevel, xpToNext } from './levels';
import { currentStage, examPassed, gradeForLevel, graduationCheck, maxTierForLevel, playerLevel, stageTitle } from './lifeStages';
import { addBedtimeSeconds, BEDTIME_DAILY_CAP_SECONDS, formatInputTime, inputHourBadgesEarned } from './inputHours';
import { addDays, localDayKey, touchStreak } from './time';
import { computeBadges } from './badges';
import { skillLock, SPEAKING_MIN_INPUT_SECONDS } from './skillUnlock';

describe('XP formula', () => {
  it('matches the spec example: Natural listening tier 3, 90%, 4-day streak → 36', () => {
    expect(calcXp({ skill: 'listening', tier: 3, accuracy: 0.9, speed: 'natural', mbti: null, streakDays: 4 })).toBe(36);
  });
  it('accuracy never multiplies by zero', () => {
    expect(accuracyMultiplier(1)).toBe(1.2);
    expect(accuracyMultiplier(0.8)).toBe(1.0);
    expect(accuracyMultiplier(0.6)).toBe(0.7);
    expect(accuracyMultiplier(0)).toBe(0.4);
    expect(calcXp({ skill: 'writing', tier: 1, accuracy: 0, mbti: null, streakDays: 0 })).toBe(10);
  });
  it('speed multiplier applies to listening and speaking only', () => {
    const base = { tier: 1 as const, accuracy: 0.9, mbti: null, streakDays: 0 };
    expect(calcXp({ ...base, skill: 'listening', speed: 'native' })).toBe(27);
    expect(calcXp({ ...base, skill: 'speaking', speed: 'native' })).toBe(36);
    expect(calcXp({ ...base, skill: 'reading', speed: 'native' })).toBe(15);
    expect(calcXp({ ...base, skill: 'writing', speed: 'native' })).toBe(25);
  });
  it('streak bonus caps at +30%', () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(5)).toBeCloseTo(1.1);
    expect(streakMultiplier(100)).toBe(1.3);
  });
  it('MBTI bonus: own style +10%, opposite style +20%', () => {
    expect(mbtiBonus('ENFP', 'speaking')).toEqual({ mult: 1.1, opposite: false });
    expect(mbtiBonus('ENFP', 'reading')).toEqual({ mult: 1.2, opposite: true });
    expect(mbtiBonus('ISTJ', 'writing')).toEqual({ mult: 1.1, opposite: false });
    expect(mbtiBonus('ISTJ', 'speaking')).toEqual({ mult: 1.2, opposite: true });
    expect(mbtiBonus('ISTJ', 'listening').mult).toBe(1);
    expect(mbtiBonus(null, 'speaking').mult).toBe(1);
  });
  it('re-listening never pays less, and pays a bonus on the 5th and 10th time', () => {
    const args = { tier: 1 as const, speed: 'slow' as const, mbti: null, streakDays: 0 };
    const first = storyListenXp({ ...args, listenCountAfter: 1 });
    expect(storyListenXp({ ...args, listenCountAfter: 4 })).toBe(first);
    expect(storyListenXp({ ...args, listenCountAfter: 5 })).toBe(first + 50);
    expect(storyListenXp({ ...args, listenCountAfter: 10 })).toBe(first + 100);
    expect(deepListenerBonus(7)).toBe(0);
  });
  it('Talk Time turn XP', () => {
    expect(talkTurnXp({ tier: 1, speed: 'slow', fullSentence: false, phrasesUsed: 0 })).toBe(20);
    expect(talkTurnXp({ tier: 1, speed: 'natural', fullSentence: true, phrasesUsed: 2 })).toBe(26 + 5 + 20);
  });
});

describe('levels', () => {
  it('needs 100 × level^1.5 XP per level', () => {
    expect(xpToNext(1)).toBe(100);
    expect(xpToNext(4)).toBe(800);
    expect(totalXpForLevel(3)).toBe(100 + 283);
  });
  it('converts XP to level and caps at 99', () => {
    expect(levelFromXp(0)).toEqual({ level: 1, into: 0, need: 100 });
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100).level).toBe(2);
    expect(levelFromXp(1e12).level).toBe(MAX_LEVEL);
    expect(levelFromXp(1e12).need).toBe(0);
  });
  it('respects a level cap', () => {
    expect(levelFromXp(totalXpForLevel(30), 20).level).toBe(20);
  });
});

describe('life stages and graduation', () => {
  it('grades go up every 4 levels', () => {
    expect([1, 4, 5, 8, 17, 20].map(gradeForLevel)).toEqual([1, 1, 2, 2, 5, 5]);
    expect(gradeForLevel(21)).toBeNull();
    expect(stageTitle(6, 'elementary')).toBe('Grade 2');
    expect(stageTitle(25, 'middle')).toBe('Middle School');
  });
  it('level is capped at the stage max until graduation', () => {
    const lots = totalXpForLevel(40);
    expect(playerLevel(lots, []).level).toBe(20);
    expect(playerLevel(lots, ['elementary']).level).toBe(35);
    expect(playerLevel(lots, ['elementary', 'middle']).level).toBe(40);
    expect(currentStage(['elementary', 'middle', 'high', 'college']).id).toBe('career');
  });
  it('graduation needs the level AND the input hours goal', () => {
    const lv20 = totalXpForLevel(20);
    expect(graduationCheck(lv20, [], 0)).toMatchObject({ levelOk: true, inputOk: false, canTakeExam: false, needHours: 10 });
    expect(graduationCheck(lv20 - 1, [], 10 * 3600)).toMatchObject({ levelOk: false, inputOk: true, canTakeExam: false });
    expect(graduationCheck(lv20, [], 10 * 3600).canTakeExam).toBe(true);
    expect(graduationCheck(totalXpForLevel(35), ['elementary'], 29 * 3600).canTakeExam).toBe(false);
    expect(graduationCheck(totalXpForLevel(35), ['elementary'], 30 * 3600).canTakeExam).toBe(true);
    expect(graduationCheck(1e12, ['elementary', 'middle', 'high', 'college'], 1e9).canTakeExam).toBe(false);
  });
  it('exam pass rule', () => {
    expect(examPassed({ listening: 1, reading: 1, speaking: 0.5, writing: 0.5 })).toBe(true);
    expect(examPassed({ listening: 1, reading: 1, speaking: 1, writing: 0.3 })).toBe(false);
    expect(examPassed({ listening: 0.6, reading: 0.6, speaking: 0.6, writing: 0.6 })).toBe(false);
  });
  it('tiers unlock by level', () => {
    expect([1, 5, 12, 21, 36, 99].map(maxTierForLevel)).toEqual([1, 2, 3, 4, 5, 5]);
  });
});

describe('Bedtime Listening XP', () => {
  it('pays 2 XP per minute: 30 min = 60 XP', () => {
    expect(addBedtimeSeconds({ day: '', seconds: 0 }, '2026-01-01', 30 * 60).xp).toBe(60);
  });
  it('caps at 60 minutes a day (120 XP) and resets the next day', () => {
    const a = addBedtimeSeconds({ day: '2026-01-01', seconds: 50 * 60 }, '2026-01-01', 30 * 60);
    expect(a.xp).toBe(20);
    expect(a.ledger.seconds).toBe(BEDTIME_DAILY_CAP_SECONDS);
    expect(addBedtimeSeconds(a.ledger, '2026-01-01', 600).xp).toBe(0);
    expect(addBedtimeSeconds(a.ledger, '2026-01-02', 600).xp).toBe(20);
  });
  it('gives the same total when added second by second', () => {
    let ledger = { day: '', seconds: 0 };
    let xp = 0;
    for (let i = 0; i < 150; i++) {
      const r = addBedtimeSeconds(ledger, 'd', 1);
      ledger = r.ledger;
      xp += r.xp;
    }
    expect(xp).toBe(4);
  });
  it('input hour badges and formatting', () => {
    expect(inputHourBadgesEarned(49 * 3600)).toEqual(['input-10h']);
    expect(inputHourBadgesEarned(300 * 3600)).toHaveLength(4);
    expect(formatInputTime(59)).toBe('0m');
    expect(formatInputTime(3600 + 23 * 60)).toBe('1h 23m');
  });
});

describe('streak and days', () => {
  it('day keys', () => {
    expect(localDayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
  it('streak continues, holds, or restarts', () => {
    expect(touchStreak({ lastDay: '', days: 0 }, '2026-01-01')).toEqual({ lastDay: '2026-01-01', days: 1 });
    expect(touchStreak({ lastDay: '2026-01-01', days: 3 }, '2026-01-02').days).toBe(4);
    expect(touchStreak({ lastDay: '2026-01-02', days: 4 }, '2026-01-02').days).toBe(4);
    expect(touchStreak({ lastDay: '2026-01-02', days: 4 }, '2026-01-05').days).toBe(1);
  });
});

describe('badges', () => {
  it('computes earned badges and keeps event badges', () => {
    const got = computeBadges({
      inputSeconds: 11 * 3600, drawings: 1, maxListenCount: 5, hasGoldMedal: true, phraseUses: 20,
      talksDone: 1, streakDays: 7, graduated: ['elementary'], owned: ['comfort-zone'],
    });
    expect(got).toEqual(['input-10h', 'first-drawing', 'deep-listener', 'speed-gold', 'comfort-zone', 'phrase-master', 'first-talk', 'streak-7', 'grad-elementary']);
  });
});

describe('skill unlock order: Listening → Reading → (input) → Speaking → Writing', () => {
  const none = { listeningDone: 0, readingDone: 0, speakingDone: 0, inputSeconds: 0 };
  it('starts with listening only', () => {
    expect(skillLock('listening', none).unlocked).toBe(true);
    expect(skillLock('reading', none).unlocked).toBe(false);
    expect(skillLock('speaking', none).unlocked).toBe(false);
    expect(skillLock('writing', none).unlocked).toBe(false);
  });
  it('speaking needs reading AND enough input time', () => {
    const read = { ...none, listeningDone: 1, readingDone: 1 };
    expect(skillLock('reading', read).unlocked).toBe(true);
    expect(skillLock('speaking', read)).toEqual({ unlocked: false, hint: 'Your ears are still collecting words! 👂' });
    expect(skillLock('speaking', { ...read, inputSeconds: SPEAKING_MIN_INPUT_SECONDS }).unlocked).toBe(true);
  });
  it('writing needs speaking first — no shortcut', () => {
    const f = { listeningDone: 5, readingDone: 5, speakingDone: 0, inputSeconds: 99999 };
    expect(skillLock('writing', f).unlocked).toBe(false);
    expect(skillLock('writing', { ...f, speakingDone: 1 }).unlocked).toBe(true);
    expect(skillLock('writing', { ...f, speakingDone: 1, inputSeconds: 0 }).unlocked).toBe(false);
  });
});
