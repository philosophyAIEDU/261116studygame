import { MBTI_TYPES, type Mbti, type Profile } from '@/types';
import { addDays } from '@/features/progression/time';
import type { DictCard } from '@/features/dictionary/srs';
import { defaultSave, type SaveData } from '../schema';

// v1 → v2 마이그레이션
// v1 은 "단어 + 한국어 뜻" 방식의 세이브였다. v2 는 입력 중심 설계이므로:
//  - 한국어 뜻(meaningKo)은 버린다 (철학 1번). 단어 자체는 그림 사전 카드로 살린다.
//  - XP·캐릭터·연속 학습일·볼륨 설정은 그대로 옮긴다.
//  - 새로 생긴 값(듣기 시간, 이야기 진행 등)은 기본값으로 채운다.

export interface SaveV1 {
  schemaVersion?: 1;
  character?: { nickname?: string; gender?: string; mbti?: string; hair?: number; hairColor?: number; outfitColor?: number } | null;
  xp?: number;
  level?: number;
  vocab?: { word: string; meaningKo?: string; learnedAt?: number }[];
  streakDays?: number;
  lastPlayedDay?: string;
  settings?: { bgm?: number; sfx?: number };
}

function clampIndex(value: unknown, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
}

function toProfile(c: NonNullable<SaveV1['character']>): Profile | null {
  if (!c.nickname) return null;
  const mbti = (MBTI_TYPES as readonly string[]).includes(c.mbti ?? '') ? (c.mbti as Mbti) : 'INFP';
  return {
    nickname: c.nickname,
    gender: c.gender === 'girl' ? 'girl' : 'boy',
    mbti,
    hair: clampIndex(c.hair, 2),
    hairColor: clampIndex(c.hairColor, 4),
    outfitColor: clampIndex(c.outfitColor, 4),
  };
}

export function migrateV1ToV2(old: SaveV1): SaveData {
  const next = defaultSave();
  next.profile = old.character ? toProfile(old.character) : null;
  // v1 사용자는 이미 게임을 해 본 사람이므로 보호자 안내는 다시 보여주지 않는다.
  next.guardianIntroSeen = next.profile !== null;
  next.xp = typeof old.xp === 'number' && old.xp > 0 ? Math.floor(old.xp) : 0;
  next.streak = { lastDay: old.lastPlayedDay ?? '', days: Math.max(0, old.streakDays ?? 0) };
  if (old.settings) {
    if (typeof old.settings.bgm === 'number') next.settings.volume.bgm = Math.max(0, Math.min(1, old.settings.bgm));
    if (typeof old.settings.sfx === 'number') next.settings.volume.sfx = Math.max(0, Math.min(1, old.settings.sfx));
  }
  const today = old.lastPlayedDay || '1970-01-01';
  const dictionary: Record<string, DictCard> = {};
  for (const v of old.vocab ?? []) {
    const word = v.word?.trim().toLowerCase();
    if (!word) continue;
    // 뜻은 비워 둔다 → 게임에서 아이가 그림이나 쉬운 영어로 다시 채운다.
    dictionary[word] = { word, packId: 'legacy', kind: 'english', value: '', box: 1, due: addDays(today, 1), createdAt: v.learnedAt ?? 0 };
  }
  next.dictionary = dictionary;
  return next;
}
