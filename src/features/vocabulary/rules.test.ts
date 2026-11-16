import { describe, expect, it } from 'vitest';
import { WORDS, PLACEMENT_WORDS, questWord } from './catalog';
import { answerPlacement, answerWordMission, buyWordItem, claimWordMission, continueWordMission, emptyVocabulary, learningSummary, missionReady, placementProgress, startWordMission, wordOptions, type VocabularyState } from './rules';
import { migrateSave } from '@/save/migrations';
import { defaultSave } from '@/save/schema';
import { useGame } from '@/save/store';

const placed = (level: 1|2|3|4 = 1): VocabularyState => ({ ...emptyVocabulary(), level, placement: { level, correct: 3, total: 3 } });
function finish(state: VocabularyState, now = 100) { let current = state; let safety = 0; while (current.mission && !missionReady(current.mission) && safety++ < 30) { const word = current.mission.queue[current.mission.cursor]!; current = answerWordMission(current, word, word, now); current = continueWordMission(current); } return current; }
describe('adaptive starting check', () => {
  it('has unique English-only words and distinct options at every level', () => {
    expect(WORDS).toHaveLength(96); expect(new Set(WORDS.map((w) => w.id)).size).toBe(WORDS.length);
    expect(/[가-힣ㄱ-ㆎ]/.test(JSON.stringify(WORDS))).toBe(false);
    for (const word of WORDS) { const options = wordOptions(word.id, 0); expect(options).toHaveLength(4); expect(options.filter((w) => w.id === word.id)).toHaveLength(1); expect(new Set(options.map((w) => w.id)).size).toBe(4); expect(options.every((w) => w.level === word.level)).toBe(true); }
  });
  it('stops after three beginner questions if they are too hard', () => {
    let state = emptyVocabulary();
    for (const id of PLACEMENT_WORDS[0]) state = answerPlacement(state, 'unknown', id);
    expect(state.placement).toEqual({ level: 1, correct: 0, total: 3 });
    expect(placementProgress(state.assessment).finished).toBe(true);
  });
  it('reaches level four after twelve correct listening answers', () => {
    let state = emptyVocabulary();
    for (const group of PLACEMENT_WORDS) for (const id of group) state = answerPlacement(state, id, id);
    expect(state.placement).toEqual({ level: 4, correct: 12, total: 12 });
  });
  it('places a learner at the last passed level rather than the hardest question seen', () => {
    let state = emptyVocabulary();
    for (const id of PLACEMENT_WORDS[0]) state = answerPlacement(state, id, id);
    for (const id of PLACEMENT_WORDS[1]) state = answerPlacement(state, id, id);
    for (const id of PLACEMENT_WORDS[2]) state = answerPlacement(state, 'unknown', id);
    expect(state.placement?.level).toBe(2);
  });
  it('requires the current audio and a real option and ignores duplicate submissions', () => {
    const state = emptyVocabulary(); expect(answerPlacement(state, 'apple', '')).toBe(state); expect(answerPlacement(state, 'invented', 'apple')).toBe(state);
    const next = answerPlacement(state, 'apple', 'apple'); expect(answerPlacement(next, 'apple', 'apple')).toBe(next);
  });
});
describe('word quest and spaced review', () => {
  it('does not start before assessment and does not replace an unfinished mission', () => {
    expect(startWordMission(emptyVocabulary(), 0, 123).mission).toBeNull();
    const state = startWordMission(placed(3), 0, 123); expect(state.mission?.queue).toHaveLength(5); expect(state.mission!.queue.every((id) => questWord(id).level === 3)).toBe(true);
    expect(startWordMission(state, 1, 124)).toBe(state);
  });
  it('reintroduces an incorrect word after two intervening words and never counts a retry as first success', () => {
    let state = startWordMission(placed(), 100, 9); const id = state.mission!.queue[0]!;
    const wrong = wordOptions(id, 9).find((w) => w.id !== id)!.id;
    state = answerWordMission(state, wrong, id, 100);
    expect(state.mission!.queue[3]).toBe(id); expect(state.mission!.wrong).toEqual([id]);
    expect(answerWordMission(state, id, id, 100)).toBe(state);
    state = continueWordMission(state); state = finish(state);
    expect(missionReady(state.mission)).toBe(true); expect(state.mission!.firstCorrect).toBe(4); expect(state.cards[id]!.streak).toBe(0); expect(state.cards[id]!.firstCorrect).toBe(0);
    expect(learningSummary(state, 101)).toMatchObject({ independentlyCorrect: 4, familiar: 0, due: 1 });
  });
  it('rejects silent, stale, or fabricated answers and prevents incomplete rewards', () => {
    const state = startWordMission(placed(), 0, 100); const id = state.mission!.queue[0]!;
    expect(answerWordMission(state, id, '', 0)).toBe(state); expect(answerWordMission(state, 'not-a-word', id, 0)).toBe(state); expect(claimWordMission(state)).toBe(state);
  });
  it('awards a mission once, and restores progress safely after reload', () => {
    let state = finish(startWordMission(placed(), 0, 123)); state = claimWordMission(state);
    expect(state.coins).toBe(50); expect(state.xp).toBe(80); expect(state.cleared).toBe(1); expect(claimWordMission(state)).toBe(state);
    const save = { ...defaultSave(), vocabulary: state }; expect(migrateSave(JSON.parse(JSON.stringify(save))).vocabulary).toEqual(state);
  });
  it('schedules independent correct answers for later review, not immediate mastery', () => {
    const state = finish(startWordMission(placed(), 1000, 20), 1000);
    expect(Object.values(state.cards).every((card) => card.dueAt === 1000 + 86400000)).toBe(true);
    expect(learningSummary(state, 1000).familiar).toBe(0);
    const next = startWordMission(claimWordMission(state), 1000 + 86400001, 21);
    expect(next.mission!.queue.filter((id) => !!state.cards[id])).toHaveLength(2);
  });
  it('supports deliberate immediate review without promoting based on easier review words', () => {
    const state = { ...claimWordMission(finish(startWordMission(placed(), 0, 1))), recentScores: [1] };
    const reviewed = startWordMission(state, 1, 2, true); expect(reviewed.mission!.queue.every((id) => !!state.cards[id])).toBe(true);
    const claimed = claimWordMission(finish(reviewed)); expect(claimed.level).toBe(1); expect(claimed.recentScores).toEqual([1]);
  });
  it('promotes after two strong quests and eases down after two difficult quests', () => {
    let state = placed(); for (const seed of [1, 2]) state = claimWordMission(finish(startWordMission(state, 0, seed)));
    expect(state.level).toBe(2); expect(state.recentScores).toEqual([]);
    state = { ...placed(3), recentScores: [0] }; state = finish(startWordMission(state, 0, 123)); state.mission = { ...state.mission!, firstCorrect: 0 };
    expect(claimWordMission(state).level).toBe(2);
  });
  it('keeps coin purchases atomic and does not charge again for owned items', () => {
    const base = placed(); expect(buyWordItem(base, 'bow')).toBe(base);
    const bought = buyWordItem({ ...base, coins: 50 }, 'bow'); expect(bought.coins).toBe(5); expect(bought.equipped).toBe('bow'); expect(buyWordItem(bought, 'bow').coins).toBe(5);
  });
  it('migrates v3 without discarding old stories, XP, or appearance', () => {
    const old = { ...defaultSave(), schemaVersion: 3, xp: 500, profile: { hair: 2, hairColor: 3, outfitColor: 1 }, stories: { saved: { listenCount: 8 } } };
    const migrated = migrateSave(old); expect(migrated.schemaVersion).toBe(4); expect(migrated.xp).toBe(500); expect(migrated.stories).toEqual(old.stories); expect(migrated.vocabulary.look).toEqual({ hair: 2, hairColor: 3, outfitColor: 1 }); expect(migrated.vocabulary.placement).toBeNull();
  });
  it('keeps placement and rewards through the real save store', () => {
    useGame.getState().resetSave(); const game = () => useGame.getState();
    for (const id of PLACEMENT_WORDS[0]) game().vocabularyPlacementAnswer('unknown', id);
    game().vocabularyStart(7); const id = game().save.vocabulary.mission!.queue[0]!;
    game().vocabularyAnswer(id, id); const save = game().save; game().replaceSave(save);
    expect(game().save.vocabulary.mission!.feedback?.correct).toBe(true);
    game().vocabularyRetest(); expect(game().save.vocabulary.placement).not.toBeNull();
  });
});
