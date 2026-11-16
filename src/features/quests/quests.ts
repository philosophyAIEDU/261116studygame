import type { Mbti, StoryStep } from '@/types';
import type { Overlay } from '@/app/uiStore';
import type { SaveData } from '@/save/schema';
import type { StoryPack } from '@/content/loader';
import { emptyStoryProgress, isStoryComplete, isUseItUnlocked, nextStep } from '@/features/story/unlock';
import { currentStage, graduationCheck, playerLevel } from '@/features/progression/lifeStages';
import { skillLock } from '@/features/progression/skillUnlock';
import { dueCards } from '@/features/dictionary/srs';
import { learningStyle } from '@/features/mbti/style';

// 퀘스트 로그 (순수 함수): 세이브 상태에서 "지금 할 일"을 계산한다.
//  메인 = 이야기 5단계 + 졸업 / 서브 = 스킬 연습·복습 / 일일 = 오늘의 체크리스트

export interface Quest {
  id: string;
  kind: 'main' | 'sub' | 'daily';
  icon: string;
  title: string;
  detail: string;
  /** 이 퀘스트를 하러 가는 장소 */
  zoneId: string;
  overlay: Overlay | null;
  done: boolean;
  locked: boolean;
}

const STEP_TITLE: Record<StoryStep, string> = {
  look: 'Look & Listen', read: 'Read Along', dict: 'My Picture Dictionary', bedtime: 'Bedtime Listening', useIt: 'Use It!',
};

/** 지금 진행할 이야기: 추천 순서에서 아직 끝내지 않은 첫 이야기 */
export function currentStoryPack(save: SaveData, packs: readonly StoryPack[]): StoryPack | undefined {
  return packs.find((p) => !isStoryComplete(save.stories[p.meta.id] ?? emptyStoryProgress()));
}

export function buildQuests(save: SaveData, packs: readonly StoryPack[], today: string): Quest[] {
  const quests: Quest[] = [];
  const pack = currentStoryPack(save, packs);

  if (pack) {
    const p = save.stories[pack.meta.id] ?? emptyStoryProgress();
    const step = nextStep(p) ?? 'look';
    const waiting = step === 'useIt' && !isUseItUnlocked(p);
    quests.push({
      id: `story-${pack.meta.id}`, kind: 'main', icon: pack.meta.cover, title: pack.meta.title,
      detail: waiting ? `Listen again! 👂 ${p.listenCount}/3` : STEP_TITLE[step],
      zoneId: step === 'bedtime' ? 'home' : 'classroom', overlay: { type: 'story', packId: pack.meta.id }, done: false, locked: false,
    });
  } else {
    quests.push({
      id: 'story-again', kind: 'main', icon: '🌊', title: 'Deep Listener', detail: 'Listen to your favorite story again.',
      zoneId: 'classroom', overlay: { type: 'storyList' }, done: false, locked: false,
    });
  }

  const stage = currentStage(save.graduated);
  const grad = graduationCheck(save.xp, save.graduated, save.input.totalSeconds);
  if (stage.inputHoursGoal !== null) {
    const hours = Math.floor(save.input.totalSeconds / 360) / 10;
    quests.push({
      id: 'graduation', kind: 'main', icon: '🎓', title: `${stage.label} Graduation`,
      detail: `Lv ${playerLevel(save.xp, save.graduated).level}/${grad.needLevel} · 👂 ${hours}/${grad.needHours}h`,
      zoneId: 'teacher', overlay: grad.canTakeExam ? { type: 'exam' } : null, done: false, locked: !grad.canTakeExam,
    });
  } else if (!save.career) {
    quests.push({ id: 'career', kind: 'main', icon: '💼', title: 'Choose your job', detail: 'What do you want to be?', zoneId: 'teacher', overlay: { type: 'career' }, done: false, locked: false });
  }

  const facts = { listeningDone: save.skills.listening.done, readingDone: save.skills.reading.done, speakingDone: save.skills.speaking.done, inputSeconds: save.input.totalSeconds };
  const skills = [
    { skill: 'listening' as const, icon: '🎧', title: 'Listening practice', zoneId: 'music' },
    { skill: 'reading' as const, icon: '📖', title: 'Reading practice', zoneId: 'classroom' },
    { skill: 'speaking' as const, icon: '🎤', title: 'Speaking practice', zoneId: 'playground' },
    { skill: 'writing' as const, icon: '✏️', title: 'Writing practice', zoneId: 'library' },
  ];
  for (const s of skills) {
    const lock = skillLock(s.skill, facts);
    quests.push({
      id: `skill-${s.skill}`, kind: 'sub', icon: s.icon, title: s.title, detail: lock.unlocked ? `Done ${save.skills[s.skill].done} times` : lock.hint,
      zoneId: s.zoneId, overlay: lock.unlocked ? { type: 'skills', skill: s.skill } : null, done: false, locked: !lock.unlocked,
    });
  }
  quests.push({ id: 'real-talk', kind: 'sub', icon: '⚡', title: 'Real Talk', detail: 'Catch the words in a fast chat.', zoneId: 'cafeteria', overlay: { type: 'realTalk' }, done: save.badges.includes('real-talk'), locked: false });

  const daily = save.daily.day === today ? save.daily : { listens: 0, words: 0 };
  const bedtimeToday = save.input.bedtimeDay === today ? save.input.bedtimeSeconds : 0;
  const due = dueCards(Object.values(save.dictionary), today).length;
  quests.push(
    { id: 'daily-listen', kind: 'daily', icon: '👂', title: 'Listen to a story', detail: `${Math.min(1, daily.listens)}/1`, zoneId: 'classroom', overlay: { type: 'storyList' }, done: daily.listens >= 1, locked: false },
    { id: 'daily-word', kind: 'daily', icon: '🖍️', title: 'Add a word to your dictionary', detail: `${Math.min(1, daily.words)}/1`, zoneId: 'classroom', overlay: { type: 'storyList' }, done: daily.words >= 1, locked: false },
    { id: 'daily-bedtime', kind: 'daily', icon: '🌙', title: 'Bedtime Listening, 10 minutes', detail: `${Math.min(10, Math.floor(bedtimeToday / 60))}/10 min`, zoneId: 'home', overlay: { type: 'bedtime' }, done: bedtimeToday >= 600, locked: false },
  );
  if (Object.keys(save.dictionary).length > 0) {
    quests.push({ id: 'daily-review', kind: 'daily', icon: '🃏', title: 'Review my picture cards', detail: due > 0 ? `${due} cards` : 'All done!', zoneId: 'library', overlay: { type: 'bag', tab: 'dictionary' }, done: due === 0, locked: false });
  }
  return quests;
}

/** J 성향용 주간 듣기 계획: 졸업 목표까지 남은 시간을 하루 20분으로 나눈다. */
export function listeningPlan(save: SaveData): { minutesPerDay: number; daysLeft: number; hoursLeft: number } | null {
  const goal = currentStage(save.graduated).inputHoursGoal;
  if (goal === null) return null;
  const left = Math.max(0, goal * 3600 - save.input.totalSeconds);
  return { minutesPerDay: 20, daysLeft: Math.ceil(left / (20 * 60)), hoursLeft: Math.round((left / 3600) * 10) / 10 };
}

/** 퀘스트 로그를 어떻게 보여줄지: J 는 체크리스트·계획표 먼저, P 는 탐험(깜짝 이벤트) */
export function questStyle(mbti: Mbti | null): { checklistFirst: boolean; surpriseEvents: boolean } {
  const plan = mbti ? learningStyle(mbti).planning === 'plan' : true;
  return { checklistFirst: plan, surpriseEvents: !plan };
}

/** ❗ 표시를 띄울 장소들 (할 수 있는 메인 퀘스트가 있는 곳) */
export function questZones(quests: readonly Quest[]): string[] {
  return [...new Set(quests.filter((q) => q.kind === 'main' && !q.locked && !q.done).map((q) => q.zoneId))];
}
