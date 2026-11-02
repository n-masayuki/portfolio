// @ts-check
import { existsSync, readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

const keyPath = new URL('./localhost+2-key.pem', import.meta.url);
const certPath = new URL('./localhost+2.pem', import.meta.url);
const https =
  existsSync(keyPath) && existsSync(certPath)
    ? { key: readFileSync(keyPath), cert: readFileSync(certPath) }
    : undefined;

// https://astro.build/config
export default defineConfig({
  integrations: [
    react(),
    {
      name: 'separate-vite-cache',
      hooks: {
        'astro:config:setup': ({ command, updateConfig }) => {
          // buildの依存最適化で、稼働中のdevが参照するキャッシュを上書きしない。
          updateConfig({ vite: { cacheDir: `node_modules/.vite/${command}` } });
        },
      },
    },
  ],
  vite: {
    server: { https },
    build: {
      // lightningcssがanimation-timelineをanimationの省略記法へ統合し、
      // scroll-driven animationがブラウザに無効な値として無視されるのを防ぐ。
      cssMinify: 'esbuild',
    },
  },
  site: 'https://nm-dev.jp',
});
