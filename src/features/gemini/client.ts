import {
  GEMINI_HISTORY_TURNS, GEMINI_INPUT_MAX_CHARS, GEMINI_MAX_OUTPUT_TOKENS, GEMINI_MAX_RETRIES, type ModelKey, type ModelLimit,
} from '@/config/geminiLimits';
import type { GeminiState } from '@/save/schema';
import { hashKey, ResponseCache } from './cache';
import { pickModel, type RequestKind } from './modelSelect';
import { RateLimiter } from './rateLimiter';
import { pacificDayKey, remainingToday } from './usage';

// Gemini 호출의 관문. 모든 AI 요청은 반드시 여기를 지난다.
//  ① 키가 없으면 호출하지 않는다 (게임은 그대로 진행)
//  ② 오늘 한도를 다 썼으면 무조건 차단 (유료 전환 없음)
//  ③ 요청을 "보낼 때" +1 (실패·429 포함) — 실제 사용량보다 적게 세는 일이 없게
//  ④ 분당 한도는 큐로 기다리고, 429 는 지수 백오프로 최대 2번 재시도
//  ⑤ 입력 500자 제한, 출력 400토큰, 대화 이력은 최근 6턴만
//  ⑥ 녹음 오디오는 보호자 동의가 없으면 절대 보내지 않는다

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

export interface GeminiRequest {
  kind: RequestKind;
  system: string;
  history?: readonly ChatTurn[];
  user: string;
  /** 구조화된 JSON 출력용 스키마 (있으면 responseMimeType: application/json) */
  schema?: unknown;
  /** 녹음 오디오 (보호자 동의 시에만) */
  audio?: { base64: string; mimeType: string };
  /** 24시간 캐시 사용 (대화는 캐시하지 않는다) */
  cache?: boolean;
}

export interface TransportArgs {
  apiKey: string;
  modelId: string;
  system: string;
  contents: { role: 'user' | 'model'; parts: ({ text: string } | { inlineData: { data: string; mimeType: string } })[] }[];
  schema?: unknown;
  maxOutputTokens: number;
}

/** 실제 네트워크 호출. 테스트에서는 가짜로 바꾼다. 429 는 { status: 429 } 를 던진다. */
export type GeminiTransport = (args: TransportArgs) => Promise<string>;

export type GeminiFailure = 'no-key' | 'limit' | 'audio-not-allowed' | 'error';
export type GeminiResult =
  | { ok: true; text: string; model: ModelKey | null; cached: boolean; waitedMs: number }
  | { ok: false; reason: GeminiFailure };

export interface GeminiDeps {
  transport: GeminiTransport;
  getKey: () => string | null;
  getState: () => GeminiState;
  /** 보호자가 오디오 전송에 동의했는가 */
  audioAllowed: (kind: RequestKind) => boolean;
  /** 사용량 +1 */
  count: (model: ModelKey, pacificDay: string) => void;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  limiter: RateLimiter;
  cache: ResponseCache;
  /** 분당 한도 때문에 기다리기 시작할 때 (NPC 의 "생각 중" 연출용) */
  onWait?: (ms: number) => void;
}

function remaining(state: GeminiState, now: Date): Record<ModelKey, number> {
  const one = (k: ModelKey) => remainingToday(state.usage[k], state.limits[k] as ModelLimit, now);
  return { lite: one('lite'), flash: one('flash') };
}

/** 오늘 이 종류의 요청에 쓸 수 있는 남은 호출 수 (Talk Time 턴 예산 계산용) */
export function remainingCallsFor(kind: RequestKind, state: GeminiState, now: Date): number {
  const left = remaining(state, now);
  if (state.mode !== 'auto') return left[state.mode];
  return kind === 'talk' || kind === 'mentor' || kind === 'roleplay' ? left.lite : left.flash + left.lite;
}

export function trimInput(text: string): string {
  return text.trim().slice(0, GEMINI_INPUT_MAX_CHARS);
}

export function trimHistory(history: readonly ChatTurn[]): ChatTurn[] {
  return history.slice(-GEMINI_HISTORY_TURNS * 2).map((t) => ({ role: t.role, text: t.text.slice(0, GEMINI_INPUT_MAX_CHARS) }));
}

export async function callGemini(req: GeminiRequest, deps: GeminiDeps): Promise<GeminiResult> {
  const apiKey = deps.getKey();
  if (!apiKey) return { ok: false, reason: 'no-key' };
  // 동의 없는 오디오는 조용히 빼는 것이 아니라 요청 자체를 거절한다(실수로라도 전송되지 않게).
  if (req.audio && !deps.audioAllowed(req.kind)) return { ok: false, reason: 'audio-not-allowed' };

  const user = trimInput(req.user);
  const history = trimHistory(req.history ?? []);
  const cacheKey = req.cache && !req.audio ? hashKey(JSON.stringify([req.kind, req.system, history, user])) : null;
  if (cacheKey) {
    const hit = deps.cache.get(cacheKey, deps.now().getTime());
    if (hit !== null) return { ok: true, text: hit, model: null, cached: true, waitedMs: 0 };
  }

  const userParts: TransportArgs['contents'][number]['parts'] = [];
  if (req.audio) userParts.push({ inlineData: { data: req.audio.base64, mimeType: req.audio.mimeType } });
  userParts.push({ text: user.length > 0 ? user : '(audio)' });
  const contents: TransportArgs['contents'] = [
    ...history.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
    { role: 'user' as const, parts: userParts },
  ];

  let waitedMs = 0;
  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
    const state = deps.getState();
    const now = deps.now();
    const model = pickModel(req.kind, state.mode, remaining(state, now));
    if (!model) return { ok: false, reason: 'limit' };
    const limit = state.limits[model];

    const wait = deps.limiter.reserve(model, limit.rpm, now.getTime());
    if (wait > 0) {
      deps.onWait?.(wait);
      waitedMs += wait;
      await deps.sleep(wait);
    }

    deps.count(model, pacificDayKey(deps.now()));
    try {
      const text = await deps.transport({ apiKey, modelId: limit.id, system: req.system, contents, schema: req.schema, maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS });
      if (cacheKey) deps.cache.set(cacheKey, text, deps.now().getTime());
      return { ok: true, text, model, cached: false, waitedMs };
    } catch (e) {
      const status = (e as { status?: number } | null)?.status;
      if (status !== 429 || attempt === GEMINI_MAX_RETRIES) return { ok: false, reason: 'error' };
      // 429: 1초, 2초 … 로 늘려 가며 다시 시도한다.
      const backoff = 1000 * 2 ** attempt;
      waitedMs += backoff;
      await deps.sleep(backoff);
    }
  }
  return { ok: false, reason: 'error' };
}
