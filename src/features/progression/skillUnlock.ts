import type { Skill } from '@/types';

// 4개 영역 해금 순서 (순수 함수)
//   Listening → Reading → (입력 시간 충족) → Speaking → Writing
// 대부분의 학습자는 말하기부터 하려 하지만, 귀에 쌓인 것이 없으면 말이 나오지 않는다.

/** 말하기가 열리기 위한 최소 누적 듣기 시간(초) */
export const SPEAKING_MIN_INPUT_SECONDS = 10 * 60;

export interface SkillFacts {
  listeningDone: number;
  readingDone: number;
  speakingDone: number;
  inputSeconds: number;
}

export interface SkillLock {
  unlocked: boolean;
  /** 잠겨 있을 때 보여줄 짧은 영어 안내 */
  hint: string;
}

export function skillLock(skill: Skill, f: SkillFacts): SkillLock {
  switch (skill) {
    case 'listening':
      return { unlocked: true, hint: '' };
    case 'reading':
      return f.listeningDone >= 1 ? { unlocked: true, hint: '' } : { unlocked: false, hint: 'Listen first! 👂' };
    case 'speaking': {
      if (f.readingDone < 1) return { unlocked: false, hint: 'Read a story first! 📖' };
      if (f.inputSeconds < SPEAKING_MIN_INPUT_SECONDS) {
        return { unlocked: false, hint: 'Your ears are still collecting words! 👂' };
      }
      return { unlocked: true, hint: '' };
    }
    case 'writing':
      return f.speakingDone >= 1 && skillLock('speaking', f).unlocked
        ? { unlocked: true, hint: '' }
        : { unlocked: false, hint: 'Speak first, then write! 🎤' };
  }
}
