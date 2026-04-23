import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MemoxChatEmbed',
      formats: ['iife'],
      fileName: () => 'chat-embed.js',
    },
    outDir: 'dist',
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: false },
    },
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  server: {
    open: '/test/index.html',
  },
});
