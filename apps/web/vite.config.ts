import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// WHY: Vite convention requires default export; ESLint override scoped to this file.
// eslint-disable-next-line import/no-default-export
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
