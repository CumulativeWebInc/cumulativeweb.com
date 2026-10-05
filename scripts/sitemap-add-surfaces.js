#!/usr/bin/env node
// Workstream I (2026-10-05): add missing AI-discovery surfaces to sitemap.xml.
// Reuses blog/new-post.js's updateSitemap upsert pattern: existing <url> blocks
// are byte-preserved; only the listed surfaces are appended when absent.
// Usage: node scripts/sitemap-add-surfaces.js [--dry]
// Never claims live what isn't — adds only files that exist in the repo tree.
const fs = require('fs');
const path = require('path');

const REPO = '/home/hatch/workspace/repos/cumulativeweb.com';
const BASE = 'https://cumulativeweb.com';
const TODAY = '2026-10-05';

// path -> {changefreq, priority}
const SURFACES = {
  '/llms.txt': { changefreq: 'daily', priority: '0.9' },
  '/llms-full.txt': { changefreq: 'weekly', priority: '0.8' },
  '/br/llms.txt': { changefreq: 'daily', priority: '0.9' },
  '/br/llms-full.txt': { changefreq: 'weekly', priority: '0.8' },
  '/robots.txt': { changefreq: 'monthly', priority: '0.5' },
  '/data/freshness.json': { changefreq: 'hourly', priority: '0.7' },
  '/data/catalog-embeddings.json': { changefreq: 'weekly', priority: '0.8' },
};

const dry = process.argv.includes('--dry');
const sp = path.join(REPO, 'sitemap.xml');
let xml = fs.readFileSync(sp, 'utf8');

const existing = new Set();
for (const m of xml.matchAll(/<loc>([^<]*)<\/loc>/g)) existing.add(m[1]);

const added = [], skipped = [];
for (const [p, meta] of Object.entries(SURFACES)) {
  const loc = BASE + p;
  const abs = path.join(REPO, p.replace(/^\//, ''));
  if (!fs.existsSync(abs)) {
    console.log(`MISSING-FILE (not added): ${loc}`);
    skipped.push(loc);
    continue;
  }
  if (existing.has(loc)) { skipped.push(loc); continue; }
  const block = `<url>\n    <loc>${loc}</loc>\n    <changefreq>${meta.changefreq}</changefreq>\n    <priority>${meta.priority}</priority>\n    <lastmod>${TODAY}</lastmod>\n  </url>`;
  // insert before closing </urlset>, canonical two-space indent
  xml = xml.replace(/\n<\/urlset>/, `\n  ${block}\n</urlset>`);
  added.push(loc);
  console.log(`added: ${loc}`);
}

if (!dry) fs.writeFileSync(sp, xml);
console.log(dry ? '[dry-run] no write' : `wrote sitemap.xml — ${added.length} added, ${skipped.length} already present/missing`);
