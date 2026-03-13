---
title: 写作与发布流程
date: 2026-03-08
author: 示例作者
category: 技术
tags: 写作, 部署
cover: /images/cover-build.svg
background: /images/cover-build.svg
summary: 记录这个站点的日常写作流程与部署方式。
---

## 写作流程

先在 `content/posts` 下创建一个文件夹，并在其中准备 `zh.md` 与 `en.md`：

- `title`
- `date`
- `author`
- `category`
- `summary`（可选）

## 发布流程

执行 `npm run build`，然后把 `dist` 部署到 Cloudflare Pages。
