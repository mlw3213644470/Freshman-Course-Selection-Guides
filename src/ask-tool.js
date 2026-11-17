// 提问模板生成器：把年级、专业和关心点拼成一段可直接复制的提问。
const CONCERNS = {
  content: '课程内容：这门课主要讲什么？需要提前具备哪些基础？',
  workload: '学习任务：平时有哪些作业、实验或小组任务？每周大概要投入多少时间？',
  assessment: '考核方式：考核包含哪些环节（考试、论文、展示等）？各环节大概怎么分配？',
  experience: '往届经验：你这条经验是哪一届、哪个专业的情况？现在这一届还适用吗？',
};

const form = document.querySelector('[data-ask-form]');
if (form) initAskTool(form);

function initAskTool(tool) {
  const grade = tool.querySelector('[data-ask-grade]');
  const major = tool.querySelector('[data-ask-major]');
  const target = tool.querySelector('[data-ask-target]');
  const result = tool.querySelector('[data-ask-result]');
  const copy = tool.querySelector('[data-ask-copy]');
  const reset = tool.querySelector('[data-ask-reset]');
  const status = tool.querySelector('[data-ask-status]');
  const concernInputs = Array.from(tool.querySelectorAll('input[name="concern"]'));
  let generated = false;

  const setStatus = (message, state = '') => {
    status.textContent = message;
    status.dataset.state = state;
  };

  const build = () => {
    const gradeText = grade.value.trim();
    const majorText = major.value.trim();
    const targetText = target.value.trim();
    const selected = concernInputs.filter((input) => input.checked).map((input) => input.value);

    const intro = targetText
      ? `你好！我是${gradeText}${majorText}的新生，想请教一下「${targetText}」的情况。`
      : `你好！我是${gradeText}${majorText}的新生，想请教一下选课的情况。`;

    const lines = [intro];
    if (selected.length) {
      lines.push('', '我最关心这几点：');
      selected.forEach((key, index) => lines.push(`${index + 1}. ${CONCERNS[key]}`));
    }
    lines.push('', '方便的话，能不能结合你当时的实际情况说说？如果这条经验有适用的年级、专业或学期，也请一并说明，谢谢！');
    return lines.join('\n');
  };

  const validate = () => {
    if (!grade.value.trim()) {
      setStatus('先填一下年级，问题才更有针对性。', 'error');
      grade.focus();
      return false;
    }
    if (!major.value.trim()) {
      setStatus('再补上专业，学长学姐才好判断适用情况。', 'error');
      major.focus();
      return false;
    }
    if (!concernInputs.some((input) => input.checked)) {
      setStatus('至少选一个关心点，回答的人才知道从哪儿说起。', 'error');
      concernInputs[0].focus();
      return false;
    }
    return true;
  };

  const fillResult = () => {
    result.value = build();
    copy.disabled = false;
    generated = true;
  };

  const legacyCopy = () => {
    result.focus();
    result.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    }
  };

  tool.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!validate()) return;
    fillResult();
    setStatus('已生成，可以直接复制。', 'success');
    result.focus();
  });

  tool.addEventListener('input', () => {
    if (!generated) return;
    if (!grade.value.trim() || !major.value.trim() || !concernInputs.some((input) => input.checked)) {
      copy.disabled = true;
      setStatus('补全年级、专业并至少保留一个关心点，模板会自动更新。', 'error');
      return;
    }
    result.value = build();
    copy.disabled = false;
    setStatus('已根据修改更新模板。', '');
  });

  copy.addEventListener('click', async () => {
    if (!result.value) return;
    const text = result.value;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        setStatus('已复制，可以直接粘贴到群里或帖子里。', 'success');
        return;
      }
      throw new Error('clipboard unavailable');
    } catch {
      const copied = legacyCopy();
      setStatus(
        copied ? '已复制，可以直接粘贴到群里或帖子里。' : '自动复制没成功，已选中文字，请手动复制。',
        copied ? 'success' : 'error',
      );
    }
  });

  reset.addEventListener('click', () => {
    tool.reset();
    result.value = '';
    copy.disabled = true;
    generated = false;
    setStatus('已清空，可以重新填写。', '');
    grade.focus();
  });
}
