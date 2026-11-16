// @vitest-environment node
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Netlify 에 올라가는 정적 파일들이 서로 맞물리는지 확인한다.
//  · 안내 페이지(/guide/)는 scripts/release/downloads.ts 가 만드는 /downloads/index.json 을 읽는다.
//  · 서비스 워커는 /guide/ 와 /downloads/ 로의 이동을 게임 화면으로 바꾸면 안 된다.
const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('Netlify site files', () => {
  const guide = read('public/guide/index.html');

  it('guide page reads the installer list that the release script writes', () => {
    expect(read('scripts/release/downloads.ts')).toContain("'index.json'");
    expect(guide).toContain("fetch('../downloads/index.json'");
    expect(guide).toContain("'../downloads/' + encodeURIComponent(row.name)");
  });

  it('guide page links back to the game and covers every install path', () => {
    expect(guide).toContain('href="../"');
    for (const id of ['which', 'phone', 'pc', 'first', 'play', 'guardian', 'ai', 'update', 'privacy', 'faq']) {
      expect(guide).toContain(`id="${id}"`);
      expect(guide).toContain(`href="#${id}"`);
    }
  });

  it('service worker does not hijack the guide or installer downloads', () => {
    const config = read('vite.config.ts');
    expect(config).toMatch(/navigateFallbackDenylist: \[[^\]]*guide[^\]]*downloads/);
    expect(config).toContain("'downloads/**'");
  });

  it('short links and cache headers are in place', () => {
    expect(read('public/_redirects')).toMatch(/^\/install\s+\/guide\/\s+301/m);
    const headers = read('public/_headers');
    expect(headers).toMatch(/\/sw\.js\n\s+Cache-Control: no-cache/);
    expect(headers).toMatch(/\/downloads\/latest\.json\n\s+Cache-Control: no-store/);
  });
});
