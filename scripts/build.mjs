import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcDir = path.join(root, 'src');
const contentDir = path.join(root, 'content');
const postsDir = path.join(contentDir, 'posts');
const imagesDir = path.join(contentDir, 'images');
const distDir = path.join(root, 'dist');

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
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function slugify(input) {
  return input
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

function buildPosts() {
  const files = fs.readdirSync(postsDir).filter((f) => f.endsWith('.md'));
  const posts = [];

  for (const file of files) {
    const abs = path.join(postsDir, file);
    const parsed = parseFrontMatter(read(abs));
    const title = parsed.meta.title || path.basename(file, '.md');
    const slug = slugify(path.basename(file, '.md'));
    const date = parsed.meta.date || '1970-01-01';
    const author = parsed.meta.author || 'Anonymous';
    const category = parsed.meta.category || 'Uncategorized';
    const cover = parsed.meta.cover || '';
    const summary = parsed.meta.summary || parsed.body.slice(0, 100).replace(/\n/g, ' ');
    const html = markdownToHtml(parsed.body);

    posts.push({
      title,
      slug,
      date,
      author,
      category,
      cover,
      summary,
      html,
      contentText: parsed.body
    });
  }

  posts.sort((a, b) => (a.date < b.date ? 1 : -1));
  return posts;
}

function buildSite(posts) {
  const layout = read(path.join(srcDir, 'templates', 'layout.html'));
  const postTpl = read(path.join(srcDir, 'templates', 'post.html'));
  const year = new Date().getFullYear();

  const postList = posts
    .map(
      (p) => `<li class="post-card" data-href="/posts/${p.slug}/" role="link" tabindex="0">
        ${coverImage(p.cover, 'post-cover', `${p.title} cover`)}
        <div class="post-main">
          <p class="meta">${escapeHtml(p.date)} · ${escapeHtml(p.author)} <span class="tag">${escapeHtml(p.category)}</span></p>
          <h2 class="post-card-title">${escapeHtml(p.title)}</h2>
          <p>${escapeHtml(p.summary)}</p>
        </div>
      </li>`
    )
    .join('');

  const indexContent = `<section class="hero">
    <h1>简约个人网站</h1>
    <p class="meta">全静态 · 模板与文章分离 · 支持 Cloudflare Pages</p>
    <p><a class="about-entry" href="/about/">关于我</a></p>
  </section>
  <ul class="post-list">${postList}</ul>`;

  const indexHtml = template(layout, {
    title: 'Home | MyNotes',
    description: 'A minimal personal static website.',
    content: indexContent,
    year
  });
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
    template(layout, {
      title: 'About | MyNotes',
      description: 'About this personal website.',
      content: aboutContent,
      year
    })
  );

  const grouped = posts.reduce((acc, post) => {
    const key = post.category;
    acc[key] = acc[key] || [];
    acc[key].push(post);
    return acc;
  }, {});

  const categoryBlocks = Object.entries(grouped)
    .map(([cat, items]) => {
      const links = items
        .map(
          (p) => `<li class="post-card" data-href="/posts/${p.slug}/" role="link" tabindex="0">
            ${coverImage(p.cover, 'post-cover', `${p.title} cover`)}
            <div class="post-main">
              <p class="meta">${escapeHtml(p.date)} · ${escapeHtml(p.author)} <span class="tag">${escapeHtml(p.category)}</span></p>
              <h2 class="post-card-title">${escapeHtml(p.title)}</h2>
            </div>
          </li>`
        )
        .join('');
      return `<section><h2>${escapeHtml(cat)}</h2><ul class="post-list">${links}</ul></section>`;
    })
    .join('');

  write(
    path.join(distDir, 'categories', 'index.html'),
    template(layout, {
      title: 'Category | MyNotes',
      description: 'Post categories',
      content: `<section class="hero"><h1>Category</h1><p class="meta">按分类浏览文章</p></section><div class="category-page">${categoryBlocks}</div>`,
      year
    })
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

    async function load() {
      const res = await fetch('/assets/posts.json');
      const posts = await res.json();

      const render = (list) => {
        result.innerHTML = list.map((p) =>
          '<li class=\"post-card\" data-href=\"/posts/' + p.slug + '/\" role=\"link\" tabindex=\"0\">' +
            (p.cover ? '<img class=\"post-cover\" src=\"' + p.cover + '\" alt=\"' + p.title + ' cover\" loading=\"lazy\" />' : '') +
            '<div class=\"post-main\">' +
              '<p class=\"meta\">' + p.date + ' · ' + p.author + ' <span class=\"tag\">' + p.category + '</span></p>' +
              '<h2 class=\"post-card-title\">' + p.title + '</h2>' +
              '<p>' + p.summary + '</p>' +
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

        const filtered = posts.filter((p) => {
          const text = (p.title + ' ' + p.author + ' ' + p.category + ' ' + p.contentText).toLowerCase();
          return text.includes(keyword);
        });
        render(filtered);
      });
    }

    load();
  </script>`;

  write(
    path.join(distDir, 'search', 'index.html'),
    template(layout, {
      title: 'Search | MyNotes',
      description: 'Search posts',
      content: searchContent,
      year
    })
  );

  for (const post of posts) {
    const content = template(postTpl, {
      title: escapeHtml(post.title),
      date: escapeHtml(post.date),
      author: escapeHtml(post.author),
      category: escapeHtml(post.category),
      content: post.html
    });

    const html = template(layout, {
      title: `${escapeHtml(post.title)} | MyNotes`,
      description: escapeHtml(post.summary),
      content,
      year
    });

    write(path.join(distDir, 'posts', post.slug, 'index.html'), html);
  }

  write(
    path.join(distDir, '404.html'),
    template(layout, {
      title: '404 | MyNotes',
      description: 'Page not found',
      content: '<h1>404</h1><p>页面不存在，返回 <a href="/">首页</a>。</p>',
      year
    })
  );

  write(
    path.join(distDir, 'assets', 'posts.json'),
    JSON.stringify(
      posts.map((p) => ({
        title: p.title,
        slug: p.slug,
        date: p.date,
        author: p.author,
        category: p.category,
        cover: p.cover,
        summary: p.summary,
        contentText: p.contentText
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
buildSite(posts);

console.log(`Built ${posts.length} posts into dist/.`);
