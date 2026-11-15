# Freshman-Course-Selection-Guides

新生选课指南（静态页面 + Vite 开发/构建）。

## 环境要求

Node.js 20+（当前使用 v24）。

## 开发

```bash
npm install   # 首次运行安装依赖
npm run dev   # 启动开发服务器，默认 http://localhost:5173
```

## 构建与预览

```bash
npm run build     # 产物输出到 dist/
npm run preview   # 本地预览构建结果
```

## 目录结构

```text
index.html   页面入口
script.js    页面逻辑（以 ES module 方式加载）
package.json 依赖与脚本
```
