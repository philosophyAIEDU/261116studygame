import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TalkTime } from './TalkTime';
import { setGeminiTransport } from '@/features/gemini';
import type { TransportArgs } from '@/features/gemini/client';
import { deleteApiKey, setApiKey } from '@/features/gemini/key';
import { pacificDayKey } from '@/features/gemini/usage';
import { localDayKey } from '@/features/progression/time';
import { useGame } from '@/save/store';

// Gemini 는 모두 가짜(모킹)로 바꿔서 검사한다.
const PACK = 'elem-g1-02-lunch-time';
const game = () => useGame.getState();
let sent: TransportArgs[] = [];

function mockGemini(reply: (n: number) => string) {
  sent = [];
  setGeminiTransport(async (args) => { sent.push(args); return reply(sent.length); });
}
const json = (n: number) => JSON.stringify({
  reply: `Nice! Question ${n}?`, recast: n === 1 ? 'I like pizza.' : null, phraseUsed: [], encouragement: 'Good job! 🍕', suggestedNext: ['Yes, please!', 'I love it!'],
});

async function sayByTyping(text: string) {
  const input = screen.getByLabelText('Your words');
  await waitFor(() => expect(input).toBeEnabled());
  fireEvent.change(input, { target: { value: text } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
}

beforeEach(() => {
  game().resetSave();
  deleteApiKey();
  setGeminiTransport(null);
});

describe('Talk Time', () => {
  it('is locked without an API key and offers local phrase practice instead (the game still works)', async () => {
    mockGemini(json);
    render(<TalkTime packId={PACK} onClose={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent(/can not chat yet/);
    expect(screen.queryByRole('button', { name: /Start talking/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Practice saying phrases/ }));
    expect(await screen.findByText('What would you like?')).toBeInTheDocument();
    expect(sent).toHaveLength(0);
  });

  it('runs a full 6-turn talk: text fallback, Gemini reply, recast, phrase bonus, local summary', async () => {
    setApiKey('TEST-KEY');
    mockGemini(json);
    render(<TalkTime packId={PACK} onClose={() => {}} />);
    expect(screen.getByLabelText('Call budget')).toHaveTextContent('up to 6 turns · 500 calls left today');
    fireEvent.click(screen.getByRole('button', { name: /Start talking/ }));
    expect(game().save.talk.sessionsToday).toBe(1);
    // 대화 시작 대사는 이야기에 적힌 것 → API 를 쓰지 않는다
    expect(screen.getByText('Hi! What do you like to eat?')).toBeInTheDocument();
    expect(sent).toHaveLength(0);
    // jsdom 에는 음성 인식이 없다 → 글자 입력으로 대화한다
    expect(screen.queryByRole('button', { name: 'Speak' })).toBeNull();

    await sayByTyping('I likes pizza');
    expect(await screen.findByText('Nice! Question 1?')).toBeInTheDocument();
    // 고쳐 말하기: "틀렸어"가 아니라 부드러운 도움말
    expect(screen.getByLabelText('A nice way to say it')).toHaveTextContent('You can say: I like pizza.');
    expect(screen.queryByText(/wrong/i)).toBeNull();
    expect(screen.getByRole('button', { name: /Yes, please!/ })).toBeInTheDocument();
    expect(game().save.gemini.usage.lite).toEqual({ day: pacificDayKey(new Date()), count: 1 });

    // 보낸 것은 글자뿐이다 (오디오 없음), 시스템 프롬프트에는 표현 주머니가 들어 있다
    const first = sent[0]!;
    expect(JSON.stringify(first.contents)).not.toContain('inlineData');
    expect(first.contents.at(-1)!.parts).toEqual([{ text: 'I likes pizza' }]);
    expect(first.system).toContain('Can I sit here?');
    expect(first.modelId).toBe('gemini-3.5-flash-lite');
    expect(first.schema).toBeTruthy();

    await sayByTyping('Yes, please! Can I sit here?'); // 표현 2개 사용
    expect(await screen.findByText('Nice! Question 2?')).toBeInTheDocument();
    expect(game().save.talk.phraseUses).toBe(2);
    for (let i = 3; i <= 6; i++) {
      await sayByTyping(`I am happy ${i}`);
      await waitFor(() => expect(sent).toHaveLength(i));
    }

    const summary = await screen.findByLabelText('Talk summary', {}, { timeout: 3000 });
    expect(summary).toHaveTextContent('Sentences I said: 6');
    expect(summary).toHaveTextContent('Pocket phrases I used: 2');
    expect(summary).toHaveTextContent('full talk bonus');
    expect(summary).toHaveTextContent('I likes pizza → I like pizza.');
    expect(sent).toHaveLength(6); // 요약은 Gemini 를 부르지 않는다
    expect(game().save.output.spokenTurns).toBe(6);
    // 1턴 20+5, 2턴 20+5+20, 3~6턴 25×4, 완주 +30
    expect(game().save.xp).toBe(25 + 45 + 100 + 30);
    // 대화 원문은 저장되지 않는다
    expect(JSON.stringify(game().save)).not.toContain('pizza');
    expect(localStorage.getItem('asq-gemini-cache') ?? '').not.toContain('pizza');
  });

  it('shrinks the talk when few calls are left, with no completion bonus', async () => {
    setApiKey('TEST-KEY');
    mockGemini(json);
    game().patchGemini({ usage: { lite: { day: pacificDayKey(new Date()), count: 498 }, flash: { day: '', count: 0 } } });
    render(<TalkTime packId={PACK} onClose={() => {}} />);
    expect(screen.getByLabelText('Call budget')).toHaveTextContent('up to 2 turns · 2 calls left today');
    fireEvent.click(screen.getByRole('button', { name: /Start talking/ }));
    await sayByTyping('Hello there');
    await screen.findByText('Nice! Question 1?');
    await sayByTyping('I am fine');
    const summary = await screen.findByLabelText('Talk summary', {}, { timeout: 3000 });
    expect(summary).not.toHaveTextContent('full talk bonus');
    expect(sent).toHaveLength(2);
    expect(game().save.gemini.usage.lite.count).toBe(500);
  });

  it('locks at zero calls and at the guardian daily limit', () => {
    setApiKey('TEST-KEY');
    mockGemini(json);
    game().patchGemini({ usage: { lite: { day: pacificDayKey(new Date()), count: 500 }, flash: { day: '', count: 0 } } });
    const first = render(<TalkTime packId={PACK} onClose={() => {}} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start talking/ })).toBeNull();
    first.unmount();

    game().resetSave();
    game().patchSettings({ maxTalkSessionsPerDay: 1 });
    useGame.setState((s) => ({ save: { ...s.save, talk: { ...s.save.talk, day: localDayKey(new Date()), sessionsToday: 1 } } }));
    render(<TalkTime packId={PACK} onClose={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent(/enough talking for today/);
    expect(sent).toHaveLength(0);
  });

  it('keeps talking when the reply is not valid JSON, and recovers from an error', async () => {
    setApiKey('TEST-KEY');
    mockGemini((n) => { if (n === 2) throw new Error('boom'); return 'Sounds fun! What else do you like?'; });
    render(<TalkTime packId={PACK} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Start talking/ }));
    await sayByTyping('I play tag');
    expect(await screen.findByText('Sounds fun! What else do you like?')).toBeInTheDocument();
    await sayByTyping('I read books');
    expect(await screen.findByText(/Can you say it again/)).toBeInTheDocument();
    expect(game().save.gemini.usage.lite.count).toBe(2); // 실패한 호출도 센다
  });
});
