import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || 'http://localhost:8000'),
    'import.meta.env.VITE_WS_URL': JSON.stringify(process.env.VITE_WS_URL || 'ws://localhost:8000/ws/realtime'),
  },
});
