# Minimal Personal Static Blog

一个参考 Hexo 思路的简约个人网站：

- `about` 页面
- `category` 分类页
- `search` 搜索页（前端静态搜索）
- 页面切换加载动画（仅在切换耗时可感知时出现）
- 主题自动切换（按浏览器本地时间：白天浅色、夜间深色），并可手动切换
- 文章采用**单文件**格式：`文字 + 时间 + 作者 + 分类`
- 支持文章封面图（`cover` 字段）
- 页面模板与文章内容分离
- 构建产物纯静态，可部署到 Cloudflare Pages

## 目录结构

```text
content/posts/          # 文章单文件（Markdown）
src/templates/          # 页面模板
src/assets/             # 样式
src/static/             # 静态配置文件（如 _redirects）
scripts/build.mjs       # 静态构建脚本
dist/                   # 构建输出（部署目录）
```

## 新增文章（只改一个文件）

在 `content/posts/` 新建 `xxx.md`：

```md
---
title: 文章标题
date: 2026-03-09
author: 你的名字
category: 分类名
cover: https://example.com/cover.jpg
summary: 摘要（可选）
---

这里写正文。
```

然后执行：

```bash
npm run build
```

## 本地预览

```bash
npm run dev
```

打开 `http://localhost:4173`。

## Cloudflare 一键部署

1. 把仓库推送到 GitHub。
2. 点击下方按钮并选择你的仓库：

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=YOUR_GITHUB_REPO_URL)

3. 在 Cloudflare Pages 构建设置中填写：
   - Build command: `npm run build`
   - Build output directory: `dist`

> 把 `YOUR_GITHUB_REPO_URL` 替换成你的仓库地址，例如 `https://github.com/<you>/<repo>`。
