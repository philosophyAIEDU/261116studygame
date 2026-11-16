import { useState } from 'react';
import type { Speed, StoryStep, Tier } from '@/types';
import { getPack } from '@/content/loader';
import { useGame } from '@/save/store';
import { useUi } from '@/app/uiStore';
import { playSfx } from '@/audio/sfx';
import { Btn, Locked, Modal } from '@/ui/kit';
import { EMPTY_PROGRESS, isStepAvailable, isUseItUnlocked, medalIcon, USE_IT_MIN_LISTENS } from './unlock';
import { LookListen } from './LookListen';
import { ReadAlong } from './ReadAlong';
import { DictStep } from './DictStep';
import { UseIt } from './UseIt';

// Story Quest 허브: 이야기 한 편 = 챕터 하나. 5단계를 RPG 퀘스트 단계처럼 보여준다.
// 단계는 순서대로만 열린다. ⑤ Use It! 은 ①~④ 완료 + 3회 청취 후에 열린다.

const STEPS: { id: StoryStep; num: string; icon: string; name: string; hint: string }[] = [
  { id: 'look', num: '1', icon: '👀', name: 'Look & Listen', hint: 'Pictures and sound. No words.' },
  { id: 'read', num: '2', icon: '📖', name: 'Read Along', hint: 'Listen and follow the words.' },
  { id: 'dict', num: '3', icon: '🖍️', name: 'My Picture Dictionary', hint: 'Draw the new words.' },
  { id: 'bedtime', num: '4', icon: '🌙', name: 'Bedtime Listening', hint: 'Relax in bed and listen.' },
  { id: 'useIt', num: '5', icon: '🎤', name: 'Use It!', hint: 'Say it and write it.' },
];

export const EARS_HINT = 'Your ears are still collecting words! 👂';

export function StoryQuest({ packId, onClose }: { packId: string; onClose: () => void }) {
  const pack = getPack(packId);
  const progress = useGame((s) => s.save.stories[packId]) ?? EMPTY_PROGRESS;
  const returnToAdventure = useUi((s) => s.storyReturnToAdventure);
  const settingsSpeed = useGame((s) => s.save.settings.speed);
  const game = useGame.getState;
  const open = useUi((s) => s.open);
  const [view, setView] = useState<StoryStep | null>(null);
  const [dictWord, setDictWord] = useState<string | null>(null);

  if (!pack) return null;
  const tier = pack.meta.level as Tier;
  const next = STEPS.find((step) => !progress.steps[step.id] && isStepAvailable(progress, step.id)) ?? (progress.listenCount < USE_IT_MIN_LISTENS ? STEPS[0] : undefined);
  const begin = (step: StoryStep) => step === 'bedtime' ? goToBed() : setView(step);

  const finishListen = (step: 'look' | 'read', speed: Speed) => {
    game().completeStep(packId, step);
    game().recordListen(packId, speed, tier);
    if (step === 'read') game().skillDone({ skill: 'reading', tier, accuracy: 1 });
    game().pushFx({ kind: 'questDone', title: step === 'look' ? 'Look & Listen' : 'Read Along' });
    playSfx('quest');
    setView(null);
  };

  const goToBed = () => {
    // 밤이 되면 홈스테이 방으로 돌아가 침대에서 듣는다.
    game().setPhase('night');
    useUi.getState().requestTeleport('home');
    open({ type: 'bedtime', packId });
  };

  return (
    <Modal title={pack.meta.title} icon={pack.meta.cover} onClose={view ? undefined : onClose} wide>
      {view === 'look' && <LookListen pack={pack} initialSpeed={settingsSpeed} onComplete={(sp) => finishListen('look', sp)} onExit={() => setView(null)} />}
      {view === 'read' && (
        <ReadAlong pack={pack} initialSpeed={settingsSpeed} onComplete={(sp) => finishListen('read', sp)} onExit={() => setView(null)}
          onAddWord={(w) => { setDictWord(w); setView('dict'); }} />
      )}
      {view === 'dict' && (
        <DictStep pack={pack} initialWord={dictWord} onExit={() => { setDictWord(null); setView(null); }}
          onComplete={() => {
            if (game().completeStep(packId, 'dict', pack.story.words.length)) {
              game().pushFx({ kind: 'questDone', title: 'My Picture Dictionary' });
              playSfx('quest');
            }
            setDictWord(null);
            setView(null);
          }} />
      )}
      {view === 'useIt' && (
        <UseIt pack={pack} onExit={() => setView(null)}
          onComplete={() => {
            game().completeStep(packId, 'useIt');
            game().pushFx({ kind: 'questDone', title: `${pack.meta.title} — Use It!` });
            setView(null);
          }} />
      )}

      {view === null && (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-4 text-lg font-bold">
            <span aria-label={`Listened ${progress.listenCount} times`}>👂 × {progress.listenCount}</span>
            <span aria-label="Phrase Pocket">💬 {progress.phrases.length}/{pack.story.phrasePocket.length}</span>
            {progress.medal !== 'none' ? <span className="emoji text-2xl" aria-label={`${progress.medal} speed medal`}>{medalIcon(progress.medal)}</span> : null}
          </div>
          {returnToAdventure && isUseItUnlocked(progress) ? <Btn big className="w-full" onClick={onClose}>🏮 My lantern is ready! Return to Mr. Page</Btn> : next ? <div className="rounded-2xl bg-paper p-4 text-ink"><p className="mb-2 text-xs font-black tracking-widest text-[#76618d]">YOUR NEXT STEP</p><Btn big className="w-full" onClick={() => begin(next.id)}>{next.icon} {next.id === 'look' && progress.steps.look ? 'Hear my story again' : `Start ${next.name}`}</Btn></div> : null}
          <ol className="space-y-2">
            {STEPS.map((step) => {
              const done = progress.steps[step.id];
              const available = isStepAvailable(progress, step.id);
              const start = () => (step.id === 'bedtime' ? goToBed() : setView(step.id));
              return (
                <li key={step.id}>
                  <button type="button" disabled={!available} onClick={() => { playSfx('open'); start(); }}
                    aria-label={`Step ${step.num}: ${step.name}${done ? ' (done)' : available ? '' : ' (locked)'}`}
                    className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition ${done ? 'border-meadow bg-meadow/15' : available ? 'border-honey bg-honey/15' : 'border-white/15 bg-white/5 opacity-60'}`}>
                    <span className="emoji text-4xl" aria-hidden="true">{step.icon}</span>
                    <span className="flex-1">
                      <span className="block text-xl font-extrabold">{step.num}. {step.name}</span>
                      <span className="block text-base text-paper/80">{step.hint}</span>
                    </span>
                    <span className="emoji text-3xl" aria-hidden="true">{done ? '✅' : available ? '▶️' : '🔒'}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          {!isUseItUnlocked(progress) && progress.steps.look ? (
            <Locked text={`${EARS_HINT}  (👂 ${Math.min(progress.listenCount, USE_IT_MIN_LISTENS)}/${USE_IT_MIN_LISTENS})`} />
          ) : null}
          {isUseItUnlocked(progress) ? (
            <Btn big tone="sky" icon="💬" className="w-full" onClick={() => open({ type: 'talk', packId })}>Talk Time</Btn>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
