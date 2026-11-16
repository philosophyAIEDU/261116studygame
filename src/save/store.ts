import { answerPlacement, startWordMission, answerWordMission, continueWordMission, claimWordMission, buyWordItem } from '@/features/vocabulary/rules';
import type { VocabularyState } from '@/features/vocabulary/rules';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CareerId, DayPhase, DictKind, LifeStage, Profile, Speed, StoryStep, Tier } from '@/types';
import { calcXp, deepListenerBonus, DICT_XP, mbtiBonus, storyListenXp, type XpInput } from '@/features/progression/xp';
import { playerLevel, gradeForLevel, currentStage } from '@/features/progression/lifeStages';
import { addBedtimeSeconds } from '@/features/progression/inputHours';
import { localDayKey, touchStreak } from '@/features/progression/time';
import { computeBadges } from '@/features/progression/badges';
import { emptyStoryProgress, isDictStepDone, isStepAvailable, upgradeMedal, type StoryProgress } from '@/features/story/unlock';
import { newCard, reviewCard } from '@/features/dictionary/srs';
import type { ModelKey } from '@/config/geminiLimits';
import { CURRENT_SCHEMA_VERSION, defaultSave, type SaveData, type Settings } from './schema';
import { migrateSave } from './migrations';

import { activeFestivalQuest, buyFestivalItem, claimFestivalQuest, collectParcel, completeFestivalTask, storyOutputReady } from '@/features/adventure/rules';
import type { CharacterAccessory } from '@/config/characters';

// 게임 상태 저장소(Zustand + localStorage).
// 규칙 계산은 모두 features/ 의 순수 함수가 하고, 여기서는 그 결과를 상태에 반영만 한다.

export type GameFx =
  | { kind: 'xp'; amount: number }
  | { kind: 'levelUp'; level: number; grade: number | null; gradeUp: boolean }
  | { kind: 'badge'; id: string }
  | { kind: 'questDone'; title: string };

interface GameState {
  save: SaveData;
  /** 화면 연출용 이벤트 큐 (저장하지 않음) */
  fx: GameFx[];
  shiftFx: () => void;
  pushFx: (fx: GameFx) => void;

  vocabularyPlacementAnswer: (picked: string, heard: string) => void;
  vocabularyStart: (seed: number, review?: boolean) => void;
  vocabularyBuy: (id: CharacterAccessory) => void;
  vocabularyAnswer: (picked: string, heard: string) => void;
  vocabularyContinue: () => void;
  vocabularyClaim: () => void;
  vocabularyVoice: (uri: string) => void;
  vocabularyLook: (look: VocabularyState['look']) => void;
  vocabularyRetest: () => void;
  beginAdventure: () => void;
  collectAdventureParcel: (id: string, answer: string, position: { x: number; z: number }) => boolean;
  finishAdventureTask: (task: string, answer: string) => boolean;
  claimAdventureQuest: (id: string, zone: string | null) => boolean;
  buyAdventureItem: (id: CharacterAccessory) => boolean;
  createProfile: (p: Profile) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  setFlag: (flag: 'guardianIntroSeen' | 'prologueSeen') => void;
  patchSettings: (patch: Partial<Settings>) => void;
  setVolume: (channel: 'bgm' | 'sfx' | 'voice', value: number) => void;

  awardXp: (amount: number) => void;
  skillDone: (input: Omit<XpInput, 'mbti' | 'streakDays'>) => number;
  touchToday: () => void;

  storyProgress: (packId: string) => StoryProgress;
  completeStep: (packId: string, step: StoryStep, storyWordCount?: number) => boolean;
  recordListen: (packId: string, speed: Speed, tier: Tier, silent?: boolean) => number;
  collectPhrase: (packId: string, phrase: string) => void;

  addDictCard: (args: { word: string; packId: string; kind: DictKind; value: string }) => void;
  reviewDictCard: (word: string, correct: boolean) => void;

  addInputSeconds: (seconds: number) => void;
  addBedtimeSeconds: (seconds: number) => void;

  countGeminiCall: (model: ModelKey, pacificDay: string) => void;
  patchGemini: (patch: Partial<SaveData['gemini']>) => void;
  startTalkSession: () => void;
  recordTalkTurn: (phrasesUsed: number) => void;
  recordWriting: () => void;

  setPhase: (phase: DayPhase) => void;
  advanceActivity: () => void;
  newDay: () => void;

  earnBadge: (id: string) => void;
  graduate: (stage: LifeStage) => void;
  setCareer: (career: CareerId) => void;

  replaceSave: (raw: unknown) => void;
  resetSave: () => void;
}

/** 활동 횟수에 따라 게임 속 하루가 흘러간다: 아침 → 낮 → 노을 → 밤. */
export function phaseForActivities(n: number): DayPhase {
  if (n >= 5) return 'night';
  if (n >= 4) return 'sunset';
  if (n >= 2) return 'day';
  return 'morning';
}

function refreshBadges(save: SaveData): { save: SaveData; gained: string[] } {
  const cards = Object.values(save.dictionary);
  const stories = Object.values(save.stories);
  const badges = computeBadges({
    inputSeconds: save.input.totalSeconds,
    drawings: cards.filter((c) => c.kind === 'drawing').length,
    maxListenCount: stories.reduce((m, s) => Math.max(m, s.listenCount), 0),
    hasGoldMedal: stories.some((s) => s.medal === 'gold'),
    phraseUses: save.talk.phraseUses,
    talksDone: save.talk.totalSessions,
    streakDays: save.streak.days,
    graduated: save.graduated,
    owned: save.badges,
  });
  const gained = badges.filter((b) => !save.badges.includes(b));
  return { save: gained.length ? { ...save, badges } : save, gained };
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => {
      /** 상태를 바꾸고, 레벨업·배지 연출 이벤트를 자동으로 만든다. */
      const apply = (fn: (s: SaveData) => SaveData, extraFx: GameFx[] = []) => {
        const before = get().save;
        const changed = fn(before);
        const { save, gained } = refreshBadges(changed);
        const fx: GameFx[] = [...extraFx];
        const lvBefore = playerLevel(before.xp, before.graduated).level;
        const lvAfter = playerLevel(save.xp, save.graduated).level;
        if (lvAfter > lvBefore) {
          const stage = currentStage(save.graduated).id;
          const g0 = stage === 'elementary' ? gradeForLevel(lvBefore) : null;
          const g1 = stage === 'elementary' ? gradeForLevel(lvAfter) : null;
          fx.push({ kind: 'levelUp', level: lvAfter, grade: g1, gradeUp: g0 !== null && g1 !== null && g1 > g0 });
        }
        for (const id of gained) fx.push({ kind: 'badge', id });
        set((state) => ({ save, fx: [...state.fx, ...fx] }));
      };

      const withStory = (s: SaveData, packId: string, fn: (p: StoryProgress) => StoryProgress): SaveData => ({
        ...s,
        stories: { ...s.stories, [packId]: fn(s.stories[packId] ?? emptyStoryProgress()) },
      });

      const today = () => localDayKey(new Date());
      /** 오늘의 퀘스트 카운터 올리기 (날짜가 바뀌면 0부터) */
      const bumpDaily = (s: SaveData, key: 'listens' | 'words'): SaveData['daily'] => {
        const base = s.daily.day === today() ? s.daily : { day: today(), listens: 0, words: 0 };
        return { ...base, [key]: base[key] + 1 };
      };

      return {
        save: defaultSave(),
        fx: [],
        shiftFx: () => set((s) => ({ fx: s.fx.slice(1) })),
        pushFx: (fx) => set((s) => ({ fx: [...s.fx, fx] })),

        vocabularyPlacementAnswer: (picked, heard) => apply((s) => ({ ...s, vocabulary: answerPlacement(s.vocabulary, picked, heard) })),
        vocabularyStart: (seed, review = false) => apply((s) => ({ ...s, vocabulary: startWordMission(s.vocabulary, Date.now(), seed, review) })),
        vocabularyBuy: (id) => apply((s) => ({ ...s, vocabulary: buyWordItem(s.vocabulary, id) })),
        vocabularyAnswer: (picked, heard) => apply((s) => ({ ...s, vocabulary: answerWordMission(s.vocabulary, picked, heard, Date.now()) })),
        vocabularyContinue: () => apply((s) => ({ ...s, vocabulary: continueWordMission(s.vocabulary) })),
        vocabularyClaim: () => apply((s) => ({ ...s, vocabulary: claimWordMission(s.vocabulary) })),
        vocabularyVoice: (uri) => apply((s) => ({ ...s, vocabulary: { ...s.vocabulary, voiceURI: uri } })),
        vocabularyLook: (look) => apply((s) => ({ ...s, vocabulary: { ...s.vocabulary, look } })),
        vocabularyRetest: () => apply((s) => s.vocabulary.mission && !s.vocabulary.mission.claimed ? s : ({ ...s, vocabulary: { ...s.vocabulary, placement: null, assessment: [], recentScores: [] } })),
        beginAdventure: () => apply((s) => ({ ...s, adventure: { ...s.adventure, started: true } })),
        collectAdventureParcel: (id, answer, position) => {
          const prev = get().save.adventure;
          const next = collectParcel(prev, id, answer, position);
          if (next === prev) return false;
          apply((s) => ({ ...s, adventure: next }));
          return true;
        },
        finishAdventureTask: (task, answer) => {
          const prev = get().save;
          const next = completeFestivalTask(prev.adventure, task, answer, storyOutputReady(prev.stories));
          if (next === prev.adventure) return false;
          apply((s) => ({ ...s, adventure: next }));
          return true;
        },
        claimAdventureQuest: (id, zone) => {
          const prev = get().save;
          const quest = activeFestivalQuest(prev.adventure);
          const next = claimFestivalQuest(prev.adventure, id, storyOutputReady(prev.stories), zone);
          if (next === prev.adventure || !quest) return false;
          const finished = next.claimed.length === 5;
          apply((s) => ({ ...s, adventure: next, xp: s.xp + quest.xp,
            badges: finished ? [...new Set([...s.badges, 'festival-friend'])] : s.badges,
            output: { ...s.output, spokenTurns: s.output.spokenTurns + (id === 'friendly-voice' ? 2 : 0), writtenPieces: s.output.writtenPieces + (id === 'festival-card' ? 1 : 0) },
          }), [{ kind: 'questDone', title: quest.title }, { kind: 'xp', amount: quest.xp }]);
          return true;
        },
        buyAdventureItem: (id) => {
          const prev = get().save.adventure;
          const next = buyFestivalItem(prev, id);
          if (prev === next) return false;
          apply((s) => ({ ...s, adventure: next }));
          return true;
        },
        createProfile: (p) => apply((s) => ({ ...s, profile: p })),
        updateProfile: (patch) => apply((s) => (s.profile ? { ...s, profile: { ...s.profile, ...patch } } : s)),
        setFlag: (flag) => apply((s) => ({ ...s, [flag]: true })),
        patchSettings: (patch) => apply((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
        setVolume: (channel, value) =>
          apply((s) => ({ ...s, settings: { ...s.settings, volume: { ...s.settings.volume, [channel]: Math.max(0, Math.min(1, value)) } } })),

        awardXp: (amount) => {
          if (amount <= 0) return;
          apply((s) => ({ ...s, xp: s.xp + Math.round(amount), streak: touchStreak(s.streak, today()) }), [{ kind: 'xp', amount: Math.round(amount) }]);
        },

        skillDone: (input) => {
          const s0 = get().save;
          const mbti = s0.profile?.mbti ?? null;
          const xp = calcXp({ ...input, mbti, streakDays: s0.streak.days });
          const opposite = mbtiBonus(mbti, input.skill).opposite;
          apply(
            (s) => ({
              ...s,
              xp: s.xp + xp,
              streak: touchStreak(s.streak, today()),
              skills: { ...s.skills, [input.skill]: { done: s.skills[input.skill].done + 1 } },
              badges: opposite && !s.badges.includes('comfort-zone') ? [...s.badges, 'comfort-zone'] : s.badges,
              output: input.skill === 'writing' ? { ...s.output, writtenPieces: s.output.writtenPieces + 1 } : s.output,
            }),
            [{ kind: 'xp', amount: xp }, ...(opposite && !s0.badges.includes('comfort-zone') ? [{ kind: 'badge', id: 'comfort-zone' } as GameFx] : [])],
          );
          get().advanceActivity();
          return xp;
        },

        touchToday: () => apply((s) => ({ ...s, streak: touchStreak(s.streak, today()) })),

        storyProgress: (packId) => get().save.stories[packId] ?? emptyStoryProgress(),

        completeStep: (packId, step, storyWordCount = 99) => {
          const p = get().storyProgress(packId);
          // 순서를 건너뛸 수 없다: 앞 단계가 끝나지 않았으면 거절한다.
          if (!isStepAvailable(p, step)) return false;
          if (step === 'dict' && !isDictStepDone(p.dictWords.length, storyWordCount)) return false;
          if (p.steps[step]) return true;
          apply((s) => withStory(s, packId, (sp) => ({ ...sp, steps: { ...sp.steps, [step]: true } })));
          get().advanceActivity();
          return true;
        },

        recordListen: (packId, speed, tier, silent = false) => {
          const s0 = get().save;
          const count = (s0.stories[packId]?.listenCount ?? 0) + 1;
          // silent(Bedtime): 시간 기반 XP 를 따로 받으므로 여기서는 반복 보너스만 조용히 준다.
          const xp = silent
            ? deepListenerBonus(count)
            : storyListenXp({ tier, speed, mbti: s0.profile?.mbti ?? null, streakDays: s0.streak.days, listenCountAfter: count });
          apply(
            (s) => ({
              ...withStory(s, packId, (sp) => ({ ...sp, listenCount: count, medal: upgradeMedal(sp.medal, speed) })),
              xp: s.xp + xp,
              daily: bumpDaily(s, 'listens'),
              streak: touchStreak(s.streak, today()),
              skills: { ...s.skills, listening: { done: s.skills.listening.done + 1 } },
            }),
            silent || xp <= 0 ? [] : [{ kind: 'xp', amount: xp }],
          );
          return xp;
        },

        collectPhrase: (packId, phrase) =>
          apply((s) => withStory(s, packId, (sp) => (sp.phrases.includes(phrase) ? sp : { ...sp, phrases: [...sp.phrases, phrase] }))),

        addDictCard: ({ word, packId, kind, value }) => {
          const key = word.toLowerCase();
          const isNew = !get().save.dictionary[key];
          const xp = isNew ? DICT_XP[kind] : 0;
          apply(
            (s) => {
              const prev = s.dictionary[key];
              const card = prev ? { ...prev, kind, value, packId } : newCard({ word: key, packId, kind, value, today: today(), now: Date.now() });
              const next = withStory(s, packId, (sp) => (sp.dictWords.includes(key) ? sp : { ...sp, dictWords: [...sp.dictWords, key] }));
              return { ...next, dictionary: { ...s.dictionary, [key]: card }, xp: s.xp + xp, daily: isNew ? bumpDaily(s, 'words') : s.daily };
            },
            xp ? [{ kind: 'xp', amount: xp }] : [],
          );
        },

        reviewDictCard: (word, correct) =>
          apply((s) => {
            const card = s.dictionary[word];
            return card ? { ...s, dictionary: { ...s.dictionary, [word]: reviewCard(card, correct, today()) } } : s;
          }),

        addInputSeconds: (seconds) => apply((s) => ({ ...s, input: { ...s.input, totalSeconds: s.input.totalSeconds + Math.max(0, seconds) } })),

        addBedtimeSeconds: (seconds) => {
          const s0 = get().save;
          const award = addBedtimeSeconds({ day: s0.input.bedtimeDay, seconds: s0.input.bedtimeSeconds }, today(), seconds);
          apply(
            (s) => ({
              ...s,
              xp: s.xp + award.xp,
              streak: award.xp > 0 ? touchStreak(s.streak, today()) : s.streak,
              input: { ...s.input, bedtimeDay: award.ledger.day, bedtimeSeconds: award.ledger.seconds },
            }),
            // 수면용이므로 XP 팝업을 띄우지 않는다(조용히 쌓인다).
          );
        },

        countGeminiCall: (model, pacificDay) =>
          apply((s) => {
            const prev = s.gemini.usage[model];
            const count = prev.day === pacificDay ? prev.count + 1 : 1;
            return { ...s, gemini: { ...s.gemini, usage: { ...s.gemini.usage, [model]: { day: pacificDay, count } } } };
          }),
        patchGemini: (patch) => apply((s) => ({ ...s, gemini: { ...s.gemini, ...patch } })),

        startTalkSession: () =>
          apply((s) => {
            const sameDay = s.talk.day === today();
            return { ...s, talk: { ...s.talk, day: today(), sessionsToday: (sameDay ? s.talk.sessionsToday : 0) + 1, totalSessions: s.talk.totalSessions + 1 } };
          }),
        recordTalkTurn: (phrasesUsed) =>
          apply((s) => ({
            ...s,
            talk: { ...s.talk, phraseUses: s.talk.phraseUses + phrasesUsed },
            output: { ...s.output, spokenTurns: s.output.spokenTurns + 1 },
          })),
        recordWriting: () => apply((s) => ({ ...s, output: { ...s.output, writtenPieces: s.output.writtenPieces + 1 } })),

        setPhase: (phase) => apply((s) => ({ ...s, world: { ...s.world, phase } })),
        advanceActivity: () =>
          apply((s) => {
            if (s.world.phase === 'night') return s;
            const n = s.world.activitiesToday + 1;
            return { ...s, world: { activitiesToday: n, phase: phaseForActivities(n) } };
          }),
        newDay: () => apply((s) => ({ ...s, world: { activitiesToday: 0, phase: 'morning' } })),

        earnBadge: (id) => {
          if (get().save.badges.includes(id)) return;
          apply((s) => ({ ...s, badges: [...s.badges, id] }), [{ kind: 'badge', id }]);
        },
        graduate: (stage) => apply((s) => (s.graduated.includes(stage) ? s : { ...s, graduated: [...s.graduated, stage] })),
        setCareer: (career) => apply((s) => ({ ...s, career })),

        replaceSave: (raw) => set({ save: migrateSave(raw), fx: [] }),
        resetSave: () => set({ save: defaultSave(), fx: [] }),
      };
    },
    {
      name: 'asq-save',
      version: CURRENT_SCHEMA_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ save: state.save }),
      // 앱이 업데이트되어 스키마 버전이 올라가면 여기서 순차 마이그레이션이 실행된다.
      migrate: (persisted, version) => {
        const raw = (persisted as { save?: unknown } | undefined)?.save;
        return { save: migrateSave(raw, version) };
      },
      merge: (persisted, current) => {
        const raw = (persisted as { save?: unknown } | undefined)?.save;
        return { ...current, save: raw ? migrateSave(raw) : current.save };
      },
    },
  ),
);

/** 현재 레벨·단계를 한 번에 읽는 선택자 */
export function selectLevel(save: SaveData) {
  return playerLevel(save.xp, save.graduated);
}
