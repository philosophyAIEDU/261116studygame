import type { LifeStage, Tier } from '@/types';
import { levelFromXp, MAX_LEVEL, type LevelInfo } from './levels';

// 인생 단계: 초등 → 중등 → 고등 → 대학 → 커리어.
// 졸업하려면 (1) 단계 최고 레벨 도달 (2) 누적 듣기 시간 목표 달성 (3) 졸업 시험 통과가 모두 필요하다.

export interface StageDef {
  id: LifeStage;
  minLevel: number;
  maxLevel: number;
  /** 졸업에 필요한 누적 듣기 시간(시간 단위). 커리어는 졸업이 없다. */
  inputHoursGoal: number | null;
  icon: string;
  label: string;
  readingLabel: string;
}

export const STAGES: readonly StageDef[] = [
  { id: 'elementary', minLevel: 1, maxLevel: 20, inputHoursGoal: 10, icon: '🏫', label: 'Elementary School', readingLabel: 'Picture books' },
  { id: 'middle', minLevel: 21, maxLevel: 35, inputHoursGoal: 30, icon: '🏢', label: 'Middle School', readingLabel: 'Easy chapter books' },
  { id: 'high', minLevel: 36, maxLevel: 50, inputHoursGoal: 60, icon: '🎓', label: 'High School', readingLabel: 'Novels' },
  { id: 'college', minLevel: 51, maxLevel: 70, inputHoursGoal: 120, icon: '🏛️', label: 'College', readingLabel: 'Young adult novels' },
  { id: 'career', minLevel: 71, maxLevel: MAX_LEVEL, inputHoursGoal: null, icon: '💼', label: 'Career', readingLabel: 'Job reading' },
];

export function stageDef(id: LifeStage): StageDef {
  const found = STAGES.find((s) => s.id === id);
  if (!found) throw new Error(`unknown stage ${id}`);
  return found;
}

/** 지금 다니고 있는 단계 = 아직 졸업하지 않은 첫 단계. */
export function currentStage(graduated: readonly LifeStage[]): StageDef {
  return STAGES.find((s) => !graduated.includes(s.id)) ?? stageDef('career');
}

/** 졸업 전에는 그 단계의 최고 레벨에서 멈춘다. */
export function playerLevel(xp: number, graduated: readonly LifeStage[]): LevelInfo {
  return levelFromXp(xp, currentStage(graduated).maxLevel);
}

/** 초등학교 학년: 4레벨마다 진급 (Lv1~4 = Grade 1 … Lv17~20 = Grade 5). */
export function gradeForLevel(level: number): number | null {
  if (level > 20) return null;
  return Math.min(5, Math.floor((level - 1) / 4) + 1);
}

/** 화면에 보여줄 학년/단계 이름. */
export function stageTitle(level: number, stage: LifeStage): string {
  const grade = stage === 'elementary' ? gradeForLevel(level) : null;
  return grade ? `Grade ${grade}` : stageDef(stage).label;
}

export interface GraduationCheck {
  levelOk: boolean;
  inputOk: boolean;
  /** 시험을 볼 수 있는가 */
  canTakeExam: boolean;
  needLevel: number;
  needHours: number;
}

export function graduationCheck(xp: number, graduated: readonly LifeStage[], inputSeconds: number): GraduationCheck {
  const stage = currentStage(graduated);
  const { level } = playerLevel(xp, graduated);
  const needHours = stage.inputHoursGoal ?? 0;
  const levelOk = stage.inputHoursGoal !== null && level >= stage.maxLevel;
  const inputOk = inputSeconds >= needHours * 3600;
  return { levelOk, inputOk, canTakeExam: levelOk && inputOk, needLevel: stage.maxLevel, needHours };
}

/** 졸업 시험 합격선(70%). 네 영역 평균이 아니라 "각 영역이 모두 절반 이상 + 전체 70% 이상". */
export function examPassed(scores: { listening: number; reading: number; speaking: number; writing: number }): boolean {
  const values = [scores.listening, scores.reading, scores.speaking, scores.writing];
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return avg >= 0.7 && values.every((v) => v >= 0.5);
}

/** 스킬 난이도 단계(1~5)는 레벨에 따라 열린다. */
export const TIER_UNLOCK_LEVEL: Record<Tier, number> = { 1: 1, 2: 5, 3: 12, 4: 21, 5: 36 };

export function maxTierForLevel(level: number): Tier {
  let tier: Tier = 1;
  for (const t of [2, 3, 4, 5] as const) if (level >= TIER_UNLOCK_LEVEL[t]) tier = t;
  return tier;
}
