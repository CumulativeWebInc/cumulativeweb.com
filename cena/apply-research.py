#!/usr/bin/env python3
"""Apply research-2026-10-02 findings to cena.json. Idempotent."""
import json, os

BASE = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(BASE, "cena.json")
data = json.load(open(P, encoding="utf-8"))
C = {c["slug"]: c for c in data["cities"]}

def upd(slug, **kw):
    C[slug].update(kw)

upd("maceio",
    demand=0.75, scene_density=0.5, gap=0.95, confidence=0.75,
    confidence_note="Dossiê mais profundo: Trends (rap #3 BR) + batalhas e artistas verificados via UFAL/Intercom/imprensa local.",
    tagline="Eita gota — o rap alagoano tá em outro nível e a CENA.BR chegou junto desde o começo.",
    scene_body="Maceió é a prova de que demanda não espera curadoria: o estado busca rap como poucos no Brasil (3º no país), as batalhas lotam praça — Batalha PST na Praça Santa Teresa, Batalha do Palanque com 32 edições, Batalha da SD — e MCs alagoanos já pisaram no Duelo Nacional (MC Kenshin e Skinny Mc em 2019). Falta só uma coisa: selo, coletivo ou estúdio local de trap. Esse vazio é a oportunidade — e é por isso que a CENA.BR começa aqui.",
    artists=[{"name":"MC Duende","note":"organizador da Batalha da SD"},{"name":"MC Kenshin","note":"primeiro alagoano no Duelo Nacional (2019)"},{"name":"Boby CH","note":"rap/trap do Jacintinho"},{"name":"Huna","note":"cantora alagoana"}],
    artists_note="",
    neighborhoods=["Jacintinho","Vergel do Lago","Santos Dumont","Benedito Bentes","Jaraguá"],
    prediction={"trend":"subindo","basis":"Demanda #3 BR + cena de batalhas forte + zero curadoria local dedicada: gap máximo."})

upd("brasilia",
    demand=0.95, scene_density=0.95, gap=0.4, confidence=0.85,
    confidence_note="Trends (rap #1 BR) + infraestrutura de batalhas amplamente documentada.",
    tagline="Na capital do poder, o rap manda: 1º lugar em busca, dezenas de batalhas todo dia.",
    scene_body="Brasília lidera a busca por rap no Brasil — e tem a estrutura pra sustentar: a Batalha do Museu rola desde 2012 no Eixo, ~37 batalhas acontecem por dia no DF, e nomes como Hungria, Froid e MC Sid saíram dessas rodas. O hip hop candango vem dos anos 90; o trap brasiliense é o capítulo novo.",
    artists=[{"name":"Hungria Hip Hop","note":"o brasiliense mais ouvido"},{"name":"Froid","note":"revelado na Batalha do Museu"},{"name":"MC Sid","note":"cria das batalhas do DF"}],
    artists_note="",
    neighborhoods=["Ceilândia","Taguatinga","Sol Nascente","Eixo / Museu Nacional"],
    prediction={"trend":"subindo","basis":"Demanda máxima + máquina de batalhas: celeiro contínuo de MCs."})

upd("salvador",
    demand=0.9, scene_density=0.8, gap=0.55, confidence=0.75,
    confidence_note="Trends (trap #2 BR) + cena documentada (Casa do Hip-Hop Bahia, festivais).",
    tagline="Axé na veia, trap na batida: Salvador é a 2ª capital que mais busca trap no Brasil.",
    scene_body="Salvador é a segunda capital em busca por trap no país — e a cena acompanha: o Festival HIT chega à 5ª edição com Orochi, Matuê, Duquesa e Brandão; a Casa do Hip-Hop Bahia ancora a cultura no Pelourinho; e o Festival Hip Hop Ancestralidade conecta o rap às raízes. A musicalidade baiana atravessa tudo com swing próprio.",
    artists=[{"name":"Senghor Guena","note":"rap baiano de respeito"},{"name":"Duquesa","note":"no line-up do Festival HIT"},{"name":"Ravi Lobo","note":"cena de Salvador"}],
    artists_note="",
    neighborhoods=["Pelourinho","Liberdade","Cajazeiras"],
    prediction={"trend":"subindo","basis":"Trap #2 em busca + festivais em expansão: demanda à frente da curadoria."})

upd("sao-paulo",
    demand=0.85, scene_density=0.95, gap=0.3, confidence=0.85,
    confidence_note="Trends (drill #1 BR) + cena mais densa e documentada do país.",
    tagline="A capital do trap BR — onde o underground vira mainstream em uma semana.",
    scene_body="São Paulo dita o ritmo: Veigh é o rapper mais ouvido do Brasil (10,6M de ouvintes mensais), a Batalha da Aldeia completou 10 anos como a maior do país, e o drill paulista lidera as buscas nacionais. Da Aldeia ao Beco do Batman, a cidade é uma fábrica de cena — e a concorrência por atenção é a maior do Brasil.",
    artists=[{"name":"Veigh","note":"o rapper mais ouvido do Brasil"},{"name":"Derek","note":"trap SP"},{"name":"Raffa Moreira","note":"pioneiro do trap BR"}],
    artists_note="",
    neighborhoods=["Vila Madalena","Itaquera","Barueri","Capão Redondo"],
    prediction={"trend":"estável","basis":"Demanda máxima, curadoria saturada: o jogo aqui é nicho (drill, phonk)."})

upd("recife",
    demand=0.8, scene_density=0.85, gap=0.55, confidence=0.8,
    confidence_note="Trends + cena underground verificada (UNDERFEST, Batalha da Escadaria 13+ anos).",
    tagline="Do manguebeat ao trapbrega: Recife inventa o próprio gênero de novo.",
    scene_body="Recife já reinventou a música brasileira uma vez com o manguebeat — e tá fazendo de novo com o trapbrega, a fusão local de trap e brega com identidade própria e tag 081. O UNDERFEST chega à 4ª edição como o evento de trap underground mais pesado da cidade, e a Batalha da Escadaria rima há mais de 13 anos na Rua do Hospício.",
    artists=[{"name":"JOMA","note":"cena 081"},{"name":"HoodBob","note":"HoodCave"},{"name":"Marley no Beat","note":"Comunidade do Bode"}],
    artists_note="",
    neighborhoods=["Boa Vista","Santo Amaro","Pina","Recife Antigo"],
    prediction={"trend":"subindo","basis":"Identidade própria (trapbrega/081) + underground organizado: cena com cara de movimento."})

upd("goiania",
    demand=0.8, scene_density=0.6, gap=0.6, confidence=0.7,
    confidence_note="Trends: rap #2 BR mas trap #22 — a página lidera com 'rap'. Cena local parcialmente mapeada.",
    tagline="Não é só sertanejo: Goiânia respira rap — e o trap tá chegando.",
    scene_body="Goiânia é um caso curioso: está entre os estados que mais buscam rap no Brasil, mas o trap ainda engatinha nas buscas — o recado é claro, a página fala de rap primeiro. Por trás do rótulo de capital sertaneja, o Festival Território Goiano e nomes como Big Fett e Santa Lua mostram que o outro som goiano existe e cresce.",
    artists=[{"name":"Big Fett","note":"Anápolis, plug criminal"},{"name":"Santa Lua","note":"cena goiana"},{"name":"Akao 47","note":"MP7 Rajada"}],
    artists_note="",
    neighborhoods=["Setor Sul","Parque Amazônia","Anápolis"],
    prediction={"trend":"subindo","basis":"Rap #2 em busca + cena emergente: converter busca em cena é o jogo."})

upd("porto-alegre",
    demand=0.7, scene_density=0.7, gap=0.55, confidence=0.7,
    confidence_note="Trends (drill #3) + Rap In Cena documentado; artistas locais emergentes.",
    tagline="O Sul rima diferente — e o Rap In Cena prova todo dezembro.",
    scene_body="Porto Alegre é cidade de evento grande: o Rap In Cena chega à 12ª edição com 48 mil pessoas no Parque Harmonia, e o baile Joker lota o Centro Histórico. A cena local de trap cresce longe dos holofotes do eixo — e é essa distância que mantém o som autêntico. Página com ângulo de eventos: quem vem, quando rola, onde cola.",
    artists=[],
    artists_note="Mapeamento em andamento — conhece MCs de Porto Alegre? Manda o som.",
    neighborhoods=["Centro Histórico","Praia de Belas","Restinga"],
    prediction={"trend":"estável","basis":"Cidade de grandes eventos; cena local em formação gradual."})

upd("fortaleza",
    demand=0.6, scene_density=0.9, gap=0.45, confidence=0.8,
    confidence_note="Busca subestima a cena: QG da 30PRAUM, o selo que define o trap nacional.",
    tagline="QG da 30PRAUM: Fortaleza é a capital do trap nacional.",
    scene_body="Fortaleza é onde mora a 30PRAUM — o selo de Matuê que definiu o trap brasileiro — com Teto e WIU no elenco e Brandão, cria do Ceará, batendo 100 milhões de plays. A busca subestima a cidade; a rua não: o Plantão Festival foi o primeiro festival de trap da capital. Página-âncora de credibilidade pro projeto.",
    artists=[{"name":"Matuê","note":"fundador da 30PRAUM"},{"name":"Brandão","note":"100M de plays, cria do Ceará"},{"name":"Teto","note":"30PRAUM"},{"name":"WIU","note":"30PRAUM"}],
    artists_note="",
    neighborhoods=["Conjunto Ceará","Messejana"],
    prediction={"trend":"subindo","basis":"Efeito vitrine do selo segue puxando atenção pra cena local."})

upd("rio-de-janeiro",
    demand=0.7, scene_density=0.95, gap=0.35, confidence=0.85,
    confidence_note="Busca (trap/drill #3) subestima a cena; Batalha do Tanque 11 anos/553+ edições.",
    tagline="Do Tanque pro mundo: o Rio inventa o som que o Brasil copia.",
    scene_body="O Rio busca trap e drill entre os primeiros do país — e entrega: a Batalha do Tanque, em São Gonçalo, soma 11 anos e mais de 550 edições formando MCs, enquanto Orochi, Chefin, BK', Filipe Ret e N.I.N.A levam o som carioca pros charts. O funk virou linguagem global; o trap do Rio bebe da mesma fonte.",
    artists=[{"name":"Orochi","note":"Mainstreet"},{"name":"Chefin","note":"trap carioca"},{"name":"BK'","note":"do Rio pro Maracanã"},{"name":"N.I.N.A","note":"Spotify RADAR"}],
    artists_note="",
    neighborhoods=["São Gonçalo","Maré","Madureira"],
    prediction={"trend":"estável","basis":"Cena das mais maduras do país; batalhas seguem revelando nomes."})

upd("belo-horizonte",
    demand=0.55, scene_density=0.95, gap=0.4, confidence=0.85,
    confidence_note="Busca baixa, autoridade máxima: casa do Duelo Nacional desde 2007.",
    tagline="A Meca das batalhas: BH decide quem rima no Brasil desde 2007.",
    scene_body="Belo Horizonte é a Meca do freestyle brasileiro: o Duelo de MCs Nacional acontece no Viaduto Santa Tereza desde 2007, reunindo 32 MCs de todos os estados, e as batalhas de sexta lotam 1.500 pessoas. Djonga, primeiro brasileiro indicado ao BET Hip-Hop Awards, é cria daqui. A busca é baixa — a autoridade é máxima.",
    artists=[{"name":"Djonga","note":"indicado ao BET Hip-Hop Awards"},{"name":"Sidoka","note":"rap BH"},{"name":"Chris MC","note":"cena mineira"}],
    artists_note="",
    neighborhoods=["Santa Tereza","Aglomerado da Serra","Venda Nova"],
    prediction={"trend":"estável","basis":"Autoridade consolidada; crescimento em profundidade, não em hype."})

data["_meta"]["data_confidence_note"] = ("v1.1 — research pass 2026-10-02 aplicado (pytrends 12 meses, 27 UFs, 5 termos + "
    "dossiês web por cidade). Scores agora ancorados em dados; 'Goiânia top-10 Spotify 2023' removida por não verificada.")
data["_meta"]["macro_facts"] = [
    {"fact": "O trap brasileiro cresceu 33% em streams em dois anos (Spotify, ~2022).", "confidence": "alta"},
    {"fact": "A busca por 'batalha de rima' no Brasil quase triplicou em 52 semanas (Google Trends, out/2026).", "confidence": "alta"},
    {"fact": "Veigh é o rapper mais ouvido do Brasil no Spotify (10,6M ouvintes/mês, set/2026).", "confidence": "alta"},
]

json.dump(data, open(P, "w", encoding="utf-8"), ensure_ascii=False)
print("updated", len(data["cities"]), "cities")
