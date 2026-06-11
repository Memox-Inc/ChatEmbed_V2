import { defineConfig } from 'vite';
import { resolve } from 'path';

const devConfigWatchPlugin = () => ({
  name: 'dev-config-watch',
  configureServer(server: any) {
    const devConfigPath = resolve(__dirname, 'test/dev-config.json');
    server.watcher.add(devConfigPath);
    server.watcher.on('change', (path: string) => {
      if (path === devConfigPath) {
        server.ws.send({ type: 'full-reload', path: '*' });
      }
    });
  },
});

export default defineConfig({
  plugins: [devConfigWatchPlugin()],
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
      // passes: 2 reclaims a few KB on the core bundle; the CI raw gate
      // (150KB) had <1KB headroom at the pre-MMX-468 baseline, so every
      // KB matters here. drop_console stays false (widget logs degrade
      // signals like the components-bundle load failure).
      compress: { drop_console: false, passes: 2 },
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
