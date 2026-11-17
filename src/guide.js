const NAV = [
  { page: 'index', href: 'guide.html', label: '首页' },
  { page: 'prep', href: 'prep.html', label: '选前准备' },
  { page: 'course', href: 'course-info.html', label: '课程信息' },
  { page: 'schedule', href: 'schedule.html', label: '课表安排' },
  { page: 'after', href: 'after.html', label: '选后调整' },
  { page: 'faq', href: 'faq.html', label: '常见问题' },
];

// 培养方案页不在本站多页构建里，页头单独做成醒目的金色按钮，页脚仍按普通导航展示。
const PLAN_LINK = { page: 'training-plan', href: '/pages/training-plan.html', label: '培养方案' };
const GLOSSARY_LINK = { page: 'glossary', href: 'glossary.html', label: '术语词典' };
const GAME_LINK = { page: 'game', href: 'game.html', label: '信息侦探' };
const CHANGELOG_LINK = { page: 'changelog', href: 'changelog.html', label: '内容更新日志' };

function buildNav(current, extra = []) {
  return [...NAV, ...extra].map(({ page, href, label }) => {
    const active = page === current ? ' aria-current="page"' : '';
    return `<a href="${href}"${active}>${label}</a>`;
  }).join('');
}

function renderHeader(current) {
  const host = document.querySelector('[data-site-header]');
  if (!host) return;
  const backLink = {
    index: '<a class="site-header__back" href="index.html">← 返回封面</a>',
    'senior-tips': '<a class="site-header__back" href="guide.html">← 返回指南</a>',
  }[current] || '';
  const currentAttr = (page) => page === current ? ' aria-current="page"' : '';
  host.innerHTML = `
    <div class="site-header__inner">
      ${backLink}
      <a class="brand" href="guide.html">
        <span class="brand__mark" aria-hidden="true">珞</span>
        <span class="brand__text">选课经验<small>武汉大学</small></span>
      </a>
      <div class="site-header__actions">
        <a class="site-header__feature site-header__feature--glossary" href="${GLOSSARY_LINK.href}"${currentAttr(GLOSSARY_LINK.page)}>${GLOSSARY_LINK.label}</a>
        <a class="site-header__feature site-header__feature--plan" href="${PLAN_LINK.href}">✦ ${PLAN_LINK.label}</a>
        <a class="site-header__feature site-header__feature--sakura" href="课程信息.html">通识选课</a>
        <a class="site-header__feature site-header__feature--senior" href="学长抢课秘籍.html">学长抢课秘籍</a>
        <a class="site-header__feature site-header__feature--teacher" href="教师推荐.html">教师推荐</a>
        <a class="site-header__game" href="${GAME_LINK.href}"${currentAttr(GAME_LINK.page)} aria-label="信息侦探小游戏">
          <span class="site-header__game-icon" aria-hidden="true">🎮</span>
          <span class="site-header__game-text">${GAME_LINK.label}<small>小游戏</small></span>
        </a>
      </div>
      <nav class="site-nav" aria-label="板块导航">${buildNav(current)}</nav>
    </div>`;
}

function renderFooter() {
  const host = document.querySelector('[data-site-footer]');
  if (!host) return;
  host.innerHTML = `
    <div class="site-footer__inner">
      <p class="site-footer__note">本站只整理选课方法与判断标准：不提供具体课程数据、评分或外部链接。选课时间、名额与办理规则，一律以当期官方通知为准。</p>
      <nav class="site-footer__nav" aria-label="页脚导航">${buildNav('', [GLOSSARY_LINK, PLAN_LINK, GAME_LINK, CHANGELOG_LINK])}</nav>
      <p class="site-footer__meta">内容核实于 2026 年 11 月，各页核实时间见<a href="changelog.html">内容更新日志</a>。选课规则以当期官方通知为准。</p>
    </div>`;
}

function initFaq() {
  const items = Array.from(document.querySelectorAll('details.qa'));
  const button = document.querySelector('[data-action="toggle-all"]');
  if (!button || items.length === 0) return;

  const sync = () => {
    const allOpen = items.every((item) => item.open);
    button.textContent = allOpen ? '全部收起' : '全部展开';
    button.setAttribute('aria-expanded', String(allOpen));
  };

  button.addEventListener('click', () => {
    const shouldOpen = !items.every((item) => item.open);
    items.forEach((item) => { item.open = shouldOpen; });
    sync();
  });

  items.forEach((item) => item.addEventListener('toggle', sync));
  sync();
}

function initReveal() {
  const targets = document.querySelectorAll('.reveal');
  if (targets.length === 0) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    targets.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

  targets.forEach((el) => observer.observe(el));
}

let headerObserver;

function syncHeaderOffset() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const update = () => {
    document.documentElement.style.setProperty('--header-offset', `${Math.ceil(header.getBoundingClientRect().height + 16)}px`);
  };
  update();
  if ('ResizeObserver' in window) {
    headerObserver = new ResizeObserver(update);
    headerObserver.observe(header);
  } else {
    window.addEventListener('resize', update);
  }
}

const page = document.body.dataset.page || '';
renderHeader(page);
renderFooter();
syncHeaderOffset();
initFaq();
initReveal();
