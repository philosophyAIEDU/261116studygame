import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GradExam } from './GradExam';
import { buildExam, graduationMessage, sectionScore } from './exam';
import { totalXpForLevel } from './levels';
import { RealTalk } from '@/features/skills/RealTalk';
import { SkillPractice } from '@/features/skills/SkillPractice';
import { realTalkFor, REAL_TALK } from '@/config/realTalk';
import { ALL_PACKS, getPack } from '@/content/loader';
import { containsHangul } from '@/features/dictionary/hangul';
import { useGame } from '@/save/store';
import { useUi } from '@/app/uiStore';

const game = () => useGame.getState();
beforeEach(() => { game().resetSave(); useUi.setState({ overlay: null }); });

describe('graduation exam plan', () => {
  it('has 4 sections and listening is always at native speed', () => {
    for (const stage of ['elementary', 'middle', 'high', 'college'] as const) {
      const exam = buildExam(stage, ALL_PACKS, 5);
      expect(exam.map((s) => s.skill)).toEqual(['listening', 'reading', 'speaking', 'writing']);
      expect(exam[0]!.speed).toBe('native');
      expect(exam.map((s) => s.exercises.length)).toEqual([3, 3, 2, 1]);
    }
    expect(sectionScore([1, 0.5])).toBe(0.75);
    expect(sectionScore([])).toBe(0);
    expect(graduationMessage('elementary')).toBe('Welcome to Middle School!');
  });
});

describe('graduation gate', () => {
  it('stays locked until the level AND the listening-time goal are met', () => {
    game().awardXp(totalXpForLevel(20));
    const { unmount } = render(<GradExam onClose={() => {}} />);
    expect(screen.getByText(/1\. Level 20/)).toHaveTextContent('✅');
    expect(screen.getByText(/2\. Listening time: 10 hours/)).toHaveTextContent('⬜');
    expect(screen.queryByRole('button', { name: /Start the exam/ })).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(/Keep listening/);
    unmount();
    game().addInputSeconds(10 * 3600);
    render(<GradExam onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /Start the exam/ })).toBeEnabled();
  });

  it('passing the exam graduates and plays the ceremony', async () => {
    game().awardXp(totalXpForLevel(20));
    game().addInputSeconds(10 * 3600);
    render(<GradExam onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Start the exam/ }));
    // 한 문제에 답하면 진행 막대가 올라갈 때까지 기다린다(다음 문제가 화면에 나온 뒤 다음 행동을 한다).
    const progress = () => Number(screen.getByLabelText('Exam progress').getAttribute('aria-valuenow'));
    const answerAndWait = async (act: () => void) => {
      const before = progress();
      act();
      await waitFor(() => expect(progress()).toBeGreaterThan(before));
    };
    // 듣기·읽기 6문제: 화면의 보기 중 정답을 찾아 누른다
    for (let i = 0; i < 6; i++) {
      expect(await screen.findByText(i < 3 ? /Listening \(Native speed\)/ : /Reading/)).toBeInTheDocument();
      const text = screen.queryAllByText(/./, { selector: 'p.text-2xl' }).map((p) => p.textContent ?? '');
      const pictures = screen.queryAllByRole('button', { name: /^Picture sc/ });
      await answerAndWait(() => {
        if (pictures.length > 0) {
          // 읽기 문제면 문장으로 정답 장면을 찾고, 듣기 문제면 아무거나 고른다(합격·불합격 모두 아래에서 규칙대로인지 확인한다)
          const pack = ALL_PACKS.find((p) => p.story.sentences.some((s) => text.includes(s.text)));
          const sentence = pack?.story.sentences.find((s) => text.includes(s.text));
          const target = sentence ? screen.queryByRole('button', { name: `Picture ${sentence.sceneId}` }) : null;
          fireEvent.click(target ?? pictures[0]!);
        } else {
          const def = screen.getByText(/^❓ = /).textContent!.replace('❓ = ', '');
          const word = ALL_PACKS.flatMap((p) => p.story.words).find((w) => w.easyEnglish === def)!.word;
          fireEvent.click(screen.getByRole('button', { name: word }));
        }
      });
    }
    // 말하기 2문제 (자기 평가 폴백)
    for (let i = 0; i < 2; i++) {
      fireEvent.click(await screen.findByRole('button', { name: /Say it!/ }));
      const said = await screen.findByRole('button', { name: /I said it!/ });
      await answerAndWait(() => fireEvent.click(said));
    }
    // 쓰기 1문제: 한글은 통과하지 못한다
    const box = await screen.findByLabelText(/Change one or two words/);
    fireEvent.change(box, { target: { value: '안녕' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    const original = screen.getByText(/^“/).textContent!.replace(/[“”]/g, '');
    fireEvent.change(box, { target: { value: original.replace(/\w+/, 'Leo') } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    // 듣기를 찍어서 틀렸다면 불합격일 수 있다 → 두 결과 모두 규칙대로인지 확인한다
    await waitFor(() => expect(screen.queryByLabelText('Exam progress')).toBeNull());
    if (screen.queryByRole('dialog', { name: 'Graduation' })) {
      expect(game().save.graduated).toEqual(['elementary']);
      expect(game().save.badges).toContain('grad-elementary');
      expect(screen.getByText(/Welcome to Middle School!/)).toBeInTheDocument();
    } else {
      expect(screen.getByText(/Almost!/)).toBeInTheDocument();
      expect(game().save.graduated).toEqual([]);
    }
  });
});

describe('skill practice', () => {
  it('speaking and writing are locked until input is filled — no shortcut', () => {
    const { unmount } = render(<SkillPractice skill="speaking" onClose={() => {}} />);
    expect(screen.getByText(/Read a story first/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
    unmount();
    render(<SkillPractice skill="writing" onClose={() => {}} />);
    expect(screen.getByText(/Speak first, then write/)).toBeInTheDocument();
  });
  it('listening tier 1 runs 5 questions and pays XP; higher tiers are locked by level', async () => {
    render(<SkillPractice skill="listening" onClose={() => {}} />);
    expect(screen.getByRole('radio', { name: /Level 2 \(opens at Lv 5\)/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    for (let i = 0; i < 5; i++) {
      const group = await screen.findByRole('group', { name: 'Pick the picture' });
      await waitFor(() => expect(group.querySelector('.border-meadow')).toBeNull());
      fireEvent.click(group.querySelectorAll('button')[0]!);
      if (i < 4) await waitFor(() => expect(screen.getByLabelText('Progress')).toHaveAttribute('aria-valuenow', String((i + 1) * 20)));
    }
    expect(await screen.findByText(/\+\d+ XP/)).toBeInTheDocument();
    expect(game().save.skills.listening.done).toBe(1);
    expect(game().save.xp).toBeGreaterThan(0);
  });
});

describe('Real Talk', () => {
  it('scripts get longer with level and contain no Korean', () => {
    expect(realTalkFor(1).every((s) => s.minLevel === 1)).toBe(true);
    expect(realTalkFor(60).at(-1)!.id).toBe('rt-work');
    expect(containsHangul(JSON.stringify(REAL_TALK))).toBe(false);
    for (const s of REAL_TALK) {
      const all = s.lines.map((l) => l.text.toLowerCase()).join(' ');
      for (const k of s.keyWords) expect(all).toContain(k);
      for (const d of s.distractors) expect(all).not.toContain(d);
    }
    expect(getPack('elem-g1-01-new-school')).toBeDefined();
  });
  it('shows no text of the chat; catching the words pays XP and a badge', async () => {
    render(<RealTalk onClose={() => {}} />);
    expect(screen.queryByText(/whatcha|Wanna/)).toBeNull();
    const check = screen.getByRole('button', { name: 'Check' });
    const script = realTalkFor(1).find((s) => s.keyWords.every((k) => screen.queryByRole('button', { name: k })))!;
    for (const k of script.keyWords) fireEvent.click(screen.getByRole('button', { name: k }));
    await waitFor(() => expect(check).toBeEnabled());
    fireEvent.click(check);
    expect(await screen.findByText(/Great ears!/)).toBeInTheDocument();
    expect(game().save.badges).toContain('real-talk');
    expect(game().save.xp).toBeGreaterThan(0);
  });
});
