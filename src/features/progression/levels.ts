// 레벨 계산 (순수 함수)
// 레벨 n → n+1 로 올라가는 데 필요한 XP = 100 × n^1.5 (반올림). 최대 Lv 99.

export const MAX_LEVEL = 99;

export function xpToNext(level: number): number {
  return Math.round(100 * Math.pow(level, 1.5));
}

/** 레벨 1에서 해당 레벨에 "도달"하기까지 필요한 누적 XP. */
export function totalXpForLevel(level: number): number {
  let sum = 0;
  for (let l = 1; l < Math.min(level, MAX_LEVEL); l++) sum += xpToNext(l);
  return sum;
}

export interface LevelInfo {
  level: number;
  /** 현재 레벨 안에서 모은 XP */
  into: number;
  /** 다음 레벨까지 필요한 XP (최대 레벨이면 0) */
  need: number;
}

/** 누적 XP → 레벨. levelCap 을 주면 그 레벨에서 멈춘다(졸업 전에는 다음 단계로 못 넘어감). */
export function levelFromXp(xp: number, levelCap: number = MAX_LEVEL): LevelInfo {
  const cap = Math.min(levelCap, MAX_LEVEL);
  let level = 1;
  let rest = Math.max(0, Math.floor(xp));
  while (level < cap && rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level++;
  }
  if (level >= cap) {
    // 상한에 걸리면 진행 막대는 가득 찬 채로 둔다. XP 자체는 계속 쌓인다.
    const need = level >= MAX_LEVEL ? 0 : xpToNext(level);
    return { level, into: need === 0 ? 0 : Math.min(rest, need), need };
  }
  return { level, into: rest, need: xpToNext(level) };
}
