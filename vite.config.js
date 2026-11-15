import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const PAGES = ['index', 'prep', 'course-info', 'schedule', 'after', 'faq', 'sources'];
const page = (name) => fileURLToPath(new URL(`./${name}.html`, import.meta.url));

export default defineConfig({
  server: {
    proxy: {
      '/pages/training-plan': 'http://127.0.0.1:8002',
      '/api': {
        target: 'http://127.0.0.1:8002',
        changeOrigin: true,
        configure(proxy) {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Translate only same-origin Vite requests for Flask's origin check.
            // Keep foreign Origin headers intact so Flask can reject them.
            const origin = req.headers.origin;
            if (origin === `http://${req.headers.host}` || origin === `https://${req.headers.host}`) {
              proxyReq.setHeader('Origin', 'http://127.0.0.1:8002');
            }
          });
        },
      },
    },
  },
  build: {
    rollupOptions: {
      input: PAGES.map(page),
    },
  },
});
