import { openDB, type IDBPDatabase } from 'idb';

// IndexedDB: 용량이 큰 데이터(아이가 그린 그림, 오디오 팩 내려받기 기록)를 저장한다.
// localStorage(세이브)는 5MB 제한이 있어 그림을 넣기에 부족하다.

interface AudioPackRecord {
  packId: string;
  version: number;
  files: number;
  bytes: number;
  downloadedAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  dbPromise ??= openDB('asq-db', 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('drawings')) database.createObjectStore('drawings');
      if (!database.objectStoreNames.contains('audioPacks')) database.createObjectStore('audioPacks', { keyPath: 'packId' });
    },
  });
  return dbPromise;
}

/** 그림은 PNG data URL(최대 512px)로 저장한다. key = 단어 */
export async function putDrawing(word: string, dataUrl: string): Promise<void> {
  await (await db()).put('drawings', dataUrl, word.toLowerCase());
}

export async function getDrawing(word: string): Promise<string | undefined> {
  return (await (await db()).get('drawings', word.toLowerCase())) as string | undefined;
}

export async function deleteDrawing(word: string): Promise<void> {
  await (await db()).delete('drawings', word.toLowerCase());
}

/** 백업(내보내기)용: 모든 그림 */
export async function allDrawings(): Promise<Record<string, string>> {
  const database = await db();
  const keys = await database.getAllKeys('drawings');
  const out: Record<string, string> = {};
  for (const key of keys) {
    const value = (await database.get('drawings', key)) as string | undefined;
    if (value) out[String(key)] = value;
  }
  return out;
}

export async function restoreDrawings(drawings: Record<string, string>): Promise<void> {
  const database = await db();
  const tx = database.transaction('drawings', 'readwrite');
  for (const [word, dataUrl] of Object.entries(drawings)) {
    if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) void tx.store.put(dataUrl, word);
  }
  await tx.done;
}

export async function clearDrawings(): Promise<void> {
  await (await db()).clear('drawings');
}

export async function putAudioPack(record: AudioPackRecord): Promise<void> {
  await (await db()).put('audioPacks', record);
}

export async function getAudioPacks(): Promise<AudioPackRecord[]> {
  return (await (await db()).getAll('audioPacks')) as AudioPackRecord[];
}

export async function deleteAudioPack(packId: string): Promise<void> {
  await (await db()).delete('audioPacks', packId);
}

export type { AudioPackRecord };
