import type { DictKind } from '@/types';
import { addDays } from '@/features/progression/time';

// 간격 반복(Leitner 5박스) — 그림 사전 카드에 적용 (순수 함수)
// 맞히면 다음 박스로 가고 복습 간격이 2배씩 늘어난다. 틀리면 1번 박스로 돌아온다.

export interface DictCard {
  word: string;
  packId: string;
  kind: DictKind;
  /** drawing: IndexedDB 키 / picture: 그림 카드 키(이모지) / english: 쉬운 영어 설명 */
  value: string;
  box: number; // 1~5
  due: string; // 날짜 키
  createdAt: number;
}

export const BOX_INTERVAL_DAYS = [1, 2, 4, 8, 16] as const;

export function reviewCard(card: DictCard, correct: boolean, today: string): DictCard {
  const box = correct ? Math.min(5, card.box + 1) : 1;
  const interval = BOX_INTERVAL_DAYS[box - 1] ?? 1;
  return { ...card, box, due: addDays(today, interval) };
}

export function dueCards(cards: readonly DictCard[], today: string): DictCard[] {
  return cards.filter((c) => c.due <= today).sort((a, b) => a.box - b.box || a.due.localeCompare(b.due));
}

export function newCard(args: { word: string; packId: string; kind: DictKind; value: string; today: string; now: number }): DictCard {
  return { word: args.word, packId: args.packId, kind: args.kind, value: args.value, box: 1, due: addDays(args.today, 1), createdAt: args.now };
}
