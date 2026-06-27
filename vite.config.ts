import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5178,
    watch: {
      ignored: ['**/data/**', '**/test-results/**', '**/playwright-report/**'],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
