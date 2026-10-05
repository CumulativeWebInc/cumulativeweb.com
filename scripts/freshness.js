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

function probeRemote(rel) {
  // Probe the surface from the freshly-fetched origin/main blob, not the
  // working tree. Required because the now-playing publisher commits via the
  // GitHub API — the local working tree goes stale and a local probe would
  // compare old bytes against the old remote record and wrongly conclude
  // "unchanged", leaving freshness.json permanently behind the real surface.
  const entry = { path: '/' + rel, exists: false };
  try {
    const buf = execSync(`git cat-file -p FETCH_HEAD:${rel}`,
      { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
    return {
      path: '/' + rel,
      exists: true,
      bytes: buf.length,
      sha256: sha(buf).slice(0, 16),
      mtime: null,
      source: 'origin/main',
    };
  } catch (e) {
    return entry;
  }
}

function build(useRemote) {
  const surfaces = SURFACES.map(useRemote ? probeRemote : probe);
  const live = surfaces.filter(s => s.exists);
  const contentHash = sha(live.map(s => `${s.path}:${s.sha256}`).sort().join('|')).slice(0, 16);
  let prev = null;
  if (useRemote) {
    // Compare against the committed record on origin/main, not a stale local copy.
    try { prev = JSON.parse(remoteFile('FETCH_HEAD', 'data/freshness.json') || 'null'); } catch (e) { /* first run */ }
  } else {
    try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { /* first run */ }
  }
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

// Remote state via anonymous fetch (public repo reads need no credentials);
// pushes go through the workspace ghapi_git_push helper (surrogate auth).
function remoteFile(ref, rel) {
  try {
    return git(`git show ${ref}:${rel}`);
  } catch (e) {
    return null;
  }
}

// Move the local branch pointer onto FETCH_HEAD when the trees are identical.
// Safe: identical trees mean index and working tree are unaffected; only the
// pointer moves (recovers from ghapi_git_push's API-side commits, which share
// our tree but not our sha).
function syncPointerToRemote() {
  try {
    git('git diff --quiet FETCH_HEAD HEAD --');
  } catch (e) {
    return false; // trees differ — do not touch the pointer
  }
  git('git update-ref refs/heads/main FETCH_HEAD');
  return true;
}

function unpushedNonFreshnessCommits() {
  const log = git('git log --format=%s FETCH_HEAD..HEAD');
  return log.split('\n').filter(l => l && !l.startsWith('freshness:'));
}

function main() {
  const push = process.argv.includes('--push');
  if (push) {
    git('git fetch origin main'); // read-only, always safe
    syncPointerToRemote();
  }
  const doc = build(push);
  if (push) {
    // previous = the committed file on origin/main, not the working tree
    const remoteRaw = remoteFile('FETCH_HEAD', 'data/freshness.json');
    let remotePrev = null;
    try { remotePrev = remoteRaw ? JSON.parse(remoteRaw).content_hash : null; } catch (e) {}
    doc.previous_content_hash = remotePrev;
    doc.changed = remotePrev ? doc.content_hash !== remotePrev : null;
  }
  const report = { ok: true, pushed: false, content_hash: doc.content_hash, surfaces_changed: doc.surfaces_changed };
  if (push && doc.previous_content_hash && doc.content_hash === doc.previous_content_hash) {
    console.log(JSON.stringify({ ...report, reason: 'unchanged — no commit, no push' }));
    return;
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  if (!push) {
    // Read-only check: do NOT overwrite the working-tree freshness.json with
    // locally-probed (potentially stale) data — that would block the next
    // --push rebase. Report only.
    console.log(JSON.stringify({ ...report, reason: 'read-only check, working tree untouched' }));
    return;
  }
  // Discard any stale working-tree copy before writing: a previous non-push run
  // or interrupted push may have left locally-probed data that would block the
  // rebase inside ghapi_git_push. The committed version is authoritative.
  try { git('git checkout HEAD -- data/freshness.json'); } catch (e) { /* no local copy */ }
  fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n');
  // Never sweep up siblings' unpushed work: the heartbeat only pushes when the
  // only unpushed commits are its own.
  const others = unpushedNonFreshnessCommits();
  if (others.length) {
    console.log(JSON.stringify({ ...report, reason: 'skipped push — unpushed non-freshness commits present', pending: others }));
    return;
  }
  // Discard any stale working-tree copy before the push rebase: handled above
  // before the write, so the rebase inside ghapi_git_push starts clean.
  git('git add data/freshness.json');
  git('git -c user.name="CWI Machine" -c user.email="machine@cumulativeweb.com" ' +
      `commit -m "freshness: heartbeat ${doc.content_hash} (${doc.surfaces_changed.length} surfaces changed)"`);
  git('/home/hatch/workspace/skills/github/bin/ghapi_git_push CumulativeWebInc/cumulativeweb.com --dir ' + REPO);
  git('git fetch origin main');
  syncPointerToRemote();
  report.pushed = true;
  console.log(JSON.stringify(report));
}

try {
  main();
} catch (e) {
  console.error(JSON.stringify({ ok: false, error: String(e && e.message || e) }));
  process.exit(1);
}
