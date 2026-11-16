import { emptyVocabulary } from '@/features/vocabulary/rules';

/** 기존 이야기와 캐릭터를 남기고, 단어 듣기 진단과 모험을 새로 시작한다. */
export function migrateV3ToV4(data: unknown): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  const old = data as Record<string, unknown>;
  const vocabulary = emptyVocabulary();
  if (old.profile && typeof old.profile === 'object') {
    const p = old.profile as Record<string, unknown>;
    for (const key of ['hair', 'hairColor', 'outfitColor'] as const) if (typeof p[key] === 'number' && Number.isInteger(p[key]) && p[key] >= 0 && p[key] <= (key === 'hair' ? 2 : 4)) vocabulary.look[key] = p[key];
  }
  return { ...old, schemaVersion: 4, vocabulary };
}
