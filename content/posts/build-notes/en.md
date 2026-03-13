---
title: Writing and Publishing Workflow
date: 2026-03-08
author: Demo Author
category: Tech
tags: Writing, Deployment
cover: /images/cover-build.svg
background: /images/cover-build.svg
summary: Notes on the writing and publishing workflow for this site.
---

## Writing workflow

Create a folder under `content/posts` and add `zh.md` and `en.md` files with the front matter fields:

- `title`
- `date`
- `author`
- `category`
- `summary` (optional)

## Publishing workflow

Run `npm run build`, then deploy `dist` to Cloudflare Pages.
