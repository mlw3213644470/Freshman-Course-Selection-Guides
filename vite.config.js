import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { copyFileSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PAGES = ['index', 'guide', 'prep', 'course-info', 'schedule', 'after', 'faq', 'glossary', 'game', 'changelog', '学长抢课秘籍', '教师推荐'];
// 早期实验页面及其数据脚本不经过打包，构建后原样复制，保持页面内原有引用可用。
const LEGACY_FILES = ['课程信息.html', '课程数据.js', '教师推荐数据.js'];
// The publish proxy requires ?sharecode=... on entry but strips it before the
// app sees it. Keep it on internal links browser-side so copied links work too.
const SHARECODE_SCRIPT = `<script>(function(){var c=new URLSearchParams(location.search).get('sharecode');if(!c)return;function patch(a){try{var u=new URL(a.href,location.href);if(u.origin===location.origin&&!u.searchParams.has('sharecode')){u.searchParams.set('sharecode',c);a.href=u.pathname+u.search+u.hash;}}catch(e){}}document.querySelectorAll('a[href]').forEach(patch);document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(a)patch(a);},true);})();</script>`;
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

const injectSharecodeScript = () => ({
  name: 'inject-sharecode-script',
  apply: 'build',
  writeBundle() {
    const dist = file('dist');
    for (const entry of readdirSync(dist, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.html')) continue;
      const path = join(dist, entry.name);
      const html = readFileSync(path, 'utf8');
      if (!html.includes('</body>') || html.includes('URLSearchParams(location.search)')) continue;
      writeFileSync(path, html.replace('</body>', `${SHARECODE_SCRIPT}</body>`));
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
  plugins: [copyLegacyFiles(), injectSharecodeScript()],
  build: {
    rollupOptions: {
      input: PAGES.map(page),
    },
  },
});
