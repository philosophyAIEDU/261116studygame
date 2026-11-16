import { inputHourBadgesEarned } from './inputHours';

// 배지 정의와 획득 판정 (순수 함수)

export interface BadgeDef {
  id: string;
  icon: string;
  name: string;
  hint: string;
}

export const BADGES: readonly BadgeDef[] = [
  { id: 'input-10h', icon: '👂', name: '10 Input Hours', hint: 'Listen for 10 hours.' },
  { id: 'input-50h', icon: '🎧', name: '50 Input Hours', hint: 'Listen for 50 hours.' },
  { id: 'input-100h', icon: '📻', name: '100 Input Hours', hint: 'Listen for 100 hours.' },
  { id: 'input-300h', icon: '🌟', name: '300 Input Hours', hint: 'Listen for 300 hours.' },
  { id: 'first-drawing', icon: '🖍️', name: 'First Drawing', hint: 'Draw a word.' },
  { id: 'artist-20', icon: '🎨', name: 'Little Artist', hint: 'Draw 20 words.' },
  { id: 'deep-listener', icon: '🌊', name: 'Deep Listener', hint: 'Listen to one story 5 times.' },
  { id: 'deep-listener-10', icon: '🐋', name: 'Deeper Listener', hint: 'Listen to one story 10 times.' },
  { id: 'speed-gold', icon: '🚀', name: 'Native Ears', hint: 'Finish a story at Native speed.' },
  { id: 'comfort-zone', icon: '🧗', name: 'Comfort Zone', hint: 'Try a quest outside your usual style.' },
  { id: 'phrase-master', icon: '💬', name: 'Phrase Master', hint: 'Use 20 pocket phrases in talks.' },
  { id: 'first-talk', icon: '🎤', name: 'First Talk', hint: 'Finish a Talk Time.' },
  { id: 'real-talk', icon: '⚡', name: 'Real Talk', hint: 'Catch the words in a fast chat.' },
  { id: 'streak-7', icon: '🔥', name: '7-Day Streak', hint: 'Play 7 days in a row.' },
  { id: 'grad-elementary', icon: '🏫', name: 'Elementary Graduate', hint: 'Graduate from elementary school.' },
  { id: 'grad-middle', icon: '🏢', name: 'Middle School Graduate', hint: 'Graduate from middle school.' },
  { id: 'grad-high', icon: '🎓', name: 'High School Graduate', hint: 'Graduate from high school.' },
  { id: 'grad-college', icon: '🏛️', name: 'College Graduate', hint: 'Get your degree.' },
];

export interface BadgeFacts {
  inputSeconds: number;
  drawings: number;
  maxListenCount: number;
  hasGoldMedal: boolean;
  phraseUses: number;
  talksDone: number;
  streakDays: number;
  graduated: readonly string[];
  /** 이벤트로만 얻는 배지(Comfort Zone, Real Talk 등)는 이미 가진 목록으로 유지한다 */
  owned: readonly string[];
}

/** 현재 상태에서 가지고 있어야 할 배지 전체 목록(중복 없음, 정의 순서). */
export function computeBadges(f: BadgeFacts): string[] {
  const earned = new Set<string>(f.owned);
  for (const id of inputHourBadgesEarned(f.inputSeconds)) earned.add(id);
  if (f.drawings >= 1) earned.add('first-drawing');
  if (f.drawings >= 20) earned.add('artist-20');
  if (f.maxListenCount >= 5) earned.add('deep-listener');
  if (f.maxListenCount >= 10) earned.add('deep-listener-10');
  if (f.hasGoldMedal) earned.add('speed-gold');
  if (f.phraseUses >= 20) earned.add('phrase-master');
  if (f.talksDone >= 1) earned.add('first-talk');
  if (f.streakDays >= 7) earned.add('streak-7');
  for (const stage of f.graduated) earned.add(`grad-${stage}`);
  return BADGES.map((b) => b.id).filter((id) => earned.has(id));
}

export function badgeDef(id: string): BadgeDef | undefined {
  return BADGES.find((b) => b.id === id);
}
