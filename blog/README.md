# CWI Blog

The news wire of Cumulative Web Inc — human-readable **and** machine-readable.

## What every post ships

| Artifact | Path | Purpose |
|---|---|---|
| HTML page | `blog/posts/<slug>.html` | SEO meta, OG/Twitter tags, canonical URL, JSON-LD `BlogPosting`, Related block, beacons |
| JSON twin | `blog/posts/<slug>.json` | Machine node: slug, title, excerpt, body, date, tags, author, canonical URL, JSON-LD, `machine` block |
| Feed | `blog/index.json` | All posts, newest first — **the machine's ingestion surface** |
| Hub | `blog/index.html` | Latest-first cards, tag filter |
| Review queue | `blog/review.html` | Internal (noindex): batch-approve drafts with one stacked command |

## Machine integration

- **Ingestion surface:** `https://cumulativeweb.com/blog/index.json` — the ad machine's
  `dispatch` can ingest this feed as content (`machine.content_id = "blog:<slug>"`,
  `content_type = "blog_post"`).
- **Beacons:** every post page fires `exposure` on load and `click` on outbound links;
  the hub fires `exposure` — all to `POST https://cwi-machine-data.hp-ace.workers.dev/ad/event`
  with the exact payload shape of the Radio 365 track pages:
  `{event_type, slot_id: 'blog-post'|'blog-index', content_id: 'blog:<slug>'|'blog:index', meta:{page}}`.

## Add a new post — one command

1. Write the markdown in `blog/drafts/<slug>.md`:

```md
---
title: Your headline
date: 2026-10-06
excerpt: One or two sentences — shows on cards and in SEO meta.
tags: radio-365, music, announcement
status: draft
---

# Your headline

Body in markdown. [Links](https://example.com) work; external links get
`data-outbound` automatically and fire click beacons.
```

2. Build it:

```bash
cd ~/workspace/repos/cumulativeweb.com
node blog/new-post.js new blog/drafts/<slug>.md
```

This generates the HTML + JSON, rebuilds `index.json`, the hub, and the sitemap.
The generator **refuses to build** if the legal name "Henry Pitts" appears anywhere
(personal-data scrub), and requires an excerpt and tags.

## Approve drafts — one button, many posts

Open `blog/review.html`, tick drafts, hit **Approve selected** — it produces one
stacked command:

```bash
node blog/new-post.js approve <slug1> <slug2> <slug3>
```

Or approve directly from the shell. Other commands:

```bash
node blog/new-post.js list       # all posts with status
node blog/new-post.js rebuild    # regenerate everything from drafts/
```

## Backlink discipline

- Every post links the blog index, 2 related posts (shared tags, newest backfill),
  and the canonical surfaces it mentions.
- Every blog URL is in the sitemap **and** reachable from the hub.
- The site nav (`index.html`, desktop + mobile) links `/blog/`; the homepage
  renders the 3 newest posts from the JSON feed.
