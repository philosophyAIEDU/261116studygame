import type { LifeStage, Skill } from '@/types';
import type { StoryPack } from '@/content/loader';
import { makeExercise, rng, type Exercise } from '@/features/skills/exercises';

// 졸업 시험 구성 (순수 함수)
//  듣기 3문제(반드시 Native 속도) + 읽기 3문제 + 말하기 2문제 + 쓰기 1문제.
//  단계가 올라갈수록 문제 난이도 단계(tier)가 올라간다.

export interface ExamSection {
  skill: Skill;
  icon: string;
  title: string;
  /** 이 영역의 재생 속도. 듣기는 항상 'native'. */
  speed: 'natural' | 'native';
  exercises: Exercise[];
}

const STAGE_TIER: Record<LifeStage, 1 | 2 | 3 | 4 | 5> = { elementary: 2, middle: 3, high: 4, college: 5, career: 5 };

export function buildExam(stage: LifeStage, packs: readonly StoryPack[], seed: number): ExamSection[] {
  const rand = rng(seed);
  const tier = STAGE_TIER[stage];
  const many = <T,>(n: number, fn: () => T): T[] => Array.from({ length: n }, fn);
  return [
    // 듣기는 장면 고르기 문제를 원어민 속도로 낸다(초등은 2단계 형식, 이후는 핵심 단어 듣기 포함).
    { skill: 'listening', icon: '🎧', title: 'Listening (Native speed)', speed: 'native', exercises: many(3, () => makeExercise('listening', tier >= 4 ? 4 : 2, packs, rand)) },
    { skill: 'reading', icon: '📖', title: 'Reading', speed: 'natural', exercises: many(3, () => makeExercise('reading', Math.min(3, tier) as 1 | 2 | 3, packs, rand)) },
    { skill: 'speaking', icon: '🎤', title: 'Speaking', speed: 'natural', exercises: many(2, () => makeExercise('speaking', 1, packs, rand)) },
    { skill: 'writing', icon: '✏️', title: 'Writing', speed: 'natural', exercises: [makeExercise('writing', tier >= 4 ? 4 : 2, packs, rand)] },
  ];
}

export function sectionScore(scores: readonly number[]): number {
  return scores.length === 0 ? 0 : scores.reduce((a, b) => a + b, 0) / scores.length;
}

const NEXT_STAGE: Record<LifeStage, string> = {
  elementary: 'Welcome to Middle School!',
  middle: 'Welcome to High School!',
  high: 'Welcome to College!',
  college: 'You have your degree! Time to choose a job.',
  career: 'Keep growing!',
};

export function graduationMessage(stage: LifeStage): string {
  return NEXT_STAGE[stage];
}
