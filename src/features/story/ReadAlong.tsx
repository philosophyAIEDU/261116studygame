import { useCallback, useEffect, useRef, useState } from 'react';
import type { Speed } from '@/types';
import type { StoryPack } from '@/content/loader';
import { sentencesOfScene } from '@/content/loader';
import type { StorySentence } from '@/content/schema';
import { playSentence, stopAll } from '@/audio/player';
import { playSfx } from '@/audio/sfx';
import { textForSpeed } from '@/audio/speedLadder';
import { useGame } from '@/save/store';
import { WordPopup } from '@/features/dictionary/WordPopup';
import { Btn } from '@/ui/kit';
import { SpeedPicker } from '@/ui/SpeedPicker';
import { SceneView } from './SceneView';
import { phrasesInText } from './phrases';
import { EMPTY_LIST } from './unlock';

// ② Read Along — 문장 단위로 소리와 글자 하이라이트를 맞춘다.
//  - 문장을 다시 듣기(🔁), 속도 조절(🐢🚶🚀)
//  - 단어를 탭하면 뜻 창(발음 → 그림 → 쉬운 영어 → 이야기 속 문장)
//  - 주머니 표현이 들어 있는 문장을 들으면 Phrase Pocket 에 ✨수집

function Sentence({ sentence, speed, active, done, hasPhrase, onReplay, onWord }: {
  sentence: StorySentence;
  speed: Speed;
  active: boolean;
  done: boolean;
  hasPhrase: boolean;
  onReplay: () => void;
  onWord: (word: string) => void;
}) {
  const tokens = textForSpeed(sentence, speed).split(/\s+/);
  return (
    <li className={`flex items-start gap-2 rounded-2xl p-2 transition ${active ? 'bg-honey shadow-lg' : done ? 'bg-paper' : 'bg-paper/70'}`} aria-current={active ? 'true' : undefined}>
      <Btn tone={active ? 'paper' : 'sky'} icon={active ? '🔊' : '🔁'} aria-label={`Hear sentence ${sentence.id}`} onClick={onReplay} />
      <p className="flex-1 text-[1.4rem] font-bold leading-relaxed text-ink sm:text-[1.6rem]">
        {tokens.map((token, i) => {
          const word = token.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, '');
          return (
            <span key={`${token}-${i}`}>
              {word ? (
                <button type="button" onClick={() => onWord(word.toLowerCase())} className="rounded-md px-0.5 underline decoration-ink/20 decoration-dotted underline-offset-4 hover:bg-white/70">
                  {token}
                </button>
              ) : token}{' '}
            </span>
          );
        })}
        {hasPhrase ? <span className="emoji" title="Pocket phrase" aria-label="Pocket phrase">✨</span> : null}
      </p>
    </li>
  );
}

/** 탭한 단어를 이야기의 사전 단어(원형)에 맞춘다. 예: "smiles" → "smile" */
function toDictWord(pack: StoryPack, tapped: string): string {
  const hit = pack.story.words.find((w) => {
    const stem = (w.word.toLowerCase().split(' ')[0] ?? '');
    return tapped === stem || (stem.length >= 3 && tapped.startsWith(stem.slice(0, Math.max(3, stem.length - 1))));
  });
  return hit?.word ?? tapped;
}

export function ReadAlong({ pack, initialSpeed, onComplete, onExit, onAddWord }: {
  pack: StoryPack;
  initialSpeed: Speed;
  onComplete: (speed: Speed) => void;
  onExit: () => void;
  onAddWord: (word: string) => void;
}) {
  const scenes = pack.story.scenes;
  const collectPhrase = useGame((s) => s.collectPhrase);
  const collected = useGame((s) => s.save.stories[pack.meta.id]?.phrases) ?? EMPTY_LIST;
  const [index, setIndex] = useState(0);
  const [speed, setSpeed] = useState<Speed>(initialSpeed);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [read, setRead] = useState<ReadonlySet<string>>(new Set());
  const [popup, setPopup] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const run = useRef(0);
  const scene = scenes[index];
  const sentences = scene ? sentencesOfScene(pack.story, scene.id) : [];

  const playFrom = useCallback(async (list: readonly StorySentence[]) => {
    const id = ++run.current;
    for (const s of list) {
      setActiveId(s.id);
      const ok = await playSentence(pack, s, speed).done;
      if (id !== run.current) return;
      if (!ok) break;
      setRead((prev) => new Set(prev).add(s.id));
      for (const phrase of phrasesInText(s.text, pack.story.phrasePocket)) {
        if (!useGame.getState().storyProgress(pack.meta.id).phrases.includes(phrase)) {
          collectPhrase(pack.meta.id, phrase);
          playSfx('collect');
          setToast(phrase);
        }
      }
    }
    setActiveId(null);
  }, [pack, speed, collectPhrase]);

  useEffect(() => {
    if (!scene || popup) return;
    void playFrom(sentencesOfScene(pack.story, scene.id));
    return () => { run.current++; stopAll(); };
    // popup 이 닫혀도 처음부터 다시 읽지 않도록 popup 은 의존성에서 뺀다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, playFrom]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  if (!scene) return null;
  const sceneRead = sentences.every((s) => read.has(s.id));
  const allRead = pack.story.sentences.every((s) => read.has(s.id));
  const last = index === scenes.length - 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Btn tone="ghost" icon="⬅️" aria-label="Back to quest" onClick={onExit} />
        <p className="flex-1 text-center text-lg font-bold" aria-label="Phrase Pocket">💬 {collected.length}/{pack.story.phrasePocket.length}</p>
        <SpeedPicker value={speed} onChange={setSpeed} dark />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <SceneView pack={pack} scene={scene} />
        <ul className="space-y-2">
          {sentences.map((s) => (
            <Sentence
              key={s.id}
              sentence={s}
              speed={speed}
              active={activeId === s.id}
              done={read.has(s.id)}
              hasPhrase={phrasesInText(s.text, pack.story.phrasePocket).length > 0}
              onReplay={() => void playFrom([s])}
              onWord={(w) => { run.current++; stopAll(); setActiveId(null); setPopup(toDictWord(pack, w)); }}
            />
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-2">
        <Btn tone="paper" icon="◀️" aria-label="Previous page" disabled={index === 0} onClick={() => setIndex((i) => i - 1)} />
        <Btn tone="sky" icon="🔁" className="flex-1" onClick={() => void playFrom(sentences)}>Again</Btn>
        {last ? (
          <Btn big tone="meadow" icon="✅" className="flex-1" disabled={!allRead} onClick={() => onComplete(speed)}>Done</Btn>
        ) : (
          <Btn big tone="honey" icon="▶️" aria-label="Next page" className="flex-1" disabled={!sceneRead} onClick={() => setIndex((i) => i + 1)}>Next</Btn>
        )}
      </div>

      {toast ? (
        <div role="status" className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-2xl border-2 border-honey bg-night px-4 py-2 text-lg font-bold shadow-xl">
          ✨ Phrase Pocket: “{toast}”
        </div>
      ) : null}
      {popup ? <WordPopup pack={pack} word={popup} onClose={() => setPopup(null)} onAdd={(w) => { setPopup(null); onAddWord(w); }} /> : null}
    </div>
  );
}
