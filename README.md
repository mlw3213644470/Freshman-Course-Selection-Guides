# Freshman-Course-Selection-Guides

原生 HTML/CSS/JS 前端，Python Flask 本地后端。培养方案分析使用 DeepSeek 官方 API，浏览器只访问本项目后端。首页和全局视觉样式保持不变。

## 配置与启动

在 Windows PowerShell 中进入仓库。已有虚拟环境时无需重复创建：

```powershell
cd E:\数智杯\Freshman-Course-Selection-Guides
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

若使用 8001 端口：先在原来运行该服务的终端按 Ctrl+C，再执行以下命令（不启用自动重载）：

```powershell
cd E:\数智杯\Freshman-Course-Selection-Guides
.\.venv\Scripts\python.exe -m flask --app server:create_app run --host 127.0.0.1 --port 8001
```

随后打开 <http://127.0.0.1:8001/>；前端 API 使用同源相对路径，会请求 8001。直接运行 `server.py` 仍默认使用 8000。

打开 <http://127.0.0.1:8000/>，点击“培养方案”，拖入或选择一个 PDF/DOCX，再点击“开始分析”。这一步才会上传文件并触发真实计费；启动服务、打开页面、选择文件、检查健康状态均不调用 DeepSeek。不使用 Live Server 进行分析。

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

结果接口保持 `{"result":{"培养目标":"…","毕业要求":"…","课程分类":"…","学分要求":"…","注意事项":"…"}}`；失败为 `{"error":"提示"}`。页面刷新后本地选择和结果消失，不建立文档或结果数据库。

## “开始分析”没有反应时

- 未选择文件点击按钮，会提示先选 PDF/DOCX；分析过程中禁用按钮以防重复请求。
- 页面加载后显示“页面已就绪”。若脚本丢失或初始化失败，页面会显示错误；使用 Ctrl+F5 强制刷新。静态资源使用 no-store，脚本链接有版本参数。
- 本地后端未启动、Key 未配置、使用 Live Server、后端仍是旧版本都会显示提示。可访问 <http://127.0.0.1:8000/api/health> 检查。
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
