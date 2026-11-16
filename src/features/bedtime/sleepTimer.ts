// 수면 타이머 (순수 함수)
// 끝나기 직전 60초 동안 볼륨을 서서히 줄여, 잠든 아이가 소리가 뚝 끊겨 깨지 않게 한다.

export const SLEEP_TIMER_MINUTES = [10, 20, 30, 45] as const;
export const FADE_SECONDS = 60;

/** 남은 시간(초) → 볼륨 배율(0~1). 타이머가 없으면(null) 항상 1. */
export function fadeFactor(remainingSeconds: number | null): number {
  if (remainingSeconds === null) return 1;
  if (remainingSeconds <= 0) return 0;
  return Math.min(1, remainingSeconds / FADE_SECONDS);
}

/** 타이머 종료 시각(ms)과 현재 시각 → 남은 초. 타이머가 없으면 null. */
export function remainingSeconds(endAt: number | null, now: number): number | null {
  if (endAt === null) return null;
  return Math.max(0, Math.ceil((endAt - now) / 1000));
}

/** 전체 낭독 파일의 현재 위치 → 장면 번호. 타임스탬프가 없으면 길이를 장면 수로 고르게 나눈다. */
export function sceneIndexAt(args: {
  time: number;
  duration: number;
  sceneCount: number;
  /** 문장별 시작 시각과 그 문장의 장면 번호 */
  stamps: readonly { start: number; sceneIndex: number }[];
}): number {
  if (args.stamps.length > 0) {
    let index = args.stamps[0]?.sceneIndex ?? 0;
    for (const s of args.stamps) if (args.time >= s.start) index = s.sceneIndex;
    return index;
  }
  if (args.duration <= 0 || args.sceneCount <= 0) return 0;
  return Math.min(args.sceneCount - 1, Math.floor((args.time / args.duration) * args.sceneCount));
}
