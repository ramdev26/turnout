import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { Connect } from 'vite';
import { defineConfig } from 'vite';

/** Serve the static marketing page at `/` during local dev (matches Vercel rewrite). */
function marketingHomeAtRoot(): import('vite').Plugin {
  const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
    const pathname = req.url?.split('?')[0] ?? '';
    if (pathname === '/') {
      req.url = '/turnout-landing.html';
    }
    next();
  };
  return {
    name: 'marketing-home-at-root',
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
}

export default defineConfig(() => ({
  plugins: [react(), tailwindcss(), marketingHomeAtRoot()],
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
