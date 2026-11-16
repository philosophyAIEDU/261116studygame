import type { DayPhase, LifeStage } from '@/types';

// 3D 월드의 색과 조명 프리셋. 값의 근거는 docs/ART_BIBLE.md 3절.

export interface LightPreset {
  skyTop: string;
  skyBottom: string;
  sun: string;
  sunIntensity: number;
  ambient: number;
  /** 태양(달) 방향 */
  sunPos: [number, number, number];
  /** 0 = 낮, 1 = 밤 (창문 불빛·별의 세기) */
  night: number;
}

export const LIGHT_PRESETS: Record<DayPhase, LightPreset> = {
  morning: { skyTop: '#9ed8f0', skyBottom: '#ffe9c7', sun: '#ffe2b0', sunIntensity: 1.1, ambient: 0.65, sunPos: [-18, 14, 10], night: 0 },
  day: { skyTop: '#6fc3ea', skyBottom: '#d8f1ff', sun: '#ffffff', sunIntensity: 1.3, ambient: 0.75, sunPos: [6, 24, 8], night: 0 },
  sunset: { skyTop: '#f79a6b', skyBottom: '#ffd9a0', sun: '#ffb070', sunIntensity: 1.0, ambient: 0.55, sunPos: [20, 9, 6], night: 0.25 },
  night: { skyTop: '#141a33', skyBottom: '#2b3260', sun: '#9fb4ff', sunIntensity: 0.55, ambient: 0.55, sunPos: [-10, 18, -12], night: 1 },
};

export interface StageTheme {
  name: string;
  ground: string;
  path: string;
  wall: string;
  /** 건물 높이 배율 (학교가 커질수록 높아진다) */
  height: number;
  trees: number;
}

/** 성장 단계마다 맵 분위기가 바뀐다: 초등학교 → 중학교 → 고등학교 → 대학 캠퍼스 → 직장 */
export const STAGE_THEMES: Record<LifeStage, StageTheme> = {
  elementary: { name: 'Maple Grove Elementary', ground: '#7cc36a', path: '#f3d9a4', wall: '#fff1d6', height: 1, trees: 1 },
  middle: { name: 'Maple Grove Middle School', ground: '#74b96a', path: '#e6d2b0', wall: '#f4e3c8', height: 1.25, trees: 0.9 },
  high: { name: 'Riverside High School', ground: '#6caf70', path: '#d9cdb8', wall: '#ecdcc6', height: 1.5, trees: 0.8 },
  college: { name: 'Lakeview College', ground: '#69a874', path: '#cfc6b8', wall: '#e2d6c8', height: 1.9, trees: 1.1 },
  career: { name: 'Downtown', ground: '#8aa58c', path: '#c4c4c4', wall: '#dfe4ea', height: 2.6, trees: 0.4 },
};

export const SKIN = '#f7d2b0';
