// 캐릭터 외형 선택지 (오리지널 디자인). 2D 아바타와 3D 캐릭터가 같은 값을 쓴다.
export const HAIR_STYLES = ['Short', 'Bob', 'Ponytail'] as const;
export const HAIR_COLORS = ['#2b2440', '#5a3825', '#b5651d', '#e0b040', '#c0392b'] as const;
export const OUTFIT_COLORS = ['#e8743b', '#7ec8e3', '#7cc36a', '#8e7cc3', '#f6b352'] as const;
export const SKIN_COLOR = '#f7d2b0';

export function hairColor(i: number): string {
  return HAIR_COLORS[i] ?? HAIR_COLORS[0];
}
export function outfitColor(i: number): string {
  return OUTFIT_COLORS[i] ?? OUTFIT_COLORS[0];
}
