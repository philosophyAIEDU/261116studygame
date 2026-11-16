// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildLatestJson, changelogSection, configureTauri, DOWNLOAD_NAMES, findArtifacts, prepareDownloads, type TauriConf } from './lib';

let tmp = '';
const write = (rel: string, content: string) => {
  const file = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'asq-netlify-')); fs.mkdirSync(path.join(tmp, 'dist')); });
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

// GitHub Actions 의 download-artifact 가 만드는 폴더 모양
function fakeArtifacts() {
  write('artifacts/desktop-windows-latest/release/bundle/nsis/My American School Quest_0.2.0_x64-setup.exe', 'EXE');
  write('artifacts/desktop-windows-latest/release/bundle/nsis/My American School Quest_0.2.0_x64-setup.exe.sig', 'SIG-WIN\n');
  write('artifacts/desktop-windows-latest/release/bundle/msi/My American School Quest_0.2.0_x64_en-US.msi', 'MSI');
  write('artifacts/desktop-macos-latest/universal-apple-darwin/release/bundle/dmg/My American School Quest_0.2.0_universal.dmg', 'DMG');
  write('artifacts/desktop-macos-latest/universal-apple-darwin/release/bundle/macos/My American School Quest.app.tar.gz', 'TGZ');
  write('artifacts/desktop-macos-latest/universal-apple-darwin/release/bundle/macos/My American School Quest.app.tar.gz.sig', 'SIG-MAC');
}

const CHANGELOG = '# 변경 내역\n\n## 0.2.0 — 눈 오는 날\n- 새 이야기\n- 버그 수정\n\n## 0.1.0 — 첫 버전\n- 시작\n';

describe('installer collection', () => {
  it('finds Tauri outputs and ignores signatures as installers', () => {
    fakeArtifacts();
    const found = findArtifacts(path.join(tmp, 'artifacts'));
    expect(path.basename(found.windows!)).toBe('My American School Quest_0.2.0_x64-setup.exe');
    expect(path.basename(found.windowsSig!)).toMatch(/\.exe\.sig$/);
    expect(found.mac).toMatch(/\.dmg$/);
    expect(found.macUpdate).toMatch(/\.app\.tar\.gz$/);
    expect(findArtifacts(path.join(tmp, 'nothing'))).toEqual({});
  });

  it('copies installers under stable names and writes downloads.json + latest.json', () => {
    fakeArtifacts();
    const now = new Date('2026-12-01T00:00:00Z');
    const { manifest, latest } = prepareDownloads({
      artifactsDir: path.join(tmp, 'artifacts'), distDir: path.join(tmp, 'dist'), version: '0.2.0',
      siteUrl: 'https://school-quest.netlify.app/', changelog: CHANGELOG, now,
    });
    expect(manifest.files.map((f) => f.file)).toEqual([DOWNLOAD_NAMES.windows, DOWNLOAD_NAMES['windows-msi'], DOWNLOAD_NAMES.mac]);
    expect(manifest.files[0]).toMatchObject({ id: 'windows', bytes: 3 });
    expect(manifest.files[0]!.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(fs.readFileSync(path.join(tmp, 'dist/downloads/SchoolQuest-macOS.dmg'), 'utf8')).toBe('DMG');
    const onDisk = JSON.parse(fs.readFileSync(path.join(tmp, 'dist/downloads/downloads.json'), 'utf8'));
    expect(onDisk).toEqual({ version: '0.2.0', publishedAt: '2026-12-01T00:00:00.000Z', files: manifest.files });

    expect(latest).toEqual({
      version: '0.2.0', notes: '- 새 이야기\n- 버그 수정', pub_date: '2026-12-01T00:00:00.000Z',
      platforms: {
        'windows-x86_64': { signature: 'SIG-WIN', url: 'https://school-quest.netlify.app/downloads/SchoolQuest-Windows-Setup.exe?v=0.2.0' },
        'darwin-aarch64': { signature: 'SIG-MAC', url: 'https://school-quest.netlify.app/updates/SchoolQuest-macOS.app.tar.gz?v=0.2.0' },
        'darwin-x86_64': { signature: 'SIG-MAC', url: 'https://school-quest.netlify.app/updates/SchoolQuest-macOS.app.tar.gz?v=0.2.0' },
      },
    });
    expect(fs.readFileSync(path.join(tmp, 'dist/updates/SchoolQuest-macOS.app.tar.gz'), 'utf8')).toBe('TGZ');
    expect(JSON.parse(fs.readFileSync(path.join(tmp, 'dist/updates/latest.json'), 'utf8'))).toEqual(latest);
  });

  it('without installers still writes an empty list (guide shows "coming soon"), and no latest.json', () => {
    const { manifest, latest } = prepareDownloads({
      artifactsDir: path.join(tmp, 'none'), distDir: path.join(tmp, 'dist'), version: '0.1.0', siteUrl: 'https://x.netlify.app', changelog: '', now: new Date(0),
    });
    expect(manifest.files).toEqual([]);
    expect(latest).toBeNull();
    expect(fs.existsSync(path.join(tmp, 'dist/downloads/downloads.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'dist/updates'))).toBe(false);
  });

  it('installers without signatures (no signing key) give downloads but no auto-update', () => {
    write('artifacts/a/x-setup.exe', 'EXE');
    const { manifest, latest } = prepareDownloads({
      artifactsDir: path.join(tmp, 'artifacts'), distDir: path.join(tmp, 'dist'), version: '0.1.0', siteUrl: 'https://x.netlify.app', changelog: '', now: new Date(0),
    });
    expect(manifest.files.map((f) => f.id)).toEqual(['windows']);
    expect(latest).toBeNull();
    expect(buildLatestJson({ version: '1', notes: '', now: new Date(0), siteUrl: 'https://x' })).toBeNull();
  });

  it('reads the right CHANGELOG section', () => {
    expect(changelogSection(CHANGELOG, '0.1.0')).toBe('- 시작');
    expect(changelogSection(CHANGELOG, '9.9.9')).toBe('');
  });
});

describe('tauri.conf.json updater settings', () => {
  const conf: TauriConf = { bundle: { createUpdaterArtifacts: true }, plugins: { updater: { pubkey: 'REPLACE', endpoints: ['old'] } } };
  it('turns auto-update on with a key and a site URL', () => {
    const r = configureTauri(conf, ' PUBKEY ', 'https://school-quest.netlify.app/');
    expect(r.updater).toBe(true);
    expect(r.conf.bundle.createUpdaterArtifacts).toBe(true);
    expect(r.conf.plugins?.updater).toEqual({ pubkey: 'PUBKEY', endpoints: ['https://school-quest.netlify.app/updates/latest.json'] });
    expect(conf.plugins?.updater?.pubkey).toBe('REPLACE'); // 원본은 그대로
  });
  it('builds installers only when the key or the URL is missing', () => {
    expect(configureTauri(conf, null, 'https://x').conf.bundle.createUpdaterArtifacts).toBe(false);
    expect(configureTauri(conf, 'K', null).updater).toBe(false);
  });
});
