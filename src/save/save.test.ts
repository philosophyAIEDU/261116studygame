import { beforeEach, describe, expect, it } from 'vitest';
import { migrateSave } from './migrations';
import { CURRENT_SCHEMA_VERSION, defaultSave } from './schema';
import { phaseForActivities, useGame } from './store';
import { containsHangul } from '@/features/dictionary/hangul';
import { totalXpForLevel } from '@/features/progression/levels';

// v1 샘플 세이브: "단어 + 한국어 뜻" 방식
const V1_SAMPLE = {
  schemaVersion: 1,
  character: { nickname: 'Mina', gender: 'girl', mbti: 'ENFP', hair: 2, hairColor: 9, outfitColor: 1 },
  xp: 1234,
  level: 5,
  vocab: [
    { word: 'Huge', meaningKo: '거대한', learnedAt: 100 },
    { word: 'bright', meaningKo: '밝은' },
    { word: ' ' },
  ],
  streakDays: 3,
  lastPlayedDay: '2026-03-01',
  settings: { bgm: 0.2, sfx: 3 },
};

describe('save migration v1 → v2', () => {
  const v2 = migrateSave(V1_SAMPLE);
  it('keeps progress: XP, character, streak, volume', () => {
    expect(v2.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(v2.xp).toBe(1234);
    expect(v2.profile).toEqual({ nickname: 'Mina', gender: 'girl', mbti: 'ENFP', hair: 2, hairColor: 4, outfitColor: 1 });
    expect(v2.streak).toEqual({ lastDay: '2026-03-01', days: 3 });
    expect(v2.settings.volume).toMatchObject({ bgm: 0.2, sfx: 1, voice: 1 });
    expect(v2.guardianIntroSeen).toBe(true);
  });
  it('turns vocab into picture-dictionary cards and drops every Korean meaning', () => {
    expect(Object.keys(v2.dictionary).sort()).toEqual(['bright', 'huge']);
    expect(v2.dictionary.huge).toMatchObject({ kind: 'english', value: '', box: 1, due: '2026-03-02', createdAt: 100 });
    expect(containsHangul(JSON.stringify(v2))).toBe(false);
  });
  it('fills new fields with defaults', () => {
    expect(v2.input.totalSeconds).toBe(0);
    expect(v2.gemini.limits.lite.rpd).toBe(500);
    expect(v2.settings.sendAudioToGemini).toBe(false);
  });
  it('handles broken or partial data without crashing', () => {
    expect(migrateSave(null)).toEqual(defaultSave());
    expect(migrateSave('oops')).toEqual(defaultSave());
    expect(migrateSave({ schemaVersion: 0 })).toEqual(defaultSave());
    expect(migrateSave({ schemaVersion: 1, character: { mbti: 'ZZZZ' } }).profile).toBeNull();
    const partial = migrateSave({ schemaVersion: 2, xp: 50, settings: { speed: 'native' } });
    expect(partial.xp).toBe(50);
    expect(partial.settings.speed).toBe('native');
    expect(partial.settings.volume.bgm).toBe(0.5);
    expect(partial.stories).toEqual({});
  });
  it('is idempotent for current saves', () => {
    expect(migrateSave(v2)).toEqual(v2);
  });
});

describe('game store', () => {
  beforeEach(() => useGame.getState().resetSave());
  const game = () => useGame.getState();

  it('refuses to skip story steps', () => {
    expect(game().completeStep('p', 'read')).toBe(false);
    expect(game().completeStep('p', 'look')).toBe(true);
    expect(game().completeStep('p', 'read')).toBe(true);
    expect(game().completeStep('p', 'dict', 8)).toBe(false);
    for (const w of ['a', 'b', 'c']) game().addDictCard({ word: w, packId: 'p', kind: 'picture', value: 'x' });
    expect(game().completeStep('p', 'dict', 8)).toBe(true);
    expect(game().completeStep('p', 'useIt')).toBe(false);
    expect(game().completeStep('p', 'bedtime')).toBe(true);
    expect(game().completeStep('p', 'useIt')).toBe(false); // 청취 3회 미만
    for (let i = 0; i < 3; i++) game().recordListen('p', 'slow', 1);
    expect(game().completeStep('p', 'useIt')).toBe(true);
  });

  it('awards XP for dictionary cards once, more for drawings', () => {
    game().addDictCard({ word: 'Huge', packId: 'p', kind: 'drawing', value: 'k1' });
    expect(game().save.xp).toBe(8);
    game().addDictCard({ word: 'huge', packId: 'p', kind: 'english', value: 'very big' });
    expect(game().save.xp).toBe(8);
    expect(game().save.dictionary.huge?.kind).toBe('english');
    expect(game().save.badges).toContain('first-drawing');
  });

  it('level-up and medal effects', () => {
    game().awardXp(100);
    expect(game().fx.some((f) => f.kind === 'levelUp' && f.level === 2)).toBe(true);
    game().recordListen('p', 'native', 1);
    expect(game().save.stories.p?.medal).toBe('gold');
    expect(game().save.badges).toContain('speed-gold');
    game().shiftFx();
  });

  it('caps the level at 20 before graduation, then releases it', () => {
    game().awardXp(totalXpForLevel(30));
    expect(game().save.xp).toBe(totalXpForLevel(30));
    game().graduate('elementary');
    expect(game().save.badges).toContain('grad-elementary');
  });

  it('bedtime XP is silent and capped', () => {
    game().addBedtimeSeconds(90 * 60);
    expect(game().save.xp).toBe(120);
    expect(game().fx.some((f) => f.kind === 'xp')).toBe(false);
  });

  it('skillDone gives the Comfort Zone badge for an opposite-style quest', () => {
    game().createProfile({ nickname: 'A', gender: 'boy', mbti: 'INTJ', hair: 0, hairColor: 0, outfitColor: 0 });
    game().skillDone({ skill: 'reading', tier: 1, accuracy: 1 });
    expect(game().save.badges).not.toContain('comfort-zone');
    game().skillDone({ skill: 'speaking', tier: 1, accuracy: 1, speed: 'slow' });
    expect(game().save.badges).toContain('comfort-zone');
    expect(game().save.skills.speaking.done).toBe(1);
  });

  it('counts Gemini calls per Pacific day', () => {
    game().countGeminiCall('lite', '2026-01-01');
    game().countGeminiCall('lite', '2026-01-01');
    expect(game().save.gemini.usage.lite).toEqual({ day: '2026-01-01', count: 2 });
    game().countGeminiCall('lite', '2026-01-02');
    expect(game().save.gemini.usage.lite.count).toBe(1);
  });

  it('day phases follow activity, and a new day starts in the morning', () => {
    expect([0, 2, 4, 5].map(phaseForActivities)).toEqual(['morning', 'day', 'sunset', 'night']);
    for (let i = 0; i < 6; i++) game().advanceActivity();
    expect(game().save.world.phase).toBe('night');
    game().newDay();
    expect(game().save.world).toEqual({ activitiesToday: 0, phase: 'morning' });
  });

  it('replaceSave migrates imported data; talk stats keep no transcripts', () => {
    game().replaceSave(V1_SAMPLE);
    expect(game().save.xp).toBe(1234);
    game().startTalkSession();
    game().recordTalkTurn(2);
    expect(game().save.talk).toMatchObject({ sessionsToday: 1, totalSessions: 1, phraseUses: 2 });
    expect(Object.keys(game().save.talk).sort()).toEqual(['day', 'phraseUses', 'sessionsToday', 'totalSessions']);
  });
});
