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
