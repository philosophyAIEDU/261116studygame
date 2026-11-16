import type { StoryPack } from '@/content/loader';
import { deleteAudioPack, getAudioPacks, putAudioPack, type AudioPackRecord } from '@/features/dictionary/db';

// 오디오 팩 내려받기/삭제 (오프라인 플레이용).
// 서비스 워커의 runtime cache('asq-audio')와 같은 캐시를 쓴다 → 내려받아 둔 파일은 재생할 때 네트워크 없이 나온다.
// 팩 version 이 올라가면 주소의 ?v= 값이 달라져 새 파일을 다시 받는다.

export const AUDIO_CACHE = 'asq-audio';

/** 이 팩의 모든 오디오 파일 주소 (재생기가 요청하는 주소와 똑같아야 캐시가 맞는다) */
export function packAudioUrls(pack: StoryPack): string[] {
  const m = pack.manifest;
  if (!m) return [];
  const files = [...Object.keys(m.files), ...Object.values(m.words).map((w) => w.file), ...(m.full ? [m.full.file] : [])];
  return files.map((f) => `${pack.baseUrl}audio/${f}?v=${pack.meta.version}`);
}

export function packAudioBytes(pack: StoryPack): number {
  const m = pack.manifest;
  if (!m) return 0;
  return Object.values(m.files).reduce((n, f) => n + f.bytes, 0) + Object.values(m.words).reduce((n, w) => n + w.bytes, 0) + (m.full?.bytes ?? 0);
}

export function cacheSupported(): boolean {
  return typeof caches !== 'undefined';
}

export async function downloadPack(pack: StoryPack, onProgress?: (done: number, total: number) => void): Promise<boolean> {
  if (!cacheSupported()) return false;
  const urls = packAudioUrls(pack);
  const cache = await caches.open(AUDIO_CACHE);
  let done = 0;
  for (const url of urls) {
    if (!(await cache.match(url))) {
      const response = await fetch(url);
      if (!response.ok) return false;
      await cache.put(url, response);
    }
    onProgress?.(++done, urls.length);
  }
  await putAudioPack({ packId: pack.meta.id, version: pack.meta.version, files: urls.length, bytes: packAudioBytes(pack), downloadedAt: Date.now() });
  return true;
}

export async function removePack(pack: StoryPack): Promise<void> {
  if (cacheSupported()) {
    const cache = await caches.open(AUDIO_CACHE);
    for (const request of await cache.keys()) {
      if (new URL(request.url).pathname.includes(`/content/packs/${pack.meta.id}/audio/`)) await cache.delete(request);
    }
  }
  await deleteAudioPack(pack.meta.id);
}

export async function downloadedPacks(): Promise<Record<string, AudioPackRecord>> {
  const out: Record<string, AudioPackRecord> = {};
  for (const r of await getAudioPacks()) out[r.packId] = r;
  return out;
}

/** 이 앱이 쓰고 있는 저장 공간(바이트). 브라우저가 알려주지 않으면 null. */
export async function storageUsage(): Promise<{ used: number; quota: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  const e = await navigator.storage.estimate();
  return { used: e.usage ?? 0, quota: e.quota ?? 0 };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(0, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
