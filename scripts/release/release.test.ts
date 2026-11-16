// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const temporary: string[] = [];
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'school-release-'));
  temporary.push(dir);
  fs.mkdirSync(path.join(dir, 'artifacts'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version: '0.1.0' }));
  return dir;
}
function run(dir: string, script: string, ...args: string[]) {
  return spawnSync(process.execPath, ['--import', path.join(root, 'node_modules/tsx/dist/loader.mjs'), path.join(root, 'scripts/release', script), ...args], { cwd: dir, encoding: 'utf8' });
}
afterEach(() => { for (const dir of temporary.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
describe('desktop release preparation', () => {
  it('copies signed artifacts unchanged and rewrites manifest URLs', () => {
    const dir = fixture();
    const artifact = 'School Quest.exe';
    fs.writeFileSync(path.join(dir, 'artifacts', artifact), 'signed-installer');
    fs.writeFileSync(path.join(dir, 'artifacts/latest.json'), JSON.stringify({ version: '0.1.0', platforms: { 'windows-x86_64': { url: `https://example.com/School%20Quest.exe`, signature: 'signature' } } }));
    const result = run(dir, 'downloads.ts', 'artifacts', 'https://school.netlify.app');
    expect(result.status, result.stderr).toBe(0);
    expect(fs.readFileSync(path.join(dir, 'dist/downloads', artifact), 'utf8')).toBe('signed-installer');
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'dist/downloads/latest.json'), 'utf8'));
    expect(manifest.platforms['windows-x86_64']).toEqual({ url: 'https://school.netlify.app/downloads/School%20Quest.exe', signature: 'signature' });
  });
  it('rejects a missing update file before writing output', () => {
    const dir = fixture();
    fs.writeFileSync(path.join(dir, 'artifacts/setup.exe'), 'installer');
    fs.writeFileSync(path.join(dir, 'artifacts/latest.json'), JSON.stringify({ version: '0.1.0', platforms: { mac: { url: 'https://example.com/missing.tar.gz', signature: 'signed' } } }));
    expect(run(dir, 'downloads.ts', 'artifacts', 'https://school.netlify.app').status).not.toBe(0);
    expect(fs.existsSync(path.join(dir, 'dist/downloads'))).toBe(false);
  });
  it('changes only the updater endpoint and requires HTTPS', () => {
    const dir = fixture();
    fs.mkdirSync(path.join(dir, 'src-tauri'));
    const file = path.join(dir, 'src-tauri/tauri.conf.json');
    fs.writeFileSync(file, JSON.stringify({ plugins: { updater: { pubkey: 'keep-key', endpoints: [] } } }));
    expect(run(dir, 'configure-updater.ts', 'http://example.com').status).not.toBe(0);
    expect(run(dir, 'configure-updater.ts', 'https://school.netlify.app/').status).toBe(0);
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).plugins.updater).toEqual({ pubkey: 'keep-key', endpoints: ['https://school.netlify.app/downloads/latest.json'] });
  });
});
