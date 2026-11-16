import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { copyFileSync } from 'node:fs';

const PAGES = ['index', 'guide', 'prep', 'course-info', 'schedule', 'after', 'faq', '首页', '学长抢课秘籍', '教师推荐'];
// 早期实验页面及其数据脚本不经过打包，构建后原样复制，保持页面内原有引用可用。
const LEGACY_FILES = ['课程信息.html', '课程数据.js', '教师推荐数据.js'];
const file = (name) => fileURLToPath(new URL(`./${name}`, import.meta.url));
const page = (name) => file(`${name}.html`);

const copyLegacyFiles = () => ({
  name: 'copy-legacy-files',
  apply: 'build',
  writeBundle() {
    for (const name of LEGACY_FILES) {
      copyFileSync(file(name), file(`dist/${name}`));
    }
  },
});

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
  plugins: [copyLegacyFiles()],
  build: {
    rollupOptions: {
      input: PAGES.map(page),
    },
  },
});
