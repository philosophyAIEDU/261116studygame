import { GEMINI_CACHE_TTL_MS } from '@/config/geminiLimits';

// 응답 캐시(24시간). 같은 질문을 다시 하면 API 를 쓰지 않는다 → 무료 한도 절약.
// 질문 원문은 저장하지 않고 해시만 키로 쓴다. Talk Time 대화는 캐시하지 않는다(대화 원문 저장 금지).

interface Entry {
  at: number;
  text: string;
}

const STORAGE_KEY = 'asq-gemini-cache';
const MAX_ENTRIES = 40;

/** 간단한 문자열 해시(djb2). 암호용이 아니라 캐시 키용이다. */
export function hashKey(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export class ResponseCache {
  private entries: Record<string, Entry>;

  constructor(private storage: Pick<Storage, 'getItem' | 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage) {
    this.entries = this.load();
  }

  private load(): Record<string, Entry> {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, Entry>) : {};
    } catch {
      return {};
    }
  }

  private persist(): void {
    try { this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.entries)); } catch { /* 저장 공간 부족은 무시 */ }
  }

  get(key: string, now: number): string | null {
    const entry = this.entries[key];
    if (!entry) return null;
    if (now - entry.at > GEMINI_CACHE_TTL_MS) {
      delete this.entries[key];
      return null;
    }
    return entry.text;
  }

  set(key: string, text: string, now: number): void {
    this.entries[key] = { at: now, text };
    const keys = Object.keys(this.entries);
    if (keys.length > MAX_ENTRIES) {
      keys.sort((a, b) => (this.entries[a]?.at ?? 0) - (this.entries[b]?.at ?? 0));
      for (const k of keys.slice(0, keys.length - MAX_ENTRIES)) delete this.entries[k];
    }
    this.persist();
  }

  clear(): void {
    this.entries = {};
    this.persist();
  }
}
