import { normalizeText } from '@/content/schema';

// Phrase Pocket (표현 주머니) 규칙 (순수 함수)
// 책 속 표현 덩어리가 말하기·쓰기의 재료가 된다(철학 6번).

/** 이 문장 안에 들어 있는 주머니 표현들 */
export function phrasesInText(text: string, pocket: readonly string[]): string[] {
  const t = ` ${normalizeText(text)} `;
  return pocket.filter((p) => {
    const n = normalizeText(p);
    return n.length > 0 && t.includes(` ${n} `);
  });
}

/**
 * 학생이 말한 문장에서 주머니 표현을 썼는지 찾는다 (Talk Time 보너스 XP).
 * "I like ..." 처럼 빈칸(...)이 있는 표현은 앞부분만 맞으면 쓴 것으로 본다.
 */
export function detectPhrasesUsed(said: string, pocket: readonly string[]): string[] {
  const t = ` ${normalizeText(said)} `;
  return pocket.filter((p) => {
    const head = normalizeText(p.split('...')[0] ?? p);
    return head.length > 0 && t.includes(` ${head} `);
  });
}
