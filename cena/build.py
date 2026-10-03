#!/usr/bin/env python3
"""CENA.BR static generator — $0, zero dependencies.
Reads cena.json, emits real indexable URLs (no hash routes):
  cena/index.html, cena/metodologia/index.html,
  cena/br/<uf>/<slug>/index.html, cena/cena.css
Run: python3 build.py   (from the cena/ directory)
"""
import json, os, html
from urllib.parse import quote

BASE = os.path.dirname(os.path.abspath(__file__))
SITE = "https://cumulativeweb.com"

def esc(s):
    return html.escape(str(s or ""), quote=True)

def score(c):
    f = c["_meta_formula"] if False else None
    return round(100 * (0.35*c["demand"] + 0.25*c["scene_density"] + 0.40*c["gap"]) * (0.6 + 0.4*c["confidence"]))

def conf_label(cf):
    if cf >= 0.7: return "alta"
    if cf >= 0.45: return "média"
    return "hipótese inicial"

def city_url(c):
    return f"{SITE}/cena/br/{c['uf']}/{c['slug']}/"

def head_common(title, desc, canonical, og_extra=""):
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{canonical}">
<link rel="alternate" hreflang="pt-BR" href="{canonical}">
<link rel="icon" href="/assets/cwi-logo.jpg">
<link rel="stylesheet" href="/cena/cena.css">
<meta property="og:type" content="website">
<meta property="og:site_name" content="CENA.BR — Cumulative Web Inc">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{SITE}/assets/cwi-logo.jpg">
<meta property="og:locale" content="pt_BR">
<meta name="twitter:card" content="summary_large_image">
{og_extra}</head>"""

def header(meta):
    ann = meta.get("announcement") or {}
    banner = ""
    if ann.get("active"):
        banner = f"""<div class="announce" id="announce" data-ver="{ann.get('version',1)}">
<span>{esc(ann['text'])}</span>
<a href="{esc(ann['link'])}" target="_blank" rel="noopener">{esc(ann['link_label'])} →</a>
<button aria-label="Fechar aviso" onclick="document.getElementById('announce').remove();try{{localStorage.setItem('cena-banner-v{ann.get('version',1)}','1')}}catch(e){{}}">×</button>
</div>
<script>try{{if(localStorage.getItem('cena-banner-v{ann.get('version',1)}'))document.getElementById('announce').remove()}}catch(e){{}}</script>"""
    return f"""<body>
{banner}
<header class="topbar">
<a class="brand" href="/cena/"><img src="/assets/cwi-logo.jpg" alt="Cumulative Web Inc — logo"><span>CENA<strong>.BR</strong></span></a>
<nav><a href="/cena/">Cidades</a><a href="/cena/metodologia/">Método</a><a href="/">cumulativeweb.com</a></nav>
</header>"""

def social_row(meta):
    s = meta.get("social", {})
    links = [("Instagram", s.get("instagram")), ("TikTok", s.get("tiktok")),
             ("YouTube", s.get("youtube")), ("X", s.get("x")),
             ("Facebook", s.get("facebook"))]
    btns = "".join(f'<a class="btn soc" href="{esc(u)}" target="_blank" rel="noopener">{n}</a>'
                   for n, u in links if u)
    return f"""<section class="segue">
<h2>Segue a CWI</h2>
<p>Acompanha os lançamentos, as datas e a cena em tempo real:</p>
<div class="btnrow">{btns}</div>
</section>"""

def airplay_section(c, meta):
    ra = meta.get("radio_airplay", {})
    cwi = meta["cwi"]
    return f"""<section class="airplay">
<h2>{esc(ra.get('title', 'Toca na Rádio 365'))}</h2>
<p>{esc(ra.get('body', ''))}</p>
<div class="btnrow">
<a class="btn" href="mailto:{cwi['contact_email']}?subject=Música%20pra%20Rádio%20365%20—%20{quote(c['city'])}">Mandar minha música</a>
<a class="btn" href="{cwi['radio_page']}">Ouvir a Rádio 365</a>
</div>
<p class="tiny">Como funciona: você manda o som → a curadoria da CWI ouve → se entrar na programação, toca no ar com teu nome. Resposta honesta, sem taxa.</p>
</section>"""

def footer(meta):
    soc = meta.get("social", {})
    soc_links = " · ".join(
        f'<a href="{esc(u)}">{n}</a>'
        for n, u in [("Instagram", soc.get("instagram")), ("X", soc.get("x")),
                     ("YouTube", soc.get("youtube")), ("TikTok", soc.get("tiktok")),
                     ("Facebook", soc.get("facebook"))]
        if u)
    return f"""<footer>
<img src="/assets/cwi-logo.jpg" alt="Cumulative Web Inc — logo" class="flogo">
<p><strong>CENA.BR</strong> é um projeto da <strong>Cumulative Web Inc</strong> — mapeando o rap, trap e underground do Brasil, cidade por cidade.</p>
<p><a href="/">cumulativeweb.com</a> · <a href="/br/privacidade.html">Privacidade (LGPD)</a> · <a href="mailto:{meta['cwi']['contact_email']}">Contato</a></p>
<p>Social: {soc_links}</p>
<p class="tiny">Estimativas marcadas como tal são hipóteses iniciais, substituídas por dados medidos toda semana. Método aberto em <a href="/cena/metodologia/">/cena/metodologia/</a>.</p>
</footer>
</body>
</html>"""

def jsonld_city(c, meta, url, sc):
    lineage = {
        "@context": {"cwi": "https://cumulativeweb.com/cena/vocab#"},
        "@type": "cwi:CityScenePage",
        "cwi:generator": meta["generated_by"],
        "cwi:dataVersion": meta["version"],
        "cwi:opportunityScore": sc,
        "cwi:confidence": c["confidence"],
        "cwi:confidenceNote": c["confidence_note"],
        "cwi:goalTrace": meta["goal_lineage"]["result"],
        "cwi:method": meta["method"],
        "cwi:scoringFormula": meta["scoring_formula"]["opportunity"],
    }
    schema = {
        "@context": "https://schema.org",
        "@graph": [
            {"@type": "WebPage", "url": url, "name": c["seo_title"],
             "description": c["seo_description"], "inLanguage": "pt-BR",
             "about": {"@type": "City", "name": c["city"], "containedInPlace": {"@type": "State", "name": c["uf_name"]}}},
            {"@type": "MusicGroup", "name": "Cumulative Web Inc",
             "url": SITE, "logo": meta["cwi"]["logo_absolute"],
             "genre": ["Rap", "Trap", "Underground", "Alternative Rap"]},
        ],
    }
    return ('<script type="application/ld+json">' + json.dumps(schema, ensure_ascii=False) + '</script>\n'
            '<script type="application/ld+json">' + json.dumps(lineage, ensure_ascii=False) + '</script>')

def discovery_bars(c):
    labels = {"whatsapp": "WhatsApp/Telegram", "tiktok_reels": "TikTok/Reels/Shorts",
              "algoritmo": "Spotify/YouTube (algoritmo)", "eventos": "Batalhas e eventos", "boca_a_boca": "Boca a boca"}
    out = ['<div class="disco"><h3>Como a cena descobre som novo <span class="est">estimativa inicial</span></h3><div class="bars">']
    for k, v in c["discovery"].items():
        out.append(f'<div class="bar"><span class="bl">{labels[k]}</span><span class="bt"><i style="width:{v}%"></i></span><span class="bv">{v}%</span></div>')
    out.append('</div><p class="tiny">Números de partida — a cada semana os cliques reais das páginas recalibram essa divisão. <a href="/cena/metodologia/">Como medimos</a>.</p></div>')
    return "\n".join(out)

def render_city(c, meta):
    url = city_url(c)
    sc = score(c)
    pl = c["playlists"]
    yt = f"https://www.youtube.com/embed/videoseries?list={pl['youtube_id']}" if pl.get("youtube_id") else None
    sp = f"https://open.spotify.com/embed/playlist/{pl['spotify_id']}" if pl.get("spotify_id") else None
    artists = "".join(f'<li><strong>{esc(a["name"])}</strong> — {esc(a["note"])}</li>' for a in c.get("artists", []))
    if not artists:
        artists = f'<li class="muted">{esc(c.get("artists_note", "Mapeamento em andamento."))}</li>'
    hoods = "".join(f"<li>{esc(n)}</li>" for n in c.get("neighborhoods", []))
    share_txt = quote(f"{c['tagline']} {url}")
    wa_join = meta["channels"].get("whatsapp"); tg_join = meta["channels"].get("telegram")
    join_btns = ""
    if wa_join: join_btns += f'<a class="btn" href="{esc(wa_join)}" target="_blank" rel="noopener">Entrar no WhatsApp</a>'
    if tg_join: join_btns += f'<a class="btn" href="{esc(tg_join)}" target="_blank" rel="noopener">Entrar no Telegram</a>'

    page = head_common(c["seo_title"], c["seo_description"], url) + "\n"
    page += jsonld_city(c, meta, url, sc) + "\n"
    page += header(meta) + f"""
<main class="city" style="--accent:{c['accent']}">
<p class="crumb"><a href="/cena/">CENA.BR</a> / {esc(c['region'])} / {esc(c['uf_name'])}</p>
{'<p class="pilot">Cidade-piloto — a CENA.BR começa aqui.</p>' if c.get('pilot') else ''}
<h1>{esc(c['city'])}<span class="uf">{esc(c['uf'].upper())}</span></h1>
<p class="tagline">{esc(c['tagline'])}</p>

<section class="scene">
<h2>{esc(c['scene_title'])}</h2>
<p>{esc(c['scene_body'])}</p>
<div class="cols">
<div><h3>Quem tá fazendo</h3><ul>{artists}</ul></div>
<div><h3>Quebradas da cena</h3><ul>{hoods}</ul></div>
</div>
</section>

<section class="ouca">
<h2>Ouça agora</h2>
<div class="player-row">
<div class="radio-card">
<img src="/assets/cwi-logo.jpg" alt="Cumulative Web Inc — logo">
<p><strong>Rádio 365</strong> — o som da CWI tocando direto daqui.</p>
<audio id="radioAudio" controls preload="none"></audio>
<p class="tiny" id="playState" data-state="idle" aria-live="polite"></p>
<script src="/radio/radio365-player.js" defer></script>
</div>
<div class="embeds">
{f'<div class="emb"><p><strong>Seleção CWI no YouTube</strong></p><iframe loading="lazy" src="{yt}" title="CWI no YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>' if yt else '<div class="emb"><p><strong>CWI no YouTube</strong></p><iframe loading="lazy" src="https://www.youtube.com/embed/videoseries?list=' + meta['cwi']['youtube_uploads_playlist'] + '" title="CWI no YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>'}
{f'<div class="emb"><p><strong>Playlist ' + esc(c['city']) + ' no Spotify</strong></p><iframe loading="lazy" src="{sp}" title="Spotify" allow="encrypted-media" ></iframe></div>' if sp else '<div class="emb"><p><strong>Catálogo CWI no Spotify</strong> <span class="est">seleção da casa</span></p><iframe loading="lazy" src="https://open.spotify.com/embed/playlist/' + meta['cwi']['spotify_catalog_playlist'] + '" title="Spotify" allow="encrypted-media"></iframe></div>'}
</div>
</div>
<p class="tiny">Playlists por cidade chegam quando a curadoria local estiver pronta — sem playlist fake. O que está acima é o catálogo real da CWI, claramente identificado.</p>
</section>

{airplay_section(c, meta)}

{discovery_bars(c)}

<section class="eventos">
<h2>Batalhas e eventos</h2>
<p>Ainda não há eventos verificados em {esc(c['city'])}. Organizou uma batalha, cypher ou show? <a href="mailto:{meta['cwi']['contact_email']}?subject=Batalha%20em%20{quote(c['city'])}">Manda pra gente</a> — evento verificado entra no mapa da cidade.</p>
</section>

<section class="manda">
<h2>Manda teu som</h2>
<p>Mc ou produtor de {esc(c['city'])}? Cola teu trampo: <a href="mailto:{meta['cwi']['contact_email']}?subject=Som%20de%20{quote(c['city'])}%20—%20CENA.BR">manda o som pra CWI</a>. Som verificado pode entrar na seleção da cidade e no radar do A&R.</p>
</section>

<section class="share">
<h2>Espalha</h2>
<div class="btnrow">
<a class="btn wa" href="https://wa.me/?text={share_txt}" target="_blank" rel="noopener">Compartilhar no WhatsApp</a>
<a class="btn tg" href="https://t.me/share/url?url={quote(url)}&text={quote(c['tagline'])}" target="_blank" rel="noopener">Compartilhar no Telegram</a>
{join_btns}
</div>
</section>

{social_row(meta)}

<section class="score">
<h2>Por que {esc(c['city'])}? <span class="est">metodologia aberta</span></h2>
<p class="bignum">{sc}<span>/100 oportunidade</span></p>
<p>Confiança nos dados: <strong>{conf_label(c['confidence'])}</strong> — {esc(c['confidence_note'])}</p>
<p class="tiny">Fórmula: oportunidade = 100 × (0,35×demanda + 0,25×cena + 0,40×gap) × (0,6 + 0,4×confiança). Previsão atual: <strong>{esc(c['prediction']['trend'])}</strong> — {esc(c['prediction']['basis'])} <a href="/cena/metodologia/">Ver o método completo</a>.</p>
</section>
</main>
"""
    return page + footer(meta)

def render_index(cities, meta):
    ranked = sorted(cities, key=score, reverse=True)
    cards = []
    for c in ranked:
        sc = score(c)
        cards.append(f"""<a class="card" href="/cena/br/{c['uf']}/{c['slug']}/" style="--accent:{c['accent']}">
<span class="cscore">{sc}</span>
<h3>{esc(c['city'])}<span class="uf">{esc(c['uf'].upper())}</span></h3>
<p>{esc(c['tagline'])}</p>
<span class="cconf">{conf_label(c['confidence'])}</span>
{'<span class="pilot-tag">piloto</span>' if c.get('pilot') else ''}
</a>""")
    page = head_common("CENA.BR — Rap, Trap e Underground por cidade | Cumulative Web Inc",
        "O mapa do rap, trap e underground do Brasil, cidade por cidade: cenas, sons e onde ouvir. Um projeto da Cumulative Web Inc.",
        f"{SITE}/cena/") + "\n" + header(meta) + f"""
<main class="index">
<section class="hero">
<img src="/assets/cwi-logo.jpg" alt="Cumulative Web Inc — logo" class="herologo">
<h1>CENA<strong>.BR</strong></h1>
<p class="tagline">O mapa do rap, trap e underground do Brasil — cidade por cidade.</p>
<p>{esc(meta['goal_plain'])}</p>
</section>
<section class="momento">
<h2>O momento</h2>
<ul>
{''.join('<li>' + esc(m['fact']) + f' <span class="cconf">confiança {esc(m["confidence"])}</span></li>' for m in meta.get('macro_facts', []))}
</ul>
</section>
<section class="grid">
{''.join(cards)}
</section>
{social_row(meta)}
<section class="como">
<h2>Como funciona</h2>
<ol>
<li><strong>Uma cidade, uma URL de verdade.</strong> Cada página é indexável e compartilhável — sem truque de hash.</li>
<li><strong>Pontuação aberta.</strong> Cada cidade tem nota de oportunidade com a fórmula publicada e o nível de confiança ao lado.</li>
<li><strong>Dados recalibram tudo, toda semana.</strong> Tendências de busca e cliques reais ajustam as notas; a expansão segue a tração.</li>
<li><strong>Tudo termina em play.</strong> Rádio 365, YouTube e Spotify em cada página — visita vira audição, audição vira sessão medida.</li>
</ol>
<p><a href="/cena/metodologia/">Ler a metodologia completa e o brief do agente →</a></p>
</section>
</main>
"""
    return page + footer(meta)

def render_metodologia(meta):
    f = meta["scoring_formula"]
    page = head_common("Metodologia CENA.BR — como pontuamos cada cidade | Cumulative Web Inc",
        "O método aberto da CENA.BR: fórmula de oportunidade, calibragem semanal, regras de honestidade e o brief do agente de IA.",
        f"{SITE}/cena/metodologia/") + "\n" + header(meta) + f"""
<main class="metod">
<h1>Metodologia</h1>
<p class="tagline">O manual que o agente de IA usa para operar a CENA.BR — público, pra qualquer um auditar.</p>
<section><h2>O objetivo</h2><p>{esc(meta['goal_plain'])}</p>
<p><strong>Rastro de linhagem:</strong> {esc(meta['goal_lineage']['result'])}.<br>{esc(meta['goal_lineage']['trace'])}.<br>Conversão: {esc(meta['goal_lineage']['conversion_leg'])}.</p></section>
<section><h2>A fórmula</h2>
<p><strong>Insumos:</strong> {esc(f['inputs'])}</p>
<p class="formula">{esc(f['opportunity'])}</p>
<p><strong>Leitura:</strong> {esc(f['reading'])}</p>
<p><strong>Previsão e calibragem:</strong> {esc(f['prediction'])}</p></section>
<section><h2>O loop semanal</h2><p>{esc(meta['update_cadence'])}</p></section>
<section><h2>Regras de honestidade</h2><ul>
{''.join('<li>'+esc(r)+'</li>' for r in meta['honesty_rules'])}
</ul></section>
<section><h2>Por que cada peça existe</h2><ul>
<li><strong>URL real por cidade</strong> — o Google não indexa fragmentos de hash; sem URL real, não há magnetismo de busca.</li>
<li><strong>pt-BR + &lt;100KB + zero imagem remota</strong> — o Brasil ouve no Android intermediário com dados móveis; página pesada não rankeia nem converte.</li>
<li><strong>Nota de oportunidade + selo de confiança</strong> — separa hipótese de fato; o agente só escala o que tem confiança.</li>
<li><strong>Botão de compartilhar no WhatsApp</strong> — é onde o Brasil troca música; funciona sem número, sem cadastro.</li>
<li><strong>Rádio 365 em cada página</strong> — transforma visita em audição mensurável na hora.</li>
<li><strong>Manda teu som + batalhas</strong> — o underground se autoabastece: artista manda som, evento entra no mapa, página ganha backlink e conteúdo fresco.</li>
<li><strong>JSON-LD com bloco de linhagem</strong> — máquina lê o método, a fórmula e o rastro de resultado em cada página.</li>
</ul></section>
</main>
"""
    return page + footer(meta)

CSS = """:root{--bg:#0b0b0e;--panel:#141419;--txt:#f2f2f5;--sub:#a7a7b3;--line:#26262e}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--txt);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.6}
body::before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.05;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")}
.topbar{display:flex;justify-content:space-between;align-items:center;padding:.9rem 1.2rem;border-bottom:1px solid var(--line);position:sticky;top:0;background:rgba(11,11,14,.92);backdrop-filter:blur(6px);z-index:10}
.brand{display:flex;align-items:center;gap:.6rem;color:var(--txt);text-decoration:none;font-weight:800;letter-spacing:.04em}
.brand img{width:38px;height:38px;border-radius:50%;object-fit:cover}
.brand strong{color:var(--accent,#00e5a0)}
.topbar nav{display:flex;gap:1rem}
.topbar nav a{color:var(--sub);text-decoration:none;font-size:.9rem}
.topbar nav a:hover{color:var(--txt)}
main{max-width:880px;margin:0 auto;padding:1.5rem 1.2rem 3rem}
.crumb{color:var(--sub);font-size:.85rem;margin-bottom:1rem}
.crumb a{color:var(--sub)}
h1{font-size:clamp(2.6rem,9vw,4.6rem);line-height:1.02;letter-spacing:-.02em;margin:.2rem 0}
h1 .uf{font-size:.35em;vertical-align:super;color:var(--accent,#00e5a0);margin-left:.4rem;letter-spacing:.1em}
.tagline{font-size:1.25rem;color:var(--txt);margin:.6rem 0 1.5rem;font-weight:600}
.pilot{display:inline-block;background:var(--accent,#00e5a0);color:#0b0b0e;font-weight:700;font-size:.8rem;padding:.25rem .7rem;border-radius:99px;margin-bottom:.6rem}
h2{font-size:1.5rem;margin:2.2rem 0 .8rem}
h3{font-size:1.05rem;margin:1.2rem 0 .4rem}
section p{margin:.6rem 0;color:var(--txt)}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:1.2rem;margin-top:1rem}
@media(max-width:640px){.cols{grid-template-columns:1fr}}
ul{list-style:none}
.cols li{background:var(--panel);border:1px solid var(--line);border-radius:.7rem;padding:.6rem .8rem;margin-bottom:.5rem;font-size:.95rem}
.muted{color:var(--sub)}
.ouca .player-row{display:grid;gap:1rem}
.radio-card{background:var(--panel);border:1px solid var(--line);border-left:4px solid var(--accent,#00e5a0);border-radius:.8rem;padding:1rem;display:flex;gap:1rem;align-items:center;flex-wrap:wrap}
.radio-card img{width:56px;height:56px;border-radius:50%}
.radio-card audio{width:100%;margin-top:.5rem}
.embeds{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
@media(max-width:640px){.embeds{grid-template-columns:1fr}}
.emb iframe{width:100%;height:220px;border:0;border-radius:.7rem;background:#000}
.est{display:inline-block;font-size:.68rem;font-weight:700;color:#0b0b0e;background:var(--accent,#00e5a0);border-radius:99px;padding:.1rem .5rem;vertical-align:middle;margin-left:.4rem}
.bars{margin:.8rem 0}
.bar{display:grid;grid-template-columns:150px 1fr 44px;gap:.6rem;align-items:center;margin:.45rem 0;font-size:.9rem}
.bl{color:var(--sub)}
.bt{background:var(--panel);border-radius:99px;height:10px;overflow:hidden}
.bt i{display:block;height:100%;background:var(--accent,#00e5a0)}
.bv{text-align:right;color:var(--sub)}
.btnrow{display:flex;gap:.7rem;flex-wrap:wrap;margin-top:.8rem}
.btn{display:inline-block;background:var(--accent,#00e5a0);color:#0b0b0e;font-weight:700;text-decoration:none;padding:.7rem 1.1rem;border-radius:.7rem}
.btn.wa{background:#25d366}.btn.tg{background:#229ed9;color:#fff}
.tiny{font-size:.82rem;color:var(--sub)}
.score .bignum{font-size:3rem;font-weight:800;color:var(--accent,#00e5a0)}
.score .bignum span{font-size:1rem;color:var(--sub);font-weight:400;margin-left:.4rem}
.hero{text-align:center;padding:2.5rem 0 1rem}
.herologo{width:92px;height:92px;border-radius:50%;margin-bottom:1rem}
.hero h1{font-size:clamp(3rem,12vw,5.5rem)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:1rem;margin:1.5rem 0}
.card{background:var(--panel);border:1px solid var(--line);border-top:3px solid var(--accent,#00e5a0);border-radius:.8rem;padding:1rem;color:var(--txt);text-decoration:none;display:block}
.card h3{font-size:1.25rem;margin:.3rem 0}
.card p{font-size:.92rem;color:var(--sub)}
.cscore{font-weight:800;color:var(--accent,#00e5a0);font-size:1.4rem}
.cconf{font-size:.75rem;color:var(--sub);border:1px solid var(--line);border-radius:99px;padding:.1rem .6rem}
.pilot-tag{font-size:.75rem;background:var(--accent,#00e5a0);color:#0b0b0e;border-radius:99px;padding:.1rem .6rem;margin-left:.4rem;font-weight:700}
.como ol{margin:1rem 0 1rem 1.2rem}
.como li{margin:.5rem 0}
.formula{background:var(--panel);border:1px solid var(--line);border-radius:.7rem;padding:1rem;font-family:ui-monospace,monospace;margin:1rem 0}
footer{border-top:1px solid var(--line);padding:2rem 1.2rem;text-align:center;color:var(--sub);font-size:.9rem}
footer .flogo{width:54px;height:54px;border-radius:50%;margin-bottom:.6rem}
footer a{color:var(--txt)}
.announce{display:flex;align-items:center;justify-content:center;gap:.8rem;background:var(--accent,#00e5a0);color:#0b0b0e;font-weight:600;font-size:.92rem;padding:.55rem 3rem .55rem 1rem;position:relative;text-align:center}
.announce a{color:#0b0b0e;font-weight:800;white-space:nowrap}
.announce button{position:absolute;right:.6rem;top:50%;transform:translateY(-50%);background:none;border:0;font-size:1.3rem;cursor:pointer;color:#0b0b0e;line-height:1}
.segue .btnrow .soc{background:var(--panel);color:var(--txt);border:1px solid var(--line)}
.airplay{background:var(--panel);border:1px solid var(--line);border-left:4px solid var(--accent,#00e5a0);border-radius:.8rem;padding:1.2rem;margin-top:2.2rem}
.airplay h2{margin-top:0}
"""

def main():
    with open(os.path.join(BASE, "cena.json"), encoding="utf-8") as f:
        data = json.load(f)
    meta, cities = data["_meta"], data["cities"]
    out = []
    def write(rel, content):
        p = os.path.join(BASE, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            f.write(content)
        out.append(rel)
    write("index.html", render_index(cities, meta))
    write("metodologia/index.html", render_metodologia(meta))
    for c in cities:
        write(f"br/{c['uf']}/{c['slug']}/index.html", render_city(c, meta))
    with open(os.path.join(BASE, "cena.css"), "w", encoding="utf-8") as f:
        f.write(CSS)
    out.append("cena.css")
    print(json.dumps({"built": len(out), "cities": len(cities),
                      "top3": [(c["city"], score(c)) for c in sorted(cities, key=score, reverse=True)[:3]]},
                     ensure_ascii=False))

if __name__ == "__main__":
    main()
