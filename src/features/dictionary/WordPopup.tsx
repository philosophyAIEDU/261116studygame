import { useEffect } from 'react';
import type { StoryPack } from '@/content/loader';
import { findWord, sentenceForWord } from '@/content/loader';
import { playWord } from '@/audio/player';
import { useGame } from '@/save/store';
import { Btn } from '@/ui/kit';
import { CardFace } from './CardFace';

/**
 * 단어를 탭했을 때 뜨는 창. 뜻은 이 순서로 보여준다:
 * ① 발음 ② 그림 ③ 아주 쉬운 영어 설명 ④ 이야기 속 문장.  (한국어 뜻은 어디에도 없다)
 */
export function WordPopup({ pack, word, onClose, onAdd }: { pack: StoryPack; word: string; onClose: () => void; onAdd: (word: string) => void }) {
  const info = findWord(pack.story, word);
  const sentence = sentenceForWord(pack.story, word);
  const card = useGame((s) => s.save.dictionary[word.toLowerCase()]);

  useEffect(() => { playWord(pack, word); }, [pack, word]);

  return (
    <div role="dialog" aria-label={`Word: ${word}`} className="fixed inset-0 z-50 flex items-end justify-center bg-night/60 p-3 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl border-4 border-honey bg-paper p-4 text-ink shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <Btn tone="sky" icon="🔊" aria-label={`Hear ${word}`} onClick={() => playWord(pack, word)} />
          <p className="flex-1 text-3xl font-extrabold">{word}</p>
          <Btn tone="paper" icon="✖️" aria-label="Close" onClick={onClose} />
        </div>
        <div className="mt-3 flex items-center gap-3">
          {card ? <CardFace card={card} size={96} /> : info ? <div className="emoji flex h-24 w-24 items-center justify-center rounded-xl border-2 border-honey bg-white text-6xl">{info.emoji}</div> : null}
          <div className="min-w-0 flex-1">
            {info ? <p className="text-xl font-bold">= {info.easyEnglish}</p> : null}
            {sentence ? <p className="mt-1 text-lg italic text-ink/75">“{sentence.text}”</p> : null}
          </div>
        </div>
        <Btn big tone="meadow" icon={card ? '🖍️' : '➕'} className="mt-4 w-full" onClick={() => onAdd(word)}>
          {card ? 'Change my card' : 'My Picture Dictionary'}
        </Btn>
      </div>
    </div>
  );
}
