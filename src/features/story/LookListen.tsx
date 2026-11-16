import { useCallback, useEffect, useRef, useState } from 'react';
import type { Speed } from '@/types';
import type { StoryPack } from '@/content/loader';
import { sentencesOfScene } from '@/content/loader';
import { playSentence, playWord, stopAll } from '@/audio/player';
import { playSfx } from '@/audio/sfx';
import { Btn } from '@/ui/kit';
import { SpeedPicker } from '@/ui/SpeedPicker';
import { SceneView } from './SceneView';

// ① Look & Listen — 글 없이 그림과 소리만.
// 장면마다 내레이션이 자동으로 나오고, 사물을 탭하면 그 단어를 들려준다.
// 모든 장면을 끝까지 들어야 완료된다(= 1회 청취).

const SPEAKER_ICON: Record<string, string> = {
  narrator: '📖', girl: '👧', boy: '👦', friend: '👱‍♀️', teacher: '👩‍🏫', woman: '👩', man: '👨', creature: '🐉',
};

export function LookListen({ pack, initialSpeed, onComplete, onExit }: {
  pack: StoryPack;
  initialSpeed: Speed;
  onComplete: (speed: Speed) => void;
  onExit: () => void;
}) {
  const scenes = pack.story.scenes;
  const [index, setIndex] = useState(0);
  const [speed, setSpeed] = useState<Speed>(initialSpeed);
  const [heard, setHeard] = useState<ReadonlySet<number>>(new Set());
  const [speaker, setSpeaker] = useState<string | null>(null);
  const run = useRef(0);
  const scene = scenes[index];

  const narrate = useCallback(async (sceneIndex: number) => {
    const target = scenes[sceneIndex];
    if (!target) return;
    const id = ++run.current;
    for (const s of sentencesOfScene(pack.story, target.id)) {
      setSpeaker(s.speaker);
      const ok = await playSentence(pack, s, speed).done;
      if (id !== run.current) return; // 다른 재생이 시작됨
      if (!ok) { setSpeaker(null); return; }
    }
    setSpeaker(null);
    setHeard((prev) => new Set(prev).add(sceneIndex));
  }, [pack, scenes, speed]);

  useEffect(() => {
    void narrate(index);
    return () => { run.current++; stopAll(); };
  }, [index, narrate]);

  const tapObject = async (word: string) => {
    run.current++;
    setSpeaker(null);
    playSfx('star');
    await playWord(pack, word).done;
    // 내레이션을 끝까지 못 들었다면 단어를 들은 뒤 다시 들려준다.
    if (!heard.has(index)) void narrate(index);
  };

  if (!scene) return null;
  const sceneHeard = heard.has(index);
  const last = index === scenes.length - 1;
  const allHeard = scenes.every((_, i) => heard.has(i));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Btn tone="ghost" icon="⬅️" aria-label="Back to quest" onClick={onExit} />
        <div className="flex flex-1 justify-center gap-1" aria-label={`Scene ${index + 1} of ${scenes.length}`}>
          {scenes.map((s, i) => (
            <span key={s.id} className={`h-3 w-6 rounded-full ${i === index ? 'bg-honey' : heard.has(i) ? 'bg-meadow' : 'bg-white/25'}`} />
          ))}
        </div>
        <SpeedPicker value={speed} onChange={setSpeed} dark />
      </div>

      <div className="relative">
        <SceneView pack={pack} scene={scene} onTapObject={(w) => void tapObject(w)} />
        <div className="emoji absolute left-3 top-3 flex h-14 w-14 items-center justify-center rounded-full bg-night/70 text-3xl" aria-live="polite" aria-label={speaker ? `${speaker} is speaking` : 'Quiet'}>
          {speaker ? SPEAKER_ICON[speaker] ?? '🔊' : '👂'}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Btn tone="paper" icon="◀️" aria-label="Previous scene" disabled={index === 0} onClick={() => setIndex((i) => i - 1)} />
        <Btn tone="sky" icon="🔁" aria-label="Listen again" className="flex-1" onClick={() => void narrate(index)}>Again</Btn>
        {last ? (
          <Btn big tone="meadow" icon="✅" className="flex-1" disabled={!allHeard} onClick={() => onComplete(speed)}>Done</Btn>
        ) : (
          <Btn big tone="honey" icon="▶️" aria-label="Next scene" className="flex-1" disabled={!sceneHeard} onClick={() => setIndex((i) => i + 1)}>Next</Btn>
        )}
      </div>
      <p className="text-center text-base text-paper/80">👆 Tap the picture to hear a word.</p>
    </div>
  );
}
