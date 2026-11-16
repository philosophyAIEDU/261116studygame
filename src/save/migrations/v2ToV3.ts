import { emptyAdventure } from '@/features/adventure/rules';

/** 모험 진행을 추가하되 이야기·단어·누적 듣기·외형은 그대로 보존한다. */
export function migrateV2ToV3(data: unknown): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  return { ...data, schemaVersion: 3, adventure: emptyAdventure() };
}
