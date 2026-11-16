import type { Skill, Tier } from '@/types';
import type { StoryPack } from '@/content/loader';

// 스킬 연습 문제 만들기 (순수 함수, 시드 고정 → 같은 시드면 같은 문제).
// 문제는 모두 이야기 팩에서 만든다. 보기는 그림 또는 쉬운 영어뿐이고 한국어 보기는 없다.
//
//  듣기  1 단어 듣고 그림 고르기 → 2 문장 듣고 장면 고르기 → 3 이야기 듣고 순서 맞추기 → 4·5 Native 속도 대화에서 들린 단어 고르기
//  읽기  1 문장 읽고 장면 고르기 → 2 쉬운 영어 설명 읽고 단어 고르기 → 3~5 여러 문장 읽고 장면 고르기
//  말하기 1 따라 말하기 → 2 쉐도잉 → 3 그림 보고 묘사하기 → 4·5 표현을 써서 NPC 와 롤플레이(Talk Time)
//  쓰기  1 그림 보고 단어 쓰기 → 2 문장 바꿔 쓰기 → 3 그림 일기 → 4 이야기 이어 쓰기 → 5 이메일·에세이 (4·5 만 AI 첨삭)

export type Exercise =
  | { type: 'wordPicture'; packId: string; word: string; options: string[]; answer: string }
  | { type: 'sentenceScene'; mode: 'listen' | 'read'; packId: string; sentenceIds: string[]; options: string[]; answer: string }
  | { type: 'definition'; packId: string; easyEnglish: string; options: string[]; answer: string }
  | { type: 'sceneOrder'; packId: string; sentenceIds: string[]; options: string[]; answer: string[] }
  | { type: 'keyWords'; packId: string; sentenceIds: string[]; options: string[]; answers: string[] }
  | { type: 'echo'; mode: 'echo' | 'shadow'; packId: string; sentenceId: string }
  | { type: 'describe'; packId: string; sceneId: string; targetWords: string[] }
  | { type: 'roleplay'; packId: string }
  | { type: 'pictureWord'; packId: string; word: string; emoji: string }
  | { type: 'rewrite'; packId: string; sentenceId: string }
  | { type: 'diary' }
  | { type: 'continue'; packId: string; sentenceId: string }
  | { type: 'email'; prompt: string };

/** 시드 고정 난수 (mulberry32) */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

function pick<T>(items: readonly T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length)] as T;
}

const STOP = new Set('the a an and or but is are was were am be to of in on at it he she they we you i her his its my your with for by from this that not no do does did has have had can will so very too up down out into then there here as go goes'.split(' '));

/** 문장에서 "내용어"만 뽑는다 (Real Talk·듣기 4~5단계의 정답 단어). */
export function contentWords(text: string): string[] {
  const words = text.toLowerCase().replace(/[^a-z' ]+/g, ' ').split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w) && !w.includes("'"));
  return [...new Set(words)];
}

const EMAIL_PROMPTS = [
  'Write an email to your teacher. Say thank you for a good class.',
  'Write an email to a friend. Invite them to your birthday party.',
  'Write a short essay: What job do you want, and why?',
  'Write an email to a new co-worker. Say hello and offer help.',
];

export function makeExercise(skill: Skill, tier: Tier, packs: readonly StoryPack[], rand: () => number): Exercise {
  const pack = pick(packs, rand);
  const story = pack.story;
  const packId = pack.meta.id;
  const allEmoji = [...new Set(packs.flatMap((p) => p.story.words.map((w) => w.emoji)))];
  const allWords = [...new Set(packs.flatMap((p) => p.story.words.map((w) => w.word)))];
  const sceneOptions = (answer: string, n: number) => shuffled([answer, ...shuffled(story.scenes.map((s) => s.id).filter((id) => id !== answer), rand).slice(0, n - 1)], rand);

  const sentenceScene = (mode: 'listen' | 'read', many: boolean): Exercise => {
    const scene = pick(story.scenes, rand);
    const inScene = story.sentences.filter((s) => s.sceneId === scene.id);
    const ids = many ? inScene.slice(0, 3).map((s) => s.id) : [pick(inScene, rand).id];
    return { type: 'sentenceScene', mode, packId, sentenceIds: ids, options: sceneOptions(scene.id, 3), answer: scene.id };
  };
  const keyWords = (count: number): Exercise => {
    const start = Math.floor(rand() * Math.max(1, story.sentences.length - count));
    const lines = story.sentences.slice(start, start + count);
    const answers = shuffled([...new Set(lines.flatMap((s) => contentWords(s.text)))], rand).slice(0, 3);
    const heard = new Set(lines.flatMap((s) => contentWords(s.text)));
    const distractors = shuffled(allWords.map((w) => w.split(' ')[0] as string).filter((w) => !heard.has(w)), rand).slice(0, 3);
    return { type: 'keyWords', packId, sentenceIds: lines.map((s) => s.id), options: shuffled([...answers, ...distractors], rand), answers };
  };

  switch (skill) {
    case 'listening': {
      if (tier === 1) {
        const word = pick(story.words, rand);
        const options = shuffled([word.emoji, ...shuffled(allEmoji.filter((e) => e !== word.emoji), rand).slice(0, 3)], rand);
        return { type: 'wordPicture', packId, word: word.word, options, answer: word.emoji };
      }
      if (tier === 2) return sentenceScene('listen', false);
      if (tier === 3) {
        // 서로 다른 장면의 문장 3개를 이야기 순서대로 들려주고, 장면 그림을 순서대로 고르게 한다.
        const scenes = shuffled(story.scenes, rand).slice(0, 3).sort((a, b) => a.id.localeCompare(b.id));
        const lines = scenes.map((sc) => story.sentences.find((s) => s.sceneId === sc.id)?.id ?? '');
        return { type: 'sceneOrder', packId, sentenceIds: lines, options: shuffled(scenes.map((s) => s.id), rand), answer: scenes.map((s) => s.id) };
      }
      return keyWords(tier === 4 ? 2 : 3);
    }
    case 'reading': {
      if (tier === 1) return sentenceScene('read', false);
      if (tier === 2) {
        const word = pick(story.words, rand);
        const options = shuffled([word.word, ...shuffled(allWords.filter((w) => w !== word.word), rand).slice(0, 3)], rand);
        return { type: 'definition', packId, easyEnglish: word.easyEnglish, options, answer: word.word };
      }
      return sentenceScene('read', true);
    }
    case 'speaking': {
      if (tier <= 2) return { type: 'echo', mode: tier === 1 ? 'echo' : 'shadow', packId, sentenceId: pick(story.sentences.filter((s) => s.speaker !== 'narrator'), rand).id };
      if (tier === 3) {
        const scene = pick(story.scenes, rand);
        return { type: 'describe', packId, sceneId: scene.id, targetWords: scene.objects.map((o) => o.word) };
      }
      return { type: 'roleplay', packId };
    }
    case 'writing': {
      if (tier === 1) {
        const word = pick(story.words.filter((w) => !w.word.includes(' ')), rand);
        return { type: 'pictureWord', packId, word: word.word, emoji: word.emoji };
      }
      if (tier === 2) return { type: 'rewrite', packId, sentenceId: pick(story.sentences.filter((s) => s.text.split(' ').length >= 4), rand).id };
      if (tier === 3) return { type: 'diary' };
      if (tier === 4) return { type: 'continue', packId, sentenceId: story.sentences[story.sentences.length - 1]?.id ?? 's001' };
      return { type: 'email', prompt: pick(EMAIL_PROMPTS, rand) };
    }
  }
}

/** 한 번의 연습 세트. 쓰기 3~5단계와 롤플레이는 길어서 1문제, 나머지는 여러 문제. */
export function makeSet(skill: Skill, tier: Tier, packs: readonly StoryPack[], seed: number): Exercise[] {
  const rand = rng(seed);
  const long = (skill === 'writing' && tier >= 3) || (skill === 'speaking' && tier >= 4);
  const count = long ? 1 : skill === 'speaking' ? 3 : skill === 'writing' ? 3 : 5;
  return Array.from({ length: count }, () => makeExercise(skill, tier, packs, rand));
}

// ── 쓰기 채점 (기기 안에서) ────────────────────────────────────
/** 그림 보고 단어 쓰기: 철자가 얼마나 가까운가 (0~1) */
export function spellingScore(target: string, typed: string): number {
  const a = target.toLowerCase().trim();
  const b = typed.toLowerCase().trim();
  if (a === b) return 1;
  if (b.length === 0) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0] as number;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j] as number;
      prev[j] = Math.min((prev[j] as number) + 1, (prev[j - 1] as number) + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return Math.max(0, Math.round((1 - (prev[b.length] as number) / a.length) * 100) / 100);
}

/** 문장 바꿔 쓰기: 원래 문장의 틀을 살리되 한두 단어를 바꿨을 때 만점. 그대로 베끼면 0.6. */
export function rewriteScore(original: string, written: string): number {
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z' ]+/g, ' ').split(/\s+/).filter(Boolean);
  const a = norm(original);
  const b = norm(written);
  if (b.length < 2) return 0.4;
  const same = a.filter((w) => b.includes(w)).length / Math.max(a.length, 1);
  if (a.join(' ') === b.join(' ')) return 0.6;
  if (same >= 0.4) return 1;
  return 0.7;
}
