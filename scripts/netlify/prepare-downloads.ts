import fs from 'node:fs';
import path from 'node:path';
import { prepareDownloads } from './lib';

// npm run netlify:prepare -- --artifacts <폴더> [--dist dist] [--version 0.2.0] [--site-url https://xxx.netlify.app]
// PC 설치 파일을 dist/downloads/ 에 모으고 downloads.json, updates/latest.json 을 만든다. (GitHub Actions 에서 사용)

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  return v && !v.startsWith('--') ? v : null;
}

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string };
const distDir = path.resolve(root, arg('dist') ?? 'dist');
if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error(`dist not found: ${distDir}. Run "npm run build" first.`);
  process.exit(1);
}
const changelogFile = path.join(root, 'CHANGELOG.md');
const { manifest, latest } = prepareDownloads({
  artifactsDir: path.resolve(root, arg('artifacts') ?? 'artifacts'),
  distDir,
  version: arg('version') ?? pkg.version,
  siteUrl: arg('site-url') ?? (process.env.SITE_URL || null),
  changelog: fs.existsSync(changelogFile) ? fs.readFileSync(changelogFile, 'utf8') : '',
  now: new Date(),
});
console.log(`📦 v${manifest.version}: ${manifest.files.length} installer file(s)`);
for (const f of manifest.files) console.log(`  • downloads/${f.file} (${(f.bytes / 1024 / 1024).toFixed(1)} MB)`);
if (manifest.files.length === 0) console.log('  (no installers — the guide page will say "coming soon")');
console.log(latest ? `🔄 updates/latest.json: ${Object.keys(latest.platforms).join(', ')}` : '🔄 no auto-update info (signing key or site URL not set)');
