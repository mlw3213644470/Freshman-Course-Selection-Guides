/* Offline DOM/fetch regression tests; no browser or provider API calls. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, 'pages/training-plan.js'), 'utf8');
const keys = ['培养目标', '毕业要求', '课程分类', '学分要求', '注意事项'];

function element() {
  return {
    handlers: {}, dataset: {}, children: [],
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(type, fn) { this.handlers[type] = fn; },
    replaceChildren() { this.children = []; },
    append(...children) { this.children.push(...children); },
    setAttribute(key, value) { this[key] = value; },
    focus() { this.focused = true; },
  };
}
function reply(payload, ok = true, contentType = 'application/json') {
  return { ok, headers: { get: () => contentType }, json: async () => payload };
}
async function boot(apiFetch, protocol = 'http:') {
  const nodes = {};
  const requests = [];
  const window = {};
  const document = {
    querySelector: (selector) => nodes[selector] ??= element(),
    createElement: element, addEventListener() {},
  };
  const sandbox = {
    document, window, location: { protocol }, TypeError,
    AbortController, setTimeout, clearTimeout,
    FormData: class { append(key, value) { this[key] = value; } },
    fetch: async (url, options) => {
      if (url === '/api/health') return reply({ provider: 'deepseek', configured: true });
      requests.push({ url, options });
      return apiFetch(url, options);
    },
  };
  vm.runInNewContext(source, sandbox);
  await new Promise(setImmediate);
  assert.equal(window.trainingPlanReady, true);
  return {
    nodes, requests,
    select(name = 'plan.pdf', size = 100) {
      nodes['#plan-file'].files = [{ name, size }];
      nodes['#plan-file'].handlers.change();
    },
    click: () => nodes['#analyze-button'].handlers.click({ preventDefault() {} }),
  };
}

async function main() {
  const success = () => reply({ result: Object.fromEntries(keys.map(key => [key, '原文未说明'])) });
  let app = await boot(success);
  await app.click();
  assert.match(app.nodes['#file-status'].textContent, /请先/);
  assert.equal(app.requests.length, 0);
  for (const filename of ['plan.pdf', 'plan.docx']) {
    app.select(filename);
    assert.equal(app.nodes['#analyze-button'].disabled, false);
    await app.click();
    assert.equal(app.nodes['#file-status'].dataset.state, 'success');
    assert.equal(app.nodes['#analysis-results'].children.length, 5);
    assert.equal(app.requests.at(-1).url, '/api/training-plan/analyze');
    assert.equal(app.requests.at(-1).options.method, 'POST');
    assert.equal(app.requests.at(-1).options.body.file.name, filename);
  }
  app.nodes['#remove-file'].handlers.click();
  assert.equal(app.nodes['#selected-file'].hidden, true);
  app.select('bad.exe');
  assert.equal(app.nodes['#file-status'].dataset.state, 'error');

  const failures = [
    [() => reply({ error: 'Key未配置' }, false), /Key未配置/],
    [() => reply({}, false, 'text/html'), /8000/],
    [() => { throw new TypeError('offline'); }, /无法连接后端/],
    [() => ({ ...reply({}), json: async () => { throw new SyntaxError(); } }), /无效 JSON/],
    [() => reply({ result: {} }), /不完整/],
    [() => { const error = new Error(); error.name = 'AbortError'; throw error; }, /超时/],
  ];
  for (const [fetchImpl, expected] of failures) {
    app = await boot(fetchImpl);
    app.select();
    await app.click();
    assert.equal(app.nodes['#file-status'].dataset.state, 'error');
    assert.match(app.nodes['#file-status'].textContent, expected);
    assert.equal(app.nodes['#analyze-button'].disabled, false);
    assert.equal(app.nodes['#plan-file'].disabled, false);
  }

  let finish;
  app = await boot(() => new Promise(resolve => { finish = resolve; }));
  app.select();
  const pending = app.click();
  assert.equal(app.nodes['#file-status'].dataset.state, 'loading');
  assert.equal(app.nodes['#analyze-button'].disabled, true);
  await app.click();
  assert.equal(app.requests.length, 1);
  finish(success());
  await pending;

  app = await boot(success, 'file:');
  app.select();
  await app.click();
  assert.match(app.nodes['#file-status'].textContent, /8000/);
  assert.equal(app.requests.length, 0);

  // Check the independent inline fallback when the external script never runs.
  const html = fs.readFileSync(path.join(__dirname, 'pages/training-plan.html'), 'utf8');
  const inline = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
  const nodes = { 'file-status': element(), 'analyze-button': element() };
  const window = { addEventListener(type, fn) { this[type] = fn; } };
  vm.runInNewContext(inline, { window, document: { getElementById: id => nodes[id] } });
  window.load();
  assert.equal(nodes['file-status'].dataset.state, 'error');
  nodes['analyze-button'].handlers.click();
  assert.match(nodes['file-status'].textContent, /初始化/);
  console.log('前端离线回归通过：按钮绑定、PDF/DOCX、请求发送、五项渲染、加载与失败状态、恢复、重复点击、脚本失败兜底。');
}
module.exports = main;
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
