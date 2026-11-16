import { useState } from 'react';
import type { StoryPack } from '@/content/loader';
import { useGame } from '@/save/store';
import { CardFace } from '@/features/dictionary/CardFace';
import { WordEditor } from '@/features/dictionary/WordEditor';
import { Btn } from '@/ui/kit';
import { DICT_STEP_WORDS, EMPTY_LIST, isDictStepDone } from './unlock';

// ③ My Picture Dictionary — 이야기의 단어를 내 사전에 등록한다.
// 뜻은 그림(직접 그리기 / 카드 고르기)이나 쉬운 영어로만 남긴다.

export function DictStep({ pack, initialWord, onComplete, onExit }: {
  pack: StoryPack;
  initialWord?: string | null;
  onComplete: () => void;
  onExit: () => void;
}) {
  const dictionary = useGame((s) => s.save.dictionary);
  const dictWords = useGame((s) => s.save.stories[pack.meta.id]?.dictWords) ?? EMPTY_LIST;
  const [editing, setEditing] = useState<string | null>(initialWord ?? null);

  // 이야기의 단어 + 아이가 Read Along 에서 직접 고른 단어
  const extra = dictWords.filter((w) => !pack.story.words.some((x) => x.word.toLowerCase() === w));
  const words = [...pack.story.words.map((w) => w.word), ...extra];
  const need = Math.min(DICT_STEP_WORDS, pack.story.words.length);
  const ready = isDictStepDone(dictWords.length, pack.story.words.length);

  if (editing) {
    return <WordEditor pack={pack} word={editing} onDone={() => setEditing(null)} onCancel={() => setEditing(null)} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Btn tone="ghost" icon="⬅️" aria-label="Back to quest" onClick={onExit} />
        <p className="flex-1 text-center text-lg font-bold">🖍️ {Math.min(dictWords.length, need)}/{need}</p>
      </div>
      <p className="text-center text-lg">Pick a word. Draw it, pick a picture, or write easy English.</p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {words.map((word) => {
          const card = dictionary[word.toLowerCase()];
          return (
            <li key={word}>
              <button type="button" onClick={() => setEditing(word)}
                className={`flex w-full flex-col items-center gap-2 rounded-2xl border-2 p-3 ${card ? 'border-meadow bg-meadow/20' : 'border-white/25 bg-white/10'}`}>
                {card ? <CardFace card={card} size={84} /> : <span className="emoji flex h-[84px] w-[84px] items-center justify-center rounded-xl border-2 border-dashed border-white/40 text-4xl">➕</span>}
                <span className="text-lg font-bold">{word}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <Btn big tone="meadow" icon="✅" disabled={!ready} onClick={onComplete}>Done</Btn>
    </div>
  );
}
