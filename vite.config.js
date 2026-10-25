import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
    rollupOptions: { input: { main: 'index.html', preview: 'preview.html' } },
  },
  server: { host: true },
});
