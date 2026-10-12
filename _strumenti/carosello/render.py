#!/usr/bin/env python3
"""Impagina il carosello settimanale "Le principali novità AI della settimana".

Uso:  python3 render.py slides.json cartella_output
Crea: slide-01.png ... (1080x1350, per Instagram) e carosello.pdf (per LinkedIn).

La grafica è fissa (palette navy / avorio / ottone, DM Serif Display + DM Sans).
Si cambiano solo i testi in slides.json: vedi LEGGIMI.md ed esempio.json.
"""
import html
import json
import math
import random
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

QUI = Path(__file__).resolve().parent
FONTS = (QUI / "fonts").as_uri()
W, H = 1080, 1350

CSS = """
@font-face{font-family:'DM Serif Display';src:url('{FONTS}/dm-serif-display-latin-400-normal.woff2') format('woff2');font-weight:400;font-style:normal}
@font-face{font-family:'DM Serif Display';src:url('{FONTS}/dm-serif-display-latin-400-italic.woff2') format('woff2');font-weight:400;font-style:italic}
@font-face{font-family:'DM Sans';src:url('{FONTS}/dm-sans-latin-400-normal.woff2') format('woff2');font-weight:400}
@font-face{font-family:'DM Sans';src:url('{FONTS}/dm-sans-latin-500-normal.woff2') format('woff2');font-weight:500}
@font-face{font-family:'DM Sans';src:url('{FONTS}/dm-sans-latin-700-normal.woff2') format('woff2');font-weight:700}
:root{--navy:#14213A;--avorio:#F7F4EE;--ottone:#C9A961;--ottone-scuro:#9C7F3C;--grigio:#5B6474}
@page{size:1080px 1350px;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff}
.slide{width:1080px;height:1350px;position:relative;overflow:hidden;display:flex;flex-direction:column;
  padding:96px 96px 0 96px;font-family:'DM Sans',sans-serif;page-break-after:always;break-after:page}
.scura{background:var(--navy);color:var(--avorio)}
.chiara{background:var(--avorio);color:var(--navy)}
.nodi{position:absolute;inset:0;pointer-events:none}
.top{display:flex;justify-content:space-between;align-items:baseline;position:relative;z-index:1}
.eyebrow{font-size:26px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--ottone)}
.chiara .eyebrow{color:var(--ottone-scuro)}
.num{font-size:26px;font-weight:500;letter-spacing:.06em;opacity:.55}
.corpo{flex:1;display:flex;flex-direction:column;justify-content:center;position:relative;z-index:1;
  padding:40px 0 150px 0;min-height:0}
h1,h2{font-family:'DM Serif Display',serif;font-weight:400;line-height:1.06;letter-spacing:-.005em}
h1{font-size:112px}
h2{font-size:76px}
h1 em,h2 em{font-style:italic;color:var(--ottone)}
.chiara h2 em{color:var(--ottone-scuro)}
.filo{width:120px;height:4px;background:var(--ottone);margin:44px 0 44px 0;flex:none}
.testo{font-size:40px;line-height:1.42;font-weight:400}
.scura .testo{color:rgba(247,244,238,.86)}
.fonte{margin-top:40px;font-size:24px;color:var(--grigio);letter-spacing:.02em}
.punti{list-style:none;display:flex;flex-direction:column;gap:34px}
.punti li{display:flex;gap:28px;font-size:38px;line-height:1.38}
.punti b{font-family:'DM Serif Display',serif;font-weight:400;font-size:52px;line-height:1;color:var(--ottone-scuro);min-width:44px}
.scorri{margin-top:56px;font-size:30px;font-weight:500;letter-spacing:.04em;color:var(--ottone)}
.cta{margin-top:52px;display:flex;flex-direction:column;gap:22px}
.cta div{font-size:36px;font-weight:500;padding-left:34px;border-left:4px solid var(--ottone)}
.piede{position:absolute;left:96px;right:96px;bottom:72px;display:flex;justify-content:space-between;align-items:center;z-index:1}
.handle{font-size:26px;font-weight:500;letter-spacing:.03em;opacity:.7}
.pallini{display:flex;gap:14px}
.pallini span{width:14px;height:14px;border-radius:50%;border:2px solid currentColor;opacity:.45}
.pallini span.on{background:var(--ottone);border-color:var(--ottone);opacity:1}
"""


def nodi_svg(seme, colore="#C9A961"):
    """Motivo a nodi (rete) solo per copertina e chiusura. Deterministico."""
    rnd = random.Random(seme)
    punti = []
    for _ in range(20):
        x = rnd.uniform(600, 1110)
        y = rnd.uniform(170, 390)
        punti.append((x, y))
    linee = []
    for i, (x1, y1) in enumerate(punti):
        vicini = sorted(range(len(punti)), key=lambda j: math.dist(punti[i], punti[j]))[1:3]
        for j in vicini:
            x2, y2 = punti[j]
            linee.append(f'<line x1="{x1:.0f}" y1="{y1:.0f}" x2="{x2:.0f}" y2="{y2:.0f}"/>')
    cerchi = "".join(
        f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{rnd.choice([4,5,7])}"/>' for x, y in punti
    )
    return (
        f'<svg class="nodi" viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg">'
        f'<g stroke="{colore}" stroke-opacity=".22" stroke-width="2">{"".join(linee)}</g>'
        f'<g fill="{colore}" fill-opacity=".38">{cerchi}</g></svg>'
    )


def t(s):
    """Testo sicuro; *parola* diventa corsivo in ottone."""
    s = html.escape(s or "")
    parti = s.split("*")
    return "".join(f"<em>{p}</em>" if i % 2 else p for i, p in enumerate(parti))


def pallini(i, n):
    return '<div class="pallini">' + "".join(
        f'<span class="{"on" if k <= i else ""}"></span>' for k in range(n)
    ) + "</div>"


def slide_html(s, i, n, handle):
    tipo = s.get("tipo")
    num = f'<span class="num">{i+1:02d} / {n:02d}</span>'
    piede = f'<div class="piede"><span class="handle">{html.escape(handle)}</span>{pallini(i, n)}</div>'
    if tipo == "copertina":
        return (
            f'<section class="slide scura">{nodi_svg(n)}'
            f'<div class="top"><span class="eyebrow">{t(s.get("etichetta","Novità AI"))}</span>{num}</div>'
            f'<div class="corpo"><div class="dentro"><h1>{t(s["titolo"])}</h1><div class="filo"></div>'
            f'<p class="testo">{t(s.get("testo",""))}</p>'
            f'<p class="scorri">Scorri →</p></div></div>{piede}</section>'
        )
    if tipo == "novita":
        fonte = f'<p class="fonte">{t(s["fonte"])}</p>' if s.get("fonte") else ""
        return (
            f'<section class="slide chiara">'
            f'<div class="top"><span class="eyebrow">{t(s.get("etichetta",""))}</span>{num}</div>'
            f'<div class="corpo"><div class="dentro"><h2>{t(s["titolo"])}</h2><div class="filo"></div>'
            f'<p class="testo">{t(s["testo"])}</p>{fonte}</div></div>{piede}</section>'
        )
    if tipo == "pratica":
        punti = "".join(f"<li><b>{k+1}</b><span>{t(p)}</span></li>" for k, p in enumerate(s["punti"]))
        return (
            f'<section class="slide chiara">'
            f'<div class="top"><span class="eyebrow">{t(s.get("etichetta","In pratica"))}</span>{num}</div>'
            f'<div class="corpo"><div class="dentro"><h2>{t(s["titolo"])}</h2><div class="filo"></div>'
            f'<ul class="punti">{punti}</ul></div></div>{piede}</section>'
        )
    if tipo == "chiusura":
        cta = "".join(f"<div>{t(c)}</div>" for c in s.get("cta", []))
        return (
            f'<section class="slide scura">{nodi_svg(n + 7)}'
            f'<div class="top"><span class="eyebrow">{t(s.get("etichetta","Marco Bacci"))}</span>{num}</div>'
            f'<div class="corpo"><div class="dentro"><h2>{t(s["titolo"])}</h2><div class="filo"></div>'
            f'<p class="testo">{t(s.get("testo",""))}</p><div class="cta">{cta}</div></div></div>{piede}</section>'
        )
    raise ValueError(f"Tipo di slide sconosciuto: {tipo!r} (usa copertina, novita, pratica, chiusura)")


# Riduce il testo che non entra, poi segnala le slide ancora fuori margine.
FIT_JS = """
() => {
  const problemi = [];
  document.querySelectorAll('.slide').forEach((sl, i) => {
    const corpo = sl.querySelector('.corpo');
    const dentro = sl.querySelector('.dentro');
    const cs = getComputedStyle(corpo);
    const spazio = corpo.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const testi = dentro.querySelectorAll('h1,h2,.testo,.punti li,.cta div,.fonte');
    let giri = 0;
    while (dentro.offsetHeight > spazio && giri < 12) {
      testi.forEach(el => {
        const fs = parseFloat(getComputedStyle(el).fontSize);
        el.style.fontSize = (fs * 0.96) + 'px';
      });
      giri++;
    }
    if (dentro.offsetHeight > spazio) problemi.push(i + 1);
    else if (giri > 4) problemi.push(-(i + 1));
  });
  return problemi;
}
"""


def main():
    if len(sys.argv) != 3:
        sys.exit("Uso: python3 render.py slides.json cartella_output")
    dati = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    out = Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    slides = dati["slides"]
    handle = dati.get("handle", "@marcobacci.ai")
    n = len(slides)
    corpo = "".join(slide_html(s, i, n, handle) for i, s in enumerate(slides))
    pagina = f'<!doctype html><html lang="it"><head><meta charset="utf-8"><style>{CSS.replace('{FONTS}', FONTS)}</style></head><body>{corpo}</body></html>'
    tmp = out / "_carosello.html"
    tmp.write_text(pagina, encoding="utf-8")

    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
        pg.goto(tmp.as_uri())
        pg.evaluate("document.fonts.ready")
        problemi = pg.evaluate(FIT_JS)
        for i, el in enumerate(pg.query_selector_all(".slide")):
            el.screenshot(path=str(out / f"slide-{i+1:02d}.png"))
        pg.pdf(path=str(out / "carosello.pdf"), width=f"{W}px", height=f"{H}px",
               print_background=True, margin={"top": "0", "right": "0", "bottom": "0", "left": "0"})
        b.close()
    tmp.unlink()

    fuori = [k for k in problemi if k > 0]
    ridotte = [-k for k in problemi if k < 0]
    print(f"Fatto: {n} slide PNG e carosello.pdf in {out}")
    if ridotte:
        print("Testo rimpicciolito parecchio nelle slide:", ridotte, "→ meglio accorciarlo")
    if fuori:
        print("ATTENZIONE, testo fuori margine nelle slide:", fuori, "→ accorcia il testo e rilancia")
        sys.exit(2)


if __name__ == "__main__":
    main()
