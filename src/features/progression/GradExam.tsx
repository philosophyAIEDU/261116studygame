import { useMemo, useState } from 'react';
import type { Skill } from '@/types';
import { packsForStage } from '@/content/loader';
import { useGame } from '@/save/store';
import { useUi } from '@/app/uiStore';
import { playSfx } from '@/audio/sfx';
import { ExerciseView } from '@/features/skills/ExerciseView';
import { Bar, Btn, Modal, Portrait } from '@/ui/kit';
import { buildExam, graduationMessage, sectionScore } from './exam';
import { currentStage, examPassed, graduationCheck, playerLevel } from './lifeStages';

// 졸업 시험과 졸업식.
// 졸업 조건 3가지: ① 단계 최고 레벨 ② 누적 듣기 시간 목표 ③ 시험 통과(듣기는 반드시 Native 속도).

const CONFETTI = ['🎉', '🎊', '⭐', '🎈', '✨', '🎓'];

export function GradExam({ onClose }: { onClose: () => void }) {
  const save = useGame((s) => s.save);
  const graduate = useGame((s) => s.graduate);
  const awardXp = useGame((s) => s.awardXp);
  const open = useUi((s) => s.open);
  // 시험을 시작할 때의 단계를 고정한다(졸업 처리 후에도 졸업식 화면이 유지되게).
  const [stage] = useState(() => currentStage(save.graduated));
  const check = graduationCheck(save.xp, save.graduated, save.input.totalSeconds);
  const level = playerLevel(save.xp, save.graduated).level;
  const hours = Math.floor(save.input.totalSeconds / 360) / 10;
  const [seed] = useState(() => Date.now() % 100000);
  const sections = useMemo(() => buildExam(stage.id, packsForStage(stage.id), seed), [stage.id, seed]);
  const [phase, setPhase] = useState<'gate' | 'exam' | 'fail' | 'ceremony'>('gate');
  const [pos, setPos] = useState({ section: 0, index: 0 });
  const [scores, setScores] = useState<Record<Skill, number[]>>({ listening: [], reading: [], speaking: [], writing: [] });

  const section = sections[pos.section];
  const exercise = section?.exercises[pos.index];
  const total = sections.reduce((n, s) => n + s.exercises.length, 0);
  const done = sections.slice(0, pos.section).reduce((n, s) => n + s.exercises.length, 0) + pos.index;

  const answer = (accuracy: number) => {
    if (!section) return;
    const next = { ...scores, [section.skill]: [...scores[section.skill], accuracy] };
    setScores(next);
    if (pos.index + 1 < section.exercises.length) return setPos({ section: pos.section, index: pos.index + 1 });
    if (pos.section + 1 < sections.length) return setPos({ section: pos.section + 1, index: 0 });
    const result = { listening: sectionScore(next.listening), reading: sectionScore(next.reading), speaking: sectionScore(next.speaking), writing: sectionScore(next.writing) };
    if (examPassed(result)) {
      graduate(stage.id);
      awardXp(200);
      playSfx('levelup');
      setPhase('ceremony');
    } else {
      playSfx('wrong');
      setPhase('fail');
    }
  };

  if (phase === 'ceremony') {
    return (
      <div role="dialog" aria-label="Graduation" className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 overflow-hidden bg-gradient-to-b from-honey to-paper p-6 text-center text-ink">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {Array.from({ length: 24 }, (_, i) => (
            <span key={i} className="emoji twinkle absolute text-3xl" style={{ left: `${(i * 41) % 100}%`, top: `${(i * 29) % 90}%`, animationDelay: `${(i % 6) * 0.3}s` }}>{CONFETTI[i % CONFETTI.length]}</span>
          ))}
        </div>
        <p className="emoji text-8xl">🎓</p>
        <h2 className="text-4xl font-extrabold">Graduation Day!</h2>
        <p className="text-2xl font-bold">{stage.icon} {stage.label}</p>
        <div className="flex items-center gap-3 rounded-3xl border-4 border-honey bg-white p-4 shadow-xl">
          <Portrait emoji="👩‍🏫" />
          <p className="text-xl font-bold">I am so proud of you! {graduationMessage(stage.id)}</p>
        </div>
        <Btn big tone="meadow" icon="🎒" onClick={() => (stage.id === 'college' ? open({ type: 'career' }) : onClose())}>Let's go!</Btn>
      </div>
    );
  }

  return (
    <Modal title={`${stage.label} Graduation`} icon="🎓" onClose={onClose}>
      {phase === 'gate' && (
        stage.inputHoursGoal === null ? (
          <div className="space-y-3 text-center">
            <p className="emoji text-6xl">💼</p>
            <p className="text-xl font-bold">You finished school! Keep growing in your job.</p>
            <Btn big icon="💼" onClick={() => open({ type: 'career' })}>My job</Btn>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-lg">To graduate, you need three things:</p>
            <div className="space-y-1">
              <p className="text-lg font-bold">{check.levelOk ? '✅' : '⬜'} 1. Level {check.needLevel} <span className="text-paper/80">(now Lv {level})</span></p>
              <Bar value={level} max={check.needLevel} label="Level" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-bold">{check.inputOk ? '✅' : '⬜'} 2. Listening time: {check.needHours} hours <span className="text-paper/80">(now {hours}h)</span></p>
              <Bar value={hours} max={check.needHours} tone="lilac" label="Input hours" />
            </div>
            <p className="text-lg font-bold">⬜ 3. Pass the exam: 🎧 Native speed · 📖 · 🎤 · ✏️</p>
            {check.canTakeExam
              ? <Btn big icon="📝" className="w-full" onClick={() => setPhase('exam')}>Start the exam</Btn>
              : <p role="status" className="rounded-2xl bg-white/10 p-3 text-lg">🔒 Keep listening and reading. Your ears are getting ready! 👂</p>}
          </div>
        )
      )}

      {phase === 'exam' && section && exercise && (
        <div className="space-y-3">
          <Bar value={done} max={total} tone="meadow" label="Exam progress" />
          <p className="text-center text-xl font-extrabold text-honey">{section.icon} {section.title}</p>
          <ExerciseView key={`${pos.section}-${pos.index}`} exercise={exercise} speed={section.speed} onDone={answer} />
        </div>
      )}

      {phase === 'fail' && (
        <div className="space-y-3 text-center">
          <p className="emoji text-6xl">🌱</p>
          <p className="text-xl font-bold">Almost! Listen a little more and try again.</p>
          <ul className="mx-auto max-w-xs space-y-1 text-left text-lg">
            {sections.map((s) => <li key={s.skill}>{s.icon} {Math.round(sectionScore(scores[s.skill]) * 100)}%</li>)}
          </ul>
          <Btn big tone="meadow" icon="✅" onClick={onClose}>OK</Btn>
        </div>
      )}
    </Modal>
  );
}
