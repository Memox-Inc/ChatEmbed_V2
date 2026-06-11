/**
 * Second Vite build pass: voice bundle (dist/chat-voice.js).
 *
 * Entry: src/components/families/web-call/call-controller.ts
 * Output: dist/chat-voice.js (IIFE, global MemoxChatVoice)
 *
 * This config is intentionally separate from vite.config.ts so the core
 * bundle (chat-embed.js) retains inlineDynamicImports:true while the voice
 * bundle is a standalone IIFE loaded lazily via dynamic import from card.ts.
 *
 * Run both passes:
 *   vite build && vite build --config vite.voice.config.ts
 * or:
 *   npm run build  (which does both)
 */
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/components/families/web-call/call-controller.ts'),
      name: 'MemoxChatVoice',
      formats: ['iife'],
      fileName: () => 'chat-voice.js',
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
