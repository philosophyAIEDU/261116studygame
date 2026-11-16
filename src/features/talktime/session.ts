import type { Mbti, Speed, Tier } from '@/types';
import { TALK_MAX_TURNS } from '@/config/geminiLimits';
import { TALK_COMPLETE_BONUS, talkTurnXp } from '@/features/progression/xp';
import { detectPhrasesUsed } from '@/features/story/phrases';
import { looksLikeFullSentence } from '@/features/skills/scoring';
import { learningStyle } from '@/features/mbti/style';

// Talk Time 규칙 (순수 함수): 턴 예산, 하루 횟수 제한, 응답 파싱, 시스템 프롬프트, XP.
// 학생이 말하면 Gemini 가 캐릭터로서 대답한다. 틀려도 "틀렸어"라고 하지 않고 자연스럽게 고쳐 말해 준다(recast).

// ── 턴 예산 ──────────────────────────────────────────────────
export type TalkBlock = 'no-key' | 'no-calls' | 'daily-limit';

export interface TalkBudget {
  /** 이번 대화에서 쓸 수 있는 턴 수 (= Gemini 호출 수) */
  turns: number;
  blocked: TalkBlock | null;
}

/**
 * Talk Time 1회 = 최대 6턴. 남은 호출이 6회 미만이면 남은 만큼만, 0이면 잠근다.
 * 보호자가 정한 하루 최대 횟수를 넘으면 잠근다(아이 혼자 한도를 다 쓰지 않게).
 */
export function planTalk(args: { hasKey: boolean; remainingCalls: number; sessionsToday: number; maxSessionsPerDay: number }): TalkBudget {
  if (!args.hasKey) return { turns: 0, blocked: 'no-key' };
  if (args.sessionsToday >= args.maxSessionsPerDay) return { turns: 0, blocked: 'daily-limit' };
  if (args.remainingCalls <= 0) return { turns: 0, blocked: 'no-calls' };
  return { turns: Math.min(TALK_MAX_TURNS, args.remainingCalls), blocked: null };
}

/** 오늘 쓴 Talk Time 횟수 (날짜가 바뀌었으면 0) */
export function sessionsUsedToday(talk: { day: string; sessionsToday: number }, today: string): number {
  return talk.day === today ? talk.sessionsToday : 0;
}

// ── Gemini 응답 ───────────────────────────────────────────────
export interface TalkReply {
  reply: string;
  /** 학생 문장을 자연스럽게 고쳐 말한 것. 고칠 곳이 없으면 null */
  recast: string | null;
  phraseUsed: string[];
  encouragement: string;
  /** 막혔을 때 누를 수 있는 힌트 문장 2개 */
  suggestedNext: string[];
  /** 오디오를 보냈을 때만: Gemini 가 받아쓴 학생의 말 */
  transcript: string | null;
  /** 발음 피드백(선택) */
  pronunciation: string | null;
}

/** 구조화된 JSON 출력 스키마 (@google/genai 의 responseSchema 형식) */
export function talkSchema(withTranscript: boolean): unknown {
  const str = { type: 'STRING' };
  return {
    type: 'OBJECT',
    properties: {
      reply: str,
      recast: { type: 'STRING', nullable: true },
      phraseUsed: { type: 'ARRAY', items: str },
      encouragement: str,
      suggestedNext: { type: 'ARRAY', items: str },
      ...(withTranscript ? { transcript: str } : {}),
    },
    required: ['reply', 'suggestedNext', ...(withTranscript ? ['transcript'] : [])],
  };
}

const HANGUL = new RegExp(`[${String.fromCharCode(0x3131)}-${String.fromCharCode(0x318e)}${String.fromCharCode(0xac00)}-${String.fromCharCode(0xd7a3)}]`);

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  // 학습 화면에 한국어가 나오면 안 된다 → 한글이 섞인 값은 버린다.
  return s.length > 0 && !HANGUL.test(s) ? s : null;
}

function stringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(cleanString).filter((s): s is string => s !== null).slice(0, max);
}

export const FALLBACK_REPLY = 'I see! Tell me more.';

/**
 * Gemini 응답 문자열 → TalkReply.
 * JSON 파싱에 실패하면 받은 글 전체를 reply 로 쓰는 폴백으로 대화가 끊기지 않게 한다.
 */
export function parseTalkReply(raw: string): TalkReply {
  const empty: TalkReply = { reply: FALLBACK_REPLY, recast: null, phraseUsed: [], encouragement: '', suggestedNext: [], transcript: null, pronunciation: null };
  const text = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    if (typeof data !== 'object' || data === null) throw new Error('not an object');
    return {
      reply: cleanString(data.reply) ?? FALLBACK_REPLY,
      recast: cleanString(data.recast),
      phraseUsed: stringList(data.phraseUsed, 5),
      encouragement: cleanString(data.encouragement) ?? '',
      suggestedNext: stringList(data.suggestedNext, 2),
      transcript: cleanString(data.transcript),
      pronunciation: cleanString(data.pronunciation),
    };
  } catch {
    // 폴백: JSON 이 아니면 글 자체를 대답으로 쓴다.
    const plain = cleanString(text.replace(/[{}"]/g, ' ').replace(/\s+/g, ' '));
    return { ...empty, reply: plain ? plain.slice(0, 240) : FALLBACK_REPLY };
  }
}

// ── 시스템 프롬프트 ────────────────────────────────────────────
export interface TalkContext {
  npcPersona: string;
  scene: string;
  level: number;
  mbti: Mbti | null;
  phrasePocket: readonly string[];
  dictionaryWords: readonly string[];
  withTranscript: boolean;
}

/** 레벨별 대답 길이: 1~20 레벨은 1~2문장(최대 20단어), 이후 점점 길어진다. */
export function replyWordLimit(level: number): number {
  if (level <= 20) return 20;
  if (level <= 35) return 30;
  if (level <= 50) return 40;
  if (level <= 70) return 55;
  return 70;
}

export function buildTalkSystemPrompt(ctx: TalkContext): string {
  const tone = ctx.mbti && learningStyle(ctx.mbti).tone === 'reason' ? 'clear and logical; give a short reason when you praise' : 'warm and caring; praise feelings and effort first';
  const lines = [
    `You are ${ctx.npcPersona}`,
    `Scene: ${ctx.scene}`,
    `You are talking with a Korean child who is learning English like a first language. The child's level is ${ctx.level} of 99.`,
    'RULES:',
    `- Speak ONLY in very easy English. Never write Korean or any other language. Use at most ${replyWordLimit(ctx.level)} words${ctx.level <= 20 ? ' in 1 or 2 short sentences' : ''}.`,
    '- Always end your reply with one easy question so the talk keeps going.',
    '- Never say the child is wrong. If the sentence has a mistake, put the natural, correct sentence in "recast" and also reuse the correct words naturally inside your reply, the way a parent repeats a toddler. If there is no mistake, "recast" is null.',
    '- If the child speaks Korean, understand it, answer in easy English, and show how to say it in "suggestedNext".',
    `- Try to use these story phrases naturally: ${ctx.phrasePocket.slice(0, 8).join(' | ') || '(none)'}.`,
    `- Try to use these words the child knows: ${ctx.dictionaryWords.slice(0, 12).join(', ') || '(none)'}.`,
    '- "phraseUsed": list the story phrases the child used in their last message.',
    '- "encouragement": one very short cheer with one emoji.',
    '- "suggestedNext": exactly 2 short, easy sentences the child could say next.',
    ctx.withTranscript ? '- The child\'s message is an audio recording. Put exactly what the child said in "transcript".' : '',
    `- Tone: ${tone}.`,
    '- Child safety: stay on kind, school-friendly topics. Never ask for a real name, address, school, phone number, or photo. If the child shares something worrying, kindly tell them to talk to a parent or teacher.',
    'Reply with JSON only.',
  ];
  return lines.filter(Boolean).join('\n');
}

// ── 턴 채점과 요약 ─────────────────────────────────────────────
export interface TurnRecord {
  said: string;
  recast: string | null;
  phrases: string[];
  xp: number;
}

/** 학생의 한 턴을 채점한다. 표현 사용은 기기에서 직접 확인하고(Gemini 의 phraseUsed 와 합친다) 고쳐 말하기를 받아도 XP 를 깎지 않는다. */
export function scoreTurn(args: { said: string; reply: TalkReply; pocket: readonly string[]; tier: Tier; speed: Speed }): TurnRecord {
  const local = detectPhrasesUsed(args.said, args.pocket);
  const fromModel = args.reply.phraseUsed.filter((p) => args.pocket.some((x) => x.toLowerCase() === p.toLowerCase()) && detectPhrasesUsed(args.said, [p]).length > 0);
  const phrases = [...new Set([...local, ...fromModel])];
  const xp = talkTurnXp({ tier: args.tier, speed: args.speed, fullSentence: looksLikeFullSentence(args.said), phrasesUsed: phrases.length });
  return { said: args.said, recast: args.reply.recast, phrases, xp };
}

export interface TalkSummary {
  sentences: number;
  phrases: string[];
  recasts: { said: string; better: string }[];
  xp: number;
  completed: boolean;
}

/** 대화가 끝난 뒤의 요약 카드 — Gemini 를 부르지 않고 기기에서 만든다. */
export function summarizeTalk(turns: readonly TurnRecord[], plannedTurns: number): TalkSummary {
  const completed = plannedTurns >= TALK_MAX_TURNS && turns.length >= TALK_MAX_TURNS;
  return {
    sentences: turns.length,
    phrases: [...new Set(turns.flatMap((t) => t.phrases))],
    recasts: turns.filter((t) => t.recast !== null).map((t) => ({ said: t.said, better: t.recast as string })),
    xp: turns.reduce((sum, t) => sum + t.xp, 0) + (completed ? TALK_COMPLETE_BONUS : 0),
    completed,
  };
}
