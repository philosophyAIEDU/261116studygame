import type { LifeStage, Mbti } from '@/types';
import { sortByTaste } from '@/features/mbti/style';
import { manifestSchema, packMetaSchema, storySchema, type AudioManifest, type PackMeta, type Story, type StorySentence, type StoryWord } from './schema';

// 콘텐츠 팩 로더.
// story.json / pack.json / audio-manifest.json 은 빌드 때 번들에 들어가고(작은 텍스트),
// 그림과 오디오는 `content/packs/<id>/…` 주소에서 필요할 때 내려받는다.

export interface StoryPack {
  meta: PackMeta;
  story: Story;
  manifest: AudioManifest | null;
  /** 팩 폴더 주소 (끝에 / 포함) */
  baseUrl: string;
}

const metaFiles = import.meta.glob<unknown>('/content/packs/*/pack.json', { eager: true, import: 'default' });
const storyFiles = import.meta.glob<unknown>('/content/packs/*/story.json', { eager: true, import: 'default' });
const manifestFiles = import.meta.glob<unknown>('/content/packs/*/audio-manifest.json', { eager: true, import: 'default' });

function folderOf(path: string): string {
  return path.split('/').slice(0, -1).join('/');
}

function buildPacks(): StoryPack[] {
  const packs: StoryPack[] = [];
  for (const [path, rawMeta] of Object.entries(metaFiles)) {
    const folder = folderOf(path);
    const meta = packMetaSchema.parse(rawMeta);
    const story = storySchema.parse(storyFiles[`${folder}/story.json`]);
    const rawManifest = manifestFiles[`${folder}/audio-manifest.json`];
    const manifest = rawManifest ? manifestSchema.parse(rawManifest) : null;
    packs.push({ meta, story, manifest, baseUrl: `${import.meta.env.BASE_URL}content/packs/${meta.id}/` });
  }
  return packs.sort((a, b) => a.meta.order - b.meta.order);
}

export const ALL_PACKS: readonly StoryPack[] = buildPacks();

export function getPack(id: string): StoryPack | undefined {
  return ALL_PACKS.find((p) => p.meta.id === id);
}

/** 현재 단계의 이야기. 그 단계의 팩이 아직 없으면(콘텐츠 추가 전) 전체 팩을 돌려준다. */
export function packsForStage(stage: LifeStage): StoryPack[] {
  const own = ALL_PACKS.filter((p) => p.meta.stage === stage);
  return own.length > 0 ? own : [...ALL_PACKS];
}

/** MBTI 취향(S/N)에 맞춘 추천 순서 */
export function recommendedPacks(stage: LifeStage, mbti: Mbti | null): StoryPack[] {
  const packs = packsForStage(stage).map((p) => ({ pack: p, theme: p.meta.theme, order: p.meta.order }));
  return sortByTaste(packs, mbti).map((x) => x.pack);
}

export function sentencesOfScene(story: Story, sceneId: string): StorySentence[] {
  return story.sentences.filter((s) => s.sceneId === sceneId);
}

/** 단어가 나오는 이야기 속 문장 (단어 뜻 표시의 4번째 항목) */
export function sentenceForWord(story: Story, word: string): StorySentence | undefined {
  const stem = word.toLowerCase().split(' ')[0] ?? '';
  const key = stem.slice(0, Math.max(3, stem.length - 1));
  return story.sentences.find((s) => s.text.toLowerCase().includes(key));
}

export function findWord(story: Story, word: string): StoryWord | undefined {
  return story.words.find((w) => w.word.toLowerCase() === word.toLowerCase());
}

/** 모든 팩에서 단어 정보를 찾는다 (복습 퀴즈용) */
export function findWordAnywhere(word: string): { pack: StoryPack; word: StoryWord } | undefined {
  for (const pack of ALL_PACKS) {
    const w = findWord(pack.story, word);
    if (w) return { pack, word: w };
  }
  return undefined;
}
