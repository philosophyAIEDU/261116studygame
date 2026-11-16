import type { CharacterAccessory } from '@/config/characters';
import { PLACEMENT_WORDS, questWord, WORDS, type WordLevel } from './catalog';

export interface WordMemory { seen: number; firstCorrect: number; mistakes: number; streak: number; dueAt: number }
export interface PlacementAnswer { wordId: string; correct: boolean }
export interface WordFeedback { wordId: string; picked: string; correct: boolean; firstAttempt: boolean }
export interface WordMission {
  id: number; mode: 'quest' | 'review'; level: WordLevel; queue: string[]; cursor: number; solved: string[];
  attempts: Record<string, number>; wrong: string[]; firstCorrect: number;
  feedback: WordFeedback | null; claimed: boolean;
}
export interface VocabularyState {
  placement: { level: WordLevel; correct: number; total: number } | null;
  assessment: PlacementAnswer[];
  level: WordLevel; cards: Record<string, WordMemory>; coins: number; xp: number; cleared: number;
  owned: CharacterAccessory[]; equipped: CharacterAccessory | null;
  recentScores: number[]; mission: WordMission | null; voiceURI: string;
  look: { hair: number; hairColor: number; outfitColor: number };
}
export const emptyVocabulary = (): VocabularyState => ({ placement: null, assessment: [], level: 1, cards: {}, coins: 0, xp: 0, cleared: 0, owned: [], equipped: null, recentScores: [], mission: null, voiceURI: '', look: { hair: 1, hairColor: 1, outfitColor: 2 } });

// 3문항 중 2개를 처음 듣고 맞히면 한 단계 더 본다. 어린 초보자에게 어려운 문제를 계속 내지 않는다.
export function placementProgress(answers: readonly PlacementAnswer[]): { next: string | null; level: WordLevel; finished: boolean } {
  let level: WordLevel = 1;
  for (let band = 0; band < 4; band++) {
    const group = PLACEMENT_WORDS[band]!;
    const tested = answers.slice(band * 3, band * 3 + 3);
    if (tested.length < 3) return { next: group[tested.length]!, level, finished: false };
    const passed = tested.filter((a) => a.correct).length >= 2;
    if (!passed) return { next: null, level, finished: true };
    level = (band + 1) as WordLevel;
  }
  return { next: null, level, finished: true };
}
export function answerPlacement(state: VocabularyState, picked: string, heardWord: string): VocabularyState {
  if (state.placement) return state;
  const progress = placementProgress(state.assessment);
  if (!progress.next || heardWord !== progress.next) return state;
  if (picked !== 'unknown' && !wordOptions(progress.next, 17).some((w) => w.id === picked)) return state;
  const assessment = [...state.assessment, { wordId: progress.next, correct: picked === progress.next }];
  const after = placementProgress(assessment);
  return { ...state, assessment, level: after.level, placement: after.finished ? { level: after.level, correct: assessment.filter((a) => a.correct).length, total: assessment.length } : null };
}
function random(seed: number) { let value = seed | 0; return () => { value = (Math.imul(value, 1664525) + 1013904223) | 0; return (value >>> 0) / 4294967296; }; }
function shuffle<T>(values: readonly T[], seed: number): T[] { const list = [...values]; const rng = random(seed); for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [list[i], list[j]] = [list[j]!, list[i]!]; } return list; }
function wordSeed(id: string) { return [...id].reduce((sum, char) => sum * 31 + char.charCodeAt(0), 7) | 0; }
export function wordOptions(id: string, seed: number) {
  const target = questWord(id);
  const distractors = shuffle(WORDS.filter((w) => w.level === target.level && w.id !== id), seed + wordSeed(id)).slice(0, 3);
  return shuffle([target, ...distractors], seed + wordSeed(id) + 3);
}
export function startWordMission(state: VocabularyState, now: number, seed: number, reviewOnly = false): VocabularyState {
  if (!state.placement || state.mission && !state.mission.claimed) return state;
  const eligible = WORDS.filter((w) => w.level <= state.level);
  const due = eligible.filter((w) => state.cards[w.id] && (reviewOnly || state.cards[w.id]!.dueAt <= now)).sort((a, b) => state.cards[a.id]!.dueAt - state.cards[b.id]!.dueAt).slice(0, reviewOnly ? 5 : 2);
  const pool = shuffle(WORDS.filter((w) => w.level === state.level && !due.some((d) => d.id === w.id)), seed);
  pool.sort((a, b) => (state.cards[a.id]?.seen ?? 0) - (state.cards[b.id]?.seen ?? 0));
  const words = [...due, ...pool.slice(0, 5 - due.length)];
  const queue = shuffle(words.map((w) => w.id), seed + 1);
  return { ...state, mission: { id: seed, mode: reviewOnly ? 'review' : 'quest', level: state.level, queue, cursor: 0, solved: [], attempts: {}, wrong: [], firstCorrect: 0, feedback: null, claimed: false } };
}
export function answerWordMission(state: VocabularyState, picked: string, heardWord: string, now: number): VocabularyState {
  const mission = state.mission;
  if (!mission || mission.claimed || mission.feedback || mission.cursor >= mission.queue.length) return state;
  const id = mission.queue[mission.cursor]!;
  if (heardWord !== id || !wordOptions(id, mission.id).some((w) => w.id === picked)) return state;
  const firstAttempt = !mission.attempts[id]; const correct = picked === id;
  const attempts = { ...mission.attempts, [id]: (mission.attempts[id] ?? 0) + 1 };
  const previous = state.cards[id] ?? { seen: 0, firstCorrect: 0, mistakes: 0, streak: 0, dueAt: now };
  const streak = correct && firstAttempt ? previous.streak + 1 : correct ? previous.streak : 0;
  const card: WordMemory = { seen: previous.seen + 1, firstCorrect: previous.firstCorrect + (correct && firstAttempt ? 1 : 0), mistakes: previous.mistakes + (correct ? 0 : 1), streak,
    dueAt: now + (correct && firstAttempt ? [1, 3, 7, 14][Math.min(streak - 1, 3)]! * 86400000 : 10 * 60000) };
  const queue = [...mission.queue];
  // 오답은 두 문제 뒤에 다시 낸다. 정답을 보고 바로 누른 결과를 첫 정답이나 숙달로 세지 않는다.
  if (!correct && !queue.slice(mission.cursor + 1).includes(id)) queue.splice(Math.min(queue.length, mission.cursor + 3), 0, id);
  return { ...state, cards: { ...state.cards, [id]: card }, mission: { ...mission, queue, attempts,
    solved: correct && !mission.solved.includes(id) ? [...mission.solved, id] : mission.solved,
    wrong: correct || mission.wrong.includes(id) ? mission.wrong : [...mission.wrong, id],
    firstCorrect: mission.firstCorrect + (correct && firstAttempt ? 1 : 0), feedback: { wordId: id, picked, correct, firstAttempt } } };
}
export function continueWordMission(state: VocabularyState): VocabularyState {
  const m = state.mission; return m?.feedback ? { ...state, mission: { ...m, cursor: m.cursor + 1, feedback: null } } : state;
}
export function missionReady(m: WordMission | null): boolean { return !!m && m.solved.length === 5 && m.cursor >= m.queue.length && !m.feedback; }
export function claimWordMission(state: VocabularyState): VocabularyState {
  const m = state.mission;
  if (!m || m.claimed || !missionReady(m)) return state;
  const score = m.firstCorrect / 5; const recentScores = m.mode === 'quest' ? [...state.recentScores, score].slice(-2) : state.recentScores;
  let level = state.level;
  if (m.mode === 'quest' && recentScores.length === 2 && recentScores.every((s) => s >= 0.8) && level < 4) level = (level + 1) as WordLevel;
  if (m.mode === 'quest' && recentScores.length === 2 && recentScores.every((s) => s <= 0.4) && level > 1) level = (level - 1) as WordLevel;
  return { ...state, coins: state.coins + 25 + m.firstCorrect * 5, xp: state.xp + 30 + m.firstCorrect * 10, cleared: state.cleared + 1,
    level, recentScores: level !== state.level ? [] : recentScores, mission: { ...m, claimed: true } };
}
export function learningSummary(state: VocabularyState, now: number) {
  const cards = Object.values(state.cards);
  return { encountered: cards.length, independentlyCorrect: cards.filter((c) => c.firstCorrect > 0).length, familiar: cards.filter((c) => c.streak >= 3).length, due: Object.entries(state.cards).filter(([id, c]) => questWord(id).level <= state.level && (c.dueAt <= now || c.streak === 0)).length };
}

export const WORD_SHOP: readonly { id: CharacterAccessory; icon: string; cost: number }[] = [
  { id: 'star', icon: '⭐', cost: 30 }, { id: 'bow', icon: '🎀', cost: 45 },
  { id: 'flower', icon: '🌼', cost: 60 }, { id: 'glasses', icon: '👓', cost: 75 },
];
export function buyWordItem(state: VocabularyState, id: CharacterAccessory): VocabularyState {
  const item = WORD_SHOP.find((entry) => entry.id === id);
  if (!item || !state.owned.includes(id) && state.coins < item.cost) return state;
  const owned = state.owned.includes(id);
  return { ...state, coins: state.coins - (owned ? 0 : item.cost), owned: owned ? state.owned : [...state.owned, id], equipped: id };
}
