import { useEffect, useState } from 'react';
import type { DictCard } from './srs';
import { getDrawing } from './db';

/** IndexedDB 에 저장된 그림을 불러온다. */
export function useDrawing(word: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (word) void getDrawing(word).then((d) => { if (alive) setUrl(d ?? null); }).catch(() => {});
    return () => { alive = false; };
  }, [word]);
  return url;
}

/** 단어 카드의 앞면: 아이가 남긴 뜻(직접 그린 그림 / 고른 그림 카드 / 쉬운 영어) */
export function CardFace({ card, size = 96 }: { card: DictCard; size?: number }) {
  const drawing = useDrawing(card.kind === 'drawing' ? card.word : null);
  const box = 'flex items-center justify-center overflow-hidden rounded-xl border-2 border-honey bg-white text-ink';
  if (card.kind === 'drawing') {
    return (
      <div className={box} style={{ width: size, height: size }}>
        {drawing ? <img src={drawing} alt="My drawing" className="h-full w-full object-contain" /> : <span className="emoji text-3xl">🖍️</span>}
      </div>
    );
  }
  if (card.kind === 'picture') {
    return <div className={`${box} emoji`} style={{ width: size, height: size, fontSize: size * 0.55 }}>{card.value}</div>;
  }
  return (
    <div className={`${box} p-1 text-center text-sm font-bold leading-tight`} style={{ width: size, height: size }}>
      {card.value || '❓'}
    </div>
  );
}
