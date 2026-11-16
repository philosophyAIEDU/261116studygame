import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Settings } from './Settings';
import { ioRatio, Report } from './Report';
import { UpdateBannerView } from '@/app/UpdateBanner';
import { useUi } from '@/app/uiStore';
import { GuardianIntro } from '@/features/onboarding/GuardianIntro';
import { getApiKey } from '@/features/gemini/key';
import { buildBackup, parseBackup } from '@/save/backup';
import { defaultSave } from '@/save/schema';
import { useGame } from '@/save/store';
import { formatBytes, packAudioUrls } from '@/audio/packCache';
import { ALL_PACKS } from '@/content/loader';

const game = () => useGame.getState();
beforeEach(() => { game().resetSave(); useUi.setState({ overlay: null }); });

describe('guardian settings (Korean)', () => {
  it('stores the Gemini key on this device only, masked, and deletes it', () => {
    render(<Settings onClose={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'AI · Talk Time' }));
    expect(screen.getByText(/결제\(Billing\)가 연결된 프로젝트의 키는 쓰지 마세요/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('API 키'), { target: { value: 'AIzaSyTESTKEY1234567' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(getApiKey()).toBe('AIzaSyTESTKEY1234567');
    expect(screen.queryByText('AIzaSyTESTKEY1234567')).toBeNull();
    expect(screen.getByLabelText('키가 이 기기에 저장되어 있습니다')).toHaveTextContent('AIza');
    expect(JSON.stringify(game().save)).not.toContain('AIzaSy'); // 세이브(내보내기 파일)에 키가 없다
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    expect(getApiKey()).toBeNull();
  });

  it('sending audio to Gemini is off by default and needs explicit guardian consent', () => {
    render(<Settings onClose={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'AI · Talk Time' }));
    const box = screen.getByRole('checkbox', { name: /음성을 Gemini 로 보내 인식하기/ });
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    // 체크만으로는 켜지지 않는다 → 동의 창
    expect(game().save.settings.sendAudioToGemini).toBe(false);
    const dialog = screen.getByRole('alertdialog', { name: '보호자 동의' });
    expect(dialog).toHaveTextContent('Google 의 Gemini 서비스로 전송됩니다');
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(game().save.settings.sendAudioToGemini).toBe(false);
    fireEvent.click(box);
    fireEvent.click(screen.getByRole('button', { name: '동의하고 켜기' }));
    expect(game().save.settings.sendAudioToGemini).toBe(true);
    expect(game().save.settings.pronunciationFeedback).toBe(false);
  });

  it('shows usage, lets the guardian edit limits, warns about Flash for talk, and caps daily talks', () => {
    render(<Settings onClose={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'AI · Talk Time' }));
    expect(screen.getByText('🤖 Flash-Lite: 0 / 500')).toBeInTheDocument();
    expect(screen.getByText(/Google AI Studio 에서 실제 한도를 확인/)).toBeInTheDocument();
    fireEvent.change(screen.getAllByLabelText('하루 요청')[0]!, { target: { value: '300' } });
    expect(game().save.gemini.limits.lite.rpd).toBe(300);
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Flash 만 사용' }));
    expect(screen.getByRole('alert')).toHaveTextContent('하루 20회');
    fireEvent.change(screen.getByLabelText('하루 Talk Time 최대 횟수'), { target: { value: '3' } });
    expect(game().save.settings.maxTalkSessionsPerDay).toBe(3);
  });

  it('general and data tabs: volume, version, changelog', () => {
    render(<Settings onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText(/이야기 음성/), { target: { value: '0.3' } });
    expect(game().save.settings.volume.voice).toBe(0.3);
    fireEvent.click(screen.getByRole('radio', { name: '낮음' }));
    expect(game().save.settings.quality).toBe('low');
    fireEvent.click(screen.getByRole('tab', { name: '데이터 · 앱' }));
    expect(screen.getByText(/현재 버전/)).toHaveTextContent(`v${__APP_VERSION__}`);
    expect(screen.getByText('0.1.0 — 첫 버전')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '오디오 팩' }));
    expect(screen.getAllByText('녹음 파일 없음 (기기 음성 사용)')).toHaveLength(6);
  });
});

describe('guardian report', () => {
  it('is locked by a 4-digit PIN', () => {
    const { unmount } = render(<Report onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText(/4자리 PIN 을 정해 주세요/), { target: { value: '12a34' } });
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(game().save.settings.guardianPin).toBe('1234');
    expect(screen.getByText('누적 듣기 시간')).toBeInTheDocument();
    unmount();
    render(<Report onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('PIN 을 입력하세요'), { target: { value: '0000' } });
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(screen.getByRole('alert')).toHaveTextContent('PIN 이 맞지 않습니다');
    expect(screen.queryByText('누적 듣기 시간')).toBeNull();
  });
  it('computes the input : output ratio', () => {
    const skills = { listening: { done: 6 }, reading: { done: 3 }, speaking: { done: 1 }, writing: { done: 9 } };
    expect(ioRatio(skills, { spokenTurns: 1, writtenPieces: 1 })).toEqual({ input: 9, output: 3, inputPct: 75 });
    expect(ioRatio({ ...skills, listening: { done: 0 }, reading: { done: 0 }, speaking: { done: 0 } }, { spokenTurns: 0, writtenPieces: 0 }).inputPct).toBe(100);
  });
});

describe('first-run guardian guide', () => {
  it('explains the no-Korean rule and privacy in Korean, then hands over', () => {
    const done = vi.fn();
    render(<GuardianIntro onDone={done} />);
    expect(screen.getByText('한국어 뜻을 보여주지 않습니다')).toBeInTheDocument();
    expect(screen.getByText(/브라우저 제조사\(구글·애플 등\) 서버를 거칠 수 있습니다/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /아이에게 넘겨주기/ }));
    expect(done).toHaveBeenCalled();
  });
});

describe('update banner', () => {
  it('appears in the world screen and hides while a quest or Bedtime Listening is open', () => {
    const onUpdate = vi.fn();
    const { rerender } = render(<UpdateBannerView needRefresh={false} onUpdate={onUpdate} />);
    expect(screen.queryByText(/New update!/)).toBeNull();
    rerender(<UpdateBannerView needRefresh onUpdate={onUpdate} />);
    expect(screen.getByRole('status')).toHaveTextContent('New update!');
    fireEvent.click(screen.getByRole('button', { name: 'Update now' }));
    expect(onUpdate).toHaveBeenCalledOnce();
    useUi.setState({ overlay: { type: 'bedtime' } });
    rerender(<UpdateBannerView needRefresh onUpdate={onUpdate} />);
    expect(screen.queryByText(/New update!/)).toBeNull();
    useUi.setState({ overlay: null });
    rerender(<UpdateBannerView needRefresh onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.queryByText(/New update!/)).toBeNull();
  });
});

describe('backup (export / import)', () => {
  it('round-trips the save and drawings; never contains the API key', () => {
    const save = defaultSave();
    save.xp = 777;
    const file = buildBackup(save, { huge: 'data:image/png;base64,AAAA' }, '0.1.0', new Date('2026-01-01T00:00:00Z'));
    const text = JSON.stringify(file);
    expect(text).not.toMatch(/apiKey|AIza/);
    const back = parseBackup(text)!;
    expect(back.save.xp).toBe(777);
    expect(back.drawings).toEqual({ huge: 'data:image/png;base64,AAAA' });
  });
  it('migrates old saves on import and rejects junk', () => {
    const v1 = { schemaVersion: 1, xp: 55, character: { nickname: 'A', mbti: 'ISTJ' }, vocab: [{ word: 'dog', meaningKo: '개' }] };
    const fromBare = parseBackup(JSON.stringify(v1))!;
    expect(fromBare.save).toMatchObject({ schemaVersion: 3, xp: 55 });
    expect(JSON.stringify(fromBare.save)).not.toContain('개');
    const wrapped = parseBackup(JSON.stringify({ app: 'my-american-school-quest', save: v1, drawings: { x: 'javascript:alert(1)' } }))!;
    expect(wrapped.save.xp).toBe(55);
    expect(wrapped.drawings).toEqual({});
    expect(parseBackup('not json')).toBeNull();
    expect(parseBackup('{"hello":1}')).toBeNull();
    expect(parseBackup('null')).toBeNull();
  });
  it('audio pack helpers', () => {
    expect(packAudioUrls(ALL_PACKS[0]!)).toEqual([]);
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
