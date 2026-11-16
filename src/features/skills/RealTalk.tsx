import { useEffect, useMemo, useRef, useState } from 'react';
import type { Tier } from '@/types';
import { npc } from '@/config/npcVoices';
import { realTalkFor } from '@/config/realTalk';
import { speakLine, stopAll } from '@/audio/player';
import { playSfx } from '@/audio/sfx';
import { maxTierForLevel, playerLevel } from '@/features/progression/lifeStages';
import { useGame } from '@/save/store';
import { Btn, Modal, Portrait } from '@/ui/kit';
import { rng, shuffled } from './exercises';

// ⚡ Real Talk — 친구들이 원어민 속도(연음·축약 포함)로 잡담한다. 알아들은 핵심 단어를 고른다.
// 글자는 보여주지 않는다: 귀로만 잡아내는 연습이다. 다 맞히지 못해도 XP 는 받는다.

export function RealTalk({ onClose }: { onClose: () => void }) {
  const save = useGame((s) => s.save);
  const skillDone = useGame((s) => s.skillDone);
  const earnBadge = useGame((s) => s.earnBadge);
  const level = playerLevel(save.xp, save.graduated).level;
  const [seed] = useState(() => Date.now() % 100000);
  const script = useMemo(() => {
    const pool = realTalkFor(level);
    return pool[seed % pool.length] ?? pool[0];
  }, [level, seed]);
  const options = useMemo(() => (script ? shuffled([...script.keyWords, ...script.distractors], rng(seed)) : []), [script, seed]);
  const [speaker, setSpeaker] = useState<string | null>(null);
  const [heardOnce, setHeardOnce] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [result, setResult] = useState<{ accuracy: number; xp: number } | null>(null);
  const run = useRef(0);

  const play = async () => {
    if (!script) return;
    const id = ++run.current;
    for (const line of script.lines) {
      setSpeaker(line.npc);
      const ok = await speakLine(line.text, npc(line.npc).voice, 'native').done;
      if (!ok || id !== run.current) { setSpeaker(null); return; }
    }
    setSpeaker(null);
    setHeardOnce(true);
  };
  useEffect(() => {
    void play();
    return () => { run.current++; stopAll(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script]);

  if (!script) return null;

  const check = () => {
    const hits = chosen.filter((w) => script.keyWords.includes(w)).length;
    const misses = chosen.length - hits;
    const accuracy = Math.max(0, (hits - misses) / script.keyWords.length);
    const tier: Tier = Math.min(maxTierForLevel(level), 5) as Tier;
    const xp = skillDone({ skill: 'listening', tier, accuracy, speed: 'native' });
    if (accuracy >= 0.8) earnBadge('real-talk');
    playSfx(accuracy >= 0.6 ? 'correct' : 'wrong');
    setResult({ accuracy, xp });
  };

  return (
    <Modal title="Real Talk" icon="⚡" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-6">
          {(['leo', 'ava'] as const).map((id) => (
            <div key={id} className={`flex flex-col items-center gap-1 transition ${speaker === id ? 'scale-110' : 'opacity-60'}`}>
              <Portrait emoji={npc(id).portrait} size={84} />
              <span className="text-base font-bold">{npc(id).name} {speaker === id ? '🔊' : ''}</span>
            </div>
          ))}
        </div>
        <p className="text-center text-lg font-bold">🚀 Real speed! Which words did you catch?</p>
        <div className="flex justify-center"><Btn tone="sky" icon="🔁" onClick={() => void play()}>Listen again</Btn></div>
        <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Words">
          {options.map((w) => {
            const on = chosen.includes(w);
            const right = script.keyWords.includes(w);
            return (
              <button key={w} type="button" aria-pressed={on} disabled={result !== null}
                onClick={() => setChosen((c) => (c.includes(w) ? c.filter((x) => x !== w) : [...c, w]))}
                className={`min-h-12 rounded-full border-4 px-4 text-xl font-bold ${result ? (right ? 'border-meadow bg-meadow/30' : on ? 'border-berry bg-berry/30' : 'border-white/20') : on ? 'border-honey bg-honey text-ink' : 'border-white/30 bg-white/10'}`}>
                {w}
              </button>
            );
          })}
        </div>
        {result ? (
          <div className="space-y-3 text-center">
            <p className="text-2xl font-extrabold">{result.accuracy >= 0.8 ? '⚡ Great ears!' : '👂 Good try! Listen again and again.'} +{result.xp} XP</p>
            <Btn big tone="meadow" icon="✅" className="w-full" onClick={onClose}>Done</Btn>
          </div>
        ) : (
          <Btn big tone="meadow" icon="✅" className="w-full" disabled={!heardOnce || chosen.length === 0} onClick={check}>Check</Btn>
        )}
      </div>
    </Modal>
  );
}
