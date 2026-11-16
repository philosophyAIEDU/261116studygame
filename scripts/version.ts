import fs from 'node:fs';
import path from 'node:path';

// npm run version:set -- 0.2.0
// 버전을 한 곳에서 맞춘다: package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml
// (앱 화면의 버전은 빌드 때 package.json 에서 읽는다)
const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage: npm run version:set -- <major.minor.patch>');
  process.exit(2);
}
const root = process.cwd();
const edit = (rel: string, fn: (text: string) => string) => {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return;
  fs.writeFileSync(file, fn(fs.readFileSync(file, 'utf8')));
  console.log(`✔ ${rel}`);
};
edit('package.json', (t) => t.replace(/"version": "[^"]+"/, `"version": "${version}"`));
edit('package-lock.json', (t) => t.replace(/("name": "my-american-school-quest",\s+"version": )"[^"]+"/g, `$1"${version}"`));
edit('src-tauri/tauri.conf.json', (t) => t.replace(/"version": "[^"]+"/, `"version": "${version}"`));
edit('src-tauri/Cargo.toml', (t) => t.replace(/^version = "[^"]+"/m, `version = "${version}"`));
console.log(`\nVersion set to ${version}. Next: update CHANGELOG.md, commit, then: git tag v${version} && git push --tags`);
