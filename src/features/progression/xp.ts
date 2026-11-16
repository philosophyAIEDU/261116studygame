import type { DictKind, Mbti, Skill, Speed, Tier } from '@/types';

// ─────────────────────────────────────────────────────────────
// XP 공식 (순수 함수)
//   XP = 기본XP × 난이도배율 × 정확도배율 × 속도배율 × MBTI보너스 × 연속보너스
// 어려운 것(높은 단계, 빠른 속도)을 할수록 더 많이 받는다.
// 틀려도 0이 되지는 않는다(최저 0.4배) — 시도 자체를 보상한다.
// ─────────────────────────────────────────────────────────────

export const BASE_XP: Record<Skill, number> = { listening: 15, reading: 15, speaking: 20, writing: 25 };

/** 그림 사전 등록 1개당 XP. 직접 그리면 더 많이 준다(그림으로 뜻을 붙잡는 것이 핵심이므로). */
export const DICT_XP: Record<DictKind, number> = { drawing: 8, picture: 5, english: 5 };

export const DIFFICULTY_MULT: Record<Tier, number> = { 1: 1.0, 2: 1.3, 3: 1.7, 4: 2.2, 5: 3.0 };

export const SPEED_MULT: Record<Speed, number> = { slow: 1.0, natural: 1.3, native: 1.8 };

/** 정확도(0~1) → 배율. 0배는 없다. */
export function accuracyMultiplier(accuracy: number): number {
  if (accuracy >= 1) return 1.2;
  if (accuracy >= 0.8) return 1.0;
  if (accuracy >= 0.6) return 0.7;
  return 0.4;
}

/** 연속 학습일 보너스: 하루에 2%씩, 최대 +30%. */
export function streakMultiplier(streakDays: number): number {
  const bonus = Math.min(0.3, Math.max(0, streakDays) * 0.02);
  return 1 + bonus;
}

export interface MbtiBonus {
  mult: number;
  /** 평소 스타일과 반대되는 활동인가? (Comfort Zone 배지 조건) */
  opposite: boolean;
}

/**
 * MBTI 보너스. 낙인이 아니라 "추천과 보너스"로만 쓴다.
 * - E: 말하기 +10% / I: 읽기·쓰기 +10%
 * - 반대 스타일(E의 읽기·쓰기, I의 말하기)에 도전하면 +20%
 * - 듣기는 모두에게 공통(1.0)
 */
export function mbtiBonus(mbti: Mbti | null, skill: Skill): MbtiBonus {
  if (!mbti || skill === 'listening') return { mult: 1, opposite: false };
  const extrovert = mbti.startsWith('E');
  const quietSkill = skill === 'reading' || skill === 'writing';
  if (extrovert) return quietSkill ? { mult: 1.2, opposite: true } : { mult: 1.1, opposite: false };
  return quietSkill ? { mult: 1.1, opposite: false } : { mult: 1.2, opposite: true };
}

export interface XpInput {
  skill: Skill;
  tier: Tier;
  /** 0~1 */
  accuracy: number;
  /** 듣기·말하기에만 적용. 읽기·쓰기는 무시한다. */
  speed?: Speed;
  mbti: Mbti | null;
  streakDays: number;
}

export function calcXp(input: XpInput): number {
  const speedApplies = input.skill === 'listening' || input.skill === 'speaking';
  const speedMult = speedApplies ? SPEED_MULT[input.speed ?? 'slow'] : 1;
  const raw =
    BASE_XP[input.skill] *
    DIFFICULTY_MULT[input.tier] *
    accuracyMultiplier(input.accuracy) *
    speedMult *
    mbtiBonus(input.mbti, input.skill).mult *
    streakMultiplier(input.streakDays);
  return Math.round(raw);
}

// ── 같은 이야기 반복 청취 ──────────────────────────────────────
// 철학 3번 "한 권을 깊게": 다시 들어도 XP가 줄지 않고, 5회·10회째에는 큰 보너스를 준다.
export const DEEP_LISTENER_BONUS: Record<number, number> = { 5: 50, 10: 100 };

/** 이번이 n번째 청취일 때 받는 추가 보너스 XP (없으면 0). */
export function deepListenerBonus(listenCountAfter: number): number {
  return DEEP_LISTENER_BONUS[listenCountAfter] ?? 0;
}

/** 이야기 한 편을 끝까지 들었을 때의 XP. 반복해도 줄지 않는다. */
export function storyListenXp(args: {
  tier: Tier;
  speed: Speed;
  mbti: Mbti | null;
  streakDays: number;
  listenCountAfter: number;
}): number {
  const base = calcXp({ skill: 'listening', tier: args.tier, accuracy: 0.9, speed: args.speed, mbti: args.mbti, streakDays: args.streakDays });
  return base + deepListenerBonus(args.listenCountAfter);
}

// ── Talk Time ────────────────────────────────────────────────
/** 대화 1턴 XP: 20 × 난이도 × 속도, 완전한 문장 +5, 표현 1개당 +10. 고쳐 말하기를 받아도 깎지 않는다. */
export function talkTurnXp(args: { tier: Tier; speed: Speed; fullSentence: boolean; phrasesUsed: number }): number {
  const base = Math.round(20 * DIFFICULTY_MULT[args.tier] * SPEED_MULT[args.speed]);
  return base + (args.fullSentence ? 5 : 0) + Math.max(0, args.phrasesUsed) * 10;
}
export const TALK_COMPLETE_BONUS = 30;
