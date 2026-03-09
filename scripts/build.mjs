import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

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
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let inList = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();

    if (!line) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      continue;
    }

    if (line.startsWith('### ')) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<h3>${inlineMarkdown(line.slice(4))}</h3>`;
      continue;
    }

    if (line.startsWith('## ')) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<h2>${inlineMarkdown(line.slice(3))}</h2>`;
      continue;
    }

    if (line.startsWith('# ')) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<h1>${inlineMarkdown(line.slice(2))}</h1>`;
      continue;
    }

    if (line.startsWith('- ')) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${inlineMarkdown(line.slice(2))}</li>`;
      continue;
    }

    if (line.startsWith('> ')) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`;
      continue;
    }

    if (inList) {
      html += '</ul>';
      inList = false;
    }

    html += `<p>${inlineMarkdown(line)}</p>`;
  }

  if (inList) html += '</ul>';
  return html;
}

function inlineMarkdown(text) {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return out;
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
  return template(layout, {
    ...pageVars,
    ...buildBodyAttrs(backgroundImage)
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

function normalizeName(name) {
  return String(name).trim().toLowerCase();
}

function parseBool(value) {
  const text = String(value || '')
    .trim()
    .toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(text);
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

function renderPostMeta(post) {
  return `${escapeHtml(post.date)} · ${renderAuthorLinks(post.authors)} <span class="tag">${escapeHtml(post.category)}</span>`;
}

function renderPostCard(post, includeSummary = true) {
  return `<li class="post-card" data-href="/posts/${post.slug}/" role="link" tabindex="0">
    ${coverImage(post.cover, 'post-cover', `${post.title} cover`)}
    <div class="post-main">
      <p class="meta post-meta">${renderPostMeta(post)}</p>
      <h2 class="post-card-title">${escapeHtml(post.title)}</h2>
      ${includeSummary ? `<p>${escapeHtml(post.summary)}</p>` : ''}
    </div>
  </li>`;
}

function buildSite(posts, authors) {
  const layout = read(path.join(srcDir, 'templates', 'layout.html'));
  const postTpl = read(path.join(srcDir, 'templates', 'post.html'));
  const year = new Date().getFullYear();
  const publicPosts = posts.filter((post) => !post.hidden);
  const postList = publicPosts.map((post) => renderPostCard(post, true)).join('');

  const indexContent = `<section class="hero">
    <h1>简约个人网站</h1>
    <p class="meta">全静态 · 模板与文章分离 · 支持 Cloudflare Pages</p>
    <p><a class="about-entry" href="/about/">关于我</a></p>
  </section>
  <ul class="post-list">${postList}</ul>`;

  const indexHtml = renderLayoutPage(
    layout,
    {
      title: 'Home | MyNotes',
      description: 'A minimal personal static website.',
      content: indexContent,
      year
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

  const categoryBlocks = Object.entries(grouped)
    .map(([cat, items]) => {
      const links = items.map((post) => renderPostCard(post, false)).join('');
      return `<section><h2>${escapeHtml(cat)}</h2><ul class="post-list">${links}</ul></section>`;
    })
    .join('');

  write(
    path.join(distDir, 'categories', 'index.html'),
    renderLayoutPage(
      layout,
      {
        title: 'Category | MyNotes',
        description: 'Post categories',
        content: `<section class="hero"><h1>Category</h1><p class="meta">按分类浏览文章</p></section><div class="category-page">${categoryBlocks}</div>`,
        year
      },
      pageBackgrounds.categories
    )
  );

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

    function renderMeta(post) {
      return esc(post.date) + ' · ' + renderAuthorLinks(post.authors) + ' <span class="tag">' + esc(post.category) + '</span>';
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
          const text = (post.title + ' ' + authorText + ' ' + post.category + ' ' + post.contentText).toLowerCase();
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
      metaHtml: isLocked ? `作者：${renderAuthorLinks(post.authors)}` : renderPostMeta(post),
      lockPanel,
      contentClass: isLocked ? 'is-locked' : '',
      content: post.html,
      lockScript
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

console.log(`Built ${posts.length} posts and ${authors.length} authors into dist/.`);
