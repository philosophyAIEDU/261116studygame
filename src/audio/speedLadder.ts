import type { Speed } from '@/types';
import type { AudioManifest } from '@/content/schema';

// 원어민 속도 사다리 (순수 함수)
// 🐢 Slow → 🚶 Natural → 🚀 Native. 느린 속도에서 시작해 실제 대화 속도까지 올라간다.
// 속도별 녹음 파일이 있으면 그것을 쓰고, 없으면 있는 파일을 배속 재생(음높이 유지)한다.

/** Natural 파일을 기준으로 한 배속 값 */
export const PLAYBACK_RATE: Record<Speed, number> = { slow: 0.75, natural: 1, native: 1.2 };

/** 녹음 파일이 전혀 없을 때 기기 음성(Web Speech)에 주는 속도 */
export const TTS_RATE: Record<Speed, number> = { slow: 0.7, natural: 0.95, native: 1.25 };

export const SPEED_ICON: Record<Speed, string> = { slow: '🐢', natural: '🚶', native: '🚀' };
export const SPEED_LABEL: Record<Speed, string> = { slow: 'Slow', natural: 'Natural', native: 'Native' };

export interface ResolvedAudio {
  /** audio/ 폴더 기준 파일명 */
  file: string;
  /** 1 이면 그 속도로 녹음된 파일, 아니면 배속 재생 */
  playbackRate: number;
}

const FALLBACK_ORDER: readonly Speed[] = ['natural', 'slow', 'native'];

export function resolveSentenceAudio(manifest: AudioManifest | null, sentenceId: string, speed: Speed): ResolvedAudio | null {
  if (!manifest) return null;
  const exact = `${sentenceId}.${speed}.mp3`;
  if (manifest.files[exact]) return { file: exact, playbackRate: 1 };
  for (const have of FALLBACK_ORDER) {
    const name = `${sentenceId}.${have}.mp3`;
    if (manifest.files[name]) {
      // 예: Natural 파일을 Native 로 → 1.2배, Slow 파일을 Natural 로 → 1/0.75배
      return { file: name, playbackRate: Math.round((PLAYBACK_RATE[speed] / PLAYBACK_RATE[have]) * 100) / 100 };
    }
  }
  return null;
}

/** Native 속도에서는 구어체 텍스트(gonna, wanna …)를 쓴다. */
export function textForSpeed(sentence: { text: string; nativeText?: string }, speed: Speed): string {
  return speed === 'native' && sentence.nativeText ? sentence.nativeText : sentence.text;
}

export function nextSpeed(speed: Speed): Speed {
  return speed === 'slow' ? 'natural' : speed === 'natural' ? 'native' : 'slow';
}
