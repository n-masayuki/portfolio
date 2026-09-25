// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  vite: {
    build: {
      // lightningcssがanimation-timelineをanimationの省略記法へ統合し、
      // scroll-driven animationがブラウザに無効な値として無視されるのを防ぐ。
      cssMinify: 'esbuild',
    },
  },
  site: 'https://nm-dev.jp',
});
