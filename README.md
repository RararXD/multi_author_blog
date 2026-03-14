# Minimal Personal Static Blog

一个参考 Hexo 思路的简约个人网站（纯静态构建）：

- `about` 页面
- `authors` 作者列表页 + 作者详情页
- `category` 分类页
- `tags` 标签详情页（由标签云进入）
- `/posts/` 全部文章页（首页“更多.....”入口）
- `search` 搜索页（前端静态搜索）
- 首页仅展示最新三篇文章，并提供可交互的分类 Tag 云
- 页面切换过渡动画（轻量淡入/淡出）
- 主题自动切换（按本地时间：白天浅色、夜间深色），并可手动切换
- 文章支持多作者，作者名可点击跳转作者页
- 支持文章封面图（`cover`）
- 支持页面背景图（按页面配置/Front Matter），并随主题自动调整亮度与透明度
- 支持 Giscus 评论（GitHub 登录与头像/用户名展示）
- 页面模板与内容分离
- 构建产物纯静态，可部署到 Cloudflare Pages

## 目录结构

```text
content/posts/          # 文章单文件（Markdown）
content/authors/        # 作者资料（Markdown）
content/images/         # 网站与内容图片（封面、logo、背景等）
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
# 或者使用 authors 支持多作者：
# authors: 张三, 李四
category: 分类名
tags: 标签1, 标签2
cover: /images/cover-hello.svg
background: /images/cover-build.svg
hidden: false
locked: false
# password: your-password
summary: 摘要（可选）
---

这里写正文。
```

说明：

- `author` 与 `authors` 二选一即可；`authors` 可用中英文逗号分隔多个作者。
- `background` 可选，支持单篇文章独立背景图。
- `hidden: true` 时，文章不会出现在首页/分类/搜索/作者页列表，只能通过直链访问。
- `locked: true` 且设置 `password` 后，文章默认只显示标题和作者，输入密码后可查看正文。
- `category` 用于分类页聚合，`tags` 用于标签云与标签详情页。

## 新增作者资料

在 `content/authors/` 新建 `xxx.md`：

```md
---
name: 作者名
headline: 一句话介绍（可选）
summary: 作者摘要（用于列表卡片）
background: /images/cover-build.svg
---

这里写作者简介正文。
```

构建后会生成：

- `/authors/` 作者列表
- `/authors/<slug>/` 作者详情（含该作者文章列表）

## 页面背景图配置

- 全站静态页面背景（首页/关于/分类/搜索/404）在 `scripts/build.mjs` 的 `pageBackgrounds` 中配置。
- 首页默认不启用背景图。
- 文章页和作者详情页可通过 Front Matter 的 `background`（或 `bg`）单独配置。

## 响应式与过渡

- 已适配移动端和窄窗口 PC，避免卡片/导航错位。
- 页面切换使用轻量淡入淡出，避免花哨动画；并兼容 `prefers-reduced-motion`。

## 评论区（Giscus）

评论区为纯前端加载，使用 GitHub 登录，显示对应头像与用户名，并支持在文章中选中文字后“引用评论”。

配置文件：`src/static/comments.json`（构建时读取）。

你需要在 Giscus 管理页拿到以下字段并填写：

- `repo`
- `repoId`
- `category`
- `categoryId`

常用可选项：

- `mapping`：评论与文章的映射方式，默认 `pathname`
- `lang`：评论区语言，默认 `zh-CN`
- `themeLight` / `themeDark`：明暗主题，切换站点主题时会自动同步
- `quoteMaxLength`：引用选中文字的最大长度（默认 800）

设置 `enabled: true` 后，构建即可生效。

使用说明：

- 发表评论：在评论区使用 GitHub 登录后输入并提交。
- 引用正文：选中正文中的一段文字，会出现“引用评论”按钮；点击后会复制引用并自动滚动到评论区，在输入框粘贴即可。

## 本地预览

```bash
npm run build
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
