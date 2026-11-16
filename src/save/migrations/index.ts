import { CURRENT_SCHEMA_VERSION, defaultSave, defaultSettings, type SaveData } from '../schema';
import { migrateV3ToV4 } from './v3ToV4';
import { migrateV2ToV3 } from './v2ToV3';
import { migrateV1ToV2, type SaveV1 } from './v1ToV2';

// 세이브 마이그레이션 실행기 (순수 함수)
// 저장된 데이터의 schemaVersion 에서 시작해 최신 버전까지 순서대로 변환한다.
// 새 버전을 만들 때: MIGRATIONS 에 { from: n, run } 을 추가하고 CURRENT_SCHEMA_VERSION 을 올린다.

type Migration = { from: number; run: (data: unknown) => unknown };

const MIGRATIONS: readonly Migration[] = [{ from: 1, run: (data) => migrateV1ToV2(data as SaveV1) }, { from: 2, run: migrateV2ToV3 }, { from: 3, run: migrateV3ToV4 }];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 기본값 위에 저장된 값을 겹쳐서, 나중에 추가된 필드가 비어 있지 않게 한다(얕은 2단계 병합). */
function fillDefaults(data: Record<string, unknown>): SaveData {
  const base = defaultSave() as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(base)) {
    const saved = data[key];
    if (saved === undefined || saved === null) continue;
    const def = base[key];
    out[key] = isRecord(def) && isRecord(saved) && key !== 'stories' && key !== 'dictionary' ? { ...def, ...saved } : saved;
  }
  const result = out as unknown as SaveData;
  result.settings = { ...defaultSettings(), ...result.settings, volume: { ...defaultSettings().volume, ...result.settings.volume } };
  result.schemaVersion = CURRENT_SCHEMA_VERSION;
  return result;
}

/**
 * 어떤 버전의 세이브든 최신 스키마로 바꾼다.
 * - 알 수 없는 형식이면 새 세이브를 돌려준다(게임이 멈추지 않게).
 * - 미래 버전(더 최신 앱에서 만든 세이브)은 건드리지 않고 기본값만 채운다.
 */
export function migrateSave(raw: unknown, fromVersion?: number): SaveData {
  if (!isRecord(raw)) return defaultSave();
  let version = fromVersion ?? (typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1);
  let data: unknown = raw;
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS.find((m) => m.from === version);
    if (!step) return defaultSave();
    data = step.run(data);
    version++;
  }
  return isRecord(data) ? fillDefaults(data) : defaultSave();
}
