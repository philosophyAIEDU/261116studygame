import { useGame } from '@/save/store';
import { ResponseCache } from './cache';
import { callGemini, remainingCallsFor, type GeminiDeps, type GeminiRequest, type GeminiResult, type GeminiTransport } from './client';
import { getApiKey } from './key';
import type { RequestKind } from './modelSelect';
import { RateLimiter } from './rateLimiter';
import { geminiTransport } from './transport';

// 앱에서 쓰는 Gemini 진입점: 세이브 저장소(사용량·설정)와 연결된 기본 의존성.

const limiter = new RateLimiter();
let cache: ResponseCache | null = null;
let transport: GeminiTransport = geminiTransport;

/** 테스트에서 네트워크 호출을 가짜로 바꾼다. */
export function setGeminiTransport(t: GeminiTransport | null): void {
  transport = t ?? geminiTransport;
  limiter.reset();
  cache?.clear();
}

function deps(onWait?: (ms: number) => void): GeminiDeps {
  cache ??= new ResponseCache();
  return {
    transport: (args) => transport(args),
    getKey: getApiKey,
    getState: () => useGame.getState().save.gemini,
    // 발음 피드백과 음성 인식은 보호자가 각각 따로 동의한다.
    audioAllowed: (kind) => {
      const s = useGame.getState().save.settings;
      return kind === 'pronunciation' ? s.pronunciationFeedback : s.sendAudioToGemini;
    },
    count: (model, day) => useGame.getState().countGeminiCall(model, day),
    now: () => new Date(),
    sleep: (ms) => new Promise((r) => setTimeout(r, import.meta.env.MODE === 'test' ? 0 : ms)),
    limiter,
    cache,
    onWait,
  };
}

export function askGemini(req: GeminiRequest, onWait?: (ms: number) => void): Promise<GeminiResult> {
  return callGemini(req, deps(onWait));
}

export function hasGeminiKey(): boolean {
  return getApiKey() !== null;
}

export function callsLeft(kind: RequestKind): number {
  return remainingCallsFor(kind, useGame.getState().save.gemini, new Date());
}
