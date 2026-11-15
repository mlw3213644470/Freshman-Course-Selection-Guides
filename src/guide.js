const NAV = [
  { page: 'index', href: 'index.html', label: '首页' },
  { page: 'prep', href: 'prep.html', label: '选前准备' },
  { page: 'course', href: 'course-info.html', label: '课程信息' },
  { page: 'schedule', href: 'schedule.html', label: '课表安排' },
  { page: 'after', href: 'after.html', label: '选后调整' },
  { page: 'faq', href: 'faq.html', label: '常见问题' },
  { page: 'sources', href: 'sources.html', label: '经验来源' },
  { page: 'training-plan', href: '/pages/training-plan.html', label: '培养方案' },
];

function buildNav(current) {
  return NAV.map(({ page, href, label }) => {
    const active = page === current ? ' aria-current="page"' : '';
    return `<a href="${href}"${active}>${label}</a>`;
  }).join('');
}

function renderHeader(current) {
  const host = document.querySelector('[data-site-header]');
  if (!host) return;
  host.innerHTML = `
    <div class="site-header__inner">
      <a class="brand" href="index.html">
        <span class="brand__mark" aria-hidden="true">珞</span>
        <span class="brand__text">选课经验<small>武汉大学</small></span>
      </a>
      <nav class="site-nav" aria-label="板块导航">${buildNav(current)}</nav>
    </div>`;
}

function renderFooter() {
  const host = document.querySelector('[data-site-footer]');
  if (!host) return;
  host.innerHTML = `
    <div class="site-footer__inner">
      <p class="site-footer__note">本站只整理选课方法与判断标准：不提供具体课程数据、评分或外部链接。选课时间、名额与办理规则，一律以当期官方通知为准。</p>
      <nav class="site-footer__nav" aria-label="页脚导航">${buildNav('')}</nav>
      <p class="site-footer__meta">内容会随新学年核实后更新，修改记录见「经验来源与贡献」。</p>
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
