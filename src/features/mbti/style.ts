import type { Mbti } from '@/types';

// MBTI 학습 스타일 (순수 함수). 추천과 보너스에만 쓴다. "너는 ~를 못한다" 같은 낙인은 금지.

export interface LearningStyle {
  /** E: 대화 이벤트가 자주 / I: 도서관·그림 일기 추천 */
  social: 'E' | 'I';
  /** S: 일상 이야기 먼저 / N: 모험·상상 이야기 먼저 */
  storyTaste: 'daily' | 'adventure';
  /** T: 이유 먼저 / F: 칭찬·공감 먼저 */
  tone: 'reason' | 'warm';
  /** J: 체크리스트·주간 계획 / P: 랜덤 이벤트 */
  planning: 'plan' | 'explore';
}

export function learningStyle(mbti: Mbti): LearningStyle {
  return {
    social: mbti[0] === 'E' ? 'E' : 'I',
    storyTaste: mbti[1] === 'S' ? 'daily' : 'adventure',
    tone: mbti[2] === 'T' ? 'reason' : 'warm',
    planning: mbti[3] === 'J' ? 'plan' : 'explore',
  };
}

/** 이야기 추천 순서: 취향에 맞는 테마를 앞에 두되, 같은 테마 안에서는 원래 순서(order)를 지킨다. */
export function sortByTaste<T extends { theme: 'daily' | 'adventure'; order: number }>(packs: readonly T[], mbti: Mbti | null): T[] {
  const taste = mbti ? learningStyle(mbti).storyTaste : 'daily';
  return [...packs].sort((a, b) => {
    const ta = a.theme === taste ? 0 : 1;
    const tb = b.theme === taste ? 0 : 1;
    return ta - tb || a.order - b.order;
  });
}

/** 그림 4문항 미니 테스트: 각 문항에서 고른 글자를 이어 붙인다. */
export interface MbtiQuestion {
  axis: 0 | 1 | 2 | 3;
  a: { letter: string; icon: string; label: string };
  b: { letter: string; icon: string; label: string };
  prompt: string;
}

export const MBTI_QUESTIONS: readonly MbtiQuestion[] = [
  { axis: 0, prompt: 'Free time!', a: { letter: 'E', icon: '🎉', label: 'Play with many friends' }, b: { letter: 'I', icon: '📚', label: 'Read in a quiet place' } },
  { axis: 1, prompt: 'Story time!', a: { letter: 'S', icon: '🍎', label: 'A real day at school' }, b: { letter: 'N', icon: '🐉', label: 'A magic adventure' } },
  { axis: 2, prompt: 'A friend is sad.', a: { letter: 'T', icon: '🔧', label: 'Help fix the problem' }, b: { letter: 'F', icon: '🤗', label: 'Give a big hug' } },
  { axis: 3, prompt: 'A trip tomorrow!', a: { letter: 'J', icon: '📋', label: 'Make a plan' }, b: { letter: 'P', icon: '🎲', label: 'Just go and see' } },
];

export function mbtiFromAnswers(letters: readonly string[]): Mbti {
  const pick = (i: number, a: string, b: string) => (letters[i] === a ? a : b);
  return `${pick(0, 'E', 'I')}${pick(1, 'S', 'N')}${pick(2, 'T', 'F')}${pick(3, 'J', 'P')}` as Mbti;
}
