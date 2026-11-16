import { useMemo, useState } from 'react';
import type { Skill, Speed, Tier } from '@/types';
import { packsForStage } from '@/content/loader';
import { currentStage, maxTierForLevel, playerLevel, TIER_UNLOCK_LEVEL } from '@/features/progression/lifeStages';
import { skillLock } from '@/features/progression/skillUnlock';
import { useGame } from '@/save/store';
import { useUi } from '@/app/uiStore';
import { Bar, Btn, Locked, Modal } from '@/ui/kit';
import { SpeedPicker } from '@/ui/SpeedPicker';
import { ExerciseView } from './ExerciseView';
import { makeSet } from './exercises';

// 스킬 연습: 듣기 → 읽기 → (입력 시간 충족) → 말하기 → 쓰기 순서로 열린다. 각 영역은 5단계 난이도.
// 어려운 단계·빠른 속도일수록 XP 를 더 받는다.

const SKILL_INFO: Record<Skill, { icon: string; title: string }> = {
  listening: { icon: '🎧', title: 'Listening' },
  reading: { icon: '📖', title: 'Reading' },
  speaking: { icon: '🎤', title: 'Speaking' },
  writing: { icon: '✏️', title: 'Writing' },
};
const TIERS: Tier[] = [1, 2, 3, 4, 5];

export function SkillPractice({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  const save = useGame((s) => s.save);
  const skillDone = useGame((s) => s.skillDone);
  const open = useUi((s) => s.open);
  const info = SKILL_INFO[skill];
  const level = playerLevel(save.xp, save.graduated).level;
  const maxTier = maxTierForLevel(level);
  const lock = skillLock(skill, {
    listeningDone: save.skills.listening.done, readingDone: save.skills.reading.done, speakingDone: save.skills.speaking.done, inputSeconds: save.input.totalSeconds,
  });
  const [tier, setTier] = useState<Tier>(1);
  const [speed, setSpeed] = useState<Speed>(save.settings.speed);
  const [round, setRound] = useState<{ seed: number } | null>(null);
  const [index, setIndex] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [earned, setEarned] = useState<number | null>(null);
  const usesSpeed = skill === 'listening' || skill === 'speaking';
  // 듣기 4~5단계는 실제 원어민 속도로만 낸다.
  const playSpeed: Speed = skill === 'listening' && tier >= 4 ? 'native' : speed;
  const packs = useMemo(() => packsForStage(currentStage(save.graduated).id), [save.graduated]);
  const exercises = useMemo(() => (round ? makeSet(skill, tier, packs, round.seed) : []), [round, skill, tier, packs]);
  const exercise = exercises[index];

  const answer = (accuracy: number) => {
    const next = [...scores, accuracy];
    if (index + 1 < exercises.length) {
      setScores(next);
      setIndex(index + 1);
      return;
    }
    const avg = next.reduce((a, b) => a + b, 0) / next.length;
    setEarned(skillDone({ skill, tier, accuracy: avg, speed: usesSpeed ? playSpeed : undefined }));
    setScores(next);
  };
  const start = () => { setScores([]); setIndex(0); setEarned(null); setRound({ seed: Date.now() % 100000 }); };

  return (
    <Modal title={info.title} icon={info.icon} onClose={onClose}>
      {!lock.unlocked ? (
        <Locked text={lock.hint} />
      ) : !round ? (
        <div className="space-y-4">
          <div role="radiogroup" aria-label="Difficulty" className="grid grid-cols-5 gap-2">
            {TIERS.map((t) => {
              const locked = t > maxTier;
              return (
                <button key={t} type="button" role="radio" aria-checked={tier === t} disabled={locked} onClick={() => setTier(t)}
                  aria-label={`Level ${t}${locked ? ` (opens at Lv ${TIER_UNLOCK_LEVEL[t]})` : ''}`}
                  className={`flex min-h-16 flex-col items-center justify-center rounded-2xl border-2 text-lg font-extrabold ${tier === t ? 'border-maple bg-honey text-ink' : 'border-white/25 bg-white/10'} ${locked ? 'opacity-40' : ''}`}>
                  <span>{locked ? '🔒' : '⭐'.repeat(1)}{t}</span>
                  {locked ? <span className="text-xs">Lv {TIER_UNLOCK_LEVEL[t]}</span> : null}
                </button>
              );
            })}
          </div>
          {usesSpeed ? (
            <div className="flex items-center justify-center gap-3">
              <span className="text-lg font-bold">Speed</span>
              {skill === 'listening' && tier >= 4 ? <span className="rounded-full bg-honey px-3 py-1 font-bold text-ink">🚀 Native only</span> : <SpeedPicker value={speed} onChange={setSpeed} dark />}
            </div>
          ) : null}
          <p className="text-center text-base text-paper/80">Harder and faster = more XP! ⭐</p>
          <Btn big icon="▶️" className="w-full" onClick={start}>Start</Btn>
        </div>
      ) : earned !== null ? (
        <div className="space-y-3 text-center">
          <p className="emoji text-6xl">🎉</p>
          <p className="text-2xl font-extrabold">+{earned} XP</p>
          <p className="text-lg">{Math.round((scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length)) * 100)}%</p>
          <div className="flex gap-2">
            <Btn big tone="paper" icon="🔁" className="flex-1" onClick={start}>Again</Btn>
            <Btn big tone="meadow" icon="✅" className="flex-1" onClick={onClose}>Done</Btn>
          </div>
        </div>
      ) : exercise ? (
        <div className="space-y-3">
          <Bar value={index} max={exercises.length} tone="meadow" label="Progress" />
          <ExerciseView key={`${round.seed}-${index}`} exercise={exercise} speed={playSpeed} onDone={answer}
            onRoleplay={(packId) => open({ type: 'talk', packId })} />
        </div>
      ) : null}
    </Modal>
  );
}
