import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    // Needed for PayHere return/cancel flows when using ngrok (Host header differs)
    // Vite blocks non-IP/non-localhost hosts unless explicitly allowed.
    allowedHosts: ['.ngrok-free.dev'],
    proxy: {
      // Local dev: proxy to PHP API server (php -S 127.0.0.1:8000 ...)
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
}));
