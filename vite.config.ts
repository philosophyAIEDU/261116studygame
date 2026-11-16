/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')) as { version: string };

const MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
};

/**
 * 콘텐츠 팩(content/packs)은 앱 코드와 분리된 폴더다.
 * - story.json / pack.json / audio-manifest.json 은 import.meta.glob 으로 번들에 포함된다.
 * - audio/ 와 images/ 는 용량이 크므로 정적 파일로 그대로 서빙(개발) / 복사(빌드)한다.
 */
function contentPacks(): Plugin {
  const contentRoot = path.join(rootDir, 'content');
  let outDir = path.join(rootDir, 'dist');
  return {
    name: 'asq-content-packs',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use('/content', (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? '').split('?')[0] ?? '');
        const file = path.join(contentRoot, rel);
        const ext = path.extname(file).toLowerCase();
        if (!file.startsWith(contentRoot) || !MIME[ext] || !fs.existsSync(file)) return next();
        res.setHeader('Content-Type', MIME[ext]);
        fs.createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      const packsDir = path.join(contentRoot, 'packs');
      if (!fs.existsSync(packsDir) || !fs.existsSync(outDir)) return;
      for (const id of fs.readdirSync(packsDir)) {
        for (const sub of ['audio', 'images']) {
          const from = path.join(packsDir, id, sub);
          if (fs.existsSync(from)) {
            fs.cpSync(from, path.join(outDir, 'content', 'packs', id, sub), { recursive: true });
          }
        }
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: { alias: { '@': path.join(rootDir, 'src') } },
  plugins: [
    react(),
    tailwindcss(),
    contentPacks(),
    ...(mode === 'test'
      ? []
      : [
          VitePWA({
            // 'prompt': 새 버전이 있어도 멋대로 새로고침하지 않고, 게임 안 배너로 물어본다.
            registerType: 'prompt',
            includeAssets: ['icon.svg', 'icons/*.png'],
            manifest: {
              name: 'My American School Quest',
              short_name: 'School Quest',
              description: 'Learn English like your first language: listen, read, draw, sleep, speak.',
              theme_color: '#f6b352',
              background_color: '#1d2440',
              display: 'standalone',
              orientation: 'any',
              start_url: './',
              scope: './',
              icons: [
                { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
            workbox: {
              // 앱 셸과 3D 코드는 미리 캐시(precache)한다.
              globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2,glb,json}'],
              globIgnores: ['content/packs/**/audio/**', 'downloads/**'],
              maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
              // 오디오 팩은 필요할 때 내려받아 캐시(runtime cache)한다.
              runtimeCaching: [
                {
                  urlPattern: ({ url }) => /\/content\/packs\/[^/]+\/audio\//.test(url.pathname),
                  handler: 'CacheFirst',
                  options: {
                    cacheName: 'asq-audio',
                    rangeRequests: true,
                    cacheableResponse: { statuses: [200] },
                    expiration: { maxEntries: 4000 },
                  },
                },
              ],
            },
          }),
        ]),
  ],
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/features/progression/**', 'src/features/gemini/**', 'src/features/talktime/*.ts',
        'src/features/dictionary/*.ts', 'src/features/story/*.ts', 'src/save/**', 'src/audio/speedLadder.ts',
        'src/features/mbti/*.ts', 'src/features/adventure/rules.ts',
      ],
      exclude: ['**/*.test.*', '**/*.tsx'],
      thresholds: { lines: 80 },
    },
  },
}));
