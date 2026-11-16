// Gemini 무료 등급 한도 (기본값). 실제 한도는 Google AI Studio 에서 바뀔 수 있으므로
// 보호자 설정 화면에서 수정할 수 있고, 여기 값은 "기본값" 역할만 한다.
// 유료 사용은 절대 하지 않는다: 한도에 도달하면 호출 자체를 막는다.

export type ModelKey = 'flash' | 'lite';

export interface ModelLimit {
  /** API 에 보내는 모델 ID */
  id: string;
  label: string;
  /** 분당 요청 수 */
  rpm: number;
  /** 하루 요청 수 */
  rpd: number;
}

export const DEFAULT_GEMINI_LIMITS: Record<ModelKey, ModelLimit> = {
  flash: { id: 'gemini-3.8-flash', label: 'Flash', rpm: 5, rpd: 20 },
  lite: { id: 'gemini-3.5-flash-lite', label: 'Flash-Lite', rpm: 10, rpd: 500 },
};

/** 사용량이 이 비율을 넘으면 HUD 를 노란색으로 */
export const USAGE_WARN_RATIO = 0.8;

export const GEMINI_INPUT_MAX_CHARS = 500;
export const GEMINI_MAX_OUTPUT_TOKENS = 400;
export const GEMINI_HISTORY_TURNS = 6;
export const GEMINI_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const GEMINI_MAX_RETRIES = 2;

/** Talk Time 1회의 최대 턴 수 (= 최대 Gemini 호출 수) */
export const TALK_MAX_TURNS = 6;
/** 보호자가 정하는 하루 Talk Time 최대 횟수의 기본값 */
export const DEFAULT_TALK_SESSIONS_PER_DAY = 10;
/** 녹음 오디오를 Gemini 로 보낼 때의 최대 길이(초) */
export const TALK_AUDIO_MAX_SECONDS = 15;
