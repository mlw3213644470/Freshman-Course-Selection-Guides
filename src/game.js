// 信息侦探：八道虚构传闻，练习 course-info.html 的红黄绿判断标准。
const QUESTIONS = [
  {
    source: '匿名群聊截图',
    quote: '这门课不点名，期末只交一篇论文，超轻松。',
    detail: '截图没有群名、没有发送者，也没写是哪一学期。',
    answer: 'red',
    why: '考核方式和点名规则都属于最容易变的信息。截图追溯不到来源，也确认不了适用届别，按标准只能先标红。',
    next: '先不下判断：查当期课程通知，或直接问任课教师，确认考核环节后再决定。',
  },
  {
    source: '当期课程通知 + 两位不同年级的学长',
    quote: '每周有一次小组讨论，平时作业按周提交。',
    detail: '课程通知写明了小组讨论；两位不同年级的学长也说了同样的安排。',
    answer: 'green',
    why: '官方课程信息与学生反馈方向一致，属于「多项资料相互印证」，可以据此安排时间。',
    next: '落地前仍要回官方渠道核对一次：时间、地点和具体比重都可能微调。',
  },
  {
    source: '两位同学的聊天',
    quote: '这门课作业量挺大的，每周都要花不少时间。',
    detail: '两位同学都这么说，但没写是哪门教学班、哪位老师，也没说是哪一学期。',
    answer: 'amber',
    why: '只有少量学生反馈、缺少官方信息印证，属于「待核实」。它是线索，不是结论。',
    next: '再找一个独立来源：看当期课程通知，或问不同教学班的同学，确认后再判断。',
  },
  {
    source: '学院课程介绍 + 任课教师首次课说明',
    quote: '期末开卷考试，可以带一张手写笔记。',
    detail: '学院发布的课程介绍和任课教师在首次课上的说明，都写了同样的考核形式。',
    answer: 'green',
    why: '两个当期来源相互印证，且都指向同一种考核方式，属于「多项资料相互印证」。',
    next: '把老师补充的细节记下来，考前再对照当期课程通知或教学大纲确认一次。',
  },
  {
    source: '去年的选课截图',
    quote: '这门课在周一上午，教学楼 A。',
    detail: '截图能看清时间和地点，但没有显示年份，群里的转发时间是去年。',
    answer: 'red',
    why: '上课时间和地点属于最容易变化的信息。去年的截图已经过时，即使内容当时是真的，也不能作为这一届的依据。',
    next: '打开当期教务系统，按课程代码核对教学班的时间、地点和校区。',
  },
  {
    source: '几位不同专业同学的聊天',
    quote: '这门课讲得挺深的，基础不好可能会有点吃力。',
    detail: '几个人都这么说，但没人说清是哪位老师、哪个教学班，也没提供课程大纲。',
    answer: 'amber',
    why: '只有少量学生反馈，缺少教学班、教师和学期信息，无法与官方信息对齐，属于「待核实」。',
    next: '先看当期课程大纲或课程通知，再问不同教学班的同学，看说法是否一致。',
  },
  {
    source: '当期课程通知 + 一位学长的往届经验',
    quote: '这学期没有期中测验，只有期末。',
    detail: '当期课程通知写了期中测验；学长说的是他那一届没有期中。',
    answer: 'red',
    why: '传闻与当期官方通知直接冲突，而且学长的说法只适用于他那一届，关键信息无法确认，应标为红色。',
    next: '以当期课程通知为准；如果通知和课堂说明不一致，向任课教师或开课单位确认。',
  },
  {
    source: '教务系统 + 学院选课通知',
    quote: '这个教学班在周三下午上课。',
    detail: '教务系统显示的时间和学院当期选课通知上的安排一致。',
    answer: 'green',
    why: '两个当期官方来源相互印证，属于「多项资料相互印证」，可以作为安排课表的依据。',
    next: '选课前和开课前各看一次系统，确认教学班没有调整。',
  },
];

const LABELS = {
  green: '🟢 可采信',
  amber: '🟡 待核实',
  red: '🔴 无法确认',
};

function verdictFor(value, total) {
  const ratio = value / total;
  if (ratio === 1) return '满分侦探。你已经能把「官方印证」「少量反馈」「无法确认」分开了。';
  if (ratio >= 0.75) return '很接近满分了。大部分线索都判断对了，再留意来源和时效。';
  if (ratio >= 0.5) return '已经能分辨一半以上的线索。重点再练「仅有学生反馈」和「来源不明」两种情况。';
  if (value > 0) return '有收获，但还容易把线索当结论。回去对照三条标准，再玩一次会更稳。';
  return '别急。红黄绿不是评价课程，而是判断信息能用多少。先回看上面的标准，再试一次。';
}

const BEST_KEY = 'course-guide:info-detective-best-v2';

const game = document.querySelector('[data-game]');
if (game) initGame(game);

function initGame(root) {
  const stage = root.querySelector('[data-stage]');
  const result = root.querySelector('[data-result]');
  const badge = root.querySelector('[data-badge]');
  const source = root.querySelector('[data-source]');
  const quote = root.querySelector('[data-quote]');
  const detail = root.querySelector('[data-detail]');
  const current = root.querySelector('[data-progress-current]');
  const scoreEl = root.querySelector('[data-score]');
  const progress = root.querySelector('.game__progress');
  const progressBar = root.querySelector('[data-progress-bar]');
  const feedback = root.querySelector('[data-feedback]');
  const nextButton = root.querySelector('[data-next]');
  const restartButton = root.querySelector('[data-restart]');
  const resultScore = root.querySelector('[data-result-score]');
  const resultStamp = root.querySelector('[data-result-stamp]');
  const resultVerdict = root.querySelector('[data-result-verdict]');
  const resultBest = root.querySelector('[data-result-best]');
  const choices = Array.from(root.querySelectorAll('.choice[data-answer]'));

  root.querySelectorAll('[data-progress-total]').forEach((node) => {
    node.textContent = String(QUESTIONS.length);
  });
  progress.setAttribute('aria-valuemax', String(QUESTIONS.length));

  let index = 0;
  let score = 0;
  let answered = false;

  const setProgress = (done) => {
    current.textContent = String(Math.min(index + 1, QUESTIONS.length));
    progress.setAttribute('aria-valuenow', String(done));
    progressBar.style.width = `${(done / QUESTIONS.length) * 100}%`;
  };

  const row = (label, text) => {
    const p = document.createElement('p');
    const strong = document.createElement('b');
    p.className = 'feedback__row';
    strong.textContent = label;
    p.append(strong, document.createTextNode(text));
    return p;
  };

  const renderFeedback = (correct, question) => {
    const verdict = document.createElement('p');
    verdict.className = 'feedback__verdict';
    verdict.textContent = correct
      ? '✅ 判断正确，+1 分'
      : `❌ 这条标错了，正确答案是 ${LABELS[question.answer]}`;
    feedback.replaceChildren(verdict, row('为什么：', question.why), row('下一步：', question.next));
    feedback.dataset.state = correct ? 'correct' : 'wrong';
    feedback.hidden = false;
    feedback.classList.remove('is-new');
    void feedback.offsetWidth;
    feedback.classList.add('is-new');
  };

  const renderQuestion = () => {
    const question = QUESTIONS[index];
    badge.textContent = `传闻 ${String(index + 1).padStart(2, '0')}`;
    source.textContent = `来源：${question.source}`;
    quote.textContent = `“${question.quote}”`;
    detail.textContent = question.detail;

    answered = false;
    choices.forEach((button) => {
      button.disabled = false;
      button.classList.remove('is-correct', 'is-wrong');
    });
    feedback.hidden = true;
    feedback.replaceChildren();
    feedback.dataset.state = '';
    nextButton.hidden = true;
    nextButton.textContent = index === QUESTIONS.length - 1 ? '查看结果' : '下一题';
    setProgress(index);
  };

  const finish = () => {
    stage.hidden = true;
    result.hidden = false;
    resultScore.textContent = String(score);
    const ratio = score / QUESTIONS.length;
    resultStamp.textContent = ratio === 1 ? '🏅' : ratio >= 0.75 ? '🔍' : ratio >= 0.5 ? '🕵️' : '📖';
    resultVerdict.textContent = verdictFor(score, QUESTIONS.length);

    const best = readBest();
    if (score > best) {
      writeBest(score);
      resultBest.textContent = `新的最佳成绩：${score} / ${QUESTIONS.length}`;
    } else {
      resultBest.textContent = best > 0 ? `你的最佳成绩：${best} / ${QUESTIONS.length}` : '';
    }
    restartButton.focus();
  };

  choices.forEach((button) => {
    button.addEventListener('click', () => {
      if (answered) return;
      answered = true;
      const question = QUESTIONS[index];
      const correct = button.dataset.answer === question.answer;
      if (correct) score += 1;
      scoreEl.textContent = String(score);

      choices.forEach((choice) => {
        choice.disabled = true;
        if (choice.dataset.answer === question.answer) choice.classList.add('is-correct');
        if (choice === button && !correct) choice.classList.add('is-wrong');
      });

      renderFeedback(correct, question);
      setProgress(index + 1);
      nextButton.hidden = false;
      nextButton.focus({ preventScroll: true });
    });
  });

  nextButton.addEventListener('click', () => {
    if (index < QUESTIONS.length - 1) {
      index += 1;
      renderQuestion();
      return;
    }
    finish();
  });

  restartButton.addEventListener('click', () => {
    index = 0;
    score = 0;
    scoreEl.textContent = '0';
    result.hidden = true;
    stage.hidden = false;
    renderQuestion();
    choices[0].focus();
  });

  renderQuestion();
}

function readBest() {
  try {
    const value = Number(window.localStorage.getItem(BEST_KEY));
    return Number.isInteger(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // 隐私模式或本地存储不可用时，跳过成绩记录即可。
  }
}
