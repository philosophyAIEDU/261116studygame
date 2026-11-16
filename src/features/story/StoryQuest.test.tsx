import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StoryQuest, EARS_HINT } from './StoryQuest';
import { Bedtime } from '@/features/bedtime/Bedtime';
import { useGame } from '@/save/store';
import { useUi } from '@/app/uiStore';
import { getDrawing } from '@/features/dictionary/db';
import { HANGUL_GUIDE } from '@/features/dictionary/WordEditor';

const PACK = 'elem-g1-01-new-school';
const game = () => useGame.getState();
const progress = () => game().storyProgress(PACK);

async function clickWhenEnabled(name: RegExp | string) {
  const button = await screen.findByRole('button', { name });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
}

beforeEach(() => {
  game().resetSave();
  useUi.setState({ overlay: null, teleport: null });
});

describe('Story Quest: 5 steps in order', () => {
  it('① Look & Listen → ② Read Along → ③ Dictionary → ④ Bedtime → ⑤ Use It!', async () => {
    const { unmount } = render(<StoryQuest packId={PACK} onClose={() => {}} />);

    // 처음에는 ①만 열려 있다.
    expect(screen.getByRole('button', { name: /Step 1: Look & Listen/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Step 2: Read Along \(locked\)/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Step 5: Use It! \(locked\)/ })).toBeDisabled();

    // ① 글 없이 그림과 소리만
    fireEvent.click(screen.getByRole('button', { name: /Step 1/ }));
    expect(screen.queryByText(/Mina walks into/)).toBeNull();
    expect(screen.getByRole('button', { name: 'door' })).toBeInTheDocument();
    for (let i = 0; i < 4; i++) await clickWhenEnabled('Next scene');
    await clickWhenEnabled('Done');
    expect(progress().steps.look).toBe(true);
    expect(progress().listenCount).toBe(1);
    expect(screen.getByText(new RegExp(EARS_HINT.slice(0, 20)))).toBeInTheDocument();

    // ② 문장을 따라 읽으며 표현 주머니를 채운다
    fireEvent.click(screen.getByRole('button', { name: /Step 2/ }));
    expect(await screen.findByText(/classroom\./)).toBeInTheDocument();
    for (let i = 0; i < 4; i++) await clickWhenEnabled('Next page');
    await clickWhenEnabled('Done');
    expect(progress().steps.read).toBe(true);
    expect(progress().listenCount).toBe(2);
    expect(progress().phrases).toHaveLength(6);
    expect(game().save.skills.reading.done).toBe(1);

    // ③ 그림 사전: 한글은 저장되지 않는다
    fireEvent.click(screen.getByRole('button', { name: /Step 3/ }));
    expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /bright/ }));
    fireEvent.click(screen.getByRole('tab', { name: /Write/ }));
    const input = screen.getByLabelText(/Easy English/);
    fireEvent.change(input, { target: { value: '밝은' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    expect(screen.getByRole('alert')).toHaveTextContent(HANGUL_GUIDE);
    expect(game().save.dictionary.bright).toBeUndefined();
    fireEvent.change(input, { target: { value: 'full of light' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    expect(game().save.dictionary.bright).toMatchObject({ kind: 'english', value: 'full of light' });

    // 그림 카드 고르기
    fireEvent.click(screen.getByRole('button', { name: /desk/ }));
    fireEvent.click(screen.getByRole('tab', { name: /Pick/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Picture 🪑' }));
    expect(game().save.dictionary.desk).toMatchObject({ kind: 'picture', value: '🪑' });

    fireEvent.click(screen.getByRole('button', { name: /pencil/ }));
    fireEvent.click(screen.getByRole('tab', { name: /Write/ }));
    fireEvent.change(screen.getByLabelText(/Easy English/), { target: { value: 'you write with it' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    await clickWhenEnabled('Done');
    expect(progress().steps.dict).toBe(true);

    // ⑤는 아직 잠겨 있다: ④와 3회 청취가 필요
    expect(screen.getByRole('button', { name: /Step 5: Use It! \(locked\)/ })).toBeDisabled();

    // ④ 침대로 → 밤이 되고 Bedtime 창이 열린다
    fireEvent.click(screen.getByRole('button', { name: /Step 4/ }));
    expect(game().save.world.phase).toBe('night');
    expect(useUi.getState().overlay).toEqual({ type: 'bedtime', packId: PACK });
    expect(useUi.getState().teleport).toBe('home');
    unmount();
  });

  it('④ Bedtime Listening has no story text, quiz or score, and counts a listen', async () => {
    game().completeStep(PACK, 'look');
    game().completeStep(PACK, 'read');
    for (const w of ['a', 'b', 'c']) game().addDictCard({ word: w, packId: PACK, kind: 'picture', value: 'x' });
    game().completeStep(PACK, 'dict');
    useGame.setState({ fx: [] });
    const xpBefore = game().save.xp;

    const { unmount } = render(<Bedtime initialPackId={PACK} onClose={() => {}} />);
    expect(screen.getByText("Relax. Don't translate. Just see the pictures.")).toBeInTheDocument();
    expect(screen.queryByText(/XP/)).toBeNull();
    expect(screen.queryByText(/Mina/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '20 minutes' }));
    expect(screen.getByLabelText('Sleep timer')).toHaveTextContent('20');
    fireEvent.click(screen.getByRole('button', { name: 'Repeat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await waitFor(() => expect(progress().steps.bedtime).toBe(true));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument());
    expect(progress().listenCount).toBe(1);
    expect(game().fx.some((f) => f.kind === 'xp')).toBe(false); // 조용히 기록
    expect(game().save.xp).toBe(xpBefore);
    unmount();
  });

  it('⑤ Use It! opens after 3 listens; Korean writing is not accepted', async () => {
    game().completeStep(PACK, 'look');
    game().completeStep(PACK, 'read');
    for (const w of ['a', 'b', 'c']) game().addDictCard({ word: w, packId: PACK, kind: 'picture', value: 'x' });
    game().completeStep(PACK, 'dict');
    game().completeStep(PACK, 'bedtime');
    game().recordListen(PACK, 'slow', 1);
    game().recordListen(PACK, 'slow', 1);

    const { rerender } = render(<StoryQuest packId={PACK} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /Step 5: Use It! \(locked\)/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Talk Time/ })).toBeNull();

    act(() => { game().recordListen(PACK, 'natural', 1); });
    rerender(<StoryQuest packId={PACK} onClose={() => {}} />);
    const step5 = screen.getByRole('button', { name: /Step 5: Use It!$/ });
    expect(step5).toBeEnabled();
    fireEvent.click(step5);

    // 말하기 3문장 (jsdom 에는 음성 인식·녹음이 없다 → 자기 평가 폴백)
    for (let i = 0; i < 3; i++) {
      fireEvent.click(await screen.findByRole('button', { name: /Say it!/ }));
      fireEvent.click(await screen.findByRole('button', { name: /I said it!/ }));
    }
    const box = await screen.findByLabelText(/Write about the picture/);
    fireEvent.change(box, { target: { value: '안녕하세요' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(progress().steps.useIt).toBe(false);
    fireEvent.change(box, { target: { value: "Hi! I'm new here. Can I use your pencil?" } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(progress().steps.useIt).toBe(true);
    expect(game().save.skills.speaking.done).toBe(3);
    expect(game().save.output.writtenPieces).toBe(1);
    expect(await screen.findByRole('button', { name: /Talk Time/ })).toBeInTheDocument();
  });
});

describe('My Picture Dictionary: drawing', () => {
  it('saves my drawing to IndexedDB and makes it the card face', async () => {
    const ctx = { fillStyle: '', strokeStyle: '', lineWidth: 0, lineCap: '', lineJoin: '', fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');
    game().completeStep(PACK, 'look');
    game().completeStep(PACK, 'read');
    render(<StoryQuest packId={PACK} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Step 3/ }));
    fireEvent.click(screen.getByRole('button', { name: /smile/ }));
    const save = screen.getByRole('button', { name: /Save my drawing/ });
    expect(save).toBeDisabled();
    fireEvent.pointerDown(screen.getByLabelText('Drawing area'), { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(screen.getByLabelText('Drawing area'), { clientX: 40, clientY: 30, pointerId: 1 });
    fireEvent.pointerUp(screen.getByLabelText('Drawing area'), { pointerId: 1 });
    expect(ctx.stroke).toHaveBeenCalled();
    fireEvent.click(save);
    await waitFor(() => expect(game().save.dictionary.smile?.kind).toBe('drawing'));
    expect(await getDrawing('smile')).toBe('data:image/png;base64,AAAA');
    expect(game().save.xp).toBe(8); // 직접 그리면 8 XP
    expect(game().save.badges).toContain('first-drawing');
    expect(await screen.findByAltText('My drawing')).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
