# PROOFREAD — Workstream E: 12 query-shaped answer pages
**Date:** 2026-10-05 · **Proofreader:** build agent (coordinator 3fa98503) · **Method:** programmatic validation (/tmp/validate_answers.py) + manual copy review against repo sources.

## Validation method
1. **JSON-LD**: extracted the `application/ld+json` block from each page, `JSON.parse`d it, and asserted `@context=https://schema.org`, an `FAQPage` node, and `mainEntity` = non-empty list of `Question` nodes each with `acceptedAnswer` of type `Answer` with non-empty `text`.
2. **Title/meta**: asserted `<title>` and `meta description` match the page's question/intent.
3. **Links**: every `<a href>` and `<link href>` checked — relative links resolved against the repo tree; absolute links fetched live (HEAD, GET-with-range fallback). Self-canonical + hreflang-pair URLs excluded pre-deploy (they 404 until pushed; verified live post-push).
4. **Copy accuracy**: every fact traced to a repo or memory source (see Fact ledger). No metrics, placements, or endorsements invented.
5. **Word count**: 150–350 words of page copy per page (lede + sections + FAQ answers + link labels).

## Per-page result

| # | Page | Words | JSON-LD valid | Title/meta match | Links resolve | Copy accurate | No invented facts | Verdict |
|---|------|------:|---|---|---|---|---|---|
| 1 | `answers/what-is-post-trap-futurism.html` | 324 | PASS (4 Q) | PASS | PASS | PASS | PASS | **PASS** |
| 2 | `answers/where-to-license-alternative-rap-film-tv.html` | 295 | PASS (4 Q) | PASS | PASS | PASS | PASS | **PASS** |
| 3 | `answers/how-to-query-cwi-catalog-as-ai-agent.html` | 280 | PASS (4 Q) | PASS | PASS | PASS | PASS | **PASS** |
| 4 | `answers/what-is-radio-365.html` | 217 | PASS (3 Q) | PASS | PASS | PASS | PASS | **PASS** |
| 5 | `answers/how-does-cwi-sync-licensing-work.html` | 257 | PASS (4 Q) | PASS | PASS | PASS | PASS | **PASS** |
| 6 | `answers/who-is-that-boy-hi-hat.html` | 261 | PASS (4 Q) | PASS | PASS | PASS | PASS | **PASS** |
| 7 | `answers/what-data-does-cwi-expose-to-ai.html` | 265 | PASS (4 Q) | PASS | PASS | PASS | PASS | **PASS** |
| 8 | `answers/how-to-cite-cwi-data.html` | 224 | PASS (3 Q) | PASS | PASS | PASS | PASS | **PASS** |
| 9 | `answers/what-is-the-cwi-mcp-server.html` | 306 | PASS (4 Q) | PASS | PASS | PASS | PASS | **PASS** |
| 10 | `answers/where-is-cwis-machine-readable-music-catalog.html` | 214 | PASS (4 Q) | PASS | PASS | PASS | PASS | **PASS** |
| 11 | `br/respostas/o-que-e-post-trap-futurism.html` | 342 | PASS (3 Q) | PASS | PASS | PASS | PASS | **PASS** |
| 12 | `br/respostas/como-licenciar-rap-alternativo-cinema-tv.html` | 286 | PASS (4 Q) | PASS | PASS | PASS | PASS | **PASS** |

## Link exceptions (documented, not failures)
- **TikTok social links** (`https://www.tiktok.com/@cumulativeweb`): TikTok's server returns HTTP 500 to bot fetches. These links are copied **verbatim from the existing site footer** (contact.html, br/contato.html) — consistent with every other CWI page; not introduced by this workstream.
- **`/query?q=` template links** originally returned 400 with an empty `q` (documented endpoint behavior). Fixed by pointing links at real example queries (`/query?q=alternative+rap`, `/query?q=rap+alternativo`, `/query?q=post-trap+futurism`) — all return HTTP 200.
- **Self-canonical + hreflang-pair URLs** 404 pre-deploy (expected); verified HTTP 200 live post-push.

## Deliberate deviation from the brief (flagged, not silent)
- The brief specified linking `https://cwi-machine-data.hp-ace.workers.dev/mcp`. That path **returns HTTP 404 on the live worker** (endpoint list from the worker root: `/`, `/llms.txt`, `/catalog.json`, `/graph.json`, `/kit.json`, `/.well-known/agent-card.json`, `/placement/query-db.json`, `/query?q=`, `/changes?since=`, `/license` — no `/mcp`). The MCP-server page instead links the real MCP surfaces: `github.com/CumulativeWebInc/cwi-mcp-server` (stdio `node server.js`, self-hosted HTTP bridge `POST /mcp`), the `cwi-mcp-public` mirror, and `/.well-known/mcp-registry-auth`. **Do not publish a workers.dev/mcp link anywhere until that endpoint actually exists.**

## Fact ledger (every claim, its source)
- Post-Trap Futurism = genre coined for That Boy Hi Hat's alternative rap, "alternative rap built for speakers and screens alike" — verbatim from `sync/index.html` ("That Boy Hi Hat is the creator of Post-Trap Futurism — alternative rap built for speakers and screens alike") and genre tags in site JSON-LD.
- Sync: SAIL Simple Agreement for Instant License v1.0 (MusicAtlas, CC BY-ND 4.0), five fields, e-sign OK, clears <5 min, one signature clears master+publishing, 50/50 direct-clearance owner-confirmed, hp@cumulativeweb.com — all from `sync/index.html` + standing rights memory.
- `/query?q=` scored top-5 with Spotify links, 400 without `q`; `/catalog.json`, `/graph.json`, `/kit.json`, `/license`, `/changes?since=`, agent card; X-CWI-License headers — all verified live against the worker root document + live HTTP status checks on 2026-10-05.
- Radio 365: station name, alternative/indie/hip-hop, year-round programming, RadioStation JSON-LD, directory listings — from `radio.html` markup. **No live-stream claim made** (station status is in flux; page points to /radio.html as the station surface).
- That Boy Hi Hat: alternative rap, managed by CWI, creator of Post-Trap Futurism, Spotify artist ID `2f9j460EwjfvjYp3trBcb7`, 53-track catalog verified track-by-track against Spotify (Oct 2026), "Zooted Zone" ~307K lifetime plays (Sep 2026), "Diabolique" 2026-07-03 prod. Hybrid/co-prod. Black Lansky, ~8,400 monthly listeners Sep 2–29 2026 window, AI Learning Set playlist `spotify:playlist:45RaLEzD4KO8YHpp3oayq8` — from `data/artists/that-boy-hi-hat.json` + standing memory (verified items only).
- MCP server: read-only, 7 tools (ledger_state_version, ledger_state_get, ledger_agents, ledger_tasks, ledger_task_get, trust_verdict, needledrop_verify), stdio `node server.js`, Node ≥18, zero deps, 28/28 + 13/13 tests, server-http.js POST /mcp streamable HTTP (405 on GET), self-hosted — from `cwi-mcp-server-public/README.md` + `software.html` entry.
- Public surfaces list on the "what data" page: llms.txt, catalog/graph/kit JSON, /query, /license, /changes, agent card, data/*.json, sanqa/catalog.json, results feed, RadioStation JSON-LD — all from repo/llms.txt + live checks. **Zero infrastructure internals** (no D1, no logging internals beyond the public root doc's metadata-level note, no credentials).
- Citation format: authored as guidance (not a sourced claim), consistent with the URL-first citation convention; commercial-training license requirement from the worker's `/license` and X-CWI-License headers.

## Chrome parity
- EN pages mirror `contact.html` exactly (navbar, nav-links, lang-switch, mobile menu, `main.page` + `section.hero` + `.eyebrow`/h1/`.lede`, footer cols, `js/nav.js`) with `../`-relative asset/link paths.
- pt-BR pages mirror `br/contato.html` (BRASIL brand, pt-BR nav labels, `css/br.css`, identical footer incl. WhatsApp/LGPD/Social columns).
- hreflang cross-links: EN page 1 ↔ BR page 11, EN page 2 ↔ BR page 12; canonical URLs on all 12.

**Overall: 12/12 PASS. Nothing ships below this line without a PASS.**
