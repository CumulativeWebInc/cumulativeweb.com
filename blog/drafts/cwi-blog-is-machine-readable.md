---
title: The CWI blog is now machine-readable
slug: cwi-blog-machine-readable
date: 2026-10-05
excerpt: Every post on the CWI blog ships with a JSON twin and JSON-LD schema — built so AI agents and search engines read our news directly.
tags: machine-readable, ai, blog, announcement
status: published
---

# The CWI blog is now machine-readable

This blog is built for two audiences: people, and machines.

Every post on [the CWI blog](/blog/) ships as three things at once:

1. **An HTML page** — the article you're reading, with full SEO meta, Open Graph tags, and a canonical URL.
2. **A JSON twin** — a machine-readable node with the slug, title, excerpt, body, date, tags, author, canonical URL, and the full JSON-LD record. Grab any post's JSON by swapping `.html` for `.json` in its URL.
3. **JSON-LD BlogPosting schema** — embedded in every page, so search engines and AI agents parse the headline, date, author, and publisher without guessing.

The whole feed is one file: [cumulativeweb.com/blog/index.json](https://cumulativeweb.com/blog/index.json) — newest first, every post, every tag. That feed is the ingestion surface for CWI's own machine-data layer, which can pick up new posts as content the moment they publish.

Pages also report back: each post fires exposure and click beacons to the machine-data layer, so the team can see what gets read and what gets clicked — the same measurement pattern as the Radio 365 track pages.

The machine-readable contract for the label starts at [cumulativeweb.com/llms.txt](https://cumulativeweb.com/llms.txt). This blog is the news wire plugged into it.
