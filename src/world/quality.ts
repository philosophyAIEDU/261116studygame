import type { QualitySetting } from '@/save/schema';

// 그래픽 품질 자동 감지 (순수 함수). 목표: 보급형 휴대폰에서 Low 30fps 이상.

export type Quality = 'low' | 'medium' | 'high';

export interface DeviceInfo {
  cores: number;
  memoryGb: number | null;
  mobile: boolean;
}

export function detectQuality(d: DeviceInfo): Quality {
  if (d.mobile) {
    if (d.cores <= 4 || (d.memoryGb !== null && d.memoryGb <= 3)) return 'low';
    return 'medium';
  }
  if (d.cores >= 8 && (d.memoryGb === null || d.memoryGb >= 8)) return 'high';
  if (d.cores <= 2) return 'low';
  return 'medium';
}

export function readDevice(): DeviceInfo {
  const nav = typeof navigator === 'undefined' ? null : (navigator as Navigator & { deviceMemory?: number });
  return {
    cores: nav?.hardwareConcurrency ?? 4,
    memoryGb: nav?.deviceMemory ?? null,
    mobile: !!nav && (/Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent) || (nav.maxTouchPoints > 1 && /Mac/i.test(nav.userAgent))),
  };
}

export function resolveQuality(setting: QualitySetting, device: DeviceInfo = readDevice()): Quality {
  return setting === 'auto' ? detectQuality(device) : setting;
}

export interface QualityConfig {
  dpr: number;
  shadows: boolean;
  antialias: boolean;
  bloom: boolean;
  trees: number;
  stars: number;
}

export function qualityConfig(q: Quality, deviceDpr: number): QualityConfig {
  if (q === 'low') return { dpr: 1, shadows: false, antialias: false, bloom: false, trees: 14, stars: 120 };
  if (q === 'medium') return { dpr: Math.min(deviceDpr, 1.5), shadows: true, antialias: true, bloom: false, trees: 32, stars: 300 };
  return { dpr: Math.min(deviceDpr, 2), shadows: true, antialias: true, bloom: true, trees: 54, stars: 600 };
}
