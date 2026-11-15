/* 本阶段仅管理本地 File 引用，不读取正文、不持久化、不发起网络请求。 */
(() => {
  "use strict";

  const input = document.querySelector("#plan-file");
  const dropzone = document.querySelector("#dropzone");
  const selected = document.querySelector("#selected-file");
  const name = document.querySelector("#file-name");
  const status = document.querySelector("#file-status");
  const remove = document.querySelector("#remove-file");
  let selectedFile = null;
  let dragDepth = 0;

  function selectFile(files) {
    if (!files.length) return; // 取消文件选择时保留原状态。
    if (files.length !== 1) {
      status.textContent = "请一次选择一个 PDF 或 DOCX 文件。";
      return;
    }
    const file = files[0];
    // 前端按扩展名筛选；未来后端仍需独立验证真实文件格式。
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      status.textContent = "不支持此文件格式，请选择 PDF 或 DOCX 文件。";
      return;
    }
    selectedFile = file;
    name.textContent = file.name; // 文件名作为文本显示，不解析为 HTML。
    selected.hidden = false;
    status.textContent = `已选择：${file.name}。文件仅保留在本页，尚未上传或分析。`;
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
    status.textContent = "文件已移除，可重新选择。";
    input.focus();
  });

  dropzone.addEventListener("dragenter", (event) => {
    event.preventDefault();
    dragDepth += 1;
    dropzone.classList.add("is-dragging");
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

  // 后端接入位置：启用分析按钮，在提交处理器中使用 selectedFile。
  // 仅在用户主动提交后发起请求，并将真实响应渲染到 #analysis-results。
})();
