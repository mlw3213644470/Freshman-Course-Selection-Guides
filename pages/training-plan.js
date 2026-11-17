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
  const setupHint = "分析服务暂未配置完成，请联系站点维护者。";
  // 发布网关要求每次请求都带分享码；URL、本地 Cookie 与发布链接兜底依次尝试。
  const FALLBACK_SHARECODE = "6KMLYOQLVS";
  function currentSharecode() {
    const fromUrl = new URLSearchParams(location.search).get("sharecode");
    if (fromUrl) {
      try { document.cookie = `wb_sharecode=${encodeURIComponent(fromUrl)}; path=/; max-age=2592000; SameSite=Lax`; } catch (_) {}
      return fromUrl;
    }
    const match = document.cookie.match(/(?:^|;\s*)wb_sharecode=([^;]+)/);
    if (match) {
      try { return decodeURIComponent(match[1]); } catch (_) { return match[1]; }
    }
    return FALLBACK_SHARECODE;
  }
  function apiUrl(path) {
    const code = currentSharecode();
    return code ? `${path}?sharecode=${encodeURIComponent(code)}` : path;
  }
  let selectedFile = null;
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

  function hasFiles(event) {
    return Array.from(event.dataTransfer?.types ?? []).includes("Files");
  }

  // 整页都可拖入文件：拖到区域外也会选中，并阻止浏览器直接打开文件。
  document.addEventListener("dragover", (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    if (!busy) dropzone.classList.add("is-dragging");
  });
  document.addEventListener("dragleave", (event) => {
    if (!event.relatedTarget) dropzone.classList.remove("is-dragging");
  });
  document.addEventListener("drop", (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dropzone.classList.remove("is-dragging");
    if (event.dataTransfer) selectFile(event.dataTransfer.files);
  });

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
      setStatus("请通过浏览器访问本站链接后重试。", "error");
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
      const response = await fetch(apiUrl("/api/training-plan/analyze/async"), {
        method: "POST", body, signal: controller.signal, credentials: "include",
      });
      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error(`分析接口返回了网页而非数据（HTTP ${response.status}），请从完整分享链接重新进入后重试。`);
      }
      let payload;
      try { payload = await response.json(); }
      catch { throw new Error("后端返回了无效数据，请稍后重试。"); }
      if (!response.ok) throw new Error(payload?.error || "分析失败，请稍后重试。");
      // 本地旧版后端仍可能直接返回结果；线上后端返回任务号后轮询进度。
      if (!payload?.result) {
        const jobId = payload?.job_id;
        if (!jobId) throw new Error("后端未返回任务编号，请重试。");
        const startedAt = Date.now();
        const pollMs = Number(window.TRAINING_PLAN_POLL_MS) || 2000;
        setStatus("文件已上传，正在后台分析，通常需要几分钟。请勿关闭页面。", "loading");
        while (true) {
          await new Promise((resolve) => setTimeout(resolve, pollMs));
          const statusResponse = await fetch(
            apiUrl(`/api/training-plan/analyze/status/${encodeURIComponent(jobId)}`),
            { signal: controller.signal, cache: "no-store", credentials: "include" }
          );
          if (!statusResponse.headers.get("content-type")?.includes("application/json")) {
            throw new Error(`查询分析进度失败（HTTP ${statusResponse.status}），请稍后重试。`);
          }
          const statusPayload = await statusResponse.json();
          if (!statusResponse.ok) throw new Error(statusPayload?.error || "查询分析进度失败。");
          if (statusPayload.status === "done") {
            payload = statusPayload;
            break;
          }
          if (statusPayload.status === "error") {
            throw new Error(statusPayload.error || "分析失败，请重试。");
          }
          const seconds = Math.round((Date.now() - startedAt) / 1000);
          setStatus(`后台分析中…已等待 ${seconds} 秒，请勿关闭页面。`, "loading");
        }
      }
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
      setStatus("请通过本站链接访问培养方案页面。", "error");
      return;
    }
    let timer;
    try {
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(apiUrl("/api/health"), { signal: controller.signal, cache: "no-store", credentials: "include" });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
        throw new Error(`分析接口暂不可用（HTTP ${response.status}），请从完整分享链接重新进入后重试。`);
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
        ? "无法连接分析后端，请检查网络后重试。" : error.message, "error");
    } finally { clearTimeout(timer); }
  }
  setBusy(false);
  setStatus("页面已就绪，请选择 PDF 或 DOCX，再点击开始分析。");
  window.trainingPlanReady = true;
  checkBackend();
})();
