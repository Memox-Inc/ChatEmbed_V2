/**
 * Third Vite build pass: components bundle (dist/chat-components.js).
 *
 * Entry: src/components/bundle-entry.ts
 * Output: dist/chat-components.js (IIFE, global MemoxChatComponents)
 *
 * This config is intentionally separate from vite.config.ts so the core
 * bundle (chat-embed.js) retains inlineDynamicImports:true while the
 * components bundle is a standalone IIFE loaded lazily by loader.ts.
 *
 * Run all three passes:
 *   vite build && vite build --config vite.components.config.ts && vite build --config vite.voice.config.ts
 * or:
 *   npm run build
 */
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/components/bundle-entry.ts'),
      name: 'MemoxChatComponents',
      formats: ['iife'],
      fileName: () => 'chat-components.js',
    },
    outDir: 'dist',
    emptyOutDir: false, // do NOT delete chat-embed.js produced by the first pass
    minify: 'terser',
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
