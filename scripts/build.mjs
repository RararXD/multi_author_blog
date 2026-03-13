import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import MarkdownIt from 'markdown-it';
import markdownItFootnote from 'markdown-it-footnote';
import markdownItMark from 'markdown-it-mark';
import markdownItTaskLists from 'markdown-it-task-lists';

const root = process.cwd();
const srcDir = path.join(root, 'src');
const contentDir = path.join(root, 'content');
const postsDir = path.join(contentDir, 'posts');
const authorsDir = path.join(contentDir, 'authors');
const imagesDir = path.join(contentDir, 'images');
const distDir = path.join(root, 'dist');
const pageBackgrounds = {
  home: '',
  about: '/images/cover-build.svg',
  authors: '/images/cover-hello.svg',
  categories: '/images/cover-build.svg',
  search: '/images/cover-hello.svg',
  notFound: '/images/cover-build.svg'
};
const commentsConfigPath = path.join(srcDir, 'static', 'comments.json');

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(value || '').trim().toLowerCase());
}

function readJson(file, fallback = {}) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(read(file));
  } catch (error) {
    return fallback;
  }
}

function loadCommentsConfig() {
  const raw = readJson(commentsConfigPath, {});
  return {
    enabled: parseBoolean(raw.enabled),
    provider: raw.provider || 'giscus',
    repo: raw.repo || '',
    repoId: raw.repoId || '',
    category: raw.category || '',
    categoryId: raw.categoryId || '',
    mapping: raw.mapping || 'pathname',
    strict: parseBoolean(raw.strict) ? '1' : '0',
    reactionsEnabled: parseBoolean(raw.reactionsEnabled ?? true) ? '1' : '0',
    emitMetadata: parseBoolean(raw.emitMetadata) ? '1' : '0',
    inputPosition: raw.inputPosition || 'top',
    lang: raw.lang || 'zh-CN',
    themeLight: raw.themeLight || 'light',
    themeDark: raw.themeDark || 'dark',
    loading: raw.loading || 'lazy',
    quoteMaxLength: Number.isFinite(raw.quoteMaxLength) ? raw.quoteMaxLength : 800
  };
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function removeDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content);
}

function copyDirRecursive(src, target) {
  ensureDir(target);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(from, to);
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
    }
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const markdown = createMarkdownRenderer();

function createMarkdownRenderer() {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true
  });

  md.use(markdownItFootnote);
  md.use(markdownItMark);
  md.use(markdownItTaskLists, { label: true, labelAfter: true });

  const defaultFence = md.renderer.rules.fence || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const info = (token.info || '').trim();
    if (info === 'mermaid') {
      return `<div class="mermaid">${escapeHtml(token.content)}</div>`;
    }
    return defaultFence(tokens, idx, options, env, self);
  };

  md.core.ruler.push('callouts', (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i += 1) {
      if (tokens[i].type !== 'blockquote_open') continue;

      let level = 1;
      let closeIndex = i + 1;
      while (closeIndex < tokens.length && level > 0) {
        if (tokens[closeIndex].type === 'blockquote_open') level += 1;
        if (tokens[closeIndex].type === 'blockquote_close') level -= 1;
        if (level === 0) break;
        closeIndex += 1;
      }
      if (level !== 0) continue;

      let inlineIndex = -1;
      for (let j = i + 1; j < closeIndex; j += 1) {
        if (tokens[j].type === 'inline') {
          inlineIndex = j;
          break;
        }
      }
      if (inlineIndex === -1) {
        i = closeIndex;
        continue;
      }

      const content = tokens[inlineIndex].content.trim();
      const match = content.match(/^\[!([a-zA-Z]+)\](?:\s*(.+))?$/);
      if (!match) {
        i = closeIndex;
        continue;
      }

      const rawType = match[1].toLowerCase();
      const titleOverride = (match[2] || '').trim();
      const allowed = ['note', 'tip', 'warning', 'caution', 'important'];
      const calloutType = allowed.includes(rawType) ? rawType : 'note';
      const titleText = titleOverride || calloutType[0].toUpperCase() + calloutType.slice(1);

      const paragraphOpen = inlineIndex - 1;
      const paragraphClose = inlineIndex + 1;
      if (tokens[paragraphOpen]?.type === 'paragraph_open' && tokens[paragraphClose]?.type === 'paragraph_close') {
        tokens.splice(paragraphOpen, 3);
        if (paragraphOpen < closeIndex) closeIndex -= 3;
      }

      tokens[i].type = 'callout_open';
      tokens[i].tag = 'div';
      tokens[i].attrSet('class', `callout callout-${calloutType}`);
      tokens[closeIndex].type = 'callout_close';
      tokens[closeIndex].tag = 'div';

      const titleOpen = new state.Token('paragraph_open', 'p', 1);
      titleOpen.attrSet('class', 'callout-title');
      const titleInline = new state.Token('inline', '', 0);
      titleInline.content = titleText;
      titleInline.children = [];
      const titleClose = new state.Token('paragraph_close', 'p', -1);

      tokens.splice(i + 1, 0, titleOpen, titleInline, titleClose);
      i = closeIndex + 3;
    }
  });

  return md;
}

function slugify(input) {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')
    .replace(/(^-|-$)/g, '');
}

function parseFrontMatter(raw) {
  if (!raw.startsWith('---')) {
    return { meta: {}, body: raw.trim() };
  }

  const end = raw.indexOf('\n---', 3);
  if (end === -1) {
    return { meta: {}, body: raw.trim() };
  }

  const fm = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).trim();
  const meta = {};

  for (const line of fm.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    meta[key] = value;
  }

  return { meta, body };
}

function markdownToHtml(md) {
  return markdown.render(md);
}

function template(input, vars) {
  return input.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_, key) => vars[key] ?? '');
}

function coverImage(url, cls, alt) {
  if (!url) return '';
  return `<img class="${cls}" src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy" />`;
}

function buildBodyAttrs(backgroundImage) {
  const raw = String(backgroundImage || '').trim();
  if (!raw) {
    return {
      bodyClass: '',
      bodyStyle: ''
    };
  }

  const cssUrl = `url("${raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`;
  return {
    bodyClass: 'with-page-bg',
    bodyStyle: `--page-bg-image: ${escapeHtml(cssUrl)};`
  };
}

function renderLayoutPage(layout, pageVars, backgroundImage = '') {
  const bodyAttrs = buildBodyAttrs(backgroundImage);
  const mergedBodyClass = [pageVars.bodyClass, bodyAttrs.bodyClass].filter(Boolean).join(' ');
  const mergedBodyStyle = [pageVars.bodyStyle, bodyAttrs.bodyStyle].filter(Boolean).join(' ');
  return template(layout, {
    ...pageVars,
    ...bodyAttrs,
    bodyClass: mergedBodyClass,
    bodyStyle: mergedBodyStyle
  });
}

function excerpt(text, length = 120) {
  const trimmed = String(text).replace(/\s+/g, ' ').trim();
  if (trimmed.length <= length) return trimmed;
  return `${trimmed.slice(0, length)}...`;
}

function parseAuthorNames(meta) {
  const raw = [meta.authors, meta.author].filter(Boolean).join(',');
  const split = raw
    .split(/[,，;；|/]/)
    .map((name) => name.trim())
    .filter(Boolean);
  const unique = [];
  for (const name of split) {
    if (!unique.includes(name)) unique.push(name);
  }
  return unique.length ? unique : ['Anonymous'];
}

function parseTagNames(meta) {
  const raw = [meta.tags, meta.tag].filter(Boolean).join(',');
  const split = raw
    .split(/[,，;；|/]/)
    .map((name) => name.trim())
    .filter(Boolean);
  const unique = [];
  for (const name of split) {
    if (!unique.includes(name)) unique.push(name);
  }
  return unique;
}

function normalizeName(name) {
  return String(name).trim().toLowerCase();
}

function parseBool(value) {
  const text = String(value || '')
    .trim()
    .toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(text);
}

function buildCommentsSection(config) {
  if (!config.enabled) {
    return `<section class="post-comments" id="comments">
    <h2>评论</h2>
    <p class="meta">评论区已关闭。</p>
  </section>`;
  }

  const missing = [];
  if (!config.repo) missing.push('repo');
  if (!config.repoId) missing.push('repoId');
  if (!config.category) missing.push('category');
  if (!config.categoryId) missing.push('categoryId');

  if (missing.length) {
    return `<section class="post-comments" id="comments">
    <h2>评论</h2>
    <p class="meta">评论未配置完成，请在 <code>src/static/comments.json</code> 填写：${escapeHtml(missing.join(', '))}。</p>
  </section>`;
  }

  return `<section class="post-comments" id="comments" data-comments>
    <div class="comments-header">
      <h2>评论</h2>
      <p class="meta">使用 GitHub 登录后发表评论。</p>
      <p class="comment-hint">选中文章内容后可点击“引用评论”。</p>
    </div>
    <div class="giscus-wrap">
      <script
        src="https://giscus.app/client.js"
        data-repo="${escapeHtml(config.repo)}"
        data-repo-id="${escapeHtml(config.repoId)}"
        data-category="${escapeHtml(config.category)}"
        data-category-id="${escapeHtml(config.categoryId)}"
        data-mapping="${escapeHtml(config.mapping)}"
        data-strict="${escapeHtml(config.strict)}"
        data-reactions-enabled="${escapeHtml(config.reactionsEnabled)}"
        data-emit-metadata="${escapeHtml(config.emitMetadata)}"
        data-input-position="${escapeHtml(config.inputPosition)}"
        data-lang="${escapeHtml(config.lang)}"
        data-theme="${escapeHtml(config.themeLight)}"
        data-loading="${escapeHtml(config.loading)}"
        crossorigin="anonymous"
        async>
      </script>
    </div>
    <div class="quote-bubble" data-quote-bubble aria-hidden="true">
      <button class="quote-btn" type="button" data-quote-action>引用评论</button>
    </div>
    <div class="quote-toast" data-quote-toast role="status" aria-live="polite"></div>
  </section>`;
}

function buildCommentsScript(config) {
  if (!config.enabled) return '';
  if (!config.repo || !config.repoId || !config.category || !config.categoryId) return '';

  return `<script>
    (() => {
      const commentsRoot = document.querySelector('[data-comments]');
      if (!commentsRoot) return;
      const config = ${JSON.stringify({
        themeLight: config.themeLight,
        themeDark: config.themeDark,
        quoteMaxLength: config.quoteMaxLength
      })};
      const quoteBubble = commentsRoot.querySelector('[data-quote-bubble]');
      const quoteToast = commentsRoot.querySelector('[data-quote-toast]');
      const quoteButton = commentsRoot.querySelector('[data-quote-action]');
      const article = document.querySelector('.markdown-body');
      const commentAnchor = document.getElementById('comments');
      let lastSelection = '';
      let lastSelectionLength = 0;

      const showToast = (message) => {
        if (!quoteToast) return;
        quoteToast.textContent = message;
        quoteToast.classList.add('show');
        setTimeout(() => quoteToast.classList.remove('show'), 1800);
      };

      const copyToClipboard = async (text) => {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          return;
        }
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      };

      const normalizeSelection = (text) =>
        String(text || '')
          .replace(/\\s+\\n/g, '\\n')
          .replace(/\\n{3,}/g, '\\n\\n')
          .trim();

      const buildQuote = (text) => {
        const lines = text.split(/\\n/);
        const quoted = lines.map((line) => (line.trim() ? '> ' + line : '>')).join('\\n');
        return quoted + '\\n\\n';
      };

      const updateBubble = () => {
        if (!quoteBubble || !article) return;
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
          quoteBubble.style.opacity = '0';
          quoteBubble.setAttribute('aria-hidden', 'true');
          lastSelection = '';
          return;
        }
        const range = selection.getRangeAt(0);
        if (!article.contains(range.commonAncestorContainer)) {
          quoteBubble.style.opacity = '0';
          quoteBubble.setAttribute('aria-hidden', 'true');
          lastSelection = '';
          return;
        }
        const text = normalizeSelection(selection.toString());
        if (!text) {
          quoteBubble.style.opacity = '0';
          quoteBubble.setAttribute('aria-hidden', 'true');
          lastSelection = '';
          return;
        }
        lastSelectionLength = text.length;
        lastSelection = text.length > config.quoteMaxLength ? text.slice(0, config.quoteMaxLength) : text;
        const rect = range.getBoundingClientRect();
        const idealLeft = rect.left + rect.width / 2;
        quoteBubble.style.left = Math.max(80, Math.min(idealLeft, window.innerWidth - 80)) + 'px';
        quoteBubble.style.top = Math.max(rect.top - 44, 10) + 'px';
        quoteBubble.style.opacity = '1';
        quoteBubble.setAttribute('aria-hidden', 'false');
      };

      const handleQuote = async () => {
        if (!lastSelection) return;
        const extra = lastSelectionLength > lastSelection.length;
        const quoteText = buildQuote(lastSelection);
        try {
          await copyToClipboard(quoteText);
          if (commentAnchor) {
            commentAnchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          showToast(extra ? '已复制引用（内容过长已截断），请在评论框粘贴。' : '已复制引用，请在评论框粘贴。');
        } catch (error) {
          showToast('复制失败，请手动复制。');
        }
      };

      if (quoteButton) {
        quoteButton.addEventListener('click', handleQuote);
      }

      ['mouseup', 'keyup', 'touchend'].forEach((event) => {
        document.addEventListener(event, () => {
          setTimeout(updateBubble, 0);
        });
      });

      document.addEventListener('scroll', () => {
        if (quoteBubble && quoteBubble.getAttribute('aria-hidden') === 'false') {
          updateBubble();
        }
      }, { passive: true });

      const syncGiscusTheme = (theme, attempt = 0) => {
        const iframe = document.querySelector('iframe.giscus-frame');
        if (!iframe) {
          if (attempt < 8) {
            setTimeout(() => syncGiscusTheme(theme, attempt + 1), 260);
          }
          return;
        }
        const giscusTheme = theme === 'dark' ? config.themeDark : config.themeLight;
        iframe.contentWindow?.postMessage(
          { giscus: { setConfig: { theme: giscusTheme } } },
          'https://giscus.app'
        );
      };

      window.syncGiscusTheme = syncGiscusTheme;
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      syncGiscusTheme(currentTheme);
    })();
  </script>`;
}

function hashPassword(text) {
  return createHash('sha256').update(String(text)).digest('hex');
}

function buildPosts() {
  const files = fs.readdirSync(postsDir).filter((f) => f.endsWith('.md'));
  const posts = [];

  for (const file of files) {
    const abs = path.join(postsDir, file);
    const parsed = parseFrontMatter(read(abs));
    const title = parsed.meta.title || path.basename(file, '.md');
    const slug = slugify(path.basename(file, '.md'));
    const date = parsed.meta.date || '1970-01-01';
    const category = parsed.meta.category || 'Uncategorized';
    const tags = parseTagNames(parsed.meta);
    const cover = parsed.meta.cover || '';
    const summary = parsed.meta.summary || excerpt(parsed.body, 100);
    const html = markdownToHtml(parsed.body);
    const authorNames = parseAuthorNames(parsed.meta);
    const background = parsed.meta.background || parsed.meta.bg || '';
    const hidden = parseBool(parsed.meta.hidden || parsed.meta.hide || parsed.meta.private);
    const lockEnabled = parseBool(parsed.meta.lock || parsed.meta.locked);
    const rawPassword = parsed.meta.password || parsed.meta.lockPassword || parsed.meta.passcode || '';
    const lockHash = lockEnabled && rawPassword ? hashPassword(rawPassword) : '';

    posts.push({
      title,
      slug,
      date,
      category,
      tags,
      cover,
      summary,
      html,
      contentText: parsed.body,
      authorNames,
      authors: [],
      authorText: authorNames.join(' / '),
      background,
      hidden,
      lockHash
    });
  }

  posts.sort((a, b) => (a.date < b.date ? 1 : -1));
  return posts;
}

function buildAuthorProfiles() {
  if (!fs.existsSync(authorsDir)) return [];

  const files = fs.readdirSync(authorsDir).filter((f) => f.endsWith('.md'));
  return files.map((file) => {
    const abs = path.join(authorsDir, file);
    const parsed = parseFrontMatter(read(abs));
    const fallbackName = path.basename(file, '.md');
    const name = parsed.meta.name || fallbackName;
    const slug = parsed.meta.slug || slugify(name) || slugify(fallbackName) || 'author';
    const headline = parsed.meta.headline || '';
    const summary = parsed.meta.summary || excerpt(parsed.body, 90) || `${name} 的介绍`;
    const bioHtml = markdownToHtml(parsed.body || `关于 ${name} 的介绍暂未补充。`);
    const background = parsed.meta.background || parsed.meta.bg || '';

    return {
      name,
      slug,
      headline,
      summary,
      bioHtml,
      background
    };
  });
}

function linkAuthors(posts, profileList) {
  const map = new Map();
  const authors = [];
  const usedSlugs = new Set();

  const uniqueSlug = (raw) => {
    const base = slugify(raw) || 'author';
    if (!usedSlugs.has(base)) {
      usedSlugs.add(base);
      return base;
    }
    let n = 2;
    while (usedSlugs.has(`${base}-${n}`)) {
      n += 1;
    }
    const finalSlug = `${base}-${n}`;
    usedSlugs.add(finalSlug);
    return finalSlug;
  };

  for (const profile of profileList) {
    const key = normalizeName(profile.name);
    if (map.has(key)) continue;
    const author = {
      ...profile,
      slug: uniqueSlug(profile.slug)
    };
    map.set(key, author);
    authors.push(author);
  }

  for (const post of posts) {
    const resolved = [];
    for (const name of post.authorNames) {
      const key = normalizeName(name);
      let author = map.get(key);
      if (!author) {
        author = {
          name,
          slug: uniqueSlug(name),
          headline: '',
          summary: `${name} 的介绍暂未补充。`,
          bioHtml: `<p>${escapeHtml(name)} 的介绍暂未补充。</p>`,
          background: ''
        };
        map.set(key, author);
        authors.push(author);
      }
      resolved.push(author);
    }
    post.authors = resolved;
    post.authorText = resolved.map((a) => a.name).join(' / ');
  }

  authors.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
  return authors;
}

function renderAuthorLinks(authors) {
  return authors
    .map((author) => `<a class="author-link" href="/authors/${escapeHtml(author.slug)}/">${escapeHtml(author.name)}</a>`)
    .join('<span class="meta-sep">/</span>');
}

function detectLang(text) {
  return /[\u4e00-\u9fff]/.test(text) ? 'zh' : 'en';
}

function renderPostMeta(post, options = {}) {
  const { hideCategory = false, hideTag = '' } = options;
  const categorySlug = slugify(post.category) || 'category';
  const categoryLabel = `<span class="tag-label" lang="${detectLang(post.category)}">${escapeHtml(
    post.category
  )}</span>`;
  const categoryChip = hideCategory
    ? ''
    : `<a class="tag tag-primary" href="/categories/${escapeHtml(categorySlug)}/">${categoryLabel}</a>`;
  const tagChips = post.tags.length
    ? `<span class="tag-list">${post.tags
        .filter((tag) => tag !== hideTag)
        .map((tag) => {
          const slug = slugify(tag) || 'tag';
          const tagLabel = `<span class="tag-label" lang="${detectLang(tag)}">#${escapeHtml(tag)}</span>`;
          return `<a class="tag tag-secondary" href="/tags/${escapeHtml(slug)}/">${tagLabel}</a>`;
        })
        .join('')}</span>`
    : '';
  return `<div class="post-meta-row"><span class="meta-left">${escapeHtml(post.date)} · ${renderAuthorLinks(post.authors)}</span><span class="meta-right">${categoryChip}${tagChips}</span></div>`;
}

function renderPostCard(post, includeSummary = true, metaOptions = {}) {
  return `<li class="post-card" data-href="/posts/${post.slug}/" role="link" tabindex="0">
    <div class="post-card__inner">
      <div class="post-cover-wrap">
        ${coverImage(post.cover, 'post-cover', `${post.title} cover`)}
      </div>
      <div class="post-main">
        <div class="meta post-meta">${renderPostMeta(post, metaOptions)}</div>
        <h2 class="post-card-title">${escapeHtml(post.title)}</h2>
        ${includeSummary ? `<p class="post-excerpt">${escapeHtml(post.summary)}</p>` : ''}
      </div>
    </div>
  </li>`;
}

function buildSite(posts, authors) {
  const layout = read(path.join(srcDir, 'templates', 'layout.html'));
  const postTpl = read(path.join(srcDir, 'templates', 'post.html'));
  const year = new Date().getFullYear();
  const commentsConfig = loadCommentsConfig();
  const publicPosts = posts.filter((post) => !post.hidden);
  const latestPosts = publicPosts.slice(0, 3);
  const postList = latestPosts.map((post) => renderPostCard(post, true)).join('');

  const tagCounts = publicPosts.reduce((acc, post) => {
    for (const tag of post.tags) {
      acc[tag] = (acc[tag] || 0) + 1;
    }
    return acc;
  }, {});
  const tagEntries = Object.entries(tagCounts);
  const countValues = tagEntries.map(([, count]) => count);
  const maxCount = Math.max(1, ...countValues);
  const minCount = Math.min(maxCount, ...countValues);
  const tagCloudItems = tagEntries
    .sort((a, b) => a[0].localeCompare(b[0], 'zh-Hans-CN'))
    .map(([tag, count]) => {
      const weight = maxCount === minCount ? 0.5 : (count - minCount) / (maxCount - minCount);
      const slug = slugify(tag) || 'category';
      return `<a class="tag-cloud-item" href="/tags/${escapeHtml(slug)}/" style="--tag-weight:${weight.toFixed(
        2
      )}" title="${escapeHtml(`${count} 篇文章`)}" aria-label="${escapeHtml(`${tag}，${count} 篇文章`)}"><span>${escapeHtml(
        tag
      )}</span></a>`;
    })
    .join('');

  const indexContent = `<section class="hero">
    <h1>简约个人网站</h1>
    <p class="meta">全静态 · 模板与文章分离 · 支持 Cloudflare Pages</p>
    <p><a class="about-entry" href="/about/">关于我</a></p>
  </section>
  <h2 class="section-title">最新文章</h2>
  <ul class="post-list">${postList}</ul>
  <p class="section-more"><a class="more-link" href="/posts/">更多.....</a></p>
  <section class="tag-cloud-section">
    <h2>热门主题</h2>
    <div class="tag-cloud-shell">
      <div class="tag-cloud">${tagCloudItems || '<p class="meta">暂无分类标签。</p>'}</div>
    </div>
  </section>`;

  const indexHtml = renderLayoutPage(
    layout,
    {
      title: 'Home | MyNotes',
      description: 'A minimal personal static website.',
      content: indexContent,
      year,
      bodyClass: 'home-page'
    },
    pageBackgrounds.home
  );
  write(path.join(distDir, 'index.html'), indexHtml);

  const aboutContent = `<section class="hero">
    <h1>About</h1>
    <p class="meta">关于我与这个站点</p>
  </section>
  <section>
    <p>你好，这里是我的个人站点。它采用纯静态方式构建，页面模板和文章内容分离，适合长期写作与托管。</p>
    <p>你只需要在 <code>content/posts</code> 新增一篇 Markdown 文件并执行构建即可发布。</p>
  </section>`;

  write(
    path.join(distDir, 'about', 'index.html'),
    renderLayoutPage(
      layout,
      {
        title: 'About | MyNotes',
        description: 'About this personal website.',
        content: aboutContent,
        year
      },
      pageBackgrounds.about
    )
  );

  const authorCards = authors
    .map((author) => {
      const count = publicPosts.filter((post) => post.authors.some((item) => item.slug === author.slug)).length;
      return `<li class="author-card">
        <h2 class="author-name"><a class="author-link" href="/authors/${escapeHtml(author.slug)}/">${escapeHtml(author.name)}</a></h2>
        ${author.headline ? `<p class="meta">${escapeHtml(author.headline)}</p>` : ''}
        <p>${escapeHtml(author.summary)}</p>
        <p class="meta">文章数：${count}</p>
      </li>`;
    })
    .join('');

  write(
    path.join(distDir, 'authors', 'index.html'),
    renderLayoutPage(
      layout,
      {
        title: 'Authors | MyNotes',
        description: 'Author profile list',
        content: `<section class="hero"><h1>Authors</h1><p class="meta">作者列表与简介</p></section><ul class="author-grid">${authorCards}</ul>`,
        year
      },
      pageBackgrounds.authors
    )
  );

  for (const author of authors) {
    const authoredPosts = publicPosts.filter((post) => post.authors.some((item) => item.slug === author.slug));
    const authoredList = authoredPosts.length
      ? `<ul class="post-list">${authoredPosts.map((post) => renderPostCard(post, true)).join('')}</ul>`
      : '<p class="meta">这个作者还没有发布文章。</p>';

    const authorContent = `<section class="author-detail-header">
      <a class="home-btn" href="/authors/">← 返回作者列表</a>
      <h1>${escapeHtml(author.name)}</h1>
      ${author.headline ? `<p class="meta">${escapeHtml(author.headline)}</p>` : ''}
      <section class="markdown-body">${author.bioHtml}</section>
    </section>
    <section>
      <h2>文章</h2>
      ${authoredList}
    </section>`;

    write(
      path.join(distDir, 'authors', author.slug, 'index.html'),
      renderLayoutPage(
        layout,
        {
          title: `${escapeHtml(author.name)} | MyNotes`,
          description: escapeHtml(author.summary),
          content: authorContent,
          year
        },
        author.background
      )
    );
  }

  const grouped = publicPosts.reduce((acc, post) => {
    const key = post.category;
    acc[key] = acc[key] || [];
    acc[key].push(post);
    return acc;
  }, {});

  const tagGrouped = publicPosts.reduce((acc, post) => {
    for (const tag of post.tags) {
      acc[tag] = acc[tag] || [];
      acc[tag].push(post);
    }
    return acc;
  }, {});

  const categoryBlocks = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b, 'zh-Hans-CN'))
    .map(([cat, items]) => {
      const links = items.map((post) => renderPostCard(post, false, { hideCategory: true })).join('');
      const slug = slugify(cat) || 'category';
      return `<section id="cat-${escapeHtml(slug)}"><h2>${escapeHtml(cat)}</h2><ul class="post-list">${links}</ul></section>`;
    })
    .join('');

  const categoryNav = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b, 'zh-Hans-CN'))
    .map(([cat, items]) => {
      const slug = slugify(cat) || 'category';
      return `<a class="category-nav-item" href="#cat-${escapeHtml(slug)}"><span>${escapeHtml(cat)}</span><span class="meta">${items.length}</span></a>`;
    })
    .join('');

  write(
    path.join(distDir, 'categories', 'index.html'),
    renderLayoutPage(
      layout,
      {
        title: 'Category | MyNotes',
        description: 'Post categories',
        content: `<section class="hero"><h1>Category</h1><p class="meta">按分类浏览文章</p></section><div class="category-page"><aside class="category-sidebar"><h3>标签索引</h3><nav class="category-nav">${categoryNav}</nav></aside><div class="category-content">${categoryBlocks}</div></div>`,
        year
      },
      pageBackgrounds.categories
    )
  );

  const allPostList = publicPosts.map((post) => renderPostCard(post, true)).join('');
  const allPostsContent = `<section class="hero">
    <h1>All Posts</h1>
    <p class="meta">全部文章列表</p>
  </section>
  <section>
    ${allPostList ? `<ul class="post-list">${allPostList}</ul>` : '<p class="meta">暂无文章。</p>'}
  </section>`;

  write(
    path.join(distDir, 'posts', 'index.html'),
    renderLayoutPage(
      layout,
      {
        title: 'Posts | MyNotes',
        description: 'All posts list',
        content: allPostsContent,
        year
      },
      pageBackgrounds.home
    )
  );

  for (const [cat, items] of Object.entries(grouped)) {
    const slug = slugify(cat) || 'category';
    const links = items.map((post) => renderPostCard(post, true, { hideCategory: true })).join('');
    const categoryContent = `<section class="hero">
      <a class="home-btn" href="/categories/">← 返回分类</a>
      <h1>${escapeHtml(cat)}</h1>
      <p class="meta">该分类共 ${items.length} 篇文章</p>
    </section>
    <section>
      ${items.length ? `<ul class="post-list">${links}</ul>` : '<p class="meta">暂无文章。</p>'}
    </section>`;

    write(
      path.join(distDir, 'categories', slug, 'index.html'),
      renderLayoutPage(
        layout,
        {
          title: `${escapeHtml(cat)} | MyNotes`,
          description: `${escapeHtml(cat)} 分类下的文章`,
          content: categoryContent,
          year
        },
        pageBackgrounds.categories
      )
    );
  }

  for (const [tag, items] of Object.entries(tagGrouped)) {
    const slug = slugify(tag) || 'category';
    const links = items.map((post) => renderPostCard(post, true, { hideTag: tag })).join('');
    const tagContent = `<section class="hero">
      <a class="home-btn" href="/">← 返回主页</a>
      <h1>${escapeHtml(tag)}</h1>
      <p class="meta">该标签共 ${items.length} 篇文章</p>
    </section>
    <section>
      ${items.length ? `<ul class="post-list">${links}</ul>` : '<p class="meta">暂无文章。</p>'}
    </section>`;

    write(
      path.join(distDir, 'tags', slug, 'index.html'),
      renderLayoutPage(
        layout,
        {
          title: `${escapeHtml(tag)} | MyNotes`,
          description: `${escapeHtml(tag)} 标签下的文章`,
          content: tagContent,
          year
        },
        pageBackgrounds.categories
      )
    );
  }

  const searchContent = `<section class="hero">
    <h1>Search</h1>
    <p class="meta">搜索标题、作者、分类和正文</p>
  </section>
  <section>
    <input id="q" class="search-input" type="search" placeholder="输入关键词搜索标题、作者、分类、正文" />
    <ul id="result" class="post-list"></ul>
  </section>
  <script>
    const q = document.getElementById('q');
    const result = document.getElementById('result');

    function esc(value) {
      return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
    }

    function renderAuthorLinks(authors) {
      return authors
        .map((author) => '<a class="author-link" href="/authors/' + esc(author.slug) + '/">' + esc(author.name) + '</a>')
        .join('<span class="meta-sep">/</span>');
    }

    function slugifyText(input) {
      return String(input)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')
        .replace(/(^-|-$)/g, '');
    }

    function detectLang(text) {
      return /[\\u4e00-\\u9fff]/.test(text) ? 'zh' : 'en';
    }

    function renderMeta(post) {
      const categorySlug = slugifyText(post.category) || 'category';
      const categoryLabel = '<span class="tag-label" lang="' + detectLang(post.category) + '">' + esc(post.category) + '</span>';
      const categoryChip = '<a class="tag tag-primary" href="/categories/' + esc(categorySlug) + '/">' + categoryLabel + '</a>';
      const tags = (post.tags || []).map((tag) => {
        const slug = slugifyText(tag) || 'tag';
        const tagLabel = '<span class="tag-label" lang="' + detectLang(tag) + '">#' + esc(tag) + '</span>';
        return '<a class="tag tag-secondary" href="/tags/' + esc(slug) + '/">' + tagLabel + '</a>';
      }).join('');
      const tagList = tags ? '<span class="tag-list">' + tags + '</span>' : '';
      return '<div class="post-meta-row"><span class="meta-left">' + esc(post.date) + ' · ' + renderAuthorLinks(post.authors) + '</span><span class="meta-right">' + categoryChip + tagList + '</span></div>';
    }

    async function load() {
      const res = await fetch('/assets/posts.json');
      const posts = await res.json();

      const render = (list) => {
        result.innerHTML = list.map((post) =>
          '<li class="post-card" data-href="/posts/' + post.slug + '/" role="link" tabindex="0">' +
            (post.cover ? '<img class="post-cover" src="' + esc(post.cover) + '" alt="' + esc(post.title) + ' cover" loading="lazy" />' : '') +
            '<div class="post-main">' +
              '<p class="meta post-meta">' + renderMeta(post) + '</p>' +
              '<h2 class="post-card-title">' + esc(post.title) + '</h2>' +
              '<p>' + esc(post.summary) + '</p>' +
            '</div>' +
          '</li>'
        ).join('');
      };

      render(posts);

      q.addEventListener('input', () => {
        const keyword = q.value.trim().toLowerCase();
        if (!keyword) {
          render(posts);
          return;
        }

        const filtered = posts.filter((post) => {
          const authorText = post.authors.map((item) => item.name).join(' ');
          const tagText = (post.tags || []).join(' ');
          const text = (post.title + ' ' + authorText + ' ' + post.category + ' ' + tagText + ' ' + post.contentText).toLowerCase();
          return text.includes(keyword);
        });
        render(filtered);
      });
    }

    load();
  </script>`;

  write(
    path.join(distDir, 'search', 'index.html'),
    renderLayoutPage(
      layout,
      {
        title: 'Search | MyNotes',
        description: 'Search posts',
        content: searchContent,
        year
      },
      pageBackgrounds.search
    )
  );

  for (const post of posts) {
    const isLocked = Boolean(post.lockHash);
    const lockPanel = isLocked
      ? `<section class="post-lock" data-post-lock data-lock-hash="${post.lockHash}" data-post-key="${escapeHtml(post.slug)}">
      <p class="meta">这篇文章已上锁，请输入密码后查看全文。</p>
      <div class="post-lock-form">
        <input class="post-lock-input" type="password" autocomplete="current-password" placeholder="输入阅读密码" />
        <button class="post-lock-btn" type="button">解锁</button>
      </div>
      <p class="post-lock-msg" aria-live="polite"></p>
    </section>`
      : '';
    const lockScript = isLocked
      ? `<script>
      (() => {
        const lockRoot = document.querySelector('[data-post-lock]');
        if (!lockRoot) return;
        const content = document.querySelector('.markdown-body.is-locked');
        if (!content) return;
        const input = lockRoot.querySelector('.post-lock-input');
        const button = lockRoot.querySelector('.post-lock-btn');
        const message = lockRoot.querySelector('.post-lock-msg');
        const expectedHash = lockRoot.dataset.lockHash || '';
        const postKey = lockRoot.dataset.postKey || '';
        const sessionKey = 'post-unlocked:' + postKey;

        const toHex = (buffer) =>
          Array.from(new Uint8Array(buffer))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');

        const unlockView = () => {
          content.classList.remove('is-locked');
          lockRoot.classList.add('is-unlocked');
          if (message) message.textContent = '已解锁。';
          if (sessionKey) sessionStorage.setItem(sessionKey, '1');
        };

        const hashText = async (text) => {
          const data = new TextEncoder().encode(text);
          const digest = await crypto.subtle.digest('SHA-256', data);
          return toHex(digest);
        };

        const handleUnlock = async () => {
          if (!input || !message) return;
          const password = input.value.trim();
          if (!password) {
            message.textContent = '请输入密码。';
            return;
          }
          button.disabled = true;
          try {
            const actualHash = await hashText(password);
            if (actualHash === expectedHash) {
              unlockView();
            } else {
              message.textContent = '密码错误，请重试。';
            }
          } catch (error) {
            message.textContent = '解锁失败，请稍后再试。';
          } finally {
            button.disabled = false;
          }
        };

        if (sessionKey && sessionStorage.getItem(sessionKey) === '1') {
          unlockView();
          return;
        }

        button.addEventListener('click', () => {
          handleUnlock();
        });
        input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            handleUnlock();
          }
        });
      })();
    </script>`
      : '';

    const content = template(postTpl, {
      title: escapeHtml(post.title),
      metaHtml: isLocked
        ? `<div class="post-meta-row">作者：${renderAuthorLinks(post.authors)}</div>`
        : renderPostMeta(post),
      lockPanel,
      contentClass: isLocked ? 'is-locked' : '',
      content: post.html,
      lockScript,
      commentsSection: buildCommentsSection(commentsConfig),
      commentsScript: buildCommentsScript(commentsConfig)
    });

    const html = renderLayoutPage(
      layout,
      {
        title: `${escapeHtml(post.title)} | MyNotes`,
        description: escapeHtml(post.summary),
        content,
        year
      },
      post.background
    );

    write(path.join(distDir, 'posts', post.slug, 'index.html'), html);
  }

  write(
    path.join(distDir, '404.html'),
    renderLayoutPage(
      layout,
      {
        title: '404 | MyNotes',
        description: 'Page not found',
        content: '<h1>404</h1><p>页面不存在，返回 <a href="/">首页</a>。</p>',
        year
      },
      pageBackgrounds.notFound
    )
  );

  write(
    path.join(distDir, 'assets', 'posts.json'),
    JSON.stringify(
      publicPosts.map((post) => ({
        title: post.title,
        slug: post.slug,
        date: post.date,
        authors: post.authors.map((author) => ({
          name: author.name,
          slug: author.slug
        })),
        category: post.category,
        tags: post.tags,
        cover: post.cover,
        summary: post.summary,
        contentText: post.lockHash ? '' : post.contentText
      })),
      null,
      2
    )
  );
}

function copyAssets() {
  const src = path.join(srcDir, 'assets');
  const target = path.join(distDir, 'assets');
  copyDirRecursive(src, target);
}

function copyStatic() {
  const src = path.join(srcDir, 'static');
  if (!fs.existsSync(src)) return;
  copyDirRecursive(src, distDir);
}

function copyImages() {
  if (!fs.existsSync(imagesDir)) return;
  copyDirRecursive(imagesDir, path.join(distDir, 'images'));
}

removeDir(distDir);
ensureDir(distDir);
copyAssets();
copyStatic();
copyImages();

const posts = buildPosts();
const authorProfiles = buildAuthorProfiles();
const authors = linkAuthors(posts, authorProfiles);
buildSite(posts, authors);

const fontSource = './public/fonts';
const fontDestination = './dist/public/fonts';

if (fs.existsSync(fontSource)) {
  // Recursively copies the fonts folder to the dist folder
  fs.cpSync(fontSource, fontDestination, { recursive: true });
  console.log('Fonts copied to dist!');
} else {
  console.log('No font copied to dist');
}

console.log(`Built ${posts.length} posts and ${authors.length} authors into dist/.`);
