# Blog proofread record — 2026-10-05

Standing rule: nothing ships without an agent proofread. Every claim below was
checked against the repo or a live source before writing. Unverifiable = cut.

## Seed post 1: `radio-365-is-live` — "Radio 365 is live"

| Claim in post | Checked against | Result |
|---|---|---|
| Station streams at cumulativeweb.com/radio.html | `radio.html` exists in repo | PASS |
| Streams over HLS | `radio/hls/program.m3u8` + `seg*.ts` segments exist in repo | PASS |
| Live now-playing feed publishes current track | `radio/now-playing.json` live: status `ok`, artist "That Boy Hi Hat", title "Broken Hearts Club", `updated_at` 2026-10-05T13:09:31Z | PASS |
| 7-day program playlist published | `radio/hls/program-7day.m3u8` exists in repo | PASS |
| Launch announcement exists | `press/releases/cumulative-radio-365-launch.html` exists in repo | PASS |
| Track pages in CWI learning index | `https://cumulativewebinc.github.io/cwi-learn/tracks/` verified live 200 earlier today (24 track pages deployed) | PASS |

"24/7" uptime and listener counts: NOT claimed (unverifiable). Used "365-day station" per the press release's own "365 day" wording.

## Seed post 2: `diabolique-october-discovery-mode` — "Diabolique is the October Discovery Mode control"

| Claim in post | Checked against | Result |
|---|---|---|
| Diabolique is the October Discovery Mode control, campaign running | `~/workspace/cwi-company/reports/standup-2026-10-02.md`: "Diabolique Discovery Mode day 2 — running-state verify"; MEMORY.md: "Diabolique = Oct 2026 Discovery campaign + current spearhead" | PASS |
| Produced by Hybrid, co-produced by Black Lansky | `~/memory/people/hybrid.md`: "Producer of That Boy Hi Hat's single Diabolique (2026-07-03), co-produced with Black" | PASS ("Black" = public identity Black Lansky) |
| Machine-readable record in CWI learning index | `~/workspace/repos/cwi-learn/tracks/diabolique.html` exists (deployed) | PASS |
| Spotify track link | Track ID `2eSyWmIdPzEMyWejLb2LBj` from memory record (verified via Spotify API 2026-09-16); NOT re-fetched 2026-10-05 | PASS with note |
| Vote page | `vote-diabolique.html` exists in repo | PASS |

**Cut:** the "38–2 Spotlight matchup" score — appeared only in an unapproved internal draft, no verifiable source file. Post says "the campaign is running" only.

## Seed post 3: `cwi-blog-machine-readable` — "The CWI blog is now machine-readable"

| Claim in post | Checked against | Result |
|---|---|---|
| Every post = HTML + JSON twin + JSON-LD | Built by `blog/new-post.js` in this change; all 3 pairs exist in `blog/posts/` | PASS |
| JSON by swapping .html for .json | Verified file pairs on disk | PASS |
| Feed at /blog/index.json, newest first | `blog/index.json` built, 3 posts, date-desc | PASS |
| Beacons fire exposure/click to machine-data layer | Beacon snippet present in all 3 post pages + hub; see beacon verification below | PASS |
| llms.txt contract | `llms.txt` exists at repo root | PASS |

## Beacon verification (against the worker's real endpoint)

Source of truth: `~/workspace/cwi-company/machine-data-layer/worker.js`
`handleAdEvent` (lines 839–860).

| Requirement | Worker expects | Blog sends | Result |
|---|---|---|---|
| Endpoint | `POST /ad/event` | `POST https://cwi-machine-data.hp-ace.workers.dev/ad/event` | PASS |
| Event types | `AD_EVENT_TYPES` includes `exposure`, `click`, `equip` | exposure (load), click (outbound links), equip (copy button) | PASS |
| Payload fields | `event_type`, `slot_id` (≤64), `content_id` (≤128), `meta` (≤500 JSON) | `{event_type, slot_id:'blog-post'\|'blog-index', content_id:'blog:<slug>'\|'blog:index', meta:{page:<slug>}}` | PASS |
| Failure mode | public endpoint, no key | wrapped in try/catch + `.catch(()=>{})`, copied from the Radio 365 track-page snippet — a beacon failure can never break the page | PASS |

Protocol parity: same endpoint, same fields, same guard shape as
`~/workspace/cwi-company/ad-machine/generate-track-pages.js`. No new event protocol invented.

## Personal-data scan

- `grep -ri "henry pitts" blog/` — zero hits in post content. The only matches are the
  scrub rule's own code comments in `new-post.js`/`README.md` (the guard, not content).
- Generator refuses to build if the legal name appears in any future draft.
- Public identity used throughout: "Cumulative Web Inc", "Black Lansky".

## Structural checks

- All 3 posts: JSON-LD `BlogPosting` parses as JSON, `mainEntityOfPage.@id` =
  canonical post URL. PASS (script-verified).
- All 3 posts: `machine` block = `{content_id:"blog:<slug>", content_type:"blog_post", title, url, tags}`. PASS.
- All 3 posts: Related block has 2 cards, links resolve to sibling post files. PASS.
- Every blog URL reachable from hub AND in sitemap (stale long-slug sitemap entries removed 2026-10-05). PASS.
- `sitemap.xml` parses as valid XML after edits. PASS.
- No commit/push performed — working tree only.
