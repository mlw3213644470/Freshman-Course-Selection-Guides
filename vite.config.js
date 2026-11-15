import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const PAGES = ['index', 'prep', 'course-info', 'schedule', 'after', 'faq', 'sources'];
const page = (name) => fileURLToPath(new URL(`./${name}.html`, import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: PAGES.map(page),
    },
  },
});
