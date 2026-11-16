// 한글 입력 차단 (순수 함수)
// 철학 1번: 뜻을 한국어로 적는 순간 "영어 → 한국어 → 이해" 회로가 생긴다.
// 그래서 그림 사전과 쓰기 입력에는 한글이 한 글자라도 있으면 저장하지 않는다.

// /[ㄱ-ㆎ가-힣]/ 과 같은 범위. (게임 코드에 한글 리터럴을 두지 않으려고 유니코드 이스케이프로 적는다)
const HANGUL = /[\u3131-\u318E\uAC00-\uD7A3]/;

export function containsHangul(text: string): boolean {
  return HANGUL.test(text);
}

export type EnglishInputResult = { ok: true; value: string } | { ok: false; reason: 'hangul' | 'empty' };

/** 영어 입력 검증: 한글이 있거나 비어 있으면 거절한다. 꾸짖지 않고 안내만 하기 위해 이유를 돌려준다. */
export function validateEnglishInput(text: string): EnglishInputResult {
  const value = text.trim();
  if (value.length === 0) return { ok: false, reason: 'empty' };
  if (containsHangul(value)) return { ok: false, reason: 'hangul' };
  return { ok: true, value };
}
