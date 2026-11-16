import { migrateSave } from './migrations';
import type { SaveData } from './schema';

// 진행 데이터 내보내기/가져오기 (기기 이동·백업).
// 파일에는 세이브와 아이가 그린 그림이 들어간다. API 키는 들어가지 않는다.

export interface BackupFile {
  app: 'my-american-school-quest';
  exportedAt: string;
  appVersion: string;
  save: SaveData;
  drawings: Record<string, string>;
}

export function buildBackup(save: SaveData, drawings: Record<string, string>, appVersion: string, now: Date): BackupFile {
  return { app: 'my-american-school-quest', exportedAt: now.toISOString(), appVersion, save, drawings };
}

/** 백업 파일 내용을 읽는다. 예전 버전의 세이브도 최신 스키마로 바꿔서 돌려준다. 형식이 틀리면 null. */
export function parseBackup(text: string): { save: SaveData; drawings: Record<string, string> } | null {
  try {
    const data = JSON.parse(text) as Partial<BackupFile> & Record<string, unknown>;
    if (typeof data !== 'object' || data === null) return null;
    // 백업 파일 형식, 또는 세이브만 들어 있는 예전 파일 둘 다 받는다.
    const rawSave = data.app === 'my-american-school-quest' ? data.save : 'schemaVersion' in data ? data : null;
    if (!rawSave || typeof rawSave !== 'object') return null;
    const drawings: Record<string, string> = {};
    if (data.drawings && typeof data.drawings === 'object') {
      for (const [word, url] of Object.entries(data.drawings as Record<string, unknown>)) {
        if (typeof url === 'string' && url.startsWith('data:image/')) drawings[word] = url;
      }
    }
    return { save: migrateSave(rawSave), drawings };
  } catch {
    return null;
  }
}
