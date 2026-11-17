// 术语词典：本地搜索与分类筛选，不发送任何请求。
const grid = document.querySelector('[data-term-grid]');
if (grid) initGlossary();

function initGlossary() {
  const input = document.querySelector('[data-glossary-search]');
  const chips = Array.from(document.querySelectorAll('[data-filter]'));
  const terms = Array.from(document.querySelectorAll('[data-term]'));
  const count = document.querySelector('[data-glossary-count]');
  const empty = document.querySelector('[data-glossary-empty]');
  const reset = document.querySelector('[data-reset]');
  let category = 'all';

  const normalize = (value) => value.toLowerCase().replace(/\s+/g, '');

  const apply = () => {
    const query = normalize(input.value);
    let visible = 0;

    terms.forEach((term) => {
      const categoryMatch = category === 'all' || term.dataset.category === category;
      const haystack = normalize(`${term.dataset.keywords || ''} ${term.textContent}`);
      const queryMatch = query === '' || haystack.includes(query);
      const show = categoryMatch && queryMatch;
      term.hidden = !show;
      if (show) visible += 1;
    });

    count.textContent = visible === terms.length
      ? `共 ${terms.length} 条`
      : `显示 ${visible} / ${terms.length} 条`;
    empty.hidden = visible !== 0;
  };

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      category = chip.dataset.filter;
      chips.forEach((item) => {
        const active = item === chip;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      apply();
    });
  });

  input.addEventListener('input', apply);

  reset.addEventListener('click', () => {
    input.value = '';
    category = 'all';
    chips.forEach((chip) => {
      const active = chip.dataset.filter === 'all';
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', String(active));
    });
    apply();
    input.focus();
  });

  apply();
}
