// 게임 전체에서 함께 쓰는 기본 타입 모음.
// 주의: 학습 철학 1번(한국어를 거치지 않는다)에 따라, 어떤 타입에도 "한국어 뜻" 필드는 없다.

export type Speed = 'slow' | 'natural' | 'native';
export const SPEEDS: readonly Speed[] = ['slow', 'natural', 'native'];

export type Skill = 'listening' | 'reading' | 'speaking' | 'writing';
export const SKILLS: readonly Skill[] = ['listening', 'reading', 'speaking', 'writing'];

export type LifeStage = 'elementary' | 'middle' | 'high' | 'college' | 'career';

export type StoryStep = 'look' | 'read' | 'dict' | 'bedtime' | 'useIt';
export const STORY_STEPS: readonly StoryStep[] = ['look', 'read', 'dict', 'bedtime', 'useIt'];

export type Tier = 1 | 2 | 3 | 4 | 5;

export const MBTI_TYPES = [
  'ISTJ', 'ISFJ', 'INFJ', 'INTJ', 'ISTP', 'ISFP', 'INFP', 'INTP',
  'ESTP', 'ESFP', 'ENFP', 'ENTP', 'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ',
] as const;
export type Mbti = (typeof MBTI_TYPES)[number];

export type Gender = 'boy' | 'girl';

export interface Profile {
  nickname: string;
  gender: Gender;
  mbti: Mbti;
  hair: number; // 0~2
  hairColor: number; // 0~4
  outfitColor: number; // 0~4
}

export type DayPhase = 'morning' | 'day' | 'sunset' | 'night';

export type Medal = 'none' | 'bronze' | 'silver' | 'gold';

export type CareerId = 'teacher' | 'doctor' | 'reporter' | 'gamedev' | 'diplomat' | 'chef';

export type DictKind = 'drawing' | 'picture' | 'english';
