import type { ModelKey } from '@/config/geminiLimits';
import type { ModelMode } from '@/save/schema';

// 어떤 모델로 보낼지 고른다 (순수 함수).
//  자동 모드: 대화류(Talk Time·멘토·롤플레이) → Flash-Lite(하루 500회)
//             첨삭·졸업 시험·발음 피드백    → Flash(하루 20회), 다 쓰면 Flash-Lite 로 넘어간다
//  한도를 다 쓰면 null → 호출하지 않는다(유료 전환 없음).

export type RequestKind = 'talk' | 'mentor' | 'roleplay' | 'writing' | 'exam' | 'pronunciation';

const HEAVY: readonly RequestKind[] = ['writing', 'exam', 'pronunciation'];

export function preferredModel(kind: RequestKind): ModelKey {
  return HEAVY.includes(kind) ? 'flash' : 'lite';
}

export function pickModel(kind: RequestKind, mode: ModelMode, remaining: Record<ModelKey, number>): ModelKey | null {
  if (mode !== 'auto') return remaining[mode] > 0 ? mode : null;
  const first = preferredModel(kind);
  if (remaining[first] > 0) return first;
  if (first === 'flash' && remaining.lite > 0) return 'lite';
  return null;
}

/** 대화에 Flash(하루 20회)를 직접 고르면 금방 바닥난다 → 설정 화면에서 경고한다. */
export function flashForTalkWarning(mode: ModelMode): boolean {
  return mode === 'flash';
}
