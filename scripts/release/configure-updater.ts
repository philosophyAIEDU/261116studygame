import fs from 'node:fs';

// 서명 공개 키는 유지하고 업데이트 확인 주소만 바꾼다.
const input = process.argv[2];
if (!input) throw new Error('Usage: npm run updater:url -- https://your-site.netlify.app');
const site = new URL(input);
if (site.protocol !== 'https:' || site.username || site.password || site.search || site.hash) {
  throw new Error('Use an HTTPS site URL without credentials, query, or fragment.');
}
site.pathname = `${site.pathname.replace(/\/$/, '')}/downloads/latest.json`;
const file = 'src-tauri/tauri.conf.json';
const config = JSON.parse(fs.readFileSync(file, 'utf8')) as {
  plugins: { updater: { endpoints: string[] } };
};
config.plugins.updater.endpoints = [site.href];
fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Updater endpoint: ${site.href}`);
