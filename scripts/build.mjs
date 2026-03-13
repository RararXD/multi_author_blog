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
const aboutDir = path.join(contentDir, 'about');
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

const defaultLang = 'en';
const languageConfig = {
  en: {
    code: 'en',
    htmlLang: 'en',
    giscusLang: 'en',
    toggleLabel: '中文',
    toggleAria: 'Switch to Chinese',
    themeLabels: {
      auto: 'Auto',
      light: 'Light',
      dark: 'Dark',
      aria: 'Toggle theme'
    },
    nav: {
      home: 'Home',
      about: 'About',
      authors: 'Authors',
      categories: 'Categories',
      search: 'Search'
    },
    home: {
      title: 'Minimal personal website',
      subtitle: 'Static · Templates and content separated · Cloudflare Pages ready',
      aboutEntry: 'About',
      latest: 'Latest Posts',
      more: 'More...',
      tags: 'Popular Topics',
      noTags: 'No tags yet.'
    },
    about: {
      fallbackTitle: 'About',
      fallbackSubtitle: 'About me and this site',
      fallbackDescription: 'About this personal website.',
      fallbackBody: `<section>
    <p>Hello, welcome to my personal site. It is fully static, with templates separated from content, ideal for long-term writing and hosting.</p>
    <p>Create a folder under <code>content/posts</code> with <code>zh.md</code> and <code>en.md</code>, then run the build to publish.</p>
  </section>`
    },
    authors: {
      title: 'Authors',
      subtitle: 'Author list and bios',
      postsLabel: (count) => `${count} posts`
    },
    authorDetail: {
      back: '← Back to authors',
      postsTitle: 'Posts',
      empty: 'This author has not published any posts yet.'
    },
    categories: {
      title: 'Categories',
      subtitle: 'Browse posts by category',
      navTitle: 'Category index',
      back: '← Back to categories',
      count: (count) => `This category has ${count} posts`
    },
    posts: {
      title: 'All Posts',
      subtitle: 'All posts list',
      empty: 'No posts yet.'
    },
    tags: {
      back: '← Back to home',
      count: (count) => `This tag has ${count} posts`
    },
    search: {
      title: 'Search',
      subtitle: 'Search titles, authors, categories, and content',
      placeholder: 'Type to search titles, authors, categories, and content'
    },
    post: {
      backHome: '← Back to home',
      authorPrefix: 'Author: ',
      lockedIntro: 'This post is locked. Enter the password to view the full content.',
      passwordPlaceholder: 'Enter reading password',
      unlock: 'Unlock',
      unlocked: 'Unlocked.',
      emptyPassword: 'Please enter a password.',
      wrongPassword: 'Incorrect password. Please try again.',
      unlockFail: 'Unlock failed. Please try again later.'
    },
    comments: {
      title: 'Comments',
      closed: 'Comments are closed.',
      notConfigured: (missing) =>
        `Comments are not fully configured. Please fill in: ${escapeHtml(missing.join(', '))} in <code>src/static/comments.json</code>.`,
      loginHint: 'Sign in with GitHub to comment.',
      quoteHint: 'Select text in the article to quote it in your comment.',
      quoteButton: 'Quote comment',
      quoteCopied: 'Quote copied. Paste it into the comment box.',
      quoteCopiedTrimmed: 'Quote copied (truncated). Paste it into the comment box.',
      quoteFailed: 'Copy failed. Please copy manually.'
    },
    errors: {
      notFoundTitle: 'Page not found',
      notFoundDesc: 'Page not found',
      backHome: 'Back to home'
    },
    meta: {
      tagCountTitle: (count) => `${count} posts`,
      tagCountAria: (tag, count) => `${tag}, ${count} posts`
    }
  },
  zh: {
    code: 'zh',
    htmlLang: 'zh-CN',
    giscusLang: 'zh-CN',
    toggleLabel: 'English',
    toggleAria: '切换到英文',
    themeLabels: {
      auto: '自动',
      light: '浅色',
      dark: '深色',
      aria: '切换主题'
    },
    nav: {
      home: '首页',
      about: '关于',
      authors: '作者',
      categories: '分类',
      search: '搜索'
    },
    home: {
      title: '简约个人网站',
      subtitle: '全静态 · 模板与文章分离 · 支持 Cloudflare Pages',
      aboutEntry: '关于我',
      latest: '最新文章',
      more: '更多.....',
      tags: '热门主题',
      noTags: '暂无分类标签。'
    },
    about: {
      fallbackTitle: '关于',
      fallbackSubtitle: '关于我与这个站点',
      fallbackDescription: '关于这个个人网站。',
      fallbackBody: `<section>
    <p>你好，这里是我的个人站点。它采用纯静态方式构建，页面模板和文章内容分离，适合长期写作与托管。</p>
    <p>你只需要在 <code>content/posts</code> 新建一个文件夹，准备 <code>zh.md</code> 与 <code>en.md</code> 并执行构建即可发布。</p>
  </section>`
    },
    authors: {
      title: '作者',
      subtitle: '作者列表与简介',
      postsLabel: (count) => `文章数：${count}`
    },
    authorDetail: {
      back: '← 返回作者列表',
      postsTitle: '文章',
      empty: '这个作者还没有发布文章。'
    },
    categories: {
      title: '分类',
      subtitle: '按分类浏览文章',
      navTitle: '标签索引',
      back: '← 返回分类',
      count: (count) => `该分类共 ${count} 篇文章`
    },
    posts: {
      title: '全部文章',
      subtitle: '全部文章列表',
      empty: '暂无文章。'
    },
    tags: {
      back: '← 返回主页',
      count: (count) => `该标签共 ${count} 篇文章`
    },
    search: {
      title: '搜索',
      subtitle: '搜索标题、作者、分类和正文',
      placeholder: '输入关键词搜索标题、作者、分类、正文'
    },
    post: {
      backHome: '← 返回主页',
      authorPrefix: '作者：',
      lockedIntro: '这篇文章已上锁，请输入密码后查看全文。',
      passwordPlaceholder: '输入阅读密码',
      unlock: '解锁',
      unlocked: '已解锁。',
      emptyPassword: '请输入密码。',
      wrongPassword: '密码错误，请重试。',
      unlockFail: '解锁失败，请稍后再试。'
    },
    comments: {
      title: '评论',
      closed: '评论区已关闭。',
      notConfigured: (missing) =>
        `评论未配置完成，请在 <code>src/static/comments.json</code> 填写：${escapeHtml(missing.join(', '))}。`,
      loginHint: '使用 GitHub 登录后发表评论。',
      quoteHint: '选中文章内容后可点击“引用评论”。',
      quoteButton: '引用评论',
      quoteCopied: '已复制引用，请在评论框粘贴。',
      quoteCopiedTrimmed: '已复制引用（内容过长已截断），请在评论框粘贴。',
      quoteFailed: '复制失败，请手动复制。'
    },
    errors: {
      notFoundTitle: '页面不存在',
      notFoundDesc: '页面不存在',
      backHome: '返回首页'
    },
    meta: {
      tagCountTitle: (count) => `${count} 篇文章`,
      tagCountAria: (tag, count) => `${tag}，${count} 篇文章`
    }
  }
};

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

function getLangConfig(lang) {
  return languageConfig[lang] || languageConfig[defaultLang];
}

function getBasePath(lang) {
  return `/${lang}`;
}

function listFolders(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function readLocalizedMarkdown(dir, lang) {
  const primary = path.join(dir, `${lang}.md`);
  if (fs.existsSync(primary)) return read(primary);
  const fallback = path.join(dir, `${defaultLang}.md`);
  if (fs.existsSync(fallback)) return read(fallback);
  return '';
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

function loadAboutPage(lang) {
  const raw = readLocalizedMarkdown(aboutDir, lang);
  if (!raw) return null;
  const parsed = parseFrontMatter(raw);
  const ui = getLangConfig(lang);
  const title = parsed.meta.title || ui.about.fallbackTitle;
  const subtitle = parsed.meta.subtitle || parsed.meta.tagline || ui.about.fallbackSubtitle;
  const description = parsed.meta.description || parsed.meta.desc || ui.about.fallbackDescription;
  const pageTitle = parsed.meta.pageTitle || parsed.meta.metaTitle || `${title} | MyNotes`;
  const background = parsed.meta.background || parsed.meta.bg || pageBackgrounds.about;
  const heroEnabled = Object.prototype.hasOwnProperty.call(parsed.meta, 'hero')
    ? parseBool(parsed.meta.hero)
    : !parseBool(parsed.meta.hideHero);
  const bodyHtml = markdownToHtml(parsed.body || '');
  const sections = [];

  if (heroEnabled) {
    sections.push(`<section class="hero">
    <h1>${escapeHtml(title)}</h1>
    ${subtitle ? `<p class="meta">${escapeHtml(subtitle)}</p>` : ''}
  </section>`);
  }

  if (bodyHtml.trim()) {
    sections.push(`<section class="markdown-body">${bodyHtml}</section>`);
  }

  return {
    pageTitle,
    description,
    content: sections.join('\n'),
    background
  };
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

function buildCommentsSection(config, ui) {
  if (!config.enabled) {
    return `<section class="post-comments" id="comments">
    <h2>${escapeHtml(ui.comments.title)}</h2>
    <p class="meta">${escapeHtml(ui.comments.closed)}</p>
  </section>`;
  }

  const missing = [];
  if (!config.repo) missing.push('repo');
  if (!config.repoId) missing.push('repoId');
  if (!config.category) missing.push('category');
  if (!config.categoryId) missing.push('categoryId');

  if (missing.length) {
    return `<section class="post-comments" id="comments">
    <h2>${escapeHtml(ui.comments.title)}</h2>
    <p class="meta">${ui.comments.notConfigured(missing)}</p>
  </section>`;
  }

  return `<section class="post-comments" id="comments" data-comments>
    <div class="comments-header">
      <h2>${escapeHtml(ui.comments.title)}</h2>
      <p class="meta">${escapeHtml(ui.comments.loginHint)}</p>
      <p class="comment-hint">${escapeHtml(ui.comments.quoteHint)}</p>
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
      <button class="quote-btn" type="button" data-quote-action>${escapeHtml(ui.comments.quoteButton)}</button>
    </div>
    <div class="quote-toast" data-quote-toast role="status" aria-live="polite"></div>
  </section>`;
}

function buildCommentsScript(config, ui) {
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
          showToast(extra ? ${JSON.stringify(ui.comments.quoteCopiedTrimmed)} : ${JSON.stringify(ui.comments.quoteCopied)});
        } catch (error) {
          showToast(${JSON.stringify(ui.comments.quoteFailed)});
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

function buildPosts(lang) {
  const folders = listFolders(postsDir);
  const posts = [];

  for (const folder of folders) {
    const absDir = path.join(postsDir, folder);
    const raw = readLocalizedMarkdown(absDir, lang);
    if (!raw) continue;
    const parsed = parseFrontMatter(raw);
    const title = parsed.meta.title || folder;
    const slug = slugify(parsed.meta.slug || folder);
    const date = parsed.meta.date || '1970-01-01';
    const category = parsed.meta.category || (lang === 'zh' ? '未分类' : 'Uncategorized');
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

function buildAuthorProfiles(lang) {
  if (!fs.existsSync(authorsDir)) return [];

  const folders = listFolders(authorsDir);
  return folders.map((folder) => {
    const absDir = path.join(authorsDir, folder);
    const raw = readLocalizedMarkdown(absDir, lang);
    if (!raw) {
      return null;
    }
    const parsed = parseFrontMatter(raw);
    const fallbackName = folder;
    const name = parsed.meta.name || fallbackName;
    const slug = parsed.meta.slug || slugify(name) || slugify(fallbackName) || 'author';
    const headline = parsed.meta.headline || '';
    const summary =
      parsed.meta.summary ||
      excerpt(parsed.body, 90) ||
      (lang === 'zh' ? `${name} 的介绍` : `Introduction to ${name}`);
    const bioHtml = markdownToHtml(
      parsed.body || (lang === 'zh' ? `关于 ${name} 的介绍暂未补充。` : `About ${name} will be added soon.`)
    );
    const background = parsed.meta.background || parsed.meta.bg || '';

    return {
      name,
      slug,
      headline,
      summary,
      bioHtml,
      background
    };
  }).filter(Boolean);
}

function linkAuthors(posts, profileList, locale = 'en') {
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

  const sortLocale = locale === 'zh' ? 'zh-Hans-CN' : 'en';
  authors.sort((a, b) => a.name.localeCompare(b.name, sortLocale));
  return authors;
}

function renderAuthorLinks(authors, basePath) {
  return authors
    .map(
      (author) =>
        `<a class="author-link" href="${basePath}/authors/${escapeHtml(author.slug)}/">${escapeHtml(author.name)}</a>`
    )
    .join('<span class="meta-sep">/</span>');
}

function detectLang(text) {
  return /[\u4e00-\u9fff]/.test(text) ? 'zh' : 'en';
}

function renderPostMeta(post, basePath, options = {}) {
  const { hideCategory = false, hideTag = '' } = options;
  const categorySlug = slugify(post.category) || 'category';
  const categoryLabel = `<span class="tag-label" lang="${detectLang(post.category)}">${escapeHtml(
    post.category
  )}</span>`;
  const categoryChip = hideCategory
    ? ''
    : `<a class="tag tag-primary" href="${basePath}/categories/${escapeHtml(categorySlug)}/">${categoryLabel}</a>`;
  const tagChips = post.tags.length
    ? `<span class="tag-list">${post.tags
        .filter((tag) => tag !== hideTag)
        .map((tag) => {
          const slug = slugify(tag) || 'tag';
          const tagLabel = `<span class="tag-label" lang="${detectLang(tag)}">#${escapeHtml(tag)}</span>`;
          return `<a class="tag tag-secondary" href="${basePath}/tags/${escapeHtml(slug)}/">${tagLabel}</a>`;
        })
        .join('')}</span>`
    : '';
  return `<div class="post-meta-row"><span class="meta-left">${escapeHtml(post.date)} · ${renderAuthorLinks(
    post.authors,
    basePath
  )}</span><span class="meta-right">${categoryChip}${tagChips}</span></div>`;
}

function renderPostCard(post, basePath, includeSummary = true, metaOptions = {}) {
  return `<li class="post-card" data-href="${basePath}/posts/${post.slug}/" role="link" tabindex="0">
    <div class="post-card__inner">
      <div class="post-cover-wrap">
        ${coverImage(post.cover, 'post-cover', `${post.title} cover`)}
      </div>
      <div class="post-main">
        <div class="meta post-meta">${renderPostMeta(post, basePath, metaOptions)}</div>
        <h2 class="post-card-title">${escapeHtml(post.title)}</h2>
        ${includeSummary ? `<p class="post-excerpt">${escapeHtml(post.summary)}</p>` : ''}
      </div>
    </div>
  </li>`;
}

function buildSite(posts, authors, lang) {
  const layout = read(path.join(srcDir, 'templates', 'layout.html'));
  const postTpl = read(path.join(srcDir, 'templates', 'post.html'));
  const year = new Date().getFullYear();
  const ui = getLangConfig(lang);
  const basePath = getBasePath(lang);
  const outputDir = path.join(distDir, lang);
  const sortLocale = ui.code === 'zh' ? 'zh-Hans-CN' : 'en';
  const commentsConfig = {
    ...loadCommentsConfig(),
    lang: ui.giscusLang || 'en'
  };
  const publicPosts = posts.filter((post) => !post.hidden);
  const latestPosts = publicPosts.slice(0, 3);
  const postList = latestPosts.map((post) => renderPostCard(post, basePath, true)).join('');

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
    .sort((a, b) => a[0].localeCompare(b[0], sortLocale))
    .map(([tag, count]) => {
      const weight = maxCount === minCount ? 0.5 : (count - minCount) / (maxCount - minCount);
      const slug = slugify(tag) || 'category';
      return `<a class="tag-cloud-item" href="${basePath}/tags/${escapeHtml(slug)}/" style="--tag-weight:${weight.toFixed(
        2
      )}" title="${escapeHtml(ui.meta.tagCountTitle(count))}" aria-label="${escapeHtml(
        ui.meta.tagCountAria(tag, count)
      )}"><span>${escapeHtml(tag)}</span></a>`;
    })
    .join('');

  const indexContent = `<section class="hero">
    <h1>${escapeHtml(ui.home.title)}</h1>
    <p class="meta">${escapeHtml(ui.home.subtitle)}</p>
    <p><a class="about-entry" href="${basePath}/about/">${escapeHtml(ui.home.aboutEntry)}</a></p>
  </section>
  <h2 class="section-title">${escapeHtml(ui.home.latest)}</h2>
  <ul class="post-list">${postList}</ul>
  <p class="section-more"><a class="more-link" href="${basePath}/posts/">${escapeHtml(ui.home.more)}</a></p>
  <section class="tag-cloud-section">
    <h2>${escapeHtml(ui.home.tags)}</h2>
    <div class="tag-cloud-shell">
      <div class="tag-cloud">${tagCloudItems || `<p class="meta">${escapeHtml(ui.home.noTags)}</p>`}</div>
    </div>
  </section>`;

  const indexHtml = renderLayoutPage(
    layout,
    {
      title: `${ui.nav.home} | MyNotes`,
      description: ui.about.fallbackDescription,
      content: indexContent,
      year,
      bodyClass: 'home-page',
      lang: ui.htmlLang,
      basePath,
      navHome: ui.nav.home,
      navAbout: ui.nav.about,
      navAuthors: ui.nav.authors,
      navCategories: ui.nav.categories,
      navSearch: ui.nav.search,
      langToggleLabel: ui.toggleLabel,
      langToggleAria: ui.toggleAria,
      themeToggleAria: ui.themeLabels.aria,
      themeLabelAuto: ui.themeLabels.auto,
      themeLabelLight: ui.themeLabels.light,
      themeLabelDark: ui.themeLabels.dark
    },
    pageBackgrounds.home
  );
  write(path.join(outputDir, 'index.html'), indexHtml);

  const aboutPage = loadAboutPage(lang);
  const aboutFallbackContent = `<section class="hero">
    <h1>${escapeHtml(ui.about.fallbackTitle)}</h1>
    <p class="meta">${escapeHtml(ui.about.fallbackSubtitle)}</p>
  </section>
  ${ui.about.fallbackBody}`;

  write(
    path.join(outputDir, 'about', 'index.html'),
    renderLayoutPage(
      layout,
      {
        title: aboutPage?.pageTitle || `${ui.nav.about} | MyNotes`,
        description: aboutPage?.description || ui.about.fallbackDescription,
        content: aboutPage?.content || aboutFallbackContent,
        year,
        lang: ui.htmlLang,
        basePath,
        navHome: ui.nav.home,
        navAbout: ui.nav.about,
        navAuthors: ui.nav.authors,
        navCategories: ui.nav.categories,
        navSearch: ui.nav.search,
        langToggleLabel: ui.toggleLabel,
        langToggleAria: ui.toggleAria,
        themeToggleAria: ui.themeLabels.aria,
        themeLabelAuto: ui.themeLabels.auto,
        themeLabelLight: ui.themeLabels.light,
        themeLabelDark: ui.themeLabels.dark
      },
      aboutPage?.background || pageBackgrounds.about
    )
  );

  const authorCards = authors
    .map((author) => {
      const count = publicPosts.filter((post) => post.authors.some((item) => item.slug === author.slug)).length;
      return `<li class="author-card">
        <h2 class="author-name"><a class="author-link" href="${basePath}/authors/${escapeHtml(author.slug)}/">${escapeHtml(author.name)}</a></h2>
        ${author.headline ? `<p class="meta">${escapeHtml(author.headline)}</p>` : ''}
        <p>${escapeHtml(author.summary)}</p>
        <p class="meta">${escapeHtml(ui.authors.postsLabel(count))}</p>
      </li>`;
    })
    .join('');

  write(
    path.join(outputDir, 'authors', 'index.html'),
    renderLayoutPage(
      layout,
      {
        title: `${ui.nav.authors} | MyNotes`,
        description: ui.authors.subtitle,
        content: `<section class="hero"><h1>${escapeHtml(ui.authors.title)}</h1><p class="meta">${escapeHtml(
          ui.authors.subtitle
        )}</p></section><ul class="author-grid">${authorCards}</ul>`,
        year,
        lang: ui.htmlLang,
        basePath,
        navHome: ui.nav.home,
        navAbout: ui.nav.about,
        navAuthors: ui.nav.authors,
        navCategories: ui.nav.categories,
        navSearch: ui.nav.search,
        langToggleLabel: ui.toggleLabel,
        langToggleAria: ui.toggleAria,
        themeToggleAria: ui.themeLabels.aria,
        themeLabelAuto: ui.themeLabels.auto,
        themeLabelLight: ui.themeLabels.light,
        themeLabelDark: ui.themeLabels.dark
      },
      pageBackgrounds.authors
    )
  );

  for (const author of authors) {
    const authoredPosts = publicPosts.filter((post) => post.authors.some((item) => item.slug === author.slug));
    const authoredList = authoredPosts.length
      ? `<ul class="post-list">${authoredPosts.map((post) => renderPostCard(post, basePath, true)).join('')}</ul>`
      : `<p class="meta">${escapeHtml(ui.authorDetail.empty)}</p>`;

    const authorContent = `<section class="author-detail-header">
      <div class="author-detail-row">
        <h1>${escapeHtml(author.name)}</h1>
        <a class="home-btn" href="${basePath}/authors/">${escapeHtml(ui.authorDetail.back)}</a>
      </div>
      ${author.headline ? `<p class="meta">${escapeHtml(author.headline)}</p>` : ''}
      <section class="markdown-body">${author.bioHtml}</section>
    </section>
    <section>
      <h2>${escapeHtml(ui.authorDetail.postsTitle)}</h2>
      ${authoredList}
    </section>`;

    write(
      path.join(outputDir, 'authors', author.slug, 'index.html'),
      renderLayoutPage(
        layout,
        {
          title: `${escapeHtml(author.name)} | MyNotes`,
          description: escapeHtml(author.summary),
          content: authorContent,
          year,
          lang: ui.htmlLang,
          basePath,
          navHome: ui.nav.home,
          navAbout: ui.nav.about,
          navAuthors: ui.nav.authors,
          navCategories: ui.nav.categories,
          navSearch: ui.nav.search,
          langToggleLabel: ui.toggleLabel,
          langToggleAria: ui.toggleAria,
          themeToggleAria: ui.themeLabels.aria,
          themeLabelAuto: ui.themeLabels.auto,
          themeLabelLight: ui.themeLabels.light,
          themeLabelDark: ui.themeLabels.dark
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
    .sort(([a], [b]) => a.localeCompare(b, sortLocale))
    .map(([cat, items]) => {
      const links = items.map((post) => renderPostCard(post, basePath, false, { hideCategory: true })).join('');
      const slug = slugify(cat) || 'category';
      return `<section id="cat-${escapeHtml(slug)}"><h2>${escapeHtml(cat)}</h2><ul class="post-list">${links}</ul></section>`;
    })
    .join('');

  const categoryNav = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b, sortLocale))
    .map(([cat, items]) => {
      const slug = slugify(cat) || 'category';
      return `<a class="category-nav-item" href="#cat-${escapeHtml(slug)}"><span>${escapeHtml(cat)}</span><span class="meta">${items.length}</span></a>`;
    })
    .join('');

  write(
    path.join(outputDir, 'categories', 'index.html'),
    renderLayoutPage(
      layout,
      {
        title: `${ui.nav.categories} | MyNotes`,
        description: ui.categories.subtitle,
        content: `<section class="hero"><h1>${escapeHtml(ui.categories.title)}</h1><p class="meta">${escapeHtml(
          ui.categories.subtitle
        )}</p></section><div class="category-page"><aside class="category-sidebar"><h3>${escapeHtml(
          ui.categories.navTitle
        )}</h3><nav class="category-nav">${categoryNav}</nav></aside><div class="category-content">${categoryBlocks}</div></div>`,
        year,
        lang: ui.htmlLang,
        basePath,
        navHome: ui.nav.home,
        navAbout: ui.nav.about,
        navAuthors: ui.nav.authors,
        navCategories: ui.nav.categories,
        navSearch: ui.nav.search,
        langToggleLabel: ui.toggleLabel,
        langToggleAria: ui.toggleAria,
        themeToggleAria: ui.themeLabels.aria,
        themeLabelAuto: ui.themeLabels.auto,
        themeLabelLight: ui.themeLabels.light,
        themeLabelDark: ui.themeLabels.dark
      },
      pageBackgrounds.categories
    )
  );

  const allPostList = publicPosts.map((post) => renderPostCard(post, basePath, true)).join('');
  const allPostsContent = `<section class="hero">
    <h1>${escapeHtml(ui.posts.title)}</h1>
    <p class="meta">${escapeHtml(ui.posts.subtitle)}</p>
  </section>
  <section>
    ${allPostList ? `<ul class="post-list">${allPostList}</ul>` : `<p class="meta">${escapeHtml(ui.posts.empty)}</p>`}
  </section>`;

  write(
    path.join(outputDir, 'posts', 'index.html'),
    renderLayoutPage(
      layout,
      {
        title: `${ui.posts.title} | MyNotes`,
        description: ui.posts.subtitle,
        content: allPostsContent,
        year,
        lang: ui.htmlLang,
        basePath,
        navHome: ui.nav.home,
        navAbout: ui.nav.about,
        navAuthors: ui.nav.authors,
        navCategories: ui.nav.categories,
        navSearch: ui.nav.search,
        langToggleLabel: ui.toggleLabel,
        langToggleAria: ui.toggleAria,
        themeToggleAria: ui.themeLabels.aria,
        themeLabelAuto: ui.themeLabels.auto,
        themeLabelLight: ui.themeLabels.light,
        themeLabelDark: ui.themeLabels.dark
      },
      pageBackgrounds.home
    )
  );

  for (const [cat, items] of Object.entries(grouped)) {
    const slug = slugify(cat) || 'category';
    const links = items.map((post) => renderPostCard(post, basePath, true, { hideCategory: true })).join('');
    const categoryContent = `<section class="hero">
      <a class="home-btn" href="${basePath}/categories/">${escapeHtml(ui.categories.back)}</a>
      <h1>${escapeHtml(cat)}</h1>
      <p class="meta">${escapeHtml(ui.categories.count(items.length))}</p>
    </section>
    <section>
      ${items.length ? `<ul class="post-list">${links}</ul>` : `<p class="meta">${escapeHtml(ui.posts.empty)}</p>`}
    </section>`;

    write(
      path.join(outputDir, 'categories', slug, 'index.html'),
      renderLayoutPage(
        layout,
        {
          title: `${escapeHtml(cat)} | MyNotes`,
          description: ui.categories.count(items.length),
          content: categoryContent,
          year,
          lang: ui.htmlLang,
          basePath,
          navHome: ui.nav.home,
          navAbout: ui.nav.about,
          navAuthors: ui.nav.authors,
          navCategories: ui.nav.categories,
          navSearch: ui.nav.search,
          langToggleLabel: ui.toggleLabel,
          langToggleAria: ui.toggleAria,
          themeToggleAria: ui.themeLabels.aria,
          themeLabelAuto: ui.themeLabels.auto,
          themeLabelLight: ui.themeLabels.light,
          themeLabelDark: ui.themeLabels.dark
        },
        pageBackgrounds.categories
      )
    );
  }

  for (const [tag, items] of Object.entries(tagGrouped)) {
    const slug = slugify(tag) || 'category';
    const links = items.map((post) => renderPostCard(post, basePath, true, { hideTag: tag })).join('');
    const tagContent = `<section class="hero">
      <a class="home-btn" href="${basePath}/">${escapeHtml(ui.tags.back)}</a>
      <h1>${escapeHtml(tag)}</h1>
      <p class="meta">${escapeHtml(ui.tags.count(items.length))}</p>
    </section>
    <section>
      ${items.length ? `<ul class="post-list">${links}</ul>` : `<p class="meta">${escapeHtml(ui.posts.empty)}</p>`}
    </section>`;

    write(
      path.join(outputDir, 'tags', slug, 'index.html'),
      renderLayoutPage(
        layout,
        {
          title: `${escapeHtml(tag)} | MyNotes`,
          description: ui.tags.count(items.length),
          content: tagContent,
          year,
          lang: ui.htmlLang,
          basePath,
          navHome: ui.nav.home,
          navAbout: ui.nav.about,
          navAuthors: ui.nav.authors,
          navCategories: ui.nav.categories,
          navSearch: ui.nav.search,
          langToggleLabel: ui.toggleLabel,
          langToggleAria: ui.toggleAria,
          themeToggleAria: ui.themeLabels.aria,
          themeLabelAuto: ui.themeLabels.auto,
          themeLabelLight: ui.themeLabels.light,
          themeLabelDark: ui.themeLabels.dark
        },
        pageBackgrounds.categories
      )
    );
  }

  const searchContent = `<section class="hero">
    <h1>${escapeHtml(ui.search.title)}</h1>
    <p class="meta">${escapeHtml(ui.search.subtitle)}</p>
  </section>
  <section>
    <input id="q" class="search-input" type="search" placeholder="${escapeHtml(ui.search.placeholder)}" />
    <ul id="result" class="post-list"></ul>
  </section>
  <script>
    const q = document.getElementById('q');
    const result = document.getElementById('result');
    const basePath = ${JSON.stringify(basePath)};
    const postsIndexPath = ${JSON.stringify(`/assets/posts.${lang}.json`)};

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
        .map((author) => '<a class="author-link" href="' + basePath + '/authors/' + esc(author.slug) + '/">' + esc(author.name) + '</a>')
        .join('<span class="meta-sep">/</span>');
    }

    function slugifyText(input) {
      return String(input)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\\u4e00-\\u9fa5]+/gi, '-')
        .replace(/(^-|-$)/g, '');
    }

    function detectLang(text) {
      return /[\\u4e00-\\u9fff]/.test(text) ? 'zh' : 'en';
    }

    function renderMeta(post) {
      const categorySlug = slugifyText(post.category) || 'category';
      const categoryLabel = '<span class="tag-label" lang="' + detectLang(post.category) + '">' + esc(post.category) + '</span>';
      const categoryChip = '<a class="tag tag-primary" href="' + basePath + '/categories/' + esc(categorySlug) + '/">' + categoryLabel + '</a>';
      const tags = (post.tags || []).map((tag) => {
        const slug = slugifyText(tag) || 'tag';
        const tagLabel = '<span class="tag-label" lang="' + detectLang(tag) + '">#' + esc(tag) + '</span>';
        return '<a class="tag tag-secondary" href="' + basePath + '/tags/' + esc(slug) + '/">' + tagLabel + '</a>';
      }).join('');
      const tagList = tags ? '<span class="tag-list">' + tags + '</span>' : '';
      return '<div class="post-meta-row"><span class="meta-left">' + esc(post.date) + ' · ' + renderAuthorLinks(post.authors) + '</span><span class="meta-right">' + categoryChip + tagList + '</span></div>';
    }

    async function load() {
      const res = await fetch(postsIndexPath);
      const posts = await res.json();

      const render = (list) => {
        result.innerHTML = list.map((post) =>
          '<li class="post-card" data-href="' + basePath + '/posts/' + post.slug + '/" role="link" tabindex="0">' +
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
    path.join(outputDir, 'search', 'index.html'),
    renderLayoutPage(
      layout,
      {
        title: `${ui.search.title} | MyNotes`,
        description: ui.search.subtitle,
        content: searchContent,
        year,
        lang: ui.htmlLang,
        basePath,
        navHome: ui.nav.home,
        navAbout: ui.nav.about,
        navAuthors: ui.nav.authors,
        navCategories: ui.nav.categories,
        navSearch: ui.nav.search,
        langToggleLabel: ui.toggleLabel,
        langToggleAria: ui.toggleAria,
        themeToggleAria: ui.themeLabels.aria,
        themeLabelAuto: ui.themeLabels.auto,
        themeLabelLight: ui.themeLabels.light,
        themeLabelDark: ui.themeLabels.dark
      },
      pageBackgrounds.search
    )
  );

  for (const post of posts) {
    const isLocked = Boolean(post.lockHash);
    const lockPanel = isLocked
      ? `<section class="post-lock" data-post-lock data-lock-hash="${post.lockHash}" data-post-key="${escapeHtml(post.slug)}">
      <p class="meta">${escapeHtml(ui.post.lockedIntro)}</p>
      <div class="post-lock-form">
        <input class="post-lock-input" type="password" autocomplete="current-password" placeholder="${escapeHtml(
          ui.post.passwordPlaceholder
        )}" />
        <button class="post-lock-btn" type="button">${escapeHtml(ui.post.unlock)}</button>
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
          if (message) message.textContent = ${JSON.stringify(ui.post.unlocked)};
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
            message.textContent = ${JSON.stringify(ui.post.emptyPassword)};
            return;
          }
          button.disabled = true;
          try {
            const actualHash = await hashText(password);
            if (actualHash === expectedHash) {
              unlockView();
            } else {
              message.textContent = ${JSON.stringify(ui.post.wrongPassword)};
            }
          } catch (error) {
            message.textContent = ${JSON.stringify(ui.post.unlockFail)};
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
        ? `<div class="post-meta-row">${escapeHtml(ui.post.authorPrefix)}${renderAuthorLinks(post.authors, basePath)}</div>`
        : renderPostMeta(post, basePath),
      lockPanel,
      contentClass: isLocked ? 'is-locked' : '',
      content: post.html,
      lockScript,
      commentsSection: buildCommentsSection(commentsConfig, ui),
      commentsScript: buildCommentsScript(commentsConfig, ui),
      backHomeHref: `${basePath}/`,
      backHomeLabel: escapeHtml(ui.post.backHome)
    });

    const html = renderLayoutPage(
      layout,
      {
        title: `${escapeHtml(post.title)} | MyNotes`,
        description: escapeHtml(post.summary),
        content,
        year,
        lang: ui.htmlLang,
        basePath,
        navHome: ui.nav.home,
        navAbout: ui.nav.about,
        navAuthors: ui.nav.authors,
        navCategories: ui.nav.categories,
        navSearch: ui.nav.search,
        langToggleLabel: ui.toggleLabel,
        langToggleAria: ui.toggleAria,
        themeToggleAria: ui.themeLabels.aria,
        themeLabelAuto: ui.themeLabels.auto,
        themeLabelLight: ui.themeLabels.light,
        themeLabelDark: ui.themeLabels.dark
      },
      post.background
    );

    write(path.join(outputDir, 'posts', post.slug, 'index.html'), html);
  }

  const notFoundLink = `<a href="${basePath}/">${escapeHtml(ui.errors.backHome)}</a>`;
  const notFoundMessage =
    ui.code === 'zh'
      ? `${escapeHtml(ui.errors.notFoundTitle)}，${notFoundLink}。`
      : `${escapeHtml(ui.errors.notFoundTitle)}. ${notFoundLink}.`;

  write(
    path.join(outputDir, '404.html'),
    renderLayoutPage(
      layout,
      {
        title: '404 | MyNotes',
        description: ui.errors.notFoundDesc,
        content: `<h1>404</h1><p>${notFoundMessage}</p>`,
        year,
        lang: ui.htmlLang,
        basePath,
        navHome: ui.nav.home,
        navAbout: ui.nav.about,
        navAuthors: ui.nav.authors,
        navCategories: ui.nav.categories,
        navSearch: ui.nav.search,
        langToggleLabel: ui.toggleLabel,
        langToggleAria: ui.toggleAria,
        themeToggleAria: ui.themeLabels.aria,
        themeLabelAuto: ui.themeLabels.auto,
        themeLabelLight: ui.themeLabels.light,
        themeLabelDark: ui.themeLabels.dark
      },
      pageBackgrounds.notFound
    )
  );

  write(
    path.join(distDir, 'assets', `posts.${lang}.json`),
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

function buildAutoRedirectPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Redirecting...</title>
    <meta name="robots" content="noindex" />
  </head>
  <body>
    <p>Redirecting...</p>
    <p><a href="/en/">English</a> · <a href="/zh/">中文</a></p>
    <script>
      (() => {
        const saved = localStorage.getItem('site-lang');
        const browser = (navigator.language || '').toLowerCase();
        const preferred = saved === 'en' || saved === 'zh' ? saved : browser.startsWith('zh') ? 'zh' : 'en';
        const path = window.location.pathname || '/';
        const stripped = path.replace(/^\\/(en|zh)(?=\\/|$)/, '');
        const clean = stripped.startsWith('/') ? stripped : '/' + stripped;
        const target = '/' + preferred + (clean === '/' ? '/' : clean);
        if (target !== path) {
          window.location.replace(target + window.location.search + window.location.hash);
        }
      })();
    </script>
  </body>
</html>`;
}

function writeRedirectIndex(relativePath, html) {
  const file = relativePath ? path.join(distDir, relativePath, 'index.html') : path.join(distDir, 'index.html');
  write(file, html);
}

removeDir(distDir);
ensureDir(distDir);
copyAssets();
copyStatic();
copyImages();

const languages = Object.keys(languageConfig);
const buildCache = {};

for (const lang of languages) {
  const posts = buildPosts(lang);
  const authorProfiles = buildAuthorProfiles(lang);
  const authors = linkAuthors(posts, authorProfiles, lang);
  buildSite(posts, authors, lang);
  buildCache[lang] = { posts, authors };
}

const redirectHtml = buildAutoRedirectPage();
const redirectPaths = [
  '',
  'about',
  'authors',
  'categories',
  'posts',
  'search'
];

for (const pathName of redirectPaths) {
  writeRedirectIndex(pathName, redirectHtml);
}

const postSlugs = new Set();
const authorSlugs = new Set();

for (const entry of Object.values(buildCache)) {
  for (const post of entry.posts || []) {
    postSlugs.add(post.slug);
  }
  for (const author of entry.authors || []) {
    authorSlugs.add(author.slug);
  }
}

for (const slug of postSlugs) {
  writeRedirectIndex(path.join('posts', slug), redirectHtml);
}

for (const slug of authorSlugs) {
  writeRedirectIndex(path.join('authors', slug), redirectHtml);
}

const categorySlugs = new Set();
const tagSlugs = new Set();
for (const entry of Object.values(buildCache)) {
  for (const post of entry.posts || []) {
    categorySlugs.add(slugify(post.category) || 'category');
    for (const tag of post.tags || []) {
      tagSlugs.add(slugify(tag) || 'tag');
    }
  }
}

for (const slug of categorySlugs) {
  writeRedirectIndex(path.join('categories', slug), redirectHtml);
}

for (const slug of tagSlugs) {
  writeRedirectIndex(path.join('tags', slug), redirectHtml);
}

write(path.join(distDir, '404.html'), redirectHtml);

const fontSource = './public/fonts';
const fontDestination = './dist/public/fonts';

if (fs.existsSync(fontSource)) {
  // Recursively copies the fonts folder to the dist folder
  fs.cpSync(fontSource, fontDestination, { recursive: true });
  console.log('Fonts copied to dist!');
} else {
  console.log('No font copied to dist');
}

const totalPosts = Object.values(buildCache).reduce((sum, entry) => sum + (entry.posts?.length || 0), 0);
const totalAuthors = Object.values(buildCache).reduce((sum, entry) => sum + (entry.authors?.length || 0), 0);
console.log(`Built ${totalPosts} posts and ${totalAuthors} authors into dist/.`);
