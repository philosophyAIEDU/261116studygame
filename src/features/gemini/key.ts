// Gemini API 키: 사용자가 설정에서 직접 넣고, 이 기기의 localStorage 에만 저장한다.
// 코드에 키를 넣지 않는다. 세이브 내보내기 파일에도 들어가지 않는다.

const KEY = 'asq-gemini-key';

export function getApiKey(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && v.trim().length > 0 ? v.trim() : null;
  } catch {
    return null;
  }
}

export function setApiKey(key: string): void {
  try { localStorage.setItem(KEY, key.trim()); } catch { /* 무시 */ }
}

export function deleteApiKey(): void {
  try { localStorage.removeItem(KEY); } catch { /* 무시 */ }
}

/** 화면 표시용: 앞 4글자와 뒤 2글자만 보여준다. */
export function maskKey(key: string): string {
  if (key.length <= 8) return '•'.repeat(key.length);
  return `${key.slice(0, 4)}${'•'.repeat(Math.min(16, key.length - 6))}${key.slice(-2)}`;
}
