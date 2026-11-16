/* 浏览器只请求同源项目后端，Key 和 DeepSeek API 调用均留在后端。 */
(() => {
  "use strict";

  const input = document.querySelector("#plan-file");
  const dropzone = document.querySelector("#dropzone");
  const selected = document.querySelector("#selected-file");
  const name = document.querySelector("#file-name");
  const status = document.querySelector("#file-status");
  const remove = document.querySelector("#remove-file");
  const analyze = document.querySelector("#analyze-button");
  const results = document.querySelector("#analysis-results");
  const resultKeys = ["培养目标", "毕业要求", "课程分类", "学分要求", "注意事项"];
  const maxBytes = 20 * 1024 * 1024;
  const setupHint = "后端还没配置 DEEPSEEK_API_KEY，暂时无法分析。请在项目根目录复制 .env.example 为 .env，"
    + "填写 DEEPSEEK_API_KEY=你的密钥，然后重启 python server.py 并刷新本页。";
  let selectedFile = null;
  let dragDepth = 0;
  let busy = false;
  let keyMissing = false;

  function setStatus(message, state = "idle") {
    status.textContent = message;
    status.dataset.state = state;
  }

  function setBusy(value) {
    busy = value;
    input.disabled = value;
    remove.disabled = value;
    analyze.disabled = value || keyMissing;
    analyze.textContent = value ? "分析中，请稍候…" : "开始分析";
    results.setAttribute("aria-busy", String(value));
    dropzone.classList.toggle("is-busy", value);
  }

  function selectFile(files) {
    if (busy) return;
    if (!files.length) return; // 取消文件选择时保留原状态。
    if (files.length !== 1) {
      setStatus("请一次选择一个 PDF 或 DOCX 文件。", "error");
      return;
    }
    const file = files[0];
    // 后端仍会独立检查真实格式、大小、加密状态与页数。
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      setStatus("请选择 PDF 或 DOCX 文件。", "error");
      return;
    }
    if (!file.size || file.size > maxBytes) {
      setStatus("请选择非空且不超过 20 MiB 的 PDF 或 DOCX。", "error");
      return;
    }
    selectedFile = file;
    name.textContent = file.name; // 文件名作为文本显示，不解析为 HTML。
    selected.hidden = false;
    results.replaceChildren();
    setStatus(`已选择：${file.name}。点击“开始分析”后才会上传。`);
    setBusy(false);
  }

  input.addEventListener("change", () => {
    selectFile(input.files);
    input.value = ""; // 允许移除后或连续选择同一文件。
  });

  remove.addEventListener("click", () => {
    selectedFile = null;
    input.value = "";
    name.textContent = "";
    selected.hidden = true;
    results.replaceChildren();
    setStatus("文件已移除，可重新选择。");
    setBusy(false);
    input.focus();
  });

  dropzone.addEventListener("dragenter", (event) => {
    event.preventDefault();
    dragDepth += 1;
    if (!busy) dropzone.classList.add("is-dragging");
  });
  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  });
  dropzone.addEventListener("dragleave", () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) dropzone.classList.remove("is-dragging");
  });
  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dragDepth = 0;
    dropzone.classList.remove("is-dragging");
    if (event.dataTransfer) selectFile(event.dataTransfer.files);
  });

  // 防止文件误拖到区域外时，浏览器直接打开文件并离开本页。
  for (const type of ["dragover", "drop"]) {
    document.addEventListener(type, (event) => {
      if (Array.from(event.dataTransfer?.types ?? []).includes("Files")) {
        event.preventDefault();
      }
    });
  }

  analyze.addEventListener("click", async (event) => {
    event.preventDefault();
    if (busy) return;
    if (keyMissing) {
      setStatus(setupHint, "error");
      return;
    }
    if (!selectedFile) {
      setStatus("请先拖入或选择一个 PDF 或 DOCX 文件，再点击开始分析。", "error");
      input.focus();
      return;
    }
    if (!["http:", "https:"].includes(location.protocol)) {
      setStatus("请启动后端，并通过 http://127.0.0.1:8002 打开页面。", "error");
      return;
    }
    let timer;
    try {
      setBusy(true);
      results.replaceChildren();
      setStatus("分析中：正在上传文件并由 DeepSeek 解析和分析，可能需要数分钟。请勿关闭页面。", "loading");
      const controller = new AbortController();
      // 不自动重试，以避免重复上传解析及计费。
      timer = setTimeout(() => controller.abort(), 12 * 60 * 1000);
      const body = new FormData();
      body.append("file", selectedFile);
      const response = await fetch("/api/training-plan/analyze", {
        method: "POST", body, signal: controller.signal,
      });
      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("未连接到分析后端，请通过 http://127.0.0.1:8002 打开页面，而非 Live Server。");
      }
      let payload;
      try { payload = await response.json(); }
      catch { throw new Error("后端返回了无效 JSON，请查看运行 server.py 的终端日志。"); }
      if (!response.ok) throw new Error(payload?.error || "分析失败，请稍后重试。");
      const validItem = (item) => item && typeof item.text === "string" && item.text.trim()
        && !/[\r\n]/.test(item.text)
        && (item.source === null || (typeof item.source === "string" && item.source.trim() && !/[\r\n]/.test(item.source)));
      if (!resultKeys.every((key) => Array.isArray(payload?.result?.[key])
          && payload.result[key].length > 0 && payload.result[key].every(validItem))) {
        throw new Error("后端返回的分析结果不完整，请重试。");
      }
      for (const key of resultKeys) {
        const section = document.createElement("section");
        section.className = "plan-result-item";
        const heading = document.createElement("h3");
        heading.textContent = key;
        const list = document.createElement(key === "课程分类" ? "ol" : "ul");
        list.className = "plan-result-list";
        for (const item of payload.result[key]) {
          const row = document.createElement("li");
          const text = document.createElement("span");
          text.textContent = item.text;
          row.append(text);
          if (item.source !== null) {
            const source = document.createElement("strong");
            source.className = "plan-result-source";
            source.textContent = `（${item.source}）`;
            row.append(source);
          }
          list.append(row);
        }
        section.append(heading, list);
        results.append(section);
      }
      setStatus("分析成功，结果已显示在下方。请对照 PDF 原文核查。", "success");
    } catch (error) {
      const message = error.name === "AbortError"
        ? "等待超时，后端可能仍在处理。请稍候再试，避免重复提交。"
        : error instanceof TypeError ? "无法连接后端，请确认服务已启动并检查网络。" : error.message;
      setStatus(message, "error");
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  });

  // 启动时只探测本地后端，不接触 DeepSeek，不上传任何文件。
  async function checkBackend() {
    if (!["http:", "https:"].includes(location.protocol)) {
      setStatus("请启动 Python 后端，并通过 Vite 首页或 http://127.0.0.1:8002 打开页面。", "error");
      return;
    }
    let timer;
    try {
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), 5000);
      const response = await fetch("/api/health", { signal: controller.signal, cache: "no-store" });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("分析接口不可用，请启动 Python 后端，并通过 Vite 首页或后端地址打开页面。");
      }
      const health = await response.json();
      if (health.provider !== "deepseek") throw new Error("后端尚未更新为 DeepSeek，请重启 server.py 并刷新页面。");
      if (!health.configured) {
        keyMissing = true;
        analyze.disabled = true;
        analyze.title = "先在 .env 配置 DEEPSEEK_API_KEY 才能分析";
        setStatus(setupHint, "error");
        return;
      }
      keyMissing = false;
      analyze.disabled = false;
      analyze.removeAttribute("title");
      if (!selectedFile && !busy) setStatus("页面已就绪，请选择 PDF 或 DOCX，再点击开始分析。");
    } catch (error) {
      if (!selectedFile && !busy) setStatus(error instanceof TypeError || error.name === "AbortError"
        ? "无法连接本地后端，请启动 server.py，并通过 Vite 首页或 http://127.0.0.1:8002 访问。" : error.message, "error");
    } finally { clearTimeout(timer); }
  }
  setBusy(false);
  setStatus("页面已就绪，请选择 PDF 或 DOCX，再点击开始分析。");
  window.trainingPlanReady = true;
  checkBackend();
})();
