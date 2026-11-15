# Freshman-Course-Selection-Guides

原生 HTML/CSS/JS 前端，Python Flask 本地后端。培养方案作为独立板块运行，分析使用 DeepSeek 官方 API，浏览器只访问本项目后端。页面和资源全部位于仓库内，不依赖仓库外的首页 HTML、CSS 或图片，也不提供“返回首页”链接。

## 配置与启动

在 Windows PowerShell 中进入克隆后的仓库目录（位置和文件夹名称不限）。已有虚拟环境时无需重复创建：

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

在本机编辑仓库根目录的 `.env`：

```dotenv
DEEPSEEK_API_KEY=你的DeepSeek官方APIKey
```

模型固定为 `deepseek-flash`。旧服务商的变量不再读取，可以自行删除；不要将 Key 写入前端或发送到聊天中。真实 `.env` 不会被本项目改写，已被 Git 忽略，后端静态白名单也不会提供它的访问。进程环境变量优先于 `.env`。

启动（修改配置或后端代码后，先在原终端按 Ctrl+C，再重新运行）：

```powershell
.\.venv\Scripts\python.exe server.py
```

默认端口统一为 **8002**。

打开 <http://127.0.0.1:8002/pages/training-plan.html> 即可直接使用培养方案页面；根地址 <http://127.0.0.1:8002/> 也会跳转至此。拖入或选择一个 PDF/DOCX，再点击“开始分析”。这一步才会上传文件并触发真实计费；启动服务、打开页面、选择文件、检查健康状态均不调用 DeepSeek。不使用 Live Server 进行分析。

队友将来在同一 Python 服务提供的首页中链接到 `/pages/training-plan.html` 即可。如果首页由其他域名或端口提供，请链接到培养方案 Python 后端的完整地址，例如本地开发时的 `http://127.0.0.1:8002/pages/training-plan.html`；页面和 `/api` 必须由同一后端提供。部署后使用实际后端域名。旧的 `/Freshman-Course-Selection-Guides/pages/training-plan.html` 路径保留兼容，但新链接建议统一使用 `/pages/training-plan.html`。

## VS Code 启动与集成浏览器

队友克隆后直接在 VS Code 打开仓库目录，仓库自带 `.vscode/launch.json`，路径使用 `${workspaceFolder}`，无需本机父目录配置。在“运行和调试”中选择“Python 后端（8002）”，按 F5，启动成功后会打开集成浏览器。Python 调试需要 Microsoft Python Debugger 扩展。

若已在终端启动后端，选择“集成浏览器预览（8002）”即可，仅打开页面，不再启动一个后端。也可运行 VS Code 命令 `Browser: Open Integrated Browser` 并输入 `http://127.0.0.1:8002/pages/training-plan.html`。

停止旧服务：终端启动的服务在其终端按 Ctrl+C；调试启动的服务使用“停止调试”（Shift+F5）。然后重新启动。不要用 Live Server 或直接打开 HTML 文件进行培养方案分析，页面和 `/api` 必须由同一个 Python 后端提供。

## 文件与接口

- `server.py`：本地服务，`POST /api/training-plan/analyze` 接收 multipart 字段 `file`；`GET /api/health` 仅返回后端类型、模型和是否已配置 Key，不返回 Key。
- `pages/training-plan.html`：保留现有页面和五项分析展示；增加脚本加载失败提示。
- `pages/training-plan.js`：本地文件选择、按钮事件、后端连通性检查、分析中/成功/失败状态。模型输出通过 `textContent` 展示，不执行 HTML。
- `pages/training-plan.css`、`global.css`：保持原有视觉样式。
- `PROMPT`：五项分析要求的修改位置。仅依据文件输出培养目标、毕业要求、课程分类、学分要求和注意事项，无依据时写“原文未说明”。模型结果需对照原文核查。

项目限制单文件 20 MiB；PDF 最多 200 页，验证文件头、可解析性和加密状态；DOCX 验证 ZIP/Office 文档结构及解压大小。不支持加密、损坏文件。实际格式仍由 DeepSeek 独立验证。

官方调用链：
1. `POST https://api.deepseek.com/files`，multipart 明确按 `purpose=text_recognition`、`file` 的顺序发送。
2. 上传请求会等待解析完成后返回 ID，无需状态轮询。上传包含解析，客户端单次读取/写入超时设为 300 秒。
3. `POST https://api.deepseek.com/responses`，使用 `deepseek-flash`、`stream=true`，在 user 内容中传入 `input_file.file_id`，分析要求放在 `instructions`。后端按 SSE 帧收集 `response.output_text.delta`，只有收到有效的 `response.completed` 才解析五项 JSON 并返回前端；前端不直接消费 SSE，原接口不变。
4. 只要拿到文件 ID，成功或失败后都在 finally 中尝试 `DELETE /files/{id}`。删除失败不会覆盖分析结果，后端终端会提示。

`text_recognition` 只识别文字，不向模型提供文档插图。上传解析本身可能产生费用；不会自动重试。若上传已解析成功但连接超时，后端可能拿不到 ID，无法自动删除；服务异常退出也可能留下文件，请到 DeepSeek 平台检查残留文件。未设置自动过期期限。

后端终端会记录收到分析请求、上传开始、模型分析开始、清理和完成等阶段。失败记录步骤、HTTP 状态码、截短并脱敏的错误代码/消息或网络异常类型，不打印 Key、PDF/DOCX 内容、完整请求或完整响应。前端只显示安全、明确的错误提示。

模型流日志包含 `started`、`first_event`、`completed` 或 `interrupted` 以及相对模型请求开始的 `elapsed` 秒数，不输出事件正文、delta 或推理内容。`response.incomplete`、`response.failed`、SSE 格式错误、EOF 缺少完成事件、RemoteProtocolError 均按失败处理，不返回部分文本；读取超时返回 504，断流等错误返回 502。不会自动重试上传或模型请求。

模型读取超时为 120 秒（两次网络读取之间的空闲上限，并非模型总时长）。上传与模型分析共享 660 秒的硬性总时限，持续心跳也无法延长；清理独立限制最多 15 秒。后端网络处理预算最多约 675 秒，低于前端 720 秒，留有约 45 秒的余量用于验证与本地传输。如另加反向代理，也需为此同步请求配置足够长的等待时间。SSE 可降低长时间无响应造成的断连风险，但不能消除上游或网络故障。

结果接口为 `{"result":{"培养目标":[{"text":"结论","source":null}],"毕业要求":[...],"课程分类":[...],"学分要求":[...],"注意事项":[...]}}`（结构示意，省略号不是实际 JSON）。五个板块均为非空条目数组，每条包含非空、单行的纯文本 `text` 与字符串或 `null` 的 `source`。正常培养目标需 2～3 条；整个板块无依据时统一返回 `[{"text":"原文未说明","source":null}]`。出处无法确认时使用 `null`，不编造页码。

毕业要求与学分要求一项一条，出处由前端在同一条末尾用青绿色、加粗括号标记显示。课程分类使用有序列表，其余使用无序列表。全部内容通过 `textContent` 创建，不渲染模型 HTML。学分原始数字、单位、范围和条件不得为简短而省略，后端不截短条目。旧版字符串结果会被拒绝，不能混用旧后端与新前端。失败仍为 `{"error":"提示"}`。页面刷新后本地选择和结果消失，不建立文档或结果数据库。

## “开始分析”没有反应时

- 未选择文件点击按钮，会提示先选 PDF/DOCX；分析过程中禁用按钮以防重复请求。
- 页面加载后显示“页面已就绪”。若脚本丢失或初始化失败，页面会显示错误；使用 Ctrl+F5 强制刷新。静态资源使用 no-store，脚本链接有版本参数。
- 本地后端未启动、Key 未配置、使用 Live Server、后端仍是旧版本都会显示提示。可访问 <http://127.0.0.1:8002/api/health> 检查。
- 点击后浏览器 Network 中应出现 `POST /api/training-plan/analyze`，终端应出现“培养方案分析 received”。若没有请求，检查浏览器 Console 中的脚本错误；若有请求，根据终端的失败步骤定位。
- 网络断开、非 JSON 响应、后端 HTTP 错误、结果不完整、等待超时均显示错误；finally 恢复按钮。前端最长等待 12 分钟，超时后服务端可能仍在处理，请避免立即重复提交。

后端只监听 127.0.0.1，本版本供本机开发使用，不含公开部署所需的用户认证和配额管理。

## 离线测试

```powershell
.\.venv\Scripts\python.exe -m unittest -v test_server
```

测试使用生成的 PDF/DOCX 和 MockTransport，并阻止真实 HTTP 传输。不需要真实 Key，不调用 DeepSeek。前端回归测试 `test_frontend.cjs` 使用 Node.js 内置 vm 和模拟 fetch，不发起真实请求：

后端流式测试覆盖字节分片、CRLF、多行 data、心跳、终止事件、完整文本后异常断流、超时和清理；同步与异步真实 HTTP transport 均被测试拦截。

```powershell
node test_frontend.cjs
```

实现依据：
- [DeepSeek File Parsing](https://api-docs.deepseek.com/guides/document_parsing/)
- [DeepSeek Files API](https://api-docs.deepseek.com/guides/files_api/)
- [DeepSeek Responses API](https://api-docs.deepseek.com/guides/responses_api/)
