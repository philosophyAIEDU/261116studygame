import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextResetAt, pacificDayKey, remainingToday, usageLevel, usageSummary, usedToday } from './usage';
import { RateLimiter } from './rateLimiter';
import { hashKey, ResponseCache } from './cache';
import { flashForTalkWarning, pickModel, preferredModel } from './modelSelect';
import { callGemini, remainingCallsFor, trimHistory, trimInput, type GeminiDeps, type TransportArgs } from './client';
import { deleteApiKey, getApiKey, maskKey, setApiKey } from './key';
import { defaultSave } from '@/save/schema';
import { DEFAULT_GEMINI_LIMITS } from '@/config/geminiLimits';

describe('daily usage resets at Pacific midnight', () => {
  it('uses the Pacific date, not UTC or local', () => {
    // 겨울(PST, UTC-8): 07:59Z 는 아직 전날, 08:00Z 에 날짜가 바뀐다 (한국 시간 오후 5시)
    expect(pacificDayKey(new Date('2026-01-15T07:59:59Z'))).toBe('2026-01-14');
    expect(pacificDayKey(new Date('2026-01-15T08:00:00Z'))).toBe('2026-01-15');
    // 여름(PDT, UTC-7): 07:00Z 에 날짜가 바뀐다 (한국 시간 오후 4시)
    expect(pacificDayKey(new Date('2026-07-15T06:59:59Z'))).toBe('2026-07-14');
    expect(pacificDayKey(new Date('2026-07-15T07:00:00Z'))).toBe('2026-07-15');
  });
  it('computes the next reset in PST and PDT', () => {
    expect(nextResetAt(new Date('2026-01-15T20:30:00Z')).toISOString()).toBe('2026-01-16T08:00:00.000Z');
    expect(nextResetAt(new Date('2026-07-15T20:30:00Z')).toISOString()).toBe('2026-07-16T07:00:00.000Z');
  });
  it('handles the daylight-saving switch days (23-hour and 25-hour days)', () => {
    // 2026-03-08: PST → PDT (하루가 23시간)
    expect(nextResetAt(new Date('2026-03-08T09:00:00Z')).toISOString()).toBe('2026-03-09T07:00:00.000Z');
    // 2026-11-01: PDT → PST (하루가 25시간)
    expect(nextResetAt(new Date('2026-11-01T08:00:00Z')).toISOString()).toBe('2026-11-02T08:00:00.000Z');
  });
  it('counts only today, and colors 80% yellow / 100% red', () => {
    const now = new Date('2026-01-15T20:00:00Z');
    expect(usedToday({ day: '2026-01-15', count: 7 }, now)).toBe(7);
    expect(usedToday({ day: '2026-01-14', count: 7 }, now)).toBe(0);
    expect(remainingToday({ day: '2026-01-15', count: 18 }, DEFAULT_GEMINI_LIMITS.flash, now)).toBe(2);
    expect(remainingToday({ day: '2026-01-15', count: 99 }, DEFAULT_GEMINI_LIMITS.flash, now)).toBe(0);
    expect([usageLevel(15, 20), usageLevel(16, 20), usageLevel(20, 20)]).toEqual(['ok', 'warn', 'blocked']);
    const sum = usageSummary({ lite: { day: '2026-01-15', count: 37 }, flash: { day: '2026-01-15', count: 20 } }, DEFAULT_GEMINI_LIMITS, now);
    expect(sum.lite).toMatchObject({ label: 'Flash-Lite', used: 37, rpd: 500, level: 'ok' });
    expect(sum.flash.level).toBe('blocked');
  });
});

describe('RPM queue', () => {
  it('lets rpm requests through, then makes the next one wait for the window', () => {
    const q = new RateLimiter();
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) expect(q.reserve('flash', 5, t0 + i * 1000)).toBe(0);
    expect(q.reserve('flash', 5, t0 + 5000)).toBe(55_000); // 첫 요청이 60초 창에서 빠질 때까지
    expect(q.reserve('flash', 5, t0 + 5000)).toBe(56_000); // 줄을 서면 그 다음 순서
    expect(q.reserve('lite', 10, t0 + 5000)).toBe(0); // 모델별로 따로 센다
    expect(q.reserve('flash', 5, t0 + 200_000)).toBe(0);
    q.reset();
    expect(q.reserve('flash', 1, t0)).toBe(0);
    expect(q.reserve('flash', 1, t0)).toBe(60_000);
  });
});

describe('response cache (24h)', () => {
  it('returns hits within 24 hours and forgets after', () => {
    const cache = new ResponseCache(null);
    cache.set('k', 'hello', 0);
    expect(cache.get('k', 23 * 3600_000)).toBe('hello');
    expect(cache.get('k', 25 * 3600_000)).toBeNull();
    expect(cache.get('nope', 0)).toBeNull();
    expect(hashKey('a')).not.toBe(hashKey('b'));
  });
  it('persists hashes, not questions, and stays small', () => {
    const cache = new ResponseCache();
    for (let i = 0; i < 60; i++) cache.set(hashKey(`question ${i}`), `answer ${i}`, i);
    const stored = localStorage.getItem('asq-gemini-cache') ?? '';
    expect(stored).not.toContain('question');
    expect(Object.keys(JSON.parse(stored) as object)).toHaveLength(40);
    expect(new ResponseCache().get(hashKey('question 59'), 60)).toBe('answer 59');
    cache.clear();
    expect(new ResponseCache().get(hashKey('question 59'), 60)).toBeNull();
  });
});

describe('model selection', () => {
  const full = { lite: 500, flash: 20 };
  it('auto: talk → Flash-Lite, writing/exam/pronunciation → Flash', () => {
    expect(pickModel('talk', 'auto', full)).toBe('lite');
    expect(pickModel('mentor', 'auto', full)).toBe('lite');
    expect(pickModel('writing', 'auto', full)).toBe('flash');
    expect(pickModel('exam', 'auto', full)).toBe('flash');
    expect(preferredModel('pronunciation')).toBe('flash');
  });
  it('auto: falls back from Flash to Flash-Lite, never the other way, and blocks at zero', () => {
    expect(pickModel('writing', 'auto', { lite: 5, flash: 0 })).toBe('lite');
    expect(pickModel('talk', 'auto', { lite: 0, flash: 20 })).toBeNull();
    expect(pickModel('writing', 'auto', { lite: 0, flash: 0 })).toBeNull();
  });
  it('a fixed model is blocked when it runs out; choosing Flash for talk warns', () => {
    expect(pickModel('talk', 'flash', full)).toBe('flash');
    expect(pickModel('talk', 'flash', { lite: 500, flash: 0 })).toBeNull();
    expect(flashForTalkWarning('flash')).toBe(true);
    expect(flashForTalkWarning('auto')).toBe(false);
  });
});

describe('API key storage', () => {
  it('stores locally, masks, deletes', () => {
    expect(getApiKey()).toBeNull();
    setApiKey('  AIzaSy1234567890abcd  ');
    expect(getApiKey()).toBe('AIzaSy1234567890abcd');
    expect(maskKey('AIzaSy1234567890abcd')).toBe('AIza••••••••••••••cd');
    expect(maskKey('short')).toBe('•••••');
    deleteApiKey();
    expect(getApiKey()).toBeNull();
  });
});

describe('Gemini client', () => {
  const day = '2026-01-15';
  let state = defaultSave().gemini;
  let sent: TransportArgs[] = [];
  let slept: number[] = [];
  const make = (over: Partial<GeminiDeps> = {}): GeminiDeps => ({
    transport: async (args) => { sent.push(args); return 'ok'; },
    getKey: () => 'KEY',
    getState: () => state,
    audioAllowed: () => false,
    count: (model, d) => { state = { ...state, usage: { ...state.usage, [model]: { day: d, count: (state.usage[model].day === d ? state.usage[model].count : 0) + 1 } } }; },
    now: () => new Date('2026-01-15T20:00:00Z'),
    sleep: async (ms) => { slept.push(ms); },
    limiter: new RateLimiter(),
    cache: new ResponseCache(null),
    ...over,
  });
  beforeEach(() => { state = defaultSave().gemini; sent = []; slept = []; });

  it('does nothing without a key', async () => {
    expect(await callGemini({ kind: 'talk', system: 's', user: 'hi' }, make({ getKey: () => null }))).toEqual({ ok: false, reason: 'no-key' });
    expect(sent).toHaveLength(0);
  });

  it('counts +1 when sending, trims input to 500 chars, caps output and history', async () => {
    const history = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? ('model' as const) : ('user' as const), text: `t${i}` }));
    const r = await callGemini({ kind: 'talk', system: 'sys', user: 'x'.repeat(900), history }, make());
    expect(r).toMatchObject({ ok: true, text: 'ok', model: 'lite', cached: false });
    expect(state.usage.lite).toEqual({ day, count: 1 });
    const args = sent[0]!;
    expect(args.modelId).toBe('gemini-3.5-flash-lite');
    expect(args.maxOutputTokens).toBe(400);
    expect(args.contents).toHaveLength(13); // 최근 6턴(12개) + 이번 질문
    expect((args.contents.at(-1)!.parts[0] as { text: string }).text).toHaveLength(500);
    expect(trimInput('  hi  ')).toBe('hi');
    expect(trimHistory(history)).toHaveLength(12);
  });

  it('blocks at the daily limit — no call, no count', async () => {
    state.usage.lite = { day, count: 500 };
    expect(await callGemini({ kind: 'talk', system: 's', user: 'hi' }, make())).toEqual({ ok: false, reason: 'limit' });
    expect(sent).toHaveLength(0);
    expect(state.usage.lite.count).toBe(500);
    expect(remainingCallsFor('talk', state, new Date('2026-01-15T20:00:00Z'))).toBe(0);
    // 다음 날(태평양 시간)에는 다시 열린다
    expect(remainingCallsFor('talk', state, new Date('2026-01-16T09:00:00Z'))).toBe(500);
  });

  it('writing goes to Flash and falls back to Flash-Lite when Flash is used up', async () => {
    state.usage.flash = { day, count: 19 };
    expect((await callGemini({ kind: 'writing', system: 's', user: 'a' }, make())) as { model: string }).toMatchObject({ model: 'flash' });
    expect((await callGemini({ kind: 'writing', system: 's', user: 'b' }, make())) as { model: string }).toMatchObject({ model: 'lite' });
    expect(remainingCallsFor('writing', state, new Date('2026-01-15T20:00:00Z'))).toBe(499);
  });

  it('retries a 429 with exponential backoff at most twice, counting every attempt', async () => {
    let calls = 0;
    const flaky = make({ transport: async () => { calls++; if (calls < 3) throw { status: 429 }; return 'third time'; } });
    expect(await callGemini({ kind: 'talk', system: 's', user: 'hi' }, flaky)).toMatchObject({ ok: true, text: 'third time' });
    expect(slept).toEqual([1000, 2000]);
    expect(state.usage.lite.count).toBe(3);

    const always = make({ transport: async () => { throw { status: 429 }; } });
    expect(await callGemini({ kind: 'talk', system: 's', user: 'hi' }, always)).toEqual({ ok: false, reason: 'error' });
    expect(state.usage.lite.count).toBe(6);

    const broken = make({ transport: async () => { throw new Error('network'); } });
    expect(await callGemini({ kind: 'talk', system: 's', user: 'hi' }, broken)).toEqual({ ok: false, reason: 'error' });
    expect(state.usage.lite.count).toBe(7); // 실패도 센다, 재시도는 하지 않는다
  });

  it('waits in the RPM queue and reports the wait', async () => {
    const onWait = vi.fn();
    const deps = make({ onWait });
    state.limits.lite = { ...state.limits.lite, rpm: 2 };
    await callGemini({ kind: 'talk', system: 's', user: '1' }, deps);
    await callGemini({ kind: 'talk', system: 's', user: '2' }, deps);
    const third = await callGemini({ kind: 'talk', system: 's', user: '3' }, deps);
    expect(onWait).toHaveBeenCalledWith(60_000);
    expect(slept).toEqual([60_000]);
    expect(third).toMatchObject({ ok: true, waitedMs: 60_000 });
  });

  it('serves cached answers without a call or a count', async () => {
    const deps = make();
    const req = { kind: 'mentor' as const, system: 's', user: 'What is a dragon?', cache: true };
    await callGemini(req, deps);
    expect(await callGemini(req, deps)).toMatchObject({ ok: true, cached: true, model: null });
    expect(sent).toHaveLength(1);
    expect(state.usage.lite.count).toBe(1);
  });

  it('NEVER sends audio without guardian consent', async () => {
    const audio = { base64: 'AAAA', mimeType: 'audio/webm' };
    const denied = await callGemini({ kind: 'talk', system: 's', user: '', audio }, make({ audioAllowed: () => false }));
    expect(denied).toEqual({ ok: false, reason: 'audio-not-allowed' });
    expect(sent).toHaveLength(0);
    expect(state.usage.lite.count).toBe(0);

    await callGemini({ kind: 'talk', system: 's', user: '', audio }, make({ audioAllowed: () => true }));
    expect(sent).toHaveLength(1);
    expect(sent[0]!.contents.at(-1)!.parts[0]).toEqual({ inlineData: { data: 'AAAA', mimeType: 'audio/webm' } });
    expect(state.usage.lite.count).toBe(1); // 받아쓰기 + 대답 = 호출 1회
  });
});
