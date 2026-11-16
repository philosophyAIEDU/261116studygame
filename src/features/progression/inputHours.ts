// 누적 듣기 시간(Input Hours)과 Bedtime Listening 보상 (순수 함수)
// 철학 2번(입력이 먼저)·4번(잠들기 전 편하게 듣기): 퀴즈가 아니라 "들은 시간"을 보상한다.

export const BEDTIME_XP_PER_MIN = 2;
/** 하루에 XP로 인정하는 Bedtime 듣기 시간 상한(초). 60분 = 최대 120 XP. */
export const BEDTIME_DAILY_CAP_SECONDS = 60 * 60;

export interface BedtimeLedger {
  day: string;
  /** 오늘 XP로 인정된 초 */
  seconds: number;
}

export interface BedtimeAward {
  ledger: BedtimeLedger;
  /** 이번에 새로 줄 XP */
  xp: number;
}

/**
 * 재생된 시간(초)을 장부에 더하고, 새로 줄 XP를 계산한다.
 * XP는 "오늘 인정된 누적 분"을 기준으로 내림 계산하므로, 몇 초씩 나눠 더해도 결과가 같다.
 */
export function addBedtimeSeconds(prev: BedtimeLedger, today: string, playedSeconds: number): BedtimeAward {
  const base = prev.day === today ? prev.seconds : 0;
  const next = Math.min(BEDTIME_DAILY_CAP_SECONDS, base + Math.max(0, playedSeconds));
  const xpBefore = Math.floor(base / 60) * BEDTIME_XP_PER_MIN;
  const xpAfter = Math.floor(next / 60) * BEDTIME_XP_PER_MIN;
  return { ledger: { day: today, seconds: next }, xp: xpAfter - xpBefore };
}

export const INPUT_HOUR_BADGES = [10, 50, 100, 300] as const;

export function inputHourBadgesEarned(totalSeconds: number): string[] {
  return INPUT_HOUR_BADGES.filter((h) => totalSeconds >= h * 3600).map((h) => `input-${h}h`);
}

/** HUD 표시용: 1h 23m / 45m */
export function formatInputTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
