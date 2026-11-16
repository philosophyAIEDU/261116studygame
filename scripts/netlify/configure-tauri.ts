import fs from 'node:fs';
import path from 'node:path';
import { configureTauri, type TauriConf } from './lib';

// GitHub Actions 에서 PC 앱을 빌드하기 직전에 실행한다.
// 환경 변수 TAURI_UPDATER_PUBKEY 와 SITE_URL 로 자동 업데이트 설정을 채운다.
const file = path.join(process.cwd(), 'src-tauri', 'tauri.conf.json');
const conf = JSON.parse(fs.readFileSync(file, 'utf8')) as TauriConf;
const result = configureTauri(conf, process.env.TAURI_UPDATER_PUBKEY || null, process.env.SITE_URL || null);
fs.writeFileSync(file, JSON.stringify(result.conf, null, 2) + '\n');
console.log(result.updater ? `🔄 auto-update ON → ${process.env.SITE_URL}/updates/latest.json` : '🔄 auto-update OFF (TAURI_UPDATER_PUBKEY or SITE_URL not set) — installers only');
