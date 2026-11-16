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
    index: '<a class="site-header__back" href="首页.html">← 返回封面</a>',
    'senior-tips': '<a class="site-header__back" href="guide.html">← 返回指南</a>',
  }[current] || '';
  host.innerHTML = `
    <div class="site-header__inner">
      ${backLink}
      <a class="brand" href="guide.html">
        <span class="brand__mark" aria-hidden="true">珞</span>
        <span class="brand__text">选课经验<small>武汉大学</small></span>
      </a>
      <nav class="site-nav" aria-label="板块导航">${buildNav(current)}</nav>
      <div class="site-header__features">
        <a class="site-header__feature site-header__feature--plan" href="${PLAN_LINK.href}">✦ ${PLAN_LINK.label}</a>
        <a class="site-header__feature site-header__feature--sakura" href="课程信息.html">樱下选课</a>
        <a class="site-header__feature site-header__feature--senior" href="学长抢课秘籍.html">学长抢课秘籍</a>
        <a class="site-header__feature site-header__feature--teacher" href="教师推荐.html">教师推荐</a>
      </div>
    </div>`;
}

function renderFooter() {
  const host = document.querySelector('[data-site-footer]');
  if (!host) return;
  host.innerHTML = `
    <div class="site-footer__inner">
      <p class="site-footer__note">本站只整理选课方法与判断标准：不提供具体课程数据、评分或外部链接。选课时间、名额与办理规则，一律以当期官方通知为准。</p>
      <nav class="site-footer__nav" aria-label="页脚导航">${buildNav('', [PLAN_LINK])}</nav>
      <p class="site-footer__meta">内容会随新学年核实后更新，选课规则以当期官方通知为准。</p>
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

const page = document.body.dataset.page || '';
renderHeader(page);
renderFooter();
initFaq();
initReveal();
