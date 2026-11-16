import { useMemo, useState } from 'react';
import { ALL_PACKS, findWordAnywhere } from '@/content/loader';
import { playWord } from '@/audio/player';
import { playSfx } from '@/audio/sfx';
import { localDayKey } from '@/features/progression/time';
import { useGame } from '@/save/store';
import { Btn } from '@/ui/kit';
import { CardFace } from './CardFace';
import { dueCards, type DictCard } from './srs';

// 그림 사전 복습 퀴즈 (간격 반복, Leitner 5박스).
// 문제로 나오는 그림은 "아이 본인이 남긴 것"(직접 그린 그림 / 고른 카드 / 쉬운 영어)이다.

function options(card: DictCard, all: readonly string[]): string[] {
  const others = all.filter((w) => w !== card.word);
  const seed = card.word.length + card.box;
  const picked = others.map((w, i) => ({ w, k: (i * 7 + seed * 13) % 11 })).sort((a, b) => a.k - b.k).slice(0, 3).map((x) => x.w);
  const list = [card.word, ...picked];
  return list.map((w, i) => ({ w, k: (w.charCodeAt(0) + i * 5 + seed) % 7 })).sort((a, b) => a.k - b.k).map((x) => x.w);
}

export function ReviewQuiz({ onDone }: { onDone: () => void }) {
  const dictionary = useGame((s) => s.save.dictionary);
  const reviewDictCard = useGame((s) => s.reviewDictCard);
  const awardXp = useGame((s) => s.awardXp);
  // 시작할 때의 복습 목록을 고정한다(답할 때마다 목록이 바뀌지 않게).
  const queue = useMemo(() => dueCards(Object.values(dictionary), localDayKey(new Date())).filter((c) => c.value !== ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []);
  const pool = useMemo(() => [...new Set([...Object.keys(dictionary), ...ALL_PACKS.flatMap((p) => p.story.words.map((w) => w.word.toLowerCase()))])], [dictionary]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const card = queue[index];

  if (!card) {
    return (
      <div className="space-y-3 text-center">
        <p className="emoji text-6xl">🎉</p>
        <p className="text-xl font-bold">All cards done for today!</p>
        <Btn big tone="meadow" icon="✅" onClick={onDone}>OK</Btn>
      </div>
    );
  }

  const answer = (word: string) => {
    if (picked) return;
    const correct = word === card.word;
    setPicked(word);
    reviewDictCard(card.word, correct);
    playSfx(correct ? 'correct' : 'wrong');
    if (correct) awardXp(3);
    playWord(findWordAnywhere(card.word)?.pack ?? null, card.word);
  };

  return (
    <div className="space-y-4">
      <p className="text-center text-lg font-bold">🃏 {index + 1}/{queue.length} — Which word is this?</p>
      <div className="flex justify-center"><CardFace card={card} size={176} /></div>
      <div className="grid grid-cols-2 gap-2">
        {options(card, pool).map((w) => (
          <Btn key={w} big tone={picked === null ? 'paper' : w === card.word ? 'meadow' : w === picked ? 'berry' : 'ghost'} onClick={() => answer(w)}>{w}</Btn>
        ))}
      </div>
      {picked ? <Btn big icon="➡️" className="w-full" onClick={() => { setPicked(null); setIndex((i) => i + 1); }}>Next</Btn> : null}
    </div>
  );
}
