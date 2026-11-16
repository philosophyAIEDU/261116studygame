import type { CharacterAccessory } from '@/config/characters';
import { isStepAvailable, type StoryProgress } from '@/features/story/unlock';
import { speechAccuracy, toWords } from '@/features/skills/scoring';
import { validateEnglishInput } from '@/features/dictionary/hangul';

export interface AdventureState {
  started: boolean;
  collected: string[];
  claimed: string[];
  tasks: string[];
  tokens: number;
  owned: CharacterAccessory[];
  equipped: CharacterAccessory | null;
}
export const emptyAdventure = (): AdventureState => ({ started: false, collected: [], claimed: [], tasks: [], tokens: 0, owned: [], equipped: null });
export const FESTIVAL_QUESTS = [
  { id: 'lost-stars', npc: 'leo', zone: 'cafeteria', title: 'The missing star stickers', subtitle: 'Listen to the clues. Find three star parcels.', icon: '⭐', reward: 30, xp: 20, skill: 'LISTEN', line: "The Maple Festival is today! My star stickers blew away. Can you follow the sounds and find them?" },
  { id: 'secret-letter', npc: 'ava', zone: 'playground', title: "Ava's secret invitation", subtitle: 'Read the letter. Find our meeting place.', icon: '💌', reward: 25, xp: 20, skill: 'READ', line: "You found the stars! I left a little letter for you. Read it to find our secret meeting place." },
  { id: 'story-lantern', npc: 'mrbooks', zone: 'library', title: 'Light the story lantern', subtitle: 'Listen, read, draw, and revisit one whole story.', icon: '🏮', reward: 40, xp: 25, skill: 'DISCOVER', line: "Our lantern glows with stories. Explore a story's first four steps and hear it three times. Then its words will be yours!" },
  { id: 'friendly-voice', npc: 'harper', zone: 'teacher', title: 'An invitation in your voice', subtitle: 'Tell your friend two lines from our invitation.', icon: '🎤', reward: 35, xp: 25, skill: 'SPEAK', line: "Your ears have collected a story! Now let's invite our friends. Listen to each line, then say it in your own voice." },
  { id: 'festival-card', npc: 'ava', zone: 'playground', title: 'Your festival invitation', subtitle: 'Write your own invitation. Bring everyone together!', icon: '✉️', reward: 50, xp: 30, skill: 'WRITE', line: "One last thing! Write an invitation for our friends. Tell them to come and play at the school festival." },
] as const;
export type FestivalQuestId = typeof FESTIVAL_QUESTS[number]['id'];
export const STAR_PARCELS = [
  { id: 'parcel-sun', pos: [5, 7] as [number, number], word: 'sun', clue: 'Find the sun. It is bright and warm.', options: ['🌙', '☀️', '☁️'], answer: '☀️' },
  { id: 'parcel-book', pos: [-6, 13] as [number, number], word: 'book', clue: 'Find the book. Open it and read a story.', options: ['🧸', '🍎', '📖'], answer: '📖' },
  { id: 'parcel-ball', pos: [11, -1] as [number, number], word: 'ball', clue: 'Find the ball. It is round. We can play with it.', options: ['⚽', '✏️', '🌻'], answer: '⚽' },
] as const;
export const FESTIVAL_SHOP: readonly { id: CharacterAccessory; label: string; icon: string; cost: number }[] = [
  { id: 'star', label: 'Starlight pin', icon: '⭐', cost: 25 },
  { id: 'bow', label: 'Peach ribbon', icon: '🎀', cost: 35 },
  { id: 'flower', label: 'Daisy clip', icon: '🌼', cost: 45 },
  { id: 'glasses', label: 'Story glasses', icon: '👓', cost: 50 },
];
export function activeFestivalQuest(state: AdventureState) {
  return FESTIVAL_QUESTS.find((q) => !state.claimed.includes(q.id));
}
export function festivalQuestReady(state: AdventureState, id: string, storyReady: boolean): boolean {
  switch (id) {
    case 'lost-stars': return STAR_PARCELS.every((n) => state.collected.includes(n.id));
    case 'secret-letter': return state.tasks.includes('letter');
    case 'story-lantern': return storyReady;
    case 'friendly-voice': return state.tasks.includes('voice-0') && state.tasks.includes('voice-1') && storyReady;
    case 'festival-card': return state.tasks.includes('invitation') && storyReady;
    default: return false;
  }
}

/** 근접·정답·진행 순서를 모두 확인한다. 같은 물건과 보상은 중복 획득할 수 없다. */
export function collectParcel(state: AdventureState, id: string, answer: string, position: { x: number; z: number }): AdventureState {
  const node = STAR_PARCELS.find((n) => n.id === id);
  if (!node || activeFestivalQuest(state)?.id !== 'lost-stars' || state.collected.includes(id)) return state;
  if (Math.hypot(position.x - node.pos[0], position.z - node.pos[1]) > 3 || answer !== node.answer) return state;
  return { ...state, collected: [...state.collected, id] };
}
export function completeFestivalTask(state: AdventureState, task: string, answer: string, storyReady: boolean): AdventureState {
  const quest = activeFestivalQuest(state)?.id;
  const permitted = task === 'letter' && quest === 'secret-letter' && answer === 'library'
    || /^voice-[01]$/.test(task) && quest === 'friendly-voice' && storyReady && Number(answer) >= 0.4 && Number(answer) <= 1
    || task === 'invitation' && quest === 'festival-card' && storyReady && validInvitation(answer);
  if (!permitted || state.tasks.includes(task)) return state;
  return { ...state, tasks: [...state.tasks, task] };
}
export function validInvitation(text: string): boolean {
  const result = validateEnglishInput(text);
  const words = toWords(text);
  return result.ok && words.length >= 4 && words.some((w) => ['come', 'join', 'play'].includes(w)) && words.some((w) => ['festival', 'school', 'us', 'me', 'friends'].includes(w));
}
export function claimFestivalQuest(state: AdventureState, id: string, storyReady: boolean, zone: string | null): AdventureState {
  const quest = activeFestivalQuest(state);
  if (!quest || quest.id !== id || quest.zone !== zone || !festivalQuestReady(state, id, storyReady)) return state;
  return { ...state, claimed: [...state.claimed, id], tokens: state.tokens + quest.reward };
}
export function buyFestivalItem(state: AdventureState, id: CharacterAccessory): AdventureState {
  const item = FESTIVAL_SHOP.find((i) => i.id === id);
  if (!item || (!state.owned.includes(id) && state.tokens < item.cost)) return state;
  const owned = state.owned.includes(id);
  return { ...state, tokens: state.tokens - (owned ? 0 : item.cost), owned: owned ? state.owned : [...state.owned, id], equipped: id };
}
export const INVITATION_LINES = ['Come and play with us!', 'See you at the school festival!'] as const;
export { speechAccuracy };

export function storyOutputReady(stories: Record<string, StoryProgress>): boolean {
  return Object.values(stories).some((progress) => isStepAvailable(progress, 'useIt'));
}
