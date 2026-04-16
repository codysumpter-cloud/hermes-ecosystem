#!/usr/bin/env node
/**
 * build-pages.js
 *
 * Generates static HTML pages for each repo in the Hermes Atlas ecosystem:
 *   - Individual project pages at projects/{owner}/{repo}.html
 *   - Curated list pages at lists/{slug}.html
 *   - sitemap.xml
 *
 * Usage: GITHUB_TOKEN=... node scripts/build-pages.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { marked } from "marked";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SITE_URL = "https://hermesatlas.com";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.error("Error: GITHUB_TOKEN environment variable required");
  process.exit(1);
}

const GITHUB_HEADERS = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  Accept: "application/vnd.github+json",
  "User-Agent": "hermes-atlas-build",
};

// ── Check if a URL is absolute (skip rewriting) ──
function isAbsoluteUrl(url) {
  return /^(?:https?:\/\/|data:|mailto:|#|\/\/)/.test(url.trim());
}

// ── Strip leading ./ from paths and encode spaces ──
function cleanRelativePath(p) {
  return p.replace(/^\.\//, "").replace(/ /g, "%20");
}

// ── Transform relative URLs in README markdown to absolute GitHub URLs ──
function rewriteRelativeUrls(markdown, owner, repo) {
  const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/main/`;
  const blobBase = `https://github.com/${owner}/${repo}/blob/main/`;

  // Rewrite image references: ![alt](relative/path)
  markdown = markdown.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (match, alt, url) => {
      if (isAbsoluteUrl(url)) return match;
      return `![${alt}](${rawBase}${cleanRelativePath(url)})`;
    }
  );

  // Rewrite HTML img src: <img src="relative/path" (handles both " and ')
  markdown = markdown.replace(
    /(<img\s[^>]*?src=["'])([^"']+)(["'])/gi,
    (match, prefix, url, suffix) => {
      if (isAbsoluteUrl(url)) return match;
      return `${prefix}${rawBase}${cleanRelativePath(url)}${suffix}`;
    }
  );

  // Rewrite HTML video/source src
  markdown = markdown.replace(
    /(<(?:source|video)\s[^>]*?src=["'])([^"']+)(["'])/gi,
    (match, prefix, url, suffix) => {
      if (isAbsoluteUrl(url)) return match;
      return `${prefix}${rawBase}${cleanRelativePath(url)}${suffix}`;
    }
  );

  // Rewrite link references to non-anchor, non-URL paths: [text](relative/path)
  // Only rewrite if the path looks like a file (has extension)
  markdown = markdown.replace(
    /(?<!!)\[([^\]]*)\]\(([^)]+\.(?:md|txt|rst|html|pdf|json|yaml|yml|toml|py|js|ts|go|rs|sh|ipynb)[^)]*)\)/g,
    (match, text, url) => {
      if (isAbsoluteUrl(url)) return match;
      return `[${text}](${blobBase}${cleanRelativePath(url)})`;
    }
  );

  return markdown;
}

// ── Configure marked with custom renderer to catch any remaining relative URLs ──
const renderer = new marked.Renderer();

// Per-repo base URLs — set before each parse call
let currentRawBase = "";

renderer.image = function ({ href, title, text }) {
  let src = href || "";
  if (src && !isAbsoluteUrl(src)) {
    src = currentRawBase + cleanRelativePath(src);
  }
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(text || "")}"${titleAttr}>`;
};

marked.setOptions({
  gfm: true,
  breaks: false,
  renderer,
});

// ── Load data ──
const repos = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data", "repos.json"), "utf-8")
);

let lists = [];
const listsPath = path.join(ROOT, "data", "lists.json");
if (fs.existsSync(listsPath)) {
  lists = JSON.parse(fs.readFileSync(listsPath, "utf-8"));
}

// ── Fetch metadata via GraphQL (batch all repos) ──
async function fetchAllMetadata() {
  const repoQueries = repos
    .map(
      (r, i) =>
        `repo${i}: repository(owner: "${r.owner}", name: "${r.repo}") {
        stargazerCount
        description
        homepageUrl
        primaryLanguage { name }
        licenseInfo { spdxId }
        pushedAt
      }`
    )
    .join("\n");

  const query = `query { ${repoQueries} }`;

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { ...GITHUB_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    console.error(`GraphQL error: ${res.status}`);
    return {};
  }

  const data = await res.json();
  const metadata = {};

  repos.forEach((r, i) => {
    const node = data.data?.[`repo${i}`];
    if (node) {
      metadata[`${r.owner}/${r.repo}`] = {
        stars: node.stargazerCount,
        description: node.description || r.description,
        homepage: node.homepageUrl || null,
        language: node.primaryLanguage?.name || null,
        license: node.licenseInfo?.spdxId || null,
        pushedAt: node.pushedAt,
      };
    }
  });

  return metadata;
}

// ── Fetch README for a single repo ──
async function fetchReadme(owner, repo) {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/readme`,
      {
        headers: {
          ...GITHUB_HEADERS,
          Accept: "application/vnd.github.raw+json",
        },
      }
    );

    if (!res.ok) return null;

    let text = await res.text();

    // Truncate very long READMEs
    if (text.length > 50000) {
      text =
        text.slice(0, 50000) +
        `\n\n---\n\n*README truncated. [Continue reading on GitHub](https://github.com/${owner}/${repo}#readme)*`;
    }

    return text;
  } catch (e) {
    console.warn(`  Failed to fetch README for ${owner}/${repo}: ${e.message}`);
    return null;
  }
}

// ── Format star count ──
function formatStars(n) {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 1 : 1) + "K";
  return String(n);
}

// ── Escape HTML ──
function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Map category to list slug ──
const categoryToListSlug = {};
for (const list of lists) {
  if (list.filter?.category) {
    categoryToListSlug[list.filter.category] = list.slug;
  }
}

// ── Project page template ──
function renderProjectPage(repo, meta, readmeHtml, relatedRepos) {
  const title = `${repo.name} — Hermes Agent ${repo.category} | Hermes Atlas`;
  const desc = escapeHtml(
    (meta.description || repo.description).slice(0, 160)
  );
  const canonicalUrl = `${SITE_URL}/projects/${repo.owner}/${repo.repo}`;
  const stars = meta.stars || repo.stars;
  const listSlug = categoryToListSlug[repo.category];

  const relatedHtml = relatedRepos
    .filter((r) => r.repo !== repo.repo || r.owner !== repo.owner)
    .slice(0, 8)
    .map(
      (r) =>
        `<a href="/projects/${r.owner}/${r.repo}" class="related-chip">${r.name} <span class="related-stars">${formatStars(r.stars)}</span></a>`
    )
    .join("\n          ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${canonicalUrl}">
<meta property="og:title" content="${escapeHtml(repo.name)} — Hermes Atlas">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:site_name" content="Hermes Atlas">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(repo.name)} — Hermes Atlas">
<meta name="twitter:description" content="${desc}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🗺️</text></svg>">
<script>
  (function(){try{var s=localStorage.getItem('theme');var o=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches;var t=s||(o?'light':'dark');document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','dark')}})();
</script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  :root {
    --bg-base: #0a0a0f; --bg-card: #13131f; --bg-code: rgba(255,255,255,0.06);
    --border-subtle: #1e1e30; --border-default: #2a2a44;
    --text-primary: #e0e0e8; --text-secondary: #b0b0c8; --text-tertiary: #9494b0;
    --text-muted: #7878a0; --text-link: #a78bfa; --text-link-hover: #c4b5fd;
    --brand-purple: #a78bfa; --brand-star: #fbbf24;
    --overlay-subtle: rgba(255,255,255,0.04); --overlay-medium: rgba(255,255,255,0.08);
  }
  [data-theme="light"] {
    --bg-base: #fafafc; --bg-card: #ffffff; --bg-code: rgba(20,20,40,0.06);
    --border-subtle: #e8e8f0; --border-default: #d0d0dc;
    --text-primary: #1a1a2e; --text-secondary: #3a3a52; --text-tertiary: #5a5a78;
    --text-muted: #7a7a96; --text-link: #6d4fc4; --text-link-hover: #5b3fb5;
    --brand-star: #d97706;
    --overlay-subtle: rgba(20,20,40,0.03); --overlay-medium: rgba(20,20,40,0.08);
  }

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: var(--bg-base); color: var(--text-primary);
    font-family: 'Inter', -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
    transition: background 0.2s, color 0.2s;
  }
  a { color: var(--text-link); text-decoration: none; }
  a:hover { color: var(--text-link-hover); text-decoration: underline; }

  .nav {
    padding: 16px 24px; border-bottom: 1px solid var(--border-subtle);
    display: flex; justify-content: space-between; align-items: center;
    max-width: 960px; margin: 0 auto;
  }
  .nav-brand { font-size: 15px; font-weight: 800; color: var(--text-primary); text-decoration: none; display: flex; align-items: center; gap: 8px; }
  .nav-brand:hover { color: var(--text-link); text-decoration: none; }
  .nav-actions { display: flex; gap: 8px; align-items: center; }
  .nav-link { font-size: 12px; font-weight: 600; color: var(--text-tertiary); padding: 6px 12px; border-radius: 6px; }
  .nav-link:hover { color: var(--text-primary); background: var(--bg-code); text-decoration: none; }
  #theme-toggle {
    width: 34px; height: 34px; border-radius: 50%; background: var(--bg-card);
    border: 1px solid var(--border-subtle); color: var(--text-secondary);
    cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 15px;
  }
  #theme-toggle:hover { border-color: var(--brand-purple); }
  #theme-toggle .icon-sun { display: none; }
  [data-theme="light"] #theme-toggle .icon-sun { display: block; }
  [data-theme="light"] #theme-toggle .icon-moon { display: none; }

  .project { max-width: 800px; margin: 0 auto; padding: 40px 24px 80px; }

  .breadcrumb { margin-bottom: 16px; }
  .breadcrumb a {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.8px; padding: 3px 10px; border-radius: 4px;
    background: var(--overlay-medium); color: var(--text-tertiary);
  }
  .breadcrumb a:hover { text-decoration: none; color: var(--text-primary); }

  .project h1 {
    font-size: 28px; font-weight: 900; margin-bottom: 8px; letter-spacing: -0.3px;
  }
  .project-desc {
    font-size: 16px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 16px;
  }
  .meta-row {
    display: flex; flex-wrap: wrap; gap: 12px; align-items: center;
    margin-bottom: 20px; font-size: 13px; color: var(--text-tertiary);
  }
  .meta-row .stars { color: var(--brand-star); font-weight: 700; }
  .meta-row .badge {
    padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.3px;
  }
  .meta-row .badge-official { background: rgba(167,139,250,0.15); color: var(--brand-purple); }
  .meta-row .badge-lang { background: var(--overlay-medium); }

  .actions { display: flex; gap: 8px; margin-bottom: 32px; }
  .actions a {
    padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 600;
    transition: opacity 0.15s;
  }
  .actions .btn-primary {
    background: linear-gradient(135deg, #a78bfa, #818cf8);
    color: #fff;
  }
  .actions .btn-primary:hover { opacity: 0.85; text-decoration: none; color: #fff; }
  .actions .btn-secondary {
    background: var(--overlay-medium); color: var(--text-secondary);
    border: 1px solid var(--border-subtle);
  }
  .actions .btn-secondary:hover { color: var(--text-primary); text-decoration: none; }

  /* README styles */
  .readme {
    border-top: 1px solid var(--border-subtle); padding-top: 32px; margin-bottom: 40px;
  }
  .readme h1 { font-size: 24px; font-weight: 800; margin: 32px 0 12px; }
  .readme h2 { font-size: 20px; font-weight: 700; margin: 28px 0 10px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 6px; }
  .readme h3 { font-size: 16px; font-weight: 700; margin: 24px 0 8px; }
  .readme h4, .readme h5, .readme h6 { font-size: 14px; font-weight: 700; margin: 20px 0 6px; }
  .readme p { font-size: 14px; line-height: 1.7; margin-bottom: 14px; color: var(--text-secondary); }
  .readme a { color: var(--text-link); }
  .readme strong { color: var(--text-primary); }
  .readme img { max-width: 100%; border-radius: 8px; margin: 12px 0; }
  .readme ul, .readme ol { margin: 8px 0 16px 24px; font-size: 14px; line-height: 1.7; color: var(--text-secondary); }
  .readme li { margin-bottom: 4px; }
  .readme code {
    background: var(--bg-code); padding: 2px 6px; border-radius: 4px;
    font-size: 12.5px; font-family: 'SF Mono', Menlo, Consolas, monospace;
  }
  .readme pre {
    background: var(--bg-card); border: 1px solid var(--border-subtle);
    border-radius: 8px; padding: 16px; overflow-x: auto; margin: 12px 0 16px;
  }
  .readme pre code { background: none; padding: 0; font-size: 12.5px; }
  .readme table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
  .readme th { text-align: left; padding: 8px 10px; background: var(--overlay-medium); font-weight: 700; border-bottom: 1px solid var(--border-subtle); color: var(--text-tertiary); }
  .readme td { padding: 7px 10px; border-bottom: 1px solid var(--border-subtle); color: var(--text-secondary); }
  .readme blockquote { border-left: 3px solid var(--brand-purple); background: rgba(167,139,250,0.05); padding: 10px 16px; margin: 12px 0; border-radius: 0 8px 8px 0; color: var(--text-secondary); }
  .readme hr { border: none; border-top: 1px solid var(--border-subtle); margin: 24px 0; }
  .readme .no-readme { color: var(--text-muted); font-style: italic; padding: 40px 0; text-align: center; }

  /* Related projects */
  .related { border-top: 1px solid var(--border-subtle); padding-top: 24px; }
  .related h2 { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; color: var(--text-tertiary); }
  .related-grid { display: flex; flex-wrap: wrap; gap: 6px; }
  .related-chip {
    display: inline-flex; align-items: center; gap: 5px;
    background: var(--overlay-subtle); border: 1px solid var(--border-subtle);
    border-radius: 8px; padding: 6px 10px; font-size: 12.5px; font-weight: 500;
    color: var(--text-secondary); white-space: nowrap;
  }
  .related-chip:hover { background: var(--overlay-medium); color: var(--text-primary); text-decoration: none; }
  .related-stars { font-size: 10px; font-weight: 700; color: var(--brand-star); }
  .list-link { margin-top: 12px; font-size: 13px; }

  .page-footer {
    text-align: center; margin-top: 40px; padding-top: 24px;
    border-top: 1px solid var(--border-subtle);
    font-size: 11px; color: var(--text-muted);
  }
  .page-footer a { color: var(--text-link); }

  @media (max-width: 600px) {
    .project { padding: 24px 16px 60px; }
    .project h1 { font-size: 22px; }
  }
</style>
</head>
<body>
<nav class="nav">
  <a href="/" class="nav-brand">🗺️ Hermes Atlas</a>
  <div class="nav-actions">
    <a href="/" class="nav-link">Ecosystem Map</a>
    <button id="theme-toggle" aria-label="Toggle theme"><span class="icon-moon">☾</span><span class="icon-sun">☀</span></button>
  </div>
</nav>

<article class="project">
  <div class="breadcrumb">
    <a href="/">${escapeHtml(repo.category)}</a>
  </div>

  <h1>${escapeHtml(repo.name)}${repo.official ? ' <span style="font-size:14px;color:var(--brand-purple)">OFFICIAL</span>' : ""}</h1>
  <p class="project-desc">${escapeHtml(meta.description || repo.description)}</p>

  <div class="meta-row">
    <span class="stars">★ ${formatStars(stars).toLocaleString()}</span>
    ${meta.language ? `<span class="badge badge-lang">${escapeHtml(meta.language)}</span>` : ""}
    ${meta.license && meta.license !== "NOASSERTION" ? `<span class="badge badge-lang">${escapeHtml(meta.license)}</span>` : ""}
    ${repo.official ? '<span class="badge badge-official">Nous Research</span>' : ""}
    ${meta.pushedAt ? `<span>Updated ${new Date(meta.pushedAt).toLocaleDateString()}</span>` : ""}
  </div>

  <div class="actions">
    <a href="${escapeHtml(repo.url)}" target="_blank" rel="noopener" class="btn-primary">View on GitHub →</a>
    ${meta.homepage ? `<a href="${escapeHtml(meta.homepage)}" target="_blank" rel="noopener" class="btn-secondary">Homepage</a>` : ""}
  </div>

  <section class="readme">
    ${readmeHtml || '<div class="no-readme">This project doesn\'t have a README yet. <a href="' + escapeHtml(repo.url) + '" target="_blank">Visit GitHub</a> for more details.</div>'}
  </section>

  <aside class="related">
    <h2>More in ${escapeHtml(repo.category)}</h2>
    <div class="related-grid">
      ${relatedHtml}
    </div>
    ${listSlug ? `<p class="list-link"><a href="/lists/${listSlug}">See all ${escapeHtml(repo.category)} projects →</a></p>` : ""}
  </aside>
</article>

<div class="page-footer">
  <p><a href="/">Hermes Atlas</a> · The community map for <a href="https://github.com/NousResearch/hermes-agent">Hermes Agent</a> by Nous Research</p>
</div>

<script>
  document.getElementById('theme-toggle')?.addEventListener('click',()=>{
    const c=document.documentElement.getAttribute('data-theme');
    const n=c==='light'?'dark':'light';
    document.documentElement.setAttribute('data-theme',n);
    try{localStorage.setItem('theme',n)}catch(e){}
  });
</script>
</body>
</html>`;
}

// ── List page template ──
function renderListPage(list, matchedRepos) {
  const title = `${list.title} | Hermes Atlas`;
  const desc = escapeHtml(list.description.slice(0, 160));
  const canonicalUrl = `${SITE_URL}/lists/${list.slug}`;

  const repoRows = matchedRepos
    .sort((a, b) => (b.meta?.stars || b.stars) - (a.meta?.stars || a.stars))
    .map(
      (r, i) => `
      <tr>
        <td style="font-weight:700;color:var(--text-tertiary)">${i + 1}</td>
        <td><a href="/projects/${r.owner}/${r.repo}"><strong>${escapeHtml(r.name)}</strong></a>${r.official ? ' <span style="font-size:10px;color:var(--brand-purple);font-weight:700">OFFICIAL</span>' : ""}</td>
        <td style="color:var(--brand-star);font-weight:700">★ ${formatStars(r.meta?.stars || r.stars)}</td>
        <td style="color:var(--text-secondary);font-size:13px">${escapeHtml((r.meta?.description || r.description).slice(0, 120))}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${canonicalUrl}">
<meta property="og:title" content="${escapeHtml(list.title)}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="website">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:site_name" content="Hermes Atlas">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(list.title)}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🗺️</text></svg>">
<script>
  (function(){try{var s=localStorage.getItem('theme');var o=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches;var t=s||(o?'light':'dark');document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','dark')}})();
</script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  :root {
    --bg-base: #0a0a0f; --bg-card: #13131f; --bg-code: rgba(255,255,255,0.06);
    --border-subtle: #1e1e30;
    --text-primary: #e0e0e8; --text-secondary: #b0b0c8; --text-tertiary: #9494b0;
    --text-muted: #7878a0; --text-link: #a78bfa; --text-link-hover: #c4b5fd;
    --brand-purple: #a78bfa; --brand-star: #fbbf24;
    --overlay-medium: rgba(255,255,255,0.08);
  }
  [data-theme="light"] {
    --bg-base: #fafafc; --bg-card: #ffffff; --bg-code: rgba(20,20,40,0.06);
    --border-subtle: #e8e8f0;
    --text-primary: #1a1a2e; --text-secondary: #3a3a52; --text-tertiary: #5a5a78;
    --text-muted: #7a7a96; --text-link: #6d4fc4; --text-link-hover: #5b3fb5;
    --brand-star: #d97706;
    --overlay-medium: rgba(20,20,40,0.08);
  }
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: var(--bg-base); color: var(--text-primary); font-family: 'Inter', -apple-system, sans-serif; -webkit-font-smoothing: antialiased; transition: background 0.2s; }
  a { color: var(--text-link); text-decoration: none; }
  a:hover { color: var(--text-link-hover); text-decoration: underline; }
  .nav { padding: 16px 24px; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; max-width: 960px; margin: 0 auto; }
  .nav-brand { font-size: 15px; font-weight: 800; color: var(--text-primary); text-decoration: none; display: flex; align-items: center; gap: 8px; }
  .nav-brand:hover { color: var(--text-link); text-decoration: none; }
  .nav-actions { display: flex; gap: 8px; align-items: center; }
  .nav-link { font-size: 12px; font-weight: 600; color: var(--text-tertiary); padding: 6px 12px; border-radius: 6px; }
  .nav-link:hover { color: var(--text-primary); background: var(--bg-code); text-decoration: none; }
  #theme-toggle { width: 34px; height: 34px; border-radius: 50%; background: var(--bg-card); border: 1px solid var(--border-subtle); color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 15px; }
  #theme-toggle:hover { border-color: var(--brand-purple); }
  #theme-toggle .icon-sun { display: none; }
  [data-theme="light"] #theme-toggle .icon-sun { display: block; }
  [data-theme="light"] #theme-toggle .icon-moon { display: none; }

  .list-page { max-width: 800px; margin: 0 auto; padding: 40px 24px 80px; }
  .list-page h1 { font-size: 28px; font-weight: 900; margin-bottom: 8px; letter-spacing: -0.3px; }
  .list-page .intro { font-size: 15px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 24px; }
  .list-page table { width: 100%; border-collapse: collapse; }
  .list-page th { text-align: left; padding: 10px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary); border-bottom: 1px solid var(--border-subtle); background: var(--overlay-medium); }
  .list-page td { padding: 10px 12px; border-bottom: 1px solid var(--border-subtle); }
  .list-page tr:hover td { background: var(--overlay-medium); }
  .back-link { margin-top: 24px; font-size: 13px; }
  .page-footer { text-align: center; margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--border-subtle); font-size: 11px; color: var(--text-muted); }
  .page-footer a { color: var(--text-link); }
  @media (max-width: 600px) { .list-page { padding: 24px 16px 60px; } .list-page h1 { font-size: 22px; } }
</style>
</head>
<body>
<nav class="nav">
  <a href="/" class="nav-brand">🗺️ Hermes Atlas</a>
  <div class="nav-actions">
    <a href="/" class="nav-link">Ecosystem Map</a>
    <button id="theme-toggle" aria-label="Toggle theme"><span class="icon-moon">☾</span><span class="icon-sun">☀</span></button>
  </div>
</nav>
<article class="list-page">
  <h1>${escapeHtml(list.title)}</h1>
  <p class="intro">${escapeHtml(list.description)}</p>
  <table>
    <thead><tr><th>#</th><th>Project</th><th>Stars</th><th>Description</th></tr></thead>
    <tbody>${repoRows}</tbody>
  </table>
  <p class="back-link"><a href="/">← Back to Ecosystem Map</a></p>
</article>
<div class="page-footer">
  <p><a href="/">Hermes Atlas</a> · The community map for <a href="https://github.com/NousResearch/hermes-agent">Hermes Agent</a> by Nous Research</p>
</div>
<script>
  document.getElementById('theme-toggle')?.addEventListener('click',()=>{
    const c=document.documentElement.getAttribute('data-theme');
    const n=c==='light'?'dark':'light';
    document.documentElement.setAttribute('data-theme',n);
    try{localStorage.setItem('theme',n)}catch(e){}
  });
</script>
</body>
</html>`;
}

// ── Generate sitemap.xml ──
function generateSitemap(projectPages, listPages) {
  const today = new Date().toISOString().slice(0, 10);

  let urls = `  <url><loc>${SITE_URL}/</loc><changefreq>daily</changefreq><priority>1.0</priority><lastmod>${today}</lastmod></url>\n`;
  urls += `  <url><loc>${SITE_URL}/reports/state-of-hermes-april-2026</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>\n`;

  for (const page of projectPages) {
    urls += `  <url><loc>${SITE_URL}/projects/${page.owner}/${page.repo}</loc><changefreq>weekly</changefreq><priority>0.8</priority><lastmod>${today}</lastmod></url>\n`;
  }

  for (const list of listPages) {
    urls += `  <url><loc>${SITE_URL}/lists/${list.slug}</loc><changefreq>weekly</changefreq><priority>0.6</priority><lastmod>${today}</lastmod></url>\n`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}</urlset>\n`;
}

// ── Main ──
async function main() {
  console.log(`Building pages for ${repos.length} repos + ${lists.length} lists...\n`);

  // Fetch metadata in one batch
  console.log("Fetching metadata via GraphQL...");
  const metadata = await fetchAllMetadata();
  console.log(`  Got metadata for ${Object.keys(metadata).length} repos\n`);

  // Ensure output directories exist
  const projectsDir = path.join(ROOT, "projects");
  const listsDir = path.join(ROOT, "lists");
  fs.mkdirSync(projectsDir, { recursive: true });
  fs.mkdirSync(listsDir, { recursive: true });

  // Generate project pages
  console.log("Generating project pages...");
  let generated = 0;
  let errors = 0;

  for (const repo of repos) {
    const key = `${repo.owner}/${repo.repo}`;
    const meta = metadata[key] || {};

    // Fetch README
    const readmeRaw = await fetchReadme(repo.owner, repo.repo);
    let readmeHtml = null;
    if (readmeRaw) {
      try {
        currentRawBase = `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/main/`;
        const readmeFixed = rewriteRelativeUrls(readmeRaw, repo.owner, repo.repo);
        readmeHtml = marked.parse(readmeFixed);
      } catch (e) {
        console.warn(`  Markdown parse error for ${key}: ${e.message}`);
      }
    }

    // Get related repos (same category)
    const relatedRepos = repos
      .filter((r) => r.category === repo.category)
      .map((r) => ({ ...r, meta: metadata[`${r.owner}/${r.repo}`] }));

    // Generate HTML
    const html = renderProjectPage(
      repo,
      { ...repo, ...meta },
      readmeHtml,
      relatedRepos
    );

    // Write file
    const ownerDir = path.join(projectsDir, repo.owner);
    fs.mkdirSync(ownerDir, { recursive: true });
    fs.writeFileSync(path.join(ownerDir, `${repo.repo}.html`), html, "utf-8");

    generated++;
    process.stdout.write(`  ${generated}/${repos.length} ${key}\r`);

    // Small delay to be polite to GitHub API
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\n  Generated ${generated} project pages (${errors} errors)\n`);

  // Generate list pages
  console.log("Generating list pages...");
  for (const list of lists) {
    const matchedRepos = repos
      .filter((r) => {
        if (list.filter?.category) return r.category === list.filter.category;
        return false;
      })
      .map((r) => ({
        ...r,
        meta: metadata[`${r.owner}/${r.repo}`],
      }));

    const html = renderListPage(list, matchedRepos);
    fs.writeFileSync(path.join(listsDir, `${list.slug}.html`), html, "utf-8");
    console.log(`  ${list.slug} (${matchedRepos.length} repos)`);
  }

  // Generate sitemap
  console.log("\nGenerating sitemap.xml...");
  const sitemap = generateSitemap(repos, lists);
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap, "utf-8");
  console.log(`  ${repos.length + lists.length + 2} URLs`);

  // Generate robots.txt
  const robotsTxt = `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`;
  fs.writeFileSync(path.join(ROOT, "robots.txt"), robotsTxt, "utf-8");

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
