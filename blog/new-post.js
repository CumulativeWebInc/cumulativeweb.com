#!/usr/bin/env node
// CWI blog generator — every post = HTML page + JSON twin + JSON-LD + beacons.
// Usage:
//   node blog/new-post.js new blog/drafts/<file>.md        # create/update a post (draft or published)
//   node blog/new-post.js approve <slug> [slug...]         # publish one or many drafts (stacked approval)
//   node blog/new-post.js list                             # list all posts with status
//   node blog/new-post.js rebuild                          # regenerate every post page + index + hub
//
// Input markdown format: front matter between --- lines:
//   title, date (YYYY-MM-DD, default today), excerpt, tags (comma list), status (draft|published)
// followed by the markdown body.
//
// Every run regenerates: blog/posts/<slug>.html, blog/posts/<slug>.json,
// blog/index.json (newest first), blog/index.html (hub), and sitemap.xml entries.
// Personal-data scrub: fails loudly if "Henry Pitts" appears anywhere in the copy.
const fs = require('fs');
const path = require('path');

const REPO = '/home/hatch/workspace/repos/cumulativeweb.com';
const BLOG = path.join(REPO, 'blog');
const POSTS_DIR = path.join(BLOG, 'posts');
const DRAFTS_DIR = path.join(BLOG, 'drafts');
const BASE = 'https://cumulativeweb.com';
const WORKER = 'https://cwi-machine-data.hp-ace.workers.dev';

fs.mkdirSync(POSTS_DIR, { recursive: true });

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escAttr = esc;
const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const todayStr = () => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
const escScript = (t) => String(t).replace(/<\/script/gi, '<\\/script');

// ---- personal-data scrub (Black's law: never the legal name in public) ----
function scrub(text, where) {
  if (/henry\s+pitts/i.test(text)) {
    throw new Error(`PERSONAL-DATA BLOCK: legal name found in ${where} — refusing to build.`);
  }
  if (/\bpitts\b/i.test(text) && !/black lansky/i.test(text)) {
    console.warn(`WARN: bare "Pitts" in ${where} — verify this is the public identity before shipping.`);
  }
}

// ---- minimal markdown -> html (headings, bold, italic, links, lists, paragraphs) ----
function mdToHtml(md) {
  const lines = md.split('\n');
  let html = '', inList = false;
  const inline = (t) => esc(t)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, txt, url) => {
      const ext = /^https?:\/\//.test(url) && !url.startsWith(BASE + '/');
      return `<a href="${escAttr(url)}"${ext ? ' data-outbound target="_blank" rel="noopener"' : ''}>${txt}</a>`;
    });
  for (const raw of lines) {
    const line = raw.trim();
    if (/^###\s+/.test(line)) { if (inList) { html += '</ul>'; inList = false; } html += `<h3>${inline(line.slice(4))}</h3>`; }
    else if (/^##\s+/.test(line)) { if (inList) { html += '</ul>'; inList = false; } html += `<h2>${inline(line.slice(3))}</h2>`; }
    else if (/^#\s+/.test(line)) { if (inList) { html += '</ul>'; inList = false; } html += `<h2>${inline(line.slice(2))}</h2>`; }
    else if (/^[-*]\s+/.test(line)) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inline(line.slice(2))}</li>`; }
    else if (/^\d+\.\s+/.test(line)) { if (!inList) { html += '<ol>'; inList = true; } html += `<li>${inline(line.replace(/^\d+\.\s+/, ''))}</li>`; }
    else if (line === '') { if (inList) { html += inList === true ? '</ul>' : '</ol>'; inList = false; } }
    else { if (inList) { html += '</ul>'; inList = false; } html += `<p>${inline(line)}</p>`; }
  }
  if (inList) html += '</ul>';
  return html;
}

// ---- front matter ----
function parseMdFile(p) {
  const raw = fs.readFileSync(p, 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) throw new Error(`Bad front matter in ${p}`);
  const fm = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) fm[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  const title = fm.title || path.basename(p, '.md');
  const post = {
    slug: slugify(fm.slug || title),
    _file: p,
    title,
    date: fm.date || todayStr(),
    excerpt: fm.excerpt || '',
    tags: (fm.tags || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean),
    status: (fm.status || 'draft').toLowerCase() === 'published' ? 'published' : 'draft',
    body_md: m[2].trim(),
  };
  scrub(post.title + '\n' + post.excerpt + '\n' + post.body_md, p);
  if (!post.excerpt) throw new Error(`Missing excerpt in ${p} — every post needs one.`);
  if (!post.tags.length) throw new Error(`Missing tags in ${p} — every post needs tags.`);
  return post;
}

// ---- related posts: shared tags first, backfill with newest ----
function relatedFor(post, all, n = 2) {
  const others = all.filter(p => p.slug !== post.slug);
  const scored = others.map(p => ({
    p, score: p.tags.filter(t => post.tags.includes(t)).length,
  })).sort((a, b) => b.score - a.score || b.p.date.localeCompare(a.p.date));
  return scored.slice(0, n).map(s => s.p);
}

// ---- beacon snippet (same protocol as the Radio 365 track pages) ----
function beaconJs(contentId, slotId, pageMeta) {
  return `<script>
(function(){
  var CID = ${JSON.stringify(contentId)};
  var SLOT = ${JSON.stringify(slotId)};
  function beacon(type){
    try{
      fetch(${JSON.stringify(WORKER + '/ad/event')},{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({event_type:type,slot_id:SLOT,content_id:CID,meta:{page:${JSON.stringify(pageMeta)}}}))}).catch(function(){});
    }catch(e){}
  }
  beacon('exposure');
  var links = document.querySelectorAll('a[data-outbound]');
  for (var i=0;i<links.length;i++){ (function(a){ a.addEventListener('click', function(){ beacon('click'); }); })(links[i]); }
  var eq = document.getElementById('equip-copy');
  if (eq) eq.addEventListener('click', function(){
    var pre = document.getElementById('equip-cmd');
    var txt = pre ? pre.textContent : '';
    function ok(){ beacon('equip'); var d=document.getElementById('equip-done'); if(d) d.style.display=''; }
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(txt).then(ok).catch(function(){}); }
    else { var ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy');ok();}catch(e){} document.body.removeChild(ta); }
  });
})();
</script>`;
}

const PAGE_CSS = `:root{
  --bg:#0a0a0a; --panel:#111214; --gold:#d9b36c; --gold-soft:#b9975a;
  --ink:#f2ede3; --muted:#a8a29a; --line:#2a2419; --maxw:860px; --radius:14px;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  line-height:1.7;-webkit-font-smoothing:antialiased}
a{color:var(--gold);text-decoration:none}
a:hover{text-decoration:underline}
.wrap{max-width:var(--maxw);margin:0 auto;padding:0 22px}
header.top{border-bottom:1px solid var(--line);background:rgba(10,10,10,.94);position:sticky;top:0;z-index:50}
.top-inner{display:flex;align-items:center;justify-content:space-between;padding:12px 0}
.brandline{display:flex;align-items:center;gap:12px}
.brandline img{width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid var(--gold-soft)}
.brandline .who{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.brandline .who b{display:block;color:var(--gold);letter-spacing:.22em;font-size:14px}
nav.cta a{display:inline-block;border:1px solid var(--gold);color:var(--gold);padding:8px 18px;border-radius:999px;font-size:13px;letter-spacing:.06em;margin-left:8px}
nav.cta a:hover{background:var(--gold);color:#0a0a0a;text-decoration:none}
article{padding:44px 0 30px}
.eyebrow{display:inline-block;font-size:12px;letter-spacing:.24em;text-transform:uppercase;color:#0a0a0a;background:var(--gold);border-radius:999px;padding:5px 14px;font-weight:700;margin-bottom:14px}
h1{font-size:clamp(30px,4.6vw,48px);line-height:1.12;margin:0 0 10px;letter-spacing:-.01em}
.byline{color:var(--muted);font-size:14px;margin-bottom:26px}
.byline time{color:var(--gold-soft)}
.tags{margin:26px 0 0;display:flex;gap:8px;flex-wrap:wrap}
.tag{font-size:12px;letter-spacing:.08em;border:1px solid var(--line);border-radius:999px;padding:4px 12px;color:var(--muted)}
article .body p{margin:0 0 18px;font-size:17px}
article .body h2{font-size:24px;margin:30px 0 12px}
article .body ul,article .body ol{margin:0 0 18px;padding-left:24px}
article .body li{margin-bottom:8px}
.equip{margin-top:34px;background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:22px}
.equip h3{margin:0 0 8px;font-size:16px;color:var(--gold)}
.equip p{margin:0 0 12px;color:var(--muted);font-size:14px}
.equip pre{background:#0d0e10;border:1px solid var(--line);border-radius:8px;padding:12px;font-size:13px;overflow-x:auto}
.equip button{background:var(--gold);color:#0a0a0a;border:0;border-radius:8px;padding:10px 16px;font-weight:700;cursor:pointer;font-size:14px}
#equip-done{display:none;color:#7db4ff;margin-left:10px;font-size:14px}
.related{margin-top:40px;border-top:1px solid var(--line);padding-top:26px}
.related h2{font-size:22px;margin:0 0 16px}
.rel-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.rel-card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:18px}
.rel-card h3{margin:0 0 6px;font-size:17px}
.rel-card p{margin:0;color:var(--muted);font-size:14px}
.rel-card .date{font-size:12px;color:var(--gold-soft);letter-spacing:.08em}
footer{border-top:1px solid var(--line);padding:36px 0 52px;color:var(--muted);font-size:14px}
.foot-grid{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap}
@media (max-width:700px){.rel-grid{grid-template-columns:1fr}article{padding:30px 0 20px}}`;

function jsonld(post, url) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": post.excerpt,
    "datePublished": post.date,
    "dateModified": post.date,
    "author": { "@type": "Organization", "name": "Cumulative Web Inc", "url": BASE + "/" },
    "publisher": { "@type": "Organization", "name": "Cumulative Web Inc", "url": BASE + "/", "logo": { "@type": "ImageObject", "url": BASE + "/assets/cwi-logo.jpg" } },
    "mainEntityOfPage": { "@type": "WebPage", "@id": url },
    "keywords": post.tags.join(", "),
    "inLanguage": "en",
  };
}

function renderPost(post, related) {
  const url = `${BASE}/blog/posts/${post.slug}.html`;
  const jsonUrl = `${BASE}/blog/posts/${post.slug}.json`;
  const ld = jsonld(post, url);
  const body = mdToHtml(post.body_md);
  const relCards = related.map(r => {
    const ru = `${BASE}/blog/posts/${r.slug}.html`;
    return `<div class="rel-card"><div class="date">${esc(r.date)}</div><h3><a href="${ru}">${esc(r.title)}</a></h3><p>${esc(r.excerpt)}</p></div>`;
  }).join('\n');
  const tagChips = post.tags.map(t => `<a class="tag" href="${BASE}/blog/#tag-${escAttr(t)}">${esc(t)}</a>`).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(post.title)} · CWI Blog · Cumulative Web Inc</title>
<meta name="description" content="${escAttr(post.excerpt)}">
<meta name="keywords" content="${escAttr(post.tags.join(', '))}, Cumulative Web Inc, blog">
<meta name="author" content="Cumulative Web Inc">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Cumulative Web Inc">
<meta property="og:title" content="${escAttr(post.title)}">
<meta property="og:description" content="${escAttr(post.excerpt)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${BASE}/assets/cwi-logo.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escAttr(post.title)}">
<meta name="twitter:description" content="${escAttr(post.excerpt)}">
<meta name="twitter:image" content="${BASE}/assets/cwi-logo.jpg">
<meta name="theme-color" content="#0a0a0a">
<link rel="alternate" type="application/json" title="Machine-readable JSON" href="${jsonUrl}">
<script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
</script>
<style>${PAGE_CSS}</style>
</head>
<body>
<header class="top">
  <div class="wrap top-inner">
    <a class="brandline" href="${BASE}/" aria-label="Cumulative Web Inc home">
      <img src="${BASE}/assets/cwi-logo.jpg" alt="Cumulative Web Inc logo" width="36" height="36">
      <span class="who"><b>CWI BLOG</b>The label's news wire</span>
    </a>
    <nav class="cta" aria-label="Primary">
      <a href="${BASE}/blog/">All posts</a>
      <a href="${BASE}/blog/index.json">JSON feed</a>
    </nav>
  </div>
</header>
<main class="wrap">
<article>
  <span class="eyebrow">CWI Blog</span>
  <h1>${esc(post.title)}</h1>
  <div class="byline">By <strong>Cumulative Web Inc</strong> · <time datetime="${escAttr(post.date)}">${esc(post.date)}</time></div>
  <div class="body">${body}</div>
  <div class="tags">${tagChips}</div>
  <div class="equip">
    <h3>Machine-readable</h3>
    <p>Every CWI blog post ships with a JSON twin. Copying fires an <code>equip</code> beacon so the machine learns what gets equipped.</p>
    <pre id="equip-cmd">curl ${jsonUrl}</pre>
    <button id="equip-copy">Copy equip command</button><span id="equip-done">Copied — equip beacon fired.</span>
  </div>
  <section class="related" aria-label="Related posts">
    <h2>Related</h2>
    <div class="rel-grid">${relCards}</div>
  </section>
</article>
</main>
<footer>
  <div class="wrap foot-grid">
    <div><strong style="color:var(--gold);letter-spacing:.2em">CWI BLOG</strong><br>
    The news wire of Cumulative Web Inc.<br>
    © 2026 Cumulative Web Inc. All rights reserved.</div>
    <div><a href="${BASE}/blog/">All posts</a> · <a href="${BASE}/blog/index.json">JSON</a> · <a href="${BASE}/">cumulativeweb.com</a></div>
  </div>
</footer>
${beaconJs('blog:' + post.slug, 'blog-post', post.slug)}
</body>
</html>
`;
}

function postJson(post, related) {
  const url = `${BASE}/blog/posts/${post.slug}.html`;
  const jsonUrl = `${BASE}/blog/posts/${post.slug}.json`;
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    body_markdown: post.body_md,
    body_html: mdToHtml(post.body_md),
    date: post.date,
    tags: post.tags,
    author: "Cumulative Web Inc",
    canonical_url: url,
    self: jsonUrl,
    jsonld: jsonld(post, url),
    related: related.map(r => ({ slug: r.slug, title: r.title, url: `${BASE}/blog/posts/${r.slug}.html` })),
    machine: {
      content_id: `blog:${post.slug}`,
      content_type: "blog_post",
      title: post.title,
      url,
      tags: post.tags,
    },
    generated_at: new Date().toISOString(),
  };
}

// ---- hub page ----
function renderHub(posts, allTags) {
  const cards = posts.map(p => {
    const url = `${BASE}/blog/posts/${p.slug}.html`;
    return `<article class="card" data-tags="${escAttr(p.tags.join(' '))}">
      <div class="date">${esc(p.date)}</div>
      <h2><a href="${url}">${esc(p.title)}</a></h2>
      <p>${esc(p.excerpt)}</p>
      <div class="tags">${p.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      <div class="card-links"><a href="${url}">Read →</a> · <a href="${BASE}/blog/posts/${p.slug}.json">JSON</a></div>
    </article>`;
  }).join('\n');
  const tagBtns = ['all', ...allTags].map(t =>
    `<button class="tagbtn${t === 'all' ? ' active' : ''}" data-tag="${escAttr(t)}">${esc(t)}</button>`).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CWI Blog — latest from Cumulative Web Inc</title>
<meta name="description" content="The news wire of Cumulative Web Inc: releases, Radio 365, Discovery Mode results, and machine-readable music data. Every post ships with JSON.">
<link rel="canonical" href="${BASE}/blog/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Cumulative Web Inc">
<meta property="og:title" content="CWI Blog — latest from Cumulative Web Inc">
<meta property="og:description" content="Releases, Radio 365, Discovery Mode results, and machine-readable music data — every post ships with JSON.">
<meta property="og:url" content="${BASE}/blog/">
<meta property="og:image" content="${BASE}/assets/cwi-logo.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="CWI Blog">
<meta name="twitter:description" content="The news wire of Cumulative Web Inc — every post machine-readable.">
<meta name="theme-color" content="#0a0a0a">
<meta name="robots" content="index, follow">
<link rel="alternate" type="application/json" title="Blog JSON feed" href="${BASE}/blog/index.json">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Blog","name":"CWI Blog",
 "description":"The news wire of Cumulative Web Inc.","url":"${BASE}/blog/",
 "publisher":{"@type":"Organization","name":"Cumulative Web Inc","url":"${BASE}/"}}
</script>
<style>
:root{--bg:#0a0a0a;--panel:#111214;--gold:#d9b36c;--gold-soft:#b9975a;--ink:#f2ede3;--muted:#a8a29a;--line:#2a2419;--maxw:1080px;--radius:14px}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.65;-webkit-font-smoothing:antialiased}
a{color:var(--gold);text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:var(--maxw);margin:0 auto;padding:0 22px}
header.top{border-bottom:1px solid var(--line);background:rgba(10,10,10,.94);position:sticky;top:0;z-index:50}
.top-inner{display:flex;align-items:center;justify-content:space-between;padding:12px 0}
.brandline{display:flex;align-items:center;gap:12px}
.brandline img{width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid var(--gold-soft)}
.brandline .who{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.brandline .who b{display:block;color:var(--gold);letter-spacing:.22em;font-size:14px}
nav.cta a{display:inline-block;border:1px solid var(--gold);color:var(--gold);padding:8px 18px;border-radius:999px;font-size:13px;margin-left:8px}
nav.cta a:hover{background:var(--gold);color:#0a0a0a;text-decoration:none}
.hero{padding:52px 0 26px}
.eyebrow{display:inline-block;font-size:12px;letter-spacing:.28em;text-transform:uppercase;color:#0a0a0a;background:var(--gold);border-radius:999px;padding:6px 16px;font-weight:700;margin-bottom:16px}
h1{font-size:clamp(32px,5vw,54px);margin:0 0 12px}
.lede{color:var(--muted);font-size:18px;max-width:36em;margin:0}
.filterbar{padding:18px 0 6px;display:flex;gap:8px;flex-wrap:wrap}
.tagbtn{background:transparent;border:1px solid var(--line);color:var(--muted);border-radius:999px;padding:6px 14px;font-size:13px;cursor:pointer}
.tagbtn.active,.tagbtn:hover{border-color:var(--gold);color:var(--gold)}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;padding:22px 0 50px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:24px}
.card .date{font-size:12px;letter-spacing:.18em;color:var(--gold-soft);text-transform:uppercase;margin-bottom:8px}
.card h2{margin:0 0 10px;font-size:21px}
.card h2 a{color:var(--ink)}.card h2 a:hover{color:var(--gold)}
.card p{margin:0 0 12px;color:var(--muted);font-size:15px}
.card .tags{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.tag{font-size:11px;letter-spacing:.08em;border:1px solid var(--line);border-radius:999px;padding:3px 10px;color:var(--muted)}
.card-links{font-size:14px}
footer{border-top:1px solid var(--line);padding:36px 0 52px;color:var(--muted);font-size:14px}
@media (max-width:760px){.grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<header class="top">
  <div class="wrap top-inner">
    <a class="brandline" href="${BASE}/" aria-label="Cumulative Web Inc home">
      <img src="${BASE}/assets/cwi-logo.jpg" alt="Cumulative Web Inc logo" width="36" height="36">
      <span class="who"><b>CWI BLOG</b>The label's news wire</span>
    </a>
    <nav class="cta" aria-label="Primary">
      <a href="${BASE}/blog/index.json">JSON feed</a>
      <a href="${BASE}/">cumulativeweb.com</a>
    </nav>
  </div>
</header>
<main class="wrap">
  <div class="hero">
    <span class="eyebrow">News · Releases · Data</span>
    <h1>Latest from the label</h1>
    <p class="lede">Releases, Radio 365, Discovery Mode results, and the machine-readable data behind them. Every post ships with a JSON twin — built for readers and for AI.</p>
  </div>
  <div class="filterbar" role="group" aria-label="Filter by tag">${tagBtns}</div>
  <div class="grid" id="cards">${cards}</div>
</main>
<footer>
  <div class="wrap" style="display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap">
    <div><strong style="color:var(--gold);letter-spacing:.2em">CWI BLOG</strong><br>The news wire of Cumulative Web Inc.<br>© 2026 Cumulative Web Inc. All rights reserved.</div>
    <div><a href="${BASE}/blog/index.json">JSON feed</a> · <a href="${BASE}/llms.txt">llms.txt</a></div>
  </div>
</footer>
<script>
(function(){
  var btns = document.querySelectorAll('.tagbtn');
  var cards = document.querySelectorAll('#cards .card');
  function apply(tag){
    for (var i=0;i<cards.length;i++){
      var tags = (cards[i].getAttribute('data-tags')||'').split(' ');
      cards[i].style.display = (tag==='all'||tags.indexOf(tag)>=0) ? '' : 'none';
    }
    for (var j=0;j<btns.length;j++) btns[j].classList.toggle('active', btns[j].getAttribute('data-tag')===tag);
  }
  for (var k=0;k<btns.length;k++){ (function(b){ b.addEventListener('click',function(){ apply(b.getAttribute('data-tag')); }); })(btns[k]); }
  var h = (location.hash||'').replace('#tag-','');
  if (h) apply(h);
})();
</script>
${beaconJs('blog:index', 'blog-index', 'index')}
</body>
</html>
`;
}

// ---- load all drafts as posts ----
function loadAllPosts() {
  const files = fs.existsSync(DRAFTS_DIR) ? fs.readdirSync(DRAFTS_DIR).filter(f => f.endsWith('.md')) : [];
  return files.map(f => parseMdFile(path.join(DRAFTS_DIR, f)));
}

// ---- regenerate everything ----
function rebuild() {
  const all = loadAllPosts().sort((a, b) => b.date.localeCompare(a.date) || b.slug.localeCompare(a.slug));
  const published = all.filter(p => p.status === 'published');
  // related computed over published set (so Related never links a draft)
  for (const post of published) {
    const rel = relatedFor(post, published, 2);
    const html = renderPost(post, rel);
    fs.writeFileSync(path.join(POSTS_DIR, `${post.slug}.html`), html);
    fs.writeFileSync(path.join(POSTS_DIR, `${post.slug}.json`),
      JSON.stringify(postJson(post, rel), null, 2) + '\n');
  }
  // remove stale files for posts that no longer exist or are drafts
  const keep = new Set(published.map(p => p.slug));
  for (const f of fs.readdirSync(POSTS_DIR)) {
    const m = f.match(/^(.+)\.(html|json)$/);
    if (m && !keep.has(m[1])) fs.unlinkSync(path.join(POSTS_DIR, f));
  }
  // index.json — all posts (drafts included, flagged) newest first
  const feed = {
    updated: new Date().toISOString(),
    feed_url: `${BASE}/blog/index.json`,
    count: all.length,
    posts: all.map(p => ({
      slug: p.slug, title: p.title, date: p.date, excerpt: p.excerpt,
      tags: p.tags, status: p.status,
      url: `${BASE}/blog/posts/${p.slug}.html`,
      json_url: `${BASE}/blog/posts/${p.slug}.json`,
      machine: { content_id: `blog:${p.slug}`, content_type: "blog_post", title: p.title, url: `${BASE}/blog/posts/${p.slug}.html`, tags: p.tags },
    })),
  };
  fs.writeFileSync(path.join(BLOG, 'index.json'), JSON.stringify(feed, null, 2) + '\n');
  // hub — published only
  const allTags = [...new Set(published.flatMap(p => p.tags))].sort();
  fs.writeFileSync(path.join(BLOG, 'index.html'), renderHub(published, allTags));
  // sitemap
  updateSitemap(published.map(p => `${BASE}/blog/posts/${p.slug}.html`));
  return { total: all.length, published: published.length, drafts: all.length - published.length };
}

function updateSitemap(postUrls) {
  const sp = path.join(REPO, 'sitemap.xml');
  let xml = fs.readFileSync(sp, 'utf8');
  const urls = [`${BASE}/blog/`, ...postUrls];
  const keep = new Set(urls);
  // prune stale blog entries (posts that no longer exist)
  xml = xml.replace(/\s*<url>\s*<loc>(https:\/\/cumulativeweb\.com\/blog\/[^<]*)<\/loc>.*?<\/url>/gs,
    (m, u) => keep.has(u) ? m : '');
  let added = 0;
  for (const u of urls) {
    if (xml.includes(`<loc>${u}</loc>`)) continue;
    xml = xml.replace('</urlset>', `  <url>\n    <loc>${u}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n</urlset>`);
    added++;
  }
  fs.writeFileSync(sp, xml);
  return added;
}

// ---- CLI ----
const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'new') {
  const f = args[0];
  if (!f) { console.error('usage: node blog/new-post.js new blog/drafts/<file>.md'); process.exit(1); }
  const post = parseMdFile(path.resolve(f));
  // copy into drafts dir if not already there
  const dest = path.join(DRAFTS_DIR, path.basename(f));
  if (path.resolve(f) !== dest) fs.copyFileSync(path.resolve(f), dest);
  const r = rebuild();
  console.log(`built ${post.slug} [${post.status}] — ${r.published} published, ${r.drafts} drafts`);
} else if (cmd === 'approve') {
  if (!args.length) { console.error('usage: node blog/new-post.js approve <slug> [slug...]'); process.exit(1); }
  const all = loadAllPosts();
  let n = 0;
  for (const slug of args) {
    const post = all.find(p => p.slug === slug);
    if (!post) { console.error(`no draft with slug: ${slug}`); process.exit(1); }
    const f = post._file;
    let raw = fs.readFileSync(f, 'utf8');
    if (!/^status:\s*published/mi.test(raw)) {
      raw = raw.replace(/^status:\s*\S+/mi, 'status: published');
      if (!/^status:/mi.test(raw)) raw = raw.replace(/^---\r?\n/, '---\nstatus: published\n');
      fs.writeFileSync(f, raw);
      n++;
    }
  }
  const r = rebuild();
  console.log(`approved ${n} post(s) — ${r.published} published, ${r.drafts} drafts`);
} else if (cmd === 'list') {
  const all = loadAllPosts().sort((a, b) => b.date.localeCompare(a.date));
  for (const p of all) console.log(`${p.status.padEnd(9)} ${p.date}  ${p.slug}  — ${p.title}`);
} else if (cmd === 'rebuild') {
  const r = rebuild();
  console.log(`rebuilt: ${r.published} published, ${r.drafts} drafts`);
} else {
  console.error('usage: node blog/new-post.js <new|approve|list|rebuild> [...]');
  process.exit(1);
}
