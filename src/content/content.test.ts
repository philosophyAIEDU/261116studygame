import { describe, expect, it } from 'vitest';
import { ALL_PACKS, findWordAnywhere, getPack, packsForStage, recommendedPacks, sentenceForWord, sentencesOfScene } from './loader';
import { storySchema } from './schema';

describe('story packs', () => {
  it('ships 6 original elementary stories that pass the schema', () => {
    expect(ALL_PACKS).toHaveLength(6);
    for (const p of ALL_PACKS) {
      expect(p.story.packId).toBe(p.meta.id);
      expect(p.story.sentences.length).toBeGreaterThanOrEqual(8);
      expect(p.story.sentences.length).toBeLessThanOrEqual(15);
      expect(p.story.scenes.length).toBeGreaterThanOrEqual(4);
      expect(p.story.scenes.length).toBeLessThanOrEqual(6);
      expect(p.story.phrasePocket.length).toBeGreaterThanOrEqual(5);
      expect(p.manifest).toBeNull(); // 오디오 없이 출하 → 기기 음성 폴백
    }
  });
  it('rejects Korean text, unknown scenes and phrases that are not in the story', () => {
    const base = structuredClone(getPack('elem-g1-01-new-school')!.story);
    expect(storySchema.safeParse(base).success).toBe(true);
    const ko = structuredClone(base);
    ko.words[0]!.easyEnglish = '밝은';
    expect(storySchema.safeParse(ko).success).toBe(false);
    const scene = structuredClone(base);
    scene.sentences[0]!.sceneId = 'sc99';
    expect(storySchema.safeParse(scene).success).toBe(false);
    const phrase = structuredClone(base);
    phrase.phrasePocket.push('Where is the bathroom?');
    expect(storySchema.safeParse(phrase).success).toBe(false);
  });
  it('helpers', () => {
    const pack = getPack('elem-g1-01-new-school')!;
    expect(sentencesOfScene(pack.story, 'sc01')).toHaveLength(2);
    expect(sentenceForWord(pack.story, 'smile')?.id).toBe('s004');
    expect(findWordAnywhere('dragon')?.pack.meta.id).toBe('elem-g2-04-library-dragon');
    expect(packsForStage('college')).toHaveLength(6);
    expect(recommendedPacks('elementary', 'INFP')[0]?.meta.theme).toBe('adventure');
    expect(recommendedPacks('elementary', 'ISTJ')[0]?.meta.id).toBe('elem-g1-01-new-school');
  });
});
