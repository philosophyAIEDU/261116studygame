// 날짜 키 유틸 (순수 함수). 'YYYY-MM-DD' 문자열로 하루를 구분한다.

/** 기기 현지 시간 기준 날짜 키 (연속 학습일, Bedtime 일일 상한에 사용). */
export function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 날짜 키에 일수를 더한다. */
export function addDays(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days));
  return date.toISOString().slice(0, 10);
}

export interface Streak {
  lastDay: string;
  days: number;
}

/** 오늘 학습했을 때의 연속 학습일. 어제 했으면 +1, 오늘 이미 했으면 그대로, 하루 이상 빠지면 1부터. */
export function touchStreak(prev: Streak, today: string): Streak {
  if (prev.lastDay === today) return prev;
  if (prev.lastDay && addDays(prev.lastDay, 1) === today) return { lastDay: today, days: prev.days + 1 };
  return { lastDay: today, days: 1 };
}
