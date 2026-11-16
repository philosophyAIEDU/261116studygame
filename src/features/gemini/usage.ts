import { USAGE_WARN_RATIO, type ModelKey, type ModelLimit } from '@/config/geminiLimits';

// Gemini 사용량 계산 (순수 함수)
// 무료 한도는 "미국 태평양 시간 자정"에 초기화된다. Intl 로 계산하므로 서머타임(PST/PDT)이 자동 반영된다.
// (한국 시간으로는 겨울 오후 5시, 여름 오후 4시)

const PACIFIC = 'America/Los_Angeles';

function pacificParts(date: Date): { day: string; hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PACIFIC, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  return { day: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')), minute: Number(get('minute')), second: Number(get('second')) };
}

/** 태평양 시간 기준 날짜 키 'YYYY-MM-DD' */
export function pacificDayKey(date: Date): string {
  return pacificParts(date).day;
}

/** 다음 초기화 시각(태평양 시간 다음 자정). 서머타임이 바뀌는 날에도 맞도록 한 번 보정한다. */
export function nextResetAt(now: Date): Date {
  const p = pacificParts(now);
  const elapsed = p.hour * 3600 + p.minute * 60 + p.second;
  let candidate = new Date(now.getTime() - (now.getTime() % 1000) + (86400 - elapsed) * 1000);
  const c = pacificParts(candidate);
  if (c.hour === 23) candidate = new Date(candidate.getTime() + 3600_000); // 하루가 25시간인 날(가을)
  else if (c.hour === 1) candidate = new Date(candidate.getTime() - 3600_000); // 하루가 23시간인 날(봄)
  return candidate;
}

export interface UsageEntry {
  day: string;
  count: number;
}

/** 오늘(태평양 시간) 쓴 횟수. 저장된 날짜가 오늘이 아니면 0. */
export function usedToday(entry: UsageEntry, now: Date): number {
  return entry.day === pacificDayKey(now) ? entry.count : 0;
}

export function remainingToday(entry: UsageEntry, limit: ModelLimit, now: Date): number {
  return Math.max(0, limit.rpd - usedToday(entry, now));
}

export type UsageLevel = 'ok' | 'warn' | 'blocked';

/** 80% 에서 노랑, 100% 에서 빨강(호출 차단). */
export function usageLevel(used: number, rpd: number): UsageLevel {
  if (used >= rpd) return 'blocked';
  if (used >= rpd * USAGE_WARN_RATIO) return 'warn';
  return 'ok';
}

export interface UsageSummary {
  key: ModelKey;
  label: string;
  used: number;
  rpd: number;
  level: UsageLevel;
}

export function usageSummary(
  usage: Record<ModelKey, UsageEntry>,
  limits: Record<ModelKey, ModelLimit>,
  now: Date,
): Record<ModelKey, UsageSummary> {
  const one = (key: ModelKey): UsageSummary => {
    const used = usedToday(usage[key], now);
    return { key, label: limits[key].label, used, rpd: limits[key].rpd, level: usageLevel(used, limits[key].rpd) };
  };
  return { lite: one('lite'), flash: one('flash') };
}
