import { describe, expect, it } from 'vitest';
import { buildTalkSystemPrompt, FALLBACK_REPLY, parseTalkReply, planTalk, replyWordLimit, scoreTurn, sessionsUsedToday, summarizeTalk, talkSchema, type TurnRecord } from './session';
import { buildMentorSystemPrompt, buildWritingFeedbackPrompt, MENTOR_LINES, mentorLine, mentorWordLimit } from '@/features/mentor/prompt';
import { detectPhrasesUsed, phrasesInText } from '@/features/story/phrases';
import { containsHangul } from '@/features/dictionary/hangul';

describe('Talk Time turn budget', () => {
  const base = { hasKey: true, remainingCalls: 463, sessionsToday: 0, maxSessionsPerDay: 10 };
  it('one talk is at most 6 turns', () => {
    expect(planTalk(base)).toEqual({ turns: 6, blocked: null });
  });
  it('shrinks when fewer than 6 calls are left, and locks at 0', () => {
    expect(planTalk({ ...base, remainingCalls: 4 })).toEqual({ turns: 4, blocked: null });
    expect(planTalk({ ...base, remainingCalls: 0 })).toEqual({ turns: 0, blocked: 'no-calls' });
  });
  it('locks without a key and at the guardian daily limit', () => {
    expect(planTalk({ ...base, hasKey: false })).toEqual({ turns: 0, blocked: 'no-key' });
    expect(planTalk({ ...base, sessionsToday: 10 })).toEqual({ turns: 0, blocked: 'daily-limit' });
    expect(planTalk({ ...base, sessionsToday: 9 }).blocked).toBeNull();
    expect(sessionsUsedToday({ day: '2026-01-01', sessionsToday: 7 }, '2026-01-01')).toBe(7);
    expect(sessionsUsedToday({ day: '2026-01-01', sessionsToday: 7 }, '2026-01-02')).toBe(0);
  });
});

describe('Gemini reply parsing', () => {
  it('reads the structured JSON', () => {
    const r = parseTalkReply(JSON.stringify({
      reply: 'Oh, you like pizza? Me too! What kind do you like?', recast: 'I like pizza very much.',
      phraseUsed: ['I like ...'], encouragement: 'Great sentence! 🍕', suggestedNext: ['I like cheese pizza.', "I don't know.", 'extra'],
    }));
    expect(r.reply).toMatch(/pizza/);
    expect(r.recast).toBe('I like pizza very much.');
    expect(r.suggestedNext).toEqual(['I like cheese pizza.', "I don't know."]);
    expect(r.transcript).toBeNull();
  });
  it('accepts code fences, null recast and a transcript', () => {
    const r = parseTalkReply('```json\n{"reply":"Nice! What is your name?","recast":null,"suggestedNext":[],"transcript":"hello"}\n```');
    expect(r).toMatchObject({ reply: 'Nice! What is your name?', recast: null, transcript: 'hello' });
  });
  it('falls back to plain text when JSON is broken', () => {
    expect(parseTalkReply('Hello there! How are you?').reply).toBe('Hello there! How are you?');
    expect(parseTalkReply('{"reply": "Hi! How are').reply).toContain('Hi! How are');
    expect(parseTalkReply('').reply).toBe(FALLBACK_REPLY);
    expect(parseTalkReply('{"recast": 5}').reply).toBe(FALLBACK_REPLY);
  });
  it('drops any Korean so it never reaches the learning screen', () => {
    const r = parseTalkReply(JSON.stringify({ reply: '안녕! Hello!', recast: '피자', suggestedNext: ['좋아요', 'I like it.'] }));
    expect(r.reply).toBe(FALLBACK_REPLY);
    expect(r.recast).toBeNull();
    expect(r.suggestedNext).toEqual(['I like it.']);
  });
  it('schema asks for a transcript only in audio mode', () => {
    expect(JSON.stringify(talkSchema(false))).not.toContain('transcript');
    expect(JSON.stringify(talkSchema(true))).toContain('transcript');
  });
});

describe('Phrase Pocket detection and turn XP', () => {
  const pocket = ['Can I sit here?', "I'm new here.", 'I like ...', 'Thank you!'];
  it('finds phrases in story text and in what the child said', () => {
    expect(phrasesInText("Hi! I'm Mina. I'm new here.", pocket)).toEqual(["I'm new here."]);
    expect(detectPhrasesUsed('um, can I sit here please', pocket)).toEqual(['Can I sit here?']);
    expect(detectPhrasesUsed('I like cheese pizza, thank you', pocket)).toEqual(['I like ...', 'Thank you!']);
    expect(detectPhrasesUsed('hello', pocket)).toEqual([]);
  });
  const reply = parseTalkReply(JSON.stringify({ reply: 'Sure! Do you like pizza?', recast: 'Can I sit here?', phraseUsed: ['Thank you!', 'Made up phrase'], suggestedNext: [] }));
  it('scores a turn: 20 × difficulty × speed, +5 full sentence, +10 per phrase', () => {
    const t = scoreTurn({ said: 'Can I sit here?', reply, pocket, tier: 1, speed: 'slow' });
    // Gemini 가 주장한 표현이라도 실제로 말하지 않았으면 인정하지 않는다
    expect(t.phrases).toEqual(['Can I sit here?']);
    expect(t.xp).toBe(20 + 5 + 10);
    expect(scoreTurn({ said: 'pizza', reply, pocket, tier: 2, speed: 'native' }).xp).toBe(47);
  });
  it('a recast never lowers XP', () => {
    const noRecast = parseTalkReply(JSON.stringify({ reply: 'Ok?', recast: null, suggestedNext: [] }));
    const a = scoreTurn({ said: 'I likes pizza', reply, pocket, tier: 1, speed: 'slow' });
    const b = scoreTurn({ said: 'I likes pizza', reply: noRecast, pocket, tier: 1, speed: 'slow' });
    expect(a.xp).toBe(b.xp);
    expect(a.recast).toBe('Can I sit here?');
  });
  it('summary card is built locally: sentences, phrases, recasts, +30 for a full 6-turn talk', () => {
    const turn = (i: number): TurnRecord => ({ said: `s${i}`, recast: i === 1 ? 'better' : null, phrases: i < 2 ? ['Thank you!'] : [], xp: 20 });
    const six = summarizeTalk([0, 1, 2, 3, 4, 5].map(turn), 6);
    expect(six).toMatchObject({ sentences: 6, phrases: ['Thank you!'], completed: true, xp: 150 });
    expect(six.recasts).toEqual([{ said: 's1', better: 'better' }]);
    expect(summarizeTalk([0, 1, 2].map(turn), 6)).toMatchObject({ completed: false, xp: 60 });
    expect(summarizeTalk([0, 1, 2, 3].map(turn), 4).completed).toBe(false); // 줄어든 대화는 완주 보너스 없음
  });
});

describe('system prompts', () => {
  const ctx = { npcPersona: 'Leo, a cheerful classmate.', scene: 'Lunch time.', level: 3, mbti: 'INTJ' as const, phrasePocket: ['Can I sit here?'], dictionaryWords: ['bright'], withTranscript: false };
  it('Talk Time: easy English only, short for low levels, recast instead of correction, ends with a question', () => {
    const p = buildTalkSystemPrompt(ctx);
    expect(p).toContain('at most 20 words in 1 or 2 short sentences');
    expect(p).toContain('Never write Korean');
    expect(p).toContain('Never say the child is wrong');
    expect(p).toContain('end your reply with one easy question');
    expect(p).toContain('Can I sit here?');
    expect(p).toContain('bright');
    expect(p).toContain('give a short reason');
    expect(p).not.toContain('transcript');
    expect(buildTalkSystemPrompt({ ...ctx, mbti: 'ENFP', level: 60, withTranscript: true })).toMatch(/at most 55 words[\s\S]*warm and caring[\s\S]*transcript|transcript[\s\S]*warm and caring/);
    expect([1, 20, 21, 36, 51, 71].map(replyWordLimit)).toEqual([20, 20, 30, 40, 55, 70]);
    expect(containsHangul(p)).toBe(false);
  });
  it('Mentor: teaches English through English, never translates, hints first, fills ears first', () => {
    const p = buildMentorSystemPrompt({ level: 5, mbti: 'ESFP', recentWords: ['huge'], currentStory: 'Lunch Time', speakingLocked: true });
    expect(p).toContain('At most 30 words');
    expect(p).toContain('NEVER translate a word into Korean');
    expect(p).toContain('ONE short Korean sentence of comfort');
    expect(p).toContain('Give a hint');
    expect(p).toContain("Let's fill your ears first!");
    expect(p).toContain('Start with praise');
    expect(p).toContain('everyday examples');
    expect(p).toContain('huge');
    expect(mentorWordLimit(21)).toBe(80);
    expect(buildMentorSystemPrompt({ level: 40, mbti: 'INTP', recentWords: [], currentStory: null, speakingLocked: false })).toContain('Explain the reason first');
    expect(buildWritingFeedbackPrompt(40, 'email')).toContain('Never use Korean');
  });
  it('fixed lines come from a local pool (no API) and contain no Korean', () => {
    expect(mentorLine('night', 0)).toBe('Sweet dreams, see you in the story! 🌙');
    expect(MENTOR_LINES.greeting).toContain(mentorLine('greeting'));
    expect(containsHangul(JSON.stringify(MENTOR_LINES))).toBe(false);
  });
});
