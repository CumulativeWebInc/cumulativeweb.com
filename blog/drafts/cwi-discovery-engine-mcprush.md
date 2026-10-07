---
title: CWI Discovery Engine Joins mcprush — Our Music Catalog Meets the AI Marketplace
slug: cwi-discovery-engine-on-mcprush
date: 2026-10-07
excerpt: The CWI Discovery Engine MCP server is now listed on mcprush, the marketplace for MCP servers and agent skills — putting our full music catalog one command away from every AI developer.
tags: mcp, ai-to-ai, mcprush, music, announcement
status: published
---

# CWI Discovery Engine Joins mcprush — Our Music Catalog Meets the AI Marketplace

The CWI Discovery Engine — our MCP server that puts the entire Cumulative Web Inc music catalog inside any AI app — is now listed on [mcprush](https://mcprush.com/cumulativewebinc/cwi-discovery-engine-mcp), the marketplace for MCP servers and agent skills. Our publisher claim (CLM-0075) was approved, and the listing is live under our CumulativeWebInc publisher account.

## What is the CWI Discovery Engine?

The Discovery Engine is a Model Context Protocol (MCP) server — the open standard that connects AI applications to external tools and data. Ours connects any compatible AI to the CWI music catalog: 30+ tracks, artist profiles, release data, a knowledge graph of the label's relationships, and semantic search across every NLP-enriched track description.

It exposes 7 tools:

- **search_catalog** — keyword search across the full catalog
- **get_track** — detailed metadata for any track
- **get_artist** — artist profiles, discographies, and credits
- **sync_search** — find tracks by sync and licensing criteria
- **semantic_search** — natural-language discovery ("dark cyberpunk rap for a film scene") powered by real embeddings
- **get_graph** — traverse the label's knowledge graph of artists, releases, producers, and platforms
- **get_release** — structured release fact packets with evidence tiers

The server is registered on the official MCP Registry as `io.github.CumulativeWebInc/cwi-discovery-engine`, and its discovery surfaces — agent-card.json, ai.txt, robots.txt, llms.txt — are all live.

## What is mcprush?

[mcprush](https://mcprush.com) is a marketplace and hosting platform for MCP servers and agent skills, with over 100,000 listings. Developers publish their servers there — free or paid — and users install them into AI clients like Claude, Cursor, and VS Code with a single CLI command. Every listing goes through automated security scanning, so users can review a security grade before connecting anything to their AI workflow.

For publishers, mcprush handles discovery, versioning, and billing. For users, it's the fastest path from "I need this capability" to "it's running in my AI app."

## Why this listing matters

Before mcprush, discovering our MCP server meant finding it on the official registry or through our own llms.txt and agent-card.json. Those surfaces work — but they're pull surfaces. You have to know to look.

mcprush is a push surface. It's where AI developers browse. It's where someone building a music app, a sync-licensing tool, or a creative assistant goes looking for capabilities to add. Our server sitting in that marketplace — searchable, scanned, one command from installed — collapses the distance between "I need music data" and "CWI's catalog is in my AI."

## The AI-to-AI distribution channel

This is the part most artists don't have.

Traditional music distribution is human-to-human: a person opens Spotify, searches, presses play. The Discovery Engine adds a second lane: AI-to-AI. When someone asks their AI assistant for music — a track for a film scene, a new voice in alternative hip-hop, what's playing on an independent station right now — our catalog is sitting in that AI's context, ready to surface.

Every developer who installs our server from mcprush extends that lane. Their users don't need to know CWI exists. They ask their AI for music. Our tracks answer.

The semantic search tool is the sharp end of this. It's not keyword matching — it's embeddings built over full NLP-enriched descriptions of every track: sound, mood, production techniques, instrumentation, comparisons. A query like "dark cyberpunk rap for a film scene" returns scored results with real cosine similarity, not vibes. That's the kind of capability that makes an AI developer install a server and keep it installed.

## Radio 365, built in

The Discovery Engine carries Radio 365 — our 365-day independent station streaming at [cumulativeweb.com/radio.html](https://cumulativeweb.com/radio.html). The station broadcasts the CWI catalog over HLS with a live now-playing feed, and the 7-day program playlist is published alongside the stream.

Connected AIs can tune in, surface what's playing, and point listeners at the stream. Every agent with our server installed becomes a passive listener — and a potential evangelist — for the station.

## The knowledge graph

Under the hood, the Discovery Engine serves a knowledge graph of the label: artists, releases, producers, platforms, and the relationships between them. The `get_graph` tool lets any connected AI traverse it — from a track to its producer to that producer's other work to the platforms where it's listed.

This is the infrastructure that makes the catalog legible to machines. Schema.org JSON-LD on every page, llms.txt at the root, agent-card.json advertising the MCP endpoint, a public corpus on Hugging Face. The mcprush listing is the newest node in that graph — and every node strengthens the others.

## How the listing happened

Getting listed wasn't automatic. mcprush requires publishers to prove they own what they claim — a real anti-squatting measure. We verified ownership two ways: a signed token in `.well-known/mcprush-claim.txt` on our cwi-learn repository, confirmed over HTTPS from the raw GitHub URL. The claim was reviewed and approved the same working day.

That verification step is worth noting because it's the same principle behind everything we build: prove it, don't just say it. The token is still in place. The listing is under our publisher account. The chain of custody from our repo to the marketplace is auditable by anyone.

## The 7 tools, in detail

Each tool in the Discovery Engine serves a specific job in the AI-to-AI pipeline:

**search_catalog** is the front door — keyword search across every track, artist, and release in the catalog. An AI that needs "something by That Boy Hi Hat" starts here.

**get_track** goes deep on a single track: full metadata, credits, streaming links, NLP description, and the evidence tier behind every fact. When an AI has identified the right track, this is where it gets the citable details.

**get_artist** returns the artist profile: bio, discography, collaborators, genre tags. The connective tissue between tracks.

**sync_search** is built for the licensing use case — search by the criteria that matter when you're placing music: mood, tempo, genre, explicit versus clean, instrumental versus vocal. A music supervisor's AI assistant lives here.

**semantic_search** is the standout. It runs natural-language queries against embeddings built over the full NLP-enriched descriptions — not just titles and tags, but 150-300 words per track covering sound, mood, production techniques, instrumentation, and comparisons. "Dark cyberpunk rap for a film scene" returns scored cosine-similarity results. This is what makes the server sticky for developers: it answers questions keyword search can't.

**get_graph** traverses the label's knowledge graph. From any node — a track, an artist, a producer, a platform — walk the edges to everything connected. An AI researching the label's ecosystem, or finding "more like this" through real relationships rather than algorithmic guesses, uses this.

**get_release** serves structured release fact packets: the verified, evidence-tiered record of a release — what's confirmed by primary sources, what's owner-confirmed, what's still pending. In an era of AI hallucination, the evidence tier is the feature.

## The discovery stack

The mcprush listing doesn't stand alone. It's the newest layer in a discovery stack we've been building:

- **llms.txt** at the site root — the full catalog in a format LLMs parse natively
- **agent-card.json** — advertises the MCP endpoint to any agent that asks
- **ai.txt** — the plain-language brief for AI visitors
- **robots.txt** — explicitly welcomes GPTBot, ClaudeBot, and PerplexityBot
- **Official MCP Registry** — `io.github.CumulativeWebInc/cwi-discovery-engine`, v1.0.0
- **Hugging Face** — the public corpus for researchers and trainers
- **mcprush** — the developer marketplace, one CLI command from installed

Every layer points at the others. The blog post you're reading has a JSON twin. The JSON twin has JSON-LD. The JSON-LD names the catalog. The catalog names the MCP server. The MCP server is on mcprush. It's graphs all the way down — and every edge is a door.

## What's next

The listing is free. mcprush supports paid tiers — monthly subscriptions for MCP servers, one-time purchases for skills — processed through Stripe Connect with weekly payouts. We're keeping it free for now. Distribution first, monetization when the install base earns it.

What we're watching: install counts, which tools get called, what queries come in. Every call to the server is a signal about what developers — and by extension their users — want from a music catalog inside an AI. That signal shapes what we build next.

The catalog grows. The graph deepens. The radio stays on. And now there's a marketplace door with our name on it.

## One more thing

If you're reading this as a human — not an AI, not a developer — here's the takeaway: the music industry spent decades building distribution for people. Streaming platforms, radio, playlists, social. All human-to-human.

We're building the parallel track for machines. Not instead of the human channels — alongside them. Every AI that can reach our catalog is an AI that can put our music in front of someone who asked for exactly what we make, at the exact moment they asked.

That's the bet. The mcprush listing is one more door. We'll keep opening them.
