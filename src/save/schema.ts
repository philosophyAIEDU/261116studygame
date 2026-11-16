import type { CareerId, DayPhase, LifeStage, Profile, Skill, Speed } from '@/types';
import type { StoryProgress } from '@/features/story/unlock';
import type { DictCard } from '@/features/dictionary/srs';
import { DEFAULT_GEMINI_LIMITS, DEFAULT_TALK_SESSIONS_PER_DAY, type ModelKey, type ModelLimit } from '@/config/geminiLimits';

// 세이브 데이터 스키마.
// schemaVersion 을 올릴 때는 반드시 migrations/ 에 순차 변환 함수를 추가한다.
// (업데이트 때문에 아이의 진행 데이터가 사라지면 안 된다)

export const CURRENT_SCHEMA_VERSION = 2;

export type ModelMode = 'auto' | ModelKey;
export type QualitySetting = 'auto' | 'low' | 'medium' | 'high';

export interface Settings {
  volume: { bgm: number; sfx: number; voice: number };
  quality: QualitySetting;
  speed: Speed;
  /** 저녁 7시 이후 밤 장면 자동 제안 */
  autoNight: boolean;
  /** Talk Time: 말이 끝나고 1.5초 정적이면 자동 전송 */
  autoSendSpeech: boolean;
  /** 보호자 동의: 녹음 오디오를 Gemini 로 보내 인식 (기본 꺼짐) */
  sendAudioToGemini: boolean;
  /** 보호자 동의: 발음 피드백 (기본 꺼짐) */
  pronunciationFeedback: boolean;
  maxTalkSessionsPerDay: number;
  guardianPin: string | null;
}

export interface GeminiState {
  /** 모델 키별 { 태평양시 날짜, 호출 수 } */
  usage: Record<ModelKey, { day: string; count: number }>;
  mode: ModelMode;
  limits: Record<ModelKey, ModelLimit>;
}

export interface SaveData {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  profile: Profile | null;
  guardianIntroSeen: boolean;
  prologueSeen: boolean;
  xp: number;
  graduated: LifeStage[];
  career: CareerId | null;
  streak: { lastDay: string; days: number };
  stories: Record<string, StoryProgress>;
  dictionary: Record<string, DictCard>;
  input: { totalSeconds: number; bedtimeDay: string; bedtimeSeconds: number };
  skills: Record<Skill, { done: number }>;
  /** 입력:출력 비율 리포트용 */
  output: { spokenTurns: number; writtenPieces: number };
  badges: string[];
  gemini: GeminiState;
  /** 대화 원문은 저장하지 않는다. 통계만 둔다. */
  talk: { day: string; sessionsToday: number; totalSessions: number; phraseUses: number };
  world: { phase: DayPhase; activitiesToday: number };
  /** 오늘의 퀘스트용 하루 카운터 */
  daily: { day: string; listens: number; words: number };
  settings: Settings;
}

export function defaultSettings(): Settings {
  return {
    volume: { bgm: 0.5, sfx: 0.8, voice: 1 },
    quality: 'auto',
    speed: 'slow',
    autoNight: true,
    autoSendSpeech: false,
    sendAudioToGemini: false,
    pronunciationFeedback: false,
    maxTalkSessionsPerDay: DEFAULT_TALK_SESSIONS_PER_DAY,
    guardianPin: null,
  };
}

export function defaultSave(): SaveData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profile: null,
    guardianIntroSeen: false,
    prologueSeen: false,
    xp: 0,
    graduated: [],
    career: null,
    streak: { lastDay: '', days: 0 },
    stories: {},
    dictionary: {},
    input: { totalSeconds: 0, bedtimeDay: '', bedtimeSeconds: 0 },
    skills: { listening: { done: 0 }, reading: { done: 0 }, speaking: { done: 0 }, writing: { done: 0 } },
    output: { spokenTurns: 0, writtenPieces: 0 },
    badges: [],
    gemini: {
      usage: { flash: { day: '', count: 0 }, lite: { day: '', count: 0 } },
      mode: 'auto',
      limits: structuredClone(DEFAULT_GEMINI_LIMITS),
    },
    talk: { day: '', sessionsToday: 0, totalSessions: 0, phraseUses: 0 },
    world: { phase: 'morning', activitiesToday: 0 },
    daily: { day: '', listens: 0, words: 0 },
    settings: defaultSettings(),
  };
}
