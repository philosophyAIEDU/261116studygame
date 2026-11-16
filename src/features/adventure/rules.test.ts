import { beforeEach, describe, expect, it } from 'vitest';
import { migrateSave } from '@/save/migrations';
import { defaultSave } from '@/save/schema';
import { useGame } from '@/save/store';
import { emptyStoryProgress } from '@/features/story/unlock';
import { activeFestivalQuest, buyFestivalItem, claimFestivalQuest, collectParcel, completeFestivalTask, emptyAdventure, FESTIVAL_QUESTS, STAR_PARCELS, storyOutputReady, validInvitation } from './rules';

function collected() {
  let state = emptyAdventure();
  for (const node of STAR_PARCELS) state = collectParcel(state, node.id, node.answer, { x: node.pos[0], z: node.pos[1] });
  return state;
}
describe('festival adventure rules', () => {
  it('requires proximity and the right listening answer, and collects each item once', () => {
    const state = emptyAdventure(); const node = STAR_PARCELS[0];
    expect(collectParcel(state, node.id, node.answer, { x: 30, z: 30 })).toBe(state);
    expect(collectParcel(state, node.id, 'wrong', { x: 5, z: 7 })).toBe(state);
    const next = collectParcel(state, node.id, node.answer, { x: 5, z: 7 });
    expect(next.collected).toEqual([node.id]);
    expect(collectParcel(next, node.id, node.answer, { x: 5, z: 7 })).toBe(next);
  });
  it('requires a complete mission and a return to the right friend; rewards cannot be farmed', () => {
    expect(claimFestivalQuest(emptyAdventure(), 'lost-stars', false, 'cafeteria').tokens).toBe(0);
    const state = collected();
    expect(claimFestivalQuest(state, 'lost-stars', false, 'library')).toBe(state);
    const next = claimFestivalQuest(state, 'lost-stars', false, 'cafeteria');
    expect(next.tokens).toBe(30);
    expect(activeFestivalQuest(next)?.id).toBe('secret-letter');
    expect(claimFestivalQuest(next, 'lost-stars', false, 'cafeteria')).toBe(next);
  });
  it('enforces chapter input before output and keeps the full quest chain in order', () => {
    let state = collected();
    expect(completeFestivalTask(state, 'voice-0', '1', true)).toBe(state);
    state = claimFestivalQuest(state, 'lost-stars', false, 'cafeteria');
    expect(completeFestivalTask(state, 'letter', 'cafeteria', false)).toBe(state);
    state = completeFestivalTask(state, 'letter', 'library', false);
    state = claimFestivalQuest(state, 'secret-letter', false, 'playground');
    expect(claimFestivalQuest(state, 'story-lantern', false, 'library')).toBe(state);
    state = claimFestivalQuest(state, 'story-lantern', true, 'library');
    expect(completeFestivalTask(state, 'voice-0', '1', false)).toBe(state);
    expect(completeFestivalTask(state, 'voice-0', '0', true)).toBe(state);
    state = completeFestivalTask(state, 'voice-0', '0.8', true);
    state = completeFestivalTask(state, 'voice-1', '0.9', true);
    state = claimFestivalQuest(state, 'friendly-voice', true, 'teacher');
    state = completeFestivalTask(state, 'invitation', 'Come and play with us at the school festival!', true);
    state = claimFestivalQuest(state, 'festival-card', true, 'playground');
    expect(state.claimed).toHaveLength(FESTIVAL_QUESTS.length);
    expect(state.tokens).toBe(180);
  });
  it('validates invitations without saving their original text', () => {
    expect(validInvitation('hello')).toBe(false);
    expect(validInvitation('Come and play with us!')).toBe(true);
    expect(validInvitation('Come and play with us 안녕')).toBe(false);
  });
  it('buys and equips cosmetics without double charging or negative balances', () => {
    expect(buyFestivalItem(emptyAdventure(), 'glasses').tokens).toBe(0);
    const state = { ...emptyAdventure(), tokens: 50 };
    const bought = buyFestivalItem(state, 'glasses');
    expect(bought.tokens).toBe(0);
    expect(bought.equipped).toBe('glasses');
    expect(buyFestivalItem(bought, 'glasses').tokens).toBe(0);
    expect(buyFestivalItem(bought, 'bow')).toBe(bought);
  });
  it('uses a single fully completed input chapter, not incomplete progress across different chapters', () => {
    const p = emptyStoryProgress(); p.listenCount = 3; p.steps.look = true;
    expect(storyOutputReady({ a: p })).toBe(false);
    p.steps.read = true; p.steps.dict = true; p.steps.bedtime = true;
    expect(storyOutputReady({ a: p })).toBe(true);
  });
});
describe('adventure persistence', () => {
  beforeEach(() => useGame.getState().resetSave());
  it('migrates a v2 save while retaining progress and restores v3 without resetting adventures', () => {
    const current = defaultSave();
    const { adventure: _adventure, ...old } = current;
    const migrated = migrateSave({ ...old, schemaVersion: 2, xp: 777, input: { totalSeconds: 1000 } });
    expect(migrated.xp).toBe(777);
    expect(migrated.input.totalSeconds).toBe(1000);
    expect(migrated.adventure).toEqual(emptyAdventure());
    const state = { ...migrated, adventure: { ...emptyAdventure(), tokens: 30, claimed: ['lost-stars'] } };
    expect(migrateSave(state)).toEqual(state);
  });
  it('keeps quest claims atomic and awards XP only once', () => {
    const g = () => useGame.getState();
    for (const node of STAR_PARCELS) g().collectAdventureParcel(node.id, node.answer, { x: node.pos[0], z: node.pos[1] });
    expect(g().claimAdventureQuest('lost-stars', 'cafeteria')).toBe(true);
    expect(g().claimAdventureQuest('lost-stars', 'cafeteria')).toBe(false);
    expect(g().save.xp).toBe(20);
    expect(g().save.adventure.tokens).toBe(30);
    g().buyAdventureItem('star');
    const saved = g().save;
    g().replaceSave(saved);
    expect(g().save.adventure.equipped).toBe('star');
    expect(g().save.adventure.tokens).toBe(5);
  });
});
