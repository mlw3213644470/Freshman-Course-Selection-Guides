# Freshman-Course-Selection-Guides

武汉大学选课经验网页：《选课经验：少走弯路，排好第一份课表》。

核心原则：**只做选课指导，不给具体数据和链接**。页面只写判断方法、核对步骤和该去问谁，不列课程名单、学分、给分、通过率，也不跳转外部地址。

## 页面结构

| 文件 | 内容 |
| --- | --- |
| `index.html` | 首页：蜿蜒路线串联五个板块，可直达「选前准备」 |
| `首页.html` | 独立封面式首页：以武汉大学牌楼照片为首屏，提供选课准备、课程比较、课表安排与常见问题入口 |
| `prep.html` | 选前准备：读懂毕业要求、整理清单、检查选课条件 |
| `course-info.html` | 课程信息：对照清单、打听问题模板、红黄绿提示 |
| `schedule.html` | 课表安排：放固定课 → 填自选 → 检查整周 → 备选方案 |
| `after.html` | 选后调整：立即核对、开课复盘、调整前确认 |
| `faq.html` | 常见问题：4 组场景、15 条折叠问答 |
| `sources.html` | 经验来源与贡献：来源分类、经验卡字段、纠错与更新记录 |
| `pages/training-plan.html` | 培养方案：上传 PDF 或 DOCX，由本地 Python 后端调用 DeepSeek 分析 |

板块之间用「上一步 / 下一步」按钮按顺序串联；首页与页脚的导航可跳到任意板块。

## 开发

需要 Node.js 20+。

```bash
npm install     # 首次运行安装依赖
npm run dev     # 开发服务器，默认 http://localhost:5173
npm run build   # 构建到 dist/
npm run preview # 预览构建结果
```

### 本机演示培养方案分析

首页的「分析培养方案」按钮和导航中的「培养方案」会打开 `/pages/training-plan.html`。Vite 开发服务器将该页面和 `/api` 请求转发到本机 Python 后端。需要同时启动两个服务：

1. 在项目目录配置 `.env` 中的 `DEEPSEEK_API_KEY`（此文件不提交到 Git）。已有 `.env` 的电脑无需重复填写。
2. 在一个终端运行 `python -m pip install -r requirements.txt`，然后运行 `python server.py`。后端监听 `http://127.0.0.1:8002`。
3. 在另一个终端运行 `npm install`（首次运行时），然后运行 `npm run dev`。
4. 打开 Vite 输出的首页地址（通常是 `http://localhost:5173`），点击「分析培养方案」。

换电脑演示时，需要在那台电脑单独配置 Key 并安装 Node/Python 依赖。只启动 Vite 时，首页可打开，但培养方案页和分析接口不可用。部署时应由服务器保存 Key，并将 `/pages/training-plan*` 和 `/api/*` 转发给 Python 后端。

## 实现说明

- `src/guide.css`：全站样式（珞珈绿 + 米白纸质），含首页路线与移动端时间轴布局。
- `src/guide.js`：注入页头页脚导航、标记当前板块、问答「全部展开／收起」、滚动渐显。
- `vite.config.js`：选课指南多页构建入口（上面 7 个页面），以及本机培养方案页和 API 的开发代理。

## 旧版文件

`课程信息.html`、`课程数据.js`、`style.css` 及 `pages/` 中除培养方案外的页面为早期实验内容，**不参与选课指南构建**。培养方案页使用 `global.css` 和 `assets/campus-background.png`。
