import fs from 'node:fs';
import path from 'node:path';

// OS별 빌드 결과를 한 폴더에 모아 전달한다. 서명된 파일의 내용은 바꾸지 않는다.
const source = process.argv[2];
const siteArg = process.argv[3];
if (!source) throw new Error('Usage: npm run release:downloads -- <artifacts-directory> [https://your-site.netlify.app]');
const sourceDir = path.resolve(source);
const output = path.resolve('dist/downloads');
if (sourceDir === output || sourceDir.startsWith(`${output}${path.sep}`) || output.startsWith(`${sourceDir}${path.sep}`)) {
  throw new Error('Artifacts must be outside dist/downloads and its parent directories.');
}
const base = siteArg ? new URL(siteArg) : undefined;
if (base && (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash)) {
  throw new Error('Use an HTTPS site URL without credentials, query, or fragment.');
}
const files = new Map<string, string>();
function scan(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(file);
    else if (entry.isFile() && /\.(exe|msi|dmg|zip|gz|sig)$/.test(entry.name)) {
      const previous = files.get(entry.name);
      if (previous && !fs.readFileSync(previous).equals(fs.readFileSync(file))) {
        throw new Error(`Conflicting artifact name: ${entry.name}`);
      }
      files.set(entry.name, file);
    }
  }
}
scan(sourceDir);
if (files.size === 0) throw new Error('No desktop build artifacts found. Build the desktop app first.');
const manifestFile = path.join(sourceDir, 'latest.json');
let manifest: { version: string; platforms: Record<string, { url: string; signature: string }> } | undefined;
if (base) {
  manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as NonNullable<typeof manifest>;
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')) as { version: string };
  if (manifest.version !== pkg.version || !Object.keys(manifest.platforms).length) {
    throw new Error('Manifest version must match package.json and contain platforms.');
  }
  for (const platform of Object.values(manifest.platforms)) {
    const name = decodeURIComponent(new URL(platform.url).pathname.split('/').at(-1) ?? '');
    if (!platform.signature?.trim() || !files.has(name)) throw new Error(`Missing signed update artifact: ${name}`);
    platform.url = `${base.href.replace(/\/$/, '')}/downloads/${encodeURIComponent(name)}`;
  }
}
// 모든 입력을 검증한 뒤 출력한다. 기존 배포 파일은 덮어쓰지 않도록 실패시킨다.
if (fs.existsSync(output)) throw new Error('dist/downloads already exists. Run npm run build first for a fresh output.');
fs.mkdirSync(output, { recursive: true });
const installers: { name: string; url: string }[] = [];
for (const [name, file] of files) {
  fs.copyFileSync(file, path.join(output, name));
  if (/\.(exe|msi|dmg)$/.test(name)) installers.push({ name, url: `./${encodeURIComponent(name)}` });
}
// 파일명에 OS·아키텍처 정보가 있으므로 유지하고, 다운로드 페이지에서 바로 고르게 한다.
fs.writeFileSync(path.join(output, 'index.json'), `${JSON.stringify(installers, null, 2)}\n`);
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
fs.writeFileSync(path.join(output, 'index.html'), `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>School Quest 다운로드</title><body><h1>School Quest PC 설치 파일</h1><ul>${installers.map((item) => `<li><a download href="${escapeHtml(item.url)}">${escapeHtml(item.name)}</a></li>`).join('')}</ul><p><a href="../">게임 열기</a></p></body></html>`);
if (manifest) fs.writeFileSync(path.join(output, 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Prepared ${files.size} artifacts in dist/downloads${manifest ? ' with signed update manifest' : ' (downloads only; no update manifest)'}.`);
