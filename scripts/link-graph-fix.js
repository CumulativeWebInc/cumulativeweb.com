#!/usr/bin/env node
// Workstream I (2026-10-05): internal link graph repair.
// Every new live page must be reachable from >=2 existing site surfaces via
// plain <a href> (crawl-followable, no JS-only links).
// 1. "Related answers" section on each of the 12 answer pages (curated mapping,
//    every page receives >=1 sibling inbound).
// 2. br/llms-full.txt <li> in both pt-BR pages' "Acesso de máquina" lists.
// 3. answers/index.html — canonical Answers index (also the breadcrumb target
//    the answer pages' JSON-LD already points at: https://cumulativeweb.com/answers/).
const fs = require('fs');
const path = require('path');

const REPO = '/home/hatch/workspace/repos/cumulativeweb.com';

const PAGES = {
  'answers/what-is-post-trap-futurism.html': {
    title: 'What is post-trap futurism?',
    desc: "Post-Trap Futurism is the genre coined for That Boy Hi Hat's alternative rap — alternative rap built for speakers and screens alike.",
    rel: ['answers/who-is-that-boy-hi-hat.html', 'answers/how-to-query-cwi-catalog-as-ai-agent.html'],
  },
  'answers/where-to-license-alternative-rap-film-tv.html': {
    title: 'Where can I license alternative rap for film and TV?',
    desc: 'License alternative rap for film and TV directly from Cumulative Web Inc — sync-ready catalog, direct clearance, clears in under five minutes.',
    rel: ['answers/how-does-cwi-sync-licensing-work.html', 'answers/where-is-cwis-machine-readable-music-catalog.html'],
  },
  'answers/how-to-query-cwi-catalog-as-ai-agent.html': {
    title: 'How do I query the CWI catalog as an AI agent?',
    desc: 'AI agents query the CWI catalog through a public machine-data edge: scored track search, full catalog JSON, knowledge graph and licensing terms — no API key.',
    rel: ['answers/what-is-the-cwi-mcp-server.html', 'answers/what-data-does-cwi-expose-to-ai.html'],
  },
  'answers/what-is-radio-365.html': {
    title: 'What is Radio 365?',
    desc: "Cumulative Radio 365 is Cumulative Web Inc's internet radio station for independent artists — alternative, indie and hip-hop, programmed across the full year.",
    rel: ['answers/who-is-that-boy-hi-hat.html', 'answers/what-is-post-trap-futurism.html'],
  },
  'answers/how-does-cwi-sync-licensing-work.html': {
    title: 'How does CWI sync licensing work?',
    desc: 'CWI sync licensing runs on direct clearance: one signature clears master and publishing, on the five-field SAIL form, in under five minutes.',
    rel: ['answers/where-to-license-alternative-rap-film-tv.html', 'answers/where-is-cwis-machine-readable-music-catalog.html'],
  },
  'answers/who-is-that-boy-hi-hat.html': {
    title: 'Who is That Boy Hi Hat?',
    desc: 'That Boy Hi Hat is the alternative rap artist managed by Cumulative Web Inc — creator of Post-Trap Futurism, 53-track catalog verified against Spotify.',
    rel: ['answers/what-is-post-trap-futurism.html', 'answers/what-is-radio-365.html'],
  },
  'answers/what-data-does-cwi-expose-to-ai.html': {
    title: 'What data does Cumulative Web Inc expose to AI systems?',
    desc: 'CWI exposes its public catalog, knowledge graph, search and licensing surfaces to AI systems — catalog, graph and licensing data only, never internal data.',
    rel: ['answers/how-to-query-cwi-catalog-as-ai-agent.html', 'answers/how-to-cite-cwi-data.html'],
  },
  'answers/how-to-cite-cwi-data.html': {
    title: 'How do I cite CWI data?',
    desc: 'Cite CWI data as: Cumulative Web Inc, [page or file title], [full URL], accessed [date] — keep the source URL; it is the machine-readable record.',
    rel: ['answers/what-data-does-cwi-expose-to-ai.html', 'answers/where-is-cwis-machine-readable-music-catalog.html'],
  },
  'answers/what-is-the-cwi-mcp-server.html': {
    title: 'What is the CWI MCP server and how do I call it?',
    desc: 'The CWI MCP server is a read-only Model Context Protocol server for AI agents — seven tools, zero dependencies, Node 18+. Clone the repo and run node server.js.',
    rel: ['answers/how-to-query-cwi-catalog-as-ai-agent.html', 'answers/where-is-cwis-machine-readable-music-catalog.html'],
  },
  'answers/where-is-cwis-machine-readable-music-catalog.html': {
    title: "Where is CWI's machine-readable music catalog?",
    desc: "CWI's machine-readable music catalog lives at the machine-data edge: catalog.json, graph.json, scored search and per-artist JSON — the map starts at llms.txt.",
    rel: ['answers/how-does-cwi-sync-licensing-work.html', 'answers/where-to-license-alternative-rap-film-tv.html'],
  },
  'br/respostas/o-que-e-post-trap-futurism.html': {
    title: 'O que é post-trap futurism?',
    desc: 'Post-trap futurism é o gênero criado para o alternative rap de That Boy Hi Hat — rap alternativo feito para caixas de som e telas.',
    lang: 'pt-BR',
    rel: ['br/respostas/como-licenciar-rap-alternativo-cinema-tv.html', 'answers/what-is-post-trap-futurism.html'],
  },
  'br/respostas/como-licenciar-rap-alternativo-cinema-tv.html': {
    title: 'Como licenciar rap alternativo para cinema e TV?',
    desc: 'Licencie rap alternativo para cinema e TV direto com a Cumulative Web Inc — catálogo pronto para sync, liberação direta, libera em menos de cinco minutos.',
    lang: 'pt-BR',
    rel: ['br/respostas/o-que-e-post-trap-futurism.html', 'answers/where-to-license-alternative-rap-film-tv.html'],
  },
};

const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let changed = 0;

// ---- 1. Related-answers blocks ----
for (const [rel, meta] of Object.entries(PAGES)) {
  const abs = path.join(REPO, rel);
  let html = fs.readFileSync(abs, 'utf8');
  if (html.includes('Related answers') || html.includes('Respostas relacionadas')) {
    console.log(`skip (already has related): ${rel}`);
    continue;
  }
  const pt = meta.lang === 'pt-BR';
  const items = meta.rel.map(r => {
    const title = PAGES[r] ? PAGES[r].title : r;
    // relative href from the page's own directory
    const fromDir = path.dirname(rel);
    let href = path.relative(fromDir, r).replace(/\\/g, '/');
    if (!href.startsWith('.')) href = './' + href;
    return `<li><a href="${href}">${esc(title)}</a></li>`;
  }).join('\n');
  const block = `<section>\n<h2>${pt ? 'Respostas relacionadas' : 'Related answers'}</h2>\n<ul class="link-list">\n${items}\n</ul>\n</section>\n</main>`;
  if (!html.includes('</main>')) throw new Error(`no </main> in ${rel}`);
  html = html.replace('</main>', block);
  fs.writeFileSync(abs, html);
  changed++;
  console.log(`related block added: ${rel}`);
}

// ---- 2. br/llms-full.txt in pt-BR machine-access lists ----
for (const rel of ['br/respostas/o-que-e-post-trap-futurism.html', 'br/respostas/como-licenciar-rap-alternativo-cinema-tv.html']) {
  const abs = path.join(REPO, rel);
  let html = fs.readFileSync(abs, 'utf8');
  if (html.includes('/br/llms-full.txt')) { console.log(`skip (llms-full present): ${rel}`); continue; }
  const anchor = '<li><a href="https://cumulativeweb.com/br/llms.txt">';
  const i = html.indexOf(anchor);
  if (i < 0) { console.log(`skip (no llms.txt anchor — already handled manually): ${rel}`); continue; }
  const end = html.indexOf('</li>', i) + '</li>'.length;
  const li = '\n<li><a href="https://cumulativeweb.com/br/llms-full.txt">llms-full.txt — o briefing completo para IAs</a></li>';
  html = html.slice(0, end) + li + html.slice(end);
  fs.writeFileSync(abs, html);
  changed++;
  console.log(`br/llms-full.txt li added: ${rel}`);
}

// ---- 3. answers/index.html ----
const enCards = Object.entries(PAGES).filter(([, m]) => m.lang !== 'pt-BR').map(([rel, m]) => {
  const file = path.basename(rel);
  return `      <article class="card">
        <h3><a href="${file}">${esc(m.title)}</a></h3>
        <p>${esc(m.desc)}</p>
      </article>`;
}).join('\n');
const brCards = Object.entries(PAGES).filter(([, m]) => m.lang === 'pt-BR').map(([rel, m]) => {
  const file = path.basename(rel);
  return `      <article class="card">
        <h3><a href="../br/respostas/${file}">${esc(m.title)}</a></h3>
        <p>${esc(m.desc)}</p>
      </article>`;
}).join('\n');

const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CWI Answers — direct answers from Cumulative Web Inc</title>
<meta name="description" content="Direct answers from Cumulative Web Inc: Post-Trap Futurism, That Boy Hi Hat, Radio 365, sync licensing, and the machine-readable catalog — written for people and for AI.">
<link rel="canonical" href="https://cumulativeweb.com/answers/">
<link rel="icon" href="../assets/cwi-logo.jpg">
<link rel="stylesheet" href="../site.css">
<meta property="og:type" content="website">
<meta property="og:title" content="CWI Answers — direct answers from Cumulative Web Inc">
<meta property="og:description" content="Post-Trap Futurism, That Boy Hi Hat, Radio 365, sync licensing, and the machine-readable catalog — answered at the source.">
<meta property="og:url" content="https://cumulativeweb.com/answers/">
<meta name="robots" content="index, follow">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "CWI Answers",
  "description": "Direct answers from Cumulative Web Inc.",
  "url": "https://cumulativeweb.com/answers/",
  "itemListElement": [
${Object.entries(PAGES).map(([rel, m], i) => `    {"@type": "ListItem", "position": ${i + 1}, "name": ${JSON.stringify(m.title)}, "url": "https://cumulativeweb.com/${rel}"}`).join(',\n')}
  ]
}
</script>
</head>
<body>
<header class="navbar">
  <div class="bar">
    <a class="brand" href="../index.html"><img src="../assets/cwi-logo.jpg" alt="Cumulative Web Inc logo"><span>CUMULATIVE WEB INC</span></a>
    <nav class="nav-links" aria-label="Primary">
      <a href="../index.html">Home</a>
      <a href="../music.html">Music</a>
      <a href="../films.html">Films</a>
      <a href="../models.html">Models</a>
      <a href="../software.html">Software</a>
      <a href="/sanqa/">SANQA</a>
      <a href="../events.html">Events</a>
      <a href="../live.html">Live</a>
      <a href="../radio.html">Radio</a>
      <a href="../contact.html">Contact</a>
    </nav>
    <div class="lang-switch" role="navigation" aria-label="Language">
      <a href="https://cumulativeweb.com/br/" hreflang="pt-BR">BR</a><span class="sep" aria-hidden="true">|</span><a href="./" hreflang="en" aria-current="true">EN</a>
    </div>
  </div>
</header>
<main class="page">
<section class="hero">
  <div class="eyebrow">Cumulative Web Inc · Answers</div>
  <h1>Direct answers, at the source</h1>
  <p class="lede">The questions people — and AI systems — ask about Cumulative Web Inc, answered where the data lives. Every answer links the machine-readable record it cites.</p>
</section>
<section>
<h2>English</h2>
<div class="cards">
${enCards}
</div>
</section>
<section>
<h2>Português (Brasil)</h2>
<div class="cards">
${brCards}
</div>
</section>
<section>
<h2>Machine access</h2>
<ul class="link-list">
<li><a href="https://cumulativeweb.com/llms.txt">llms.txt — the map of every public surface</a></li>
<li><a href="https://cumulativeweb.com/llms-full.txt">llms-full.txt — the full machine briefing</a></li>
<li><a href="https://cumulativeweb.com/data/freshness.json">freshness.json — what changed, every minute</a></li>
<li><a href="https://cumulativeweb.com/data/catalog-embeddings.json">catalog-embeddings.json — 55 tracks × 384-dim vectors</a></li>
</ul>
</section>
</main>
<footer class="footer">
  <div class="inner">
    <div class="cols">
      <div><div class="fbrand"><img src="../assets/cwi-logo.jpg" alt="Cumulative Web Inc logo">CUMULATIVE WEB INC</div>
      <p style="font-size:var(--text-small)">Independent label — Music &amp; Film · Clothing · Software &amp; AI Agents.</p></div>
      <div><h4>Sections</h4><ul>
        <li><a href="../music.html">Music</a></li><li><a href="../films.html">Films</a></li>
        <li><a href="../models.html">Models</a></li><li><a href="../software.html">Software</a></li>
        <li><a href="../radio.html">Radio</a></li><li><a href="./">Answers</a></li>
      </ul></div>
      <div><h4>Contact</h4><ul>
        <li><a href="../contact.html">Contact form</a></li>
        <li><a href="mailto:hp@cumulativeweb.com">hp@cumulativeweb.com</a></li>
      </ul></div>
    </div>
    <div class="legal">
      <span>© 2026 Cumulative Web Inc. All rights reserved.</span>
      <div class="lang-switch" role="navigation" aria-label="Language">
        <a href="https://cumulativeweb.com/br/" hreflang="pt-BR">Português (BR)</a><span class="sep" aria-hidden="true">|</span><a href="../index.html" hreflang="en">English</a>
      </div>
    </div>
  </div>
</footer>
<script src="../js/nav.js" defer></script>
</body>
</html>
`;
fs.writeFileSync(path.join(REPO, 'answers/index.html'), indexHtml);
changed++;
console.log(`created answers/index.html`);
console.log(`done — ${changed} changes`);
