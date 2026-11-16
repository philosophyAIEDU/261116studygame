import { z } from 'zod';

// 콘텐츠 팩 스키마 (Zod). 앱과 scripts/ 양쪽에서 함께 쓴다 → 상대 경로 import 만 사용.
// 철학 1번: 한국어 필드는 존재하지 않으며, 어떤 문자열에도 한글이 있으면 검증에 실패한다.

const HANGUL = /[\u3131-\u318E\uAC00-\uD7A3]/;
const noHangul = (s: string) => !HANGUL.test(s);
const english = z.string().min(1).refine(noHangul, { message: 'Korean text is not allowed in learning content' });

export const SPEED_VALUES = ['slow', 'natural', 'native'] as const;
export const SPEAKERS = ['narrator', 'girl', 'boy', 'friend', 'teacher', 'woman', 'man', 'creature'] as const;
export const VOICE_STYLES = ['calm', 'warm', 'excited', 'whisper', 'sad', 'curious'] as const;
export const PLACES = ['classroom', 'cafeteria', 'playground', 'library', 'home', 'outside', 'party'] as const;

export const SENTENCE_ID = /^s\d{3}$/;

export const packMetaSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: english,
  stage: z.enum(['elementary', 'middle', 'high', 'college', 'career']),
  /** 난이도 단계 1~5 (XP 난이도배율에 사용) */
  level: z.number().int().min(1).max(5),
  /** 같은 단계 안에서의 기본 순서 */
  order: z.number().int().min(1),
  /** S/N 추천용: 일상 이야기 / 모험·상상 이야기 */
  theme: z.enum(['daily', 'adventure']),
  /** 팩 버전. 올리면 캐시된 오디오를 다시 받는다 */
  version: z.number().int().min(1),
  speeds: z.array(z.enum(SPEED_VALUES)).min(1),
  cover: z.string().min(1),
});

const sceneObjectSchema = z.object({
  word: english,
  emoji: z.string().min(1),
  /** 탭 영역 중심 좌표 (0~100 %) */
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  size: z.number().min(4).max(60).default(16),
});

const sceneSchema = z.object({
  id: z.string().regex(/^sc\d{2}$/),
  image: z.string().min(1),
  place: z.enum(PLACES),
  objects: z.array(sceneObjectSchema).default([]),
});

const sentenceSchema = z.object({
  id: z.string().regex(SENTENCE_ID),
  sceneId: z.string(),
  speaker: z.enum(SPEAKERS),
  voiceStyle: z.enum(VOICE_STYLES),
  text: english,
  /** Native 속도용 구어체 텍스트 (gonna, wanna …). 없으면 text 를 쓴다 */
  nativeText: english.optional(),
});

const wordSchema = z.object({
  word: english,
  /** 아주 쉬운 영어 설명 (예: "very, very big") */
  easyEnglish: english,
  imageKey: z.string().min(1),
  /** placeholder 그림 카드 */
  emoji: z.string().min(1),
});

/** 문장부호·대소문자를 무시하고 비교하기 위한 정규화 */
export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[\u2019\u0060]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export const storySchema = z
  .object({
    packId: z.string(),
    title: english,
    level: z.number().int().min(1).max(5),
    scenes: z.array(sceneSchema).min(1),
    sentences: z.array(sentenceSchema).min(1),
    words: z.array(wordSchema).min(1),
    phrasePocket: z.array(english).min(1).max(10),
    /** ⑤ Use It! 대화 설정 */
    talk: z.object({ npc: z.string().min(1), scene: english, opener: english }),
  })
  .superRefine((story, ctx) => {
    const sceneIds = new Set(story.scenes.map((s) => s.id));
    const seen = new Set<string>();
    for (const s of story.sentences) {
      if (seen.has(s.id)) ctx.addIssue({ code: 'custom', message: `duplicate sentence id ${s.id}` });
      seen.add(s.id);
      if (!sceneIds.has(s.sceneId)) ctx.addIssue({ code: 'custom', message: `sentence ${s.id} points to unknown scene ${s.sceneId}` });
    }
    for (const scene of story.scenes) {
      if (!story.sentences.some((s) => s.sceneId === scene.id)) ctx.addIssue({ code: 'custom', message: `scene ${scene.id} has no sentence` });
    }
    // 표현 주머니의 표현은 반드시 이야기 문장 안에 나와야 한다(책 속 표현이 말이 된다).
    const all = story.sentences.map((s) => normalizeText(s.text));
    for (const phrase of story.phrasePocket) {
      const p = normalizeText(phrase);
      if (!all.some((t) => t.includes(p))) ctx.addIssue({ code: 'custom', message: `phrase "${phrase}" does not appear in any sentence` });
    }
    // 사전 단어도 이야기 안에 있어야 "이야기 속 문장"을 보여줄 수 있다.
    for (const w of story.words) {
      const stem = normalizeText(w.word).split(' ')[0] ?? '';
      if (!all.some((t) => t.includes(stem.slice(0, Math.max(3, stem.length - 1))))) {
        ctx.addIssue({ code: 'custom', message: `word "${w.word}" does not appear in any sentence` });
      }
    }
  });

const timedWordSchema = z.object({ w: z.string(), start: z.number(), end: z.number() });

const manifestFileSchema = z.object({
  sentenceId: z.string(),
  speed: z.enum(SPEED_VALUES),
  duration: z.number().min(0),
  hash: z.string(),
  bytes: z.number().int().min(0),
  /** 선택: 단어 단위 하이라이트용 타임스탬프 (로컬 forced alignment 결과를 넣는 자리) */
  wordTimings: z.array(timedWordSchema).optional(),
});

export const manifestSchema = z.object({
  packId: z.string(),
  packVersion: z.number().int(),
  generatedAt: z.string(),
  /** 파일명 → 정보 (예: "s001.natural.mp3") */
  files: z.record(z.string(), manifestFileSchema),
  /** 단어 → 파일 정보 (words/{word}.mp3) */
  words: z.record(z.string(), z.object({ file: z.string(), duration: z.number(), hash: z.string(), bytes: z.number() })).default({}),
  /** Bedtime Listening 용 전체 낭독 */
  full: z
    .object({
      file: z.string(),
      duration: z.number(),
      hash: z.string(),
      bytes: z.number(),
      /** 문장 파일을 이어 붙여 스크립트가 만든 파일인가 */
      generated: z.boolean(),
      timestamps: z.array(z.object({ sentenceId: z.string(), start: z.number(), end: z.number() })),
    })
    .nullable()
    .default(null),
});

export type PackMeta = z.infer<typeof packMetaSchema>;
export type Story = z.infer<typeof storySchema>;
export type StoryScene = Story['scenes'][number];
export type StorySentence = Story['sentences'][number];
export type StoryWord = Story['words'][number];
export type AudioManifest = z.infer<typeof manifestSchema>;
