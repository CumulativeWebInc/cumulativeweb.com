#!/usr/bin/env node
// CWI site freshness heartbeat — data/freshness.json
// Honesty-first: content_hash is derived from real file bytes (sha256); movement is
// never manufactured. --push commits and pushes ONLY when a surface actually changed
// (content_hash differs from the committed file), so a high-frequency caller is a
// silent no-op when the site is idle.
//
// Usage:
//   node scripts/freshness.js          # rebuild data/freshness.json in the working tree
//   node scripts/freshness.js --push   # + git pull --rebase, commit-if-changed, push
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const REPO = '/home/hatch/workspace/repos/cumulativeweb.com';
const OUT = path.join(REPO, 'data', 'freshness.json');

// Discovery-relevant surfaces crawlers revisit. Missing files are recorded as
// exists:false (honest), never invented.
const SURFACES = [
  'index.html',
  'robots.txt',
  'llms.txt',
  'sitemap.xml',
  'blog/index.html',
  'blog/index.json',
  'data/roster.json',
  'data/commerce.json',
  'data/producer.json',
  'data/software-catalog.json',
  'radio/schedule.json',
  'radio/now-playing.json',
];

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const git = (cmd) => execSync(cmd, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function probe(rel) {
  const abs = path.join(REPO, rel);
  const entry = { path: '/' + rel, exists: false };
  try {
    const st = fs.statSync(abs);
    if (!st.isFile()) return entry;
    const buf = fs.readFileSync(abs);
    return {
      path: '/' + rel,
      exists: true,
      bytes: buf.length,
      sha256: sha(buf).slice(0, 16),
      mtime: st.mtime.toISOString(),
    };
  } catch (e) {
    return entry;
  }
}

function build() {
  const surfaces = SURFACES.map(probe);
  const live = surfaces.filter(s => s.exists);
  const contentHash = sha(live.map(s => `${s.path}:${s.sha256}`).sort().join('|')).slice(0, 16);
  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { /* first run */ }
  const prevByPath = new Map((prev && prev.surfaces || []).filter(s => s.exists).map(s => [s.path, s.sha256]));
  const surfacesChanged = prev
    ? live.filter(s => prevByPath.get(s.path) !== s.sha256).map(s => s.path)
    : live.map(s => s.path);
  return {
    generated_at: new Date().toISOString(),
    content_hash: contentHash,
    previous_content_hash: prev ? prev.content_hash : null,
    changed: prev ? contentHash !== prev.content_hash : null,
    surfaces_changed: surfacesChanged,
    surface_count: live.length,
    surfaces,
  };
}

function main() {
  const push = process.argv.includes('--push');
  if (push) git('git pull --rebase');
  const doc = build();
  const report = { ok: true, pushed: false, content_hash: doc.content_hash, surfaces_changed: doc.surfaces_changed };
  if (push && doc.previous_content_hash && doc.content_hash === doc.previous_content_hash) {
    console.log(JSON.stringify({ ...report, reason: 'unchanged — no commit' }));
    return;
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n');
  if (!push) {
    console.log(JSON.stringify({ ...report, reason: 'written to working tree' }));
    return;
  }
  git('git add data/freshness.json');
  git(`git commit -m "freshness: heartbeat ${doc.content_hash} (${doc.surfaces_changed.length} surfaces changed)"`);
  git('git push');
  report.pushed = true;
  console.log(JSON.stringify(report));
}

try {
  main();
} catch (e) {
  console.error(JSON.stringify({ ok: false, error: String(e && e.message || e) }));
  process.exit(1);
}
