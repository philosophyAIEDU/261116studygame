import { STORY_STEPS, type Medal, type Speed, type StoryStep } from '@/types';

// Story Quest 진행 규칙 (순수 함수)
// 핵심: 입력(①~④)이 충분히 쌓여야 출력(⑤ Use It!)이 열린다. 이 순서를 건너뛰는 길은 없다.

export interface StoryProgress {
  steps: Record<StoryStep, boolean>;
  /** 이 이야기를 끝까지 들은 횟수 */
  listenCount: number;
  medal: Medal;
  /** Read Along 에서 모은 표현 */
  phrases: string[];
  /** 이 이야기에서 사전에 등록한 단어 */
  dictWords: string[];
}

export function emptyStoryProgress(): StoryProgress {
  return {
    steps: { look: false, read: false, dict: false, bedtime: false, useIt: false },
    listenCount: 0,
    medal: 'none',
    phrases: [],
    dictWords: [],
  };
}

/** ⑤ Use It! 을 열기 위한 최소 청취 횟수 */
export const USE_IT_MIN_LISTENS = 3;
/** ③ 그림 사전 단계 완료에 필요한 단어 수 */
export const DICT_STEP_WORDS = 3;

export function isUseItUnlocked(p: StoryProgress): boolean {
  return p.steps.look && p.steps.read && p.steps.dict && p.steps.bedtime && p.listenCount >= USE_IT_MIN_LISTENS;
}

/** 해당 단계를 지금 할 수 있는가? 앞 단계를 모두 끝내야 다음 단계가 열린다. */
export function isStepAvailable(p: StoryProgress, step: StoryStep): boolean {
  if (step === 'useIt') return isUseItUnlocked(p);
  const index = STORY_STEPS.indexOf(step);
  return STORY_STEPS.slice(0, index).every((s) => p.steps[s]);
}

/** 다음에 해야 할 단계. 모두 끝났으면 null. */
export function nextStep(p: StoryProgress): StoryStep | null {
  return STORY_STEPS.find((s) => !p.steps[s]) ?? null;
}

export function isStoryComplete(p: StoryProgress): boolean {
  return STORY_STEPS.every((s) => p.steps[s]);
}

/** ③ 단계 완료 조건: 단어 3개(이야기에 단어가 더 적으면 전부) 등록. */
export function isDictStepDone(dictWordCount: number, storyWordCount: number): boolean {
  return dictWordCount >= Math.min(DICT_STEP_WORDS, Math.max(1, storyWordCount));
}

const MEDAL_RANK: Record<Medal, number> = { none: 0, bronze: 1, silver: 2, gold: 3 };
const SPEED_MEDAL: Record<Speed, Medal> = { slow: 'bronze', natural: 'silver', native: 'gold' };

/** 더 빠른 속도로 끝까지 들으면 메달이 올라간다. 내려가지는 않는다. */
export function upgradeMedal(current: Medal, finishedAt: Speed): Medal {
  const earned = SPEED_MEDAL[finishedAt];
  return MEDAL_RANK[earned] > MEDAL_RANK[current] ? earned : current;
}

export function medalIcon(medal: Medal): string {
  return medal === 'gold' ? '🥇' : medal === 'silver' ? '🥈' : medal === 'bronze' ? '🥉' : '';
}
