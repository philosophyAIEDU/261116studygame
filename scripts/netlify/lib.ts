import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Netlify 배포 준비 (순수 함수 + 파일 정리).
// GitHub Actions 가 만든 PC 설치 파일(Windows·macOS)을 받기 쉬운 이름으로 dist/downloads/ 에 모으고,
//  · downloads/downloads.json : 안내 페이지(/guide/)가 읽는 다운로드 목록
//  · updates/latest.json      : PC 앱의 자동 업데이트 정보 (서명 키가 있을 때만)
// 을 만든다.

export type DownloadId = 'windows' | 'windows-msi' | 'mac';

export interface DownloadEntry {
  id: DownloadId;
  file: string;
  bytes: number;
  sha256: string;
}

export interface DownloadsManifest {
  version: string;
  publishedAt: string;
  files: DownloadEntry[];
}

/** 받는 사람이 기억하기 쉬운 고정 이름. 버전이 바뀌어도 주소가 같다. */
export const DOWNLOAD_NAMES: Record<DownloadId, string> = {
  windows: 'SchoolQuest-Windows-Setup.exe',
  'windows-msi': 'SchoolQuest-Windows.msi',
  mac: 'SchoolQuest-macOS.dmg',
};
export const MAC_UPDATE_NAME = 'SchoolQuest-macOS.app.tar.gz';

export interface FoundArtifacts {
  windows?: string;
  windowsSig?: string;
  windowsMsi?: string;
  mac?: string;
  macUpdate?: string;
  macUpdateSig?: string;
}

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** Tauri 빌드 결과물 폴더(들)에서 필요한 파일을 찾는다. */
export function findArtifacts(dir: string): FoundArtifacts {
  const files = walk(dir);
  const pick = (test: (f: string) => boolean) => files.filter(test).sort()[0];
  return {
    windows: pick((f) => /-setup\.exe$/i.test(f)),
    windowsSig: pick((f) => /-setup\.exe\.sig$/i.test(f)),
    windowsMsi: pick((f) => /\.msi$/i.test(f)),
    mac: pick((f) => /\.dmg$/i.test(f)),
    macUpdate: pick((f) => /\.app\.tar\.gz$/i.test(f)),
    macUpdateSig: pick((f) => /\.app\.tar\.gz\.sig$/i.test(f)),
  };
}

function sha256(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** CHANGELOG.md 에서 해당 버전의 내용만 뽑는다 (업데이트 알림에 쓰인다). */
export function changelogSection(text: string, version: string): string {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith('## ') && l.slice(3).trim().startsWith(version));
  if (start === -1) return '';
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith('## '));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
}

export interface LatestJson {
  version: string;
  notes: string;
  pub_date: string;
  platforms: Record<string, { signature: string; url: string }>;
}

/**
 * Tauri 업데이트 정보(latest.json). 서명(.sig)이 있는 플랫폼만 넣는다.
 * macOS 는 universal 빌드 하나로 Apple Silicon·Intel 을 모두 받는다.
 */
export function buildLatestJson(args: {
  version: string;
  notes: string;
  now: Date;
  siteUrl: string;
  windowsSig?: string;
  macSig?: string;
}): LatestJson | null {
  const base = args.siteUrl.replace(/\/+$/, '');
  const v = encodeURIComponent(args.version);
  const platforms: LatestJson['platforms'] = {};
  if (args.windowsSig) {
    platforms['windows-x86_64'] = { signature: args.windowsSig.trim(), url: `${base}/downloads/${DOWNLOAD_NAMES.windows}?v=${v}` };
  }
  if (args.macSig) {
    const mac = { signature: args.macSig.trim(), url: `${base}/updates/${MAC_UPDATE_NAME}?v=${v}` };
    platforms['darwin-aarch64'] = mac;
    platforms['darwin-x86_64'] = mac;
  }
  if (Object.keys(platforms).length === 0) return null;
  return { version: args.version, notes: args.notes, pub_date: args.now.toISOString(), platforms };
}

export interface PrepareResult {
  manifest: DownloadsManifest;
  latest: LatestJson | null;
}

/** dist/ 안에 downloads/ 와 updates/ 를 만든다. 설치 파일이 하나도 없어도 downloads.json 은 만든다. */
export function prepareDownloads(args: {
  artifactsDir: string;
  distDir: string;
  version: string;
  siteUrl: string | null;
  changelog: string;
  now: Date;
}): PrepareResult {
  const found = findArtifacts(args.artifactsDir);
  const downloads = path.join(args.distDir, 'downloads');
  const updates = path.join(args.distDir, 'updates');
  fs.mkdirSync(downloads, { recursive: true });

  const files: DownloadEntry[] = [];
  const copy = (id: DownloadId, from: string | undefined) => {
    if (!from) return;
    const to = path.join(downloads, DOWNLOAD_NAMES[id]);
    fs.copyFileSync(from, to);
    files.push({ id, file: DOWNLOAD_NAMES[id], bytes: fs.statSync(to).size, sha256: sha256(to) });
  };
  copy('windows', found.windows);
  copy('windows-msi', found.windowsMsi);
  copy('mac', found.mac);

  const manifest: DownloadsManifest = { version: args.version, publishedAt: args.now.toISOString(), files };
  fs.writeFileSync(path.join(downloads, 'downloads.json'), JSON.stringify(manifest, null, 2) + '\n');

  let latest: LatestJson | null = null;
  if (args.siteUrl) {
    const readSig = (f: string | undefined) => (f ? fs.readFileSync(f, 'utf8') : undefined);
    latest = buildLatestJson({
      version: args.version,
      notes: changelogSection(args.changelog, args.version),
      now: args.now,
      siteUrl: args.siteUrl,
      windowsSig: found.windows ? readSig(found.windowsSig) : undefined,
      macSig: found.macUpdate ? readSig(found.macUpdateSig) : undefined,
    });
    if (latest) {
      fs.mkdirSync(updates, { recursive: true });
      if (latest.platforms['darwin-aarch64'] && found.macUpdate) fs.copyFileSync(found.macUpdate, path.join(updates, MAC_UPDATE_NAME));
      fs.writeFileSync(path.join(updates, 'latest.json'), JSON.stringify(latest, null, 2) + '\n');
    }
  }
  return { manifest, latest };
}

// ── tauri.conf.json 설정 ───────────────────────────────────────

export interface TauriConf {
  bundle: { createUpdaterArtifacts?: boolean | string } & Record<string, unknown>;
  plugins?: { updater?: { pubkey: string; endpoints: string[] } & Record<string, unknown> } & Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * 자동 업데이트 설정을 채운다.
 * 공개 키와 사이트 주소가 모두 있으면: 업데이트 파일을 만들고 Netlify 의 latest.json 을 보게 한다.
 * 하나라도 없으면: 업데이트 없이 설치 파일만 만든다(업데이트 서명 개인 키가 없어도 빌드가 된다).
 */
export function configureTauri(conf: TauriConf, pubkey: string | null, siteUrl: string | null): { conf: TauriConf; updater: boolean } {
  const next = structuredClone(conf);
  const updater = !!pubkey && !!siteUrl;
  next.bundle.createUpdaterArtifacts = updater;
  if (updater && next.plugins?.updater) {
    next.plugins.updater.pubkey = (pubkey as string).trim();
    next.plugins.updater.endpoints = [`${(siteUrl as string).replace(/\/+$/, '')}/updates/latest.json`];
  }
  return { conf: next, updater };
}
