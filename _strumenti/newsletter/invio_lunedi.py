#!/usr/bin/env python3
"""Invio della newsletter del lunedì e articolo sul blog.

Lo lancia il workflow .github/workflows/newsletter-lunedi.yml.

Cosa fa, in ordine:
1. Calcola il nome della campagna della settimana: "Newsletter – 9 novembre 2026".
2. Se in Brevo c'è già una campagna inviata con quel nome, non invia nulla.
   Se c'è una BOZZA con quel nome (la prepara la revisione automatica di Claude),
   la invia subito alla lista già impostata nella bozza.
   Le bozze con un altro nome (ad esempio "BLOCCATA – ...") non vengono mai toccate.
3. Se la newsletter risulta inviata e l'articolo del blog non esiste ancora,
   scrive _posts/AAAA-MM-GG-novita-ai-settimana-G-mese-AAAA.md con lo stesso testo.
4. Se dalle 11:25 (ora di Roma) non c'è né una bozza né una campagna inviata,
   esce con errore: GitHub manda un'email di avviso al proprietario del repository.

Variabili d'ambiente:
- BREVO_API_KEY (segreto del repository, obbligatorio)
- MODALITA: "invio" (predefinita) oppure "prova" (non invia e non scrive file,
  stampa solo cosa farebbe e l'articolo che scriverebbe)
- DATA_LUNEDI: facoltativa, AAAA-MM-GG, per le prove su una settimana passata.

Solo libreria standard di Python.
"""

import datetime as dt
import html
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from zoneinfo import ZoneInfo

ROMA = ZoneInfo("Europe/Rome")
API = "https://api.brevo.com/v3"
MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio",
        "agosto", "settembre", "ottobre", "novembre", "dicembre"]
LISTA_NEWSLETTER = 3
ORA_INVIO = dt.time(9, 15)      # prima di quest'ora non invia
ORA_ALLARME = dt.time(11, 25)   # da quest'ora, se manca tutto, avvisa con un errore
REPO = Path(__file__).resolve().parents[2]


def log(msg):
    print(msg, flush=True)


# ---------------------------------------------------------------- Brevo

def brevo(metodo, percorso, corpo=None):
    chiave = os.environ.get("BREVO_API_KEY", "").strip()
    if not chiave:
        sys.exit("BREVO_API_KEY mancante: aggiungila nei segreti del repository "
                 "(Settings → Secrets and variables → Actions).")
    dati = json.dumps(corpo).encode() if corpo is not None else None
    req = urllib.request.Request(API + percorso, data=dati, method=metodo, headers={
        "api-key": chiave,
        "accept": "application/json",
        "content-type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            testo = r.read().decode() or "{}"
            return json.loads(testo)
    except urllib.error.HTTPError as e:
        sys.exit(f"Brevo ha risposto {e.code} su {metodo} {percorso}: {e.read().decode()[:500]}")


def campagne(stato):
    q = urllib.parse.urlencode({"type": "classic", "status": stato, "limit": 50,
                                "sort": "desc", "excludeHtmlContent": "true"})
    return brevo("GET", f"/emailCampaigns?{q}").get("campaigns", [])


# ------------------------------------------------- HTML → Markdown (blog)

class Paragrafi(HTMLParser):
    """Raccoglie i <p> del corpo email: testo, link e se sono tutti in grassetto."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.paragrafi, self.cur, self.href, self.dentro_p = [], None, None, 0
        self.grassetto = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "p":
            self.dentro_p += 1
            self.cur = {"pezzi": [], "stile": a.get("style") or ""}
        elif self.cur is None:
            return
        elif tag in ("strong", "b"):
            self.grassetto += 1
        elif tag == "a":
            self.href = a.get("href", "")
            self.cur["pezzi"].append(["link", "", self.href])
        elif tag == "br":
            self.cur["pezzi"].append(["testo", "\n", False])

    def handle_endtag(self, tag):
        if self.cur is None:
            return
        if tag in ("strong", "b"):
            self.grassetto -= 1
        elif tag == "a":
            self.href = None
        elif tag == "p":
            self.paragrafi.append(self.cur)
            self.cur, self.dentro_p = None, 0

    def handle_data(self, data):
        if self.cur is None:
            return
        if self.href is not None and self.cur["pezzi"] and self.cur["pezzi"][-1][0] == "link":
            self.cur["pezzi"][-1][1] += data
        else:
            self.cur["pezzi"].append(["testo", data, self.grassetto > 0])


def fonte(url):
    host = urllib.parse.urlparse(url).netloc.lower()
    if "anthropic" in host or "claude.com" in host:
        return "pagina ufficiale di Anthropic"
    if "openai" in host or "chatgpt.com" in host:
        return "pagina ufficiale di OpenAI"
    if "google" in host or "blog.google" in host:
        return "pagina ufficiale di Google"
    return host.removeprefix("www.")


def in_markdown(html_email):
    p = Paragrafi()
    p.feed(html_email)
    blocchi, fonti = [], []

    def chiudi_fonti():
        if fonti:
            blocchi.append("Fonte: " + " · ".join(f"[{fonte(u)}]({u})" for u in fonti))
            fonti.clear()

    for par in p.paragrafi:
        testo = "".join(x[1] for x in par["pezzi"]).strip()
        if not testo:
            continue
        if "font-size:12px" in par["stile"].replace(" ", "") or "Cancella l'iscrizione" in testo:
            continue  # piè di pagina
        link = [x for x in par["pezzi"] if x[0] == "link"]
        resto = "".join(x[1] for x in par["pezzi"] if x[0] != "link").strip(" ·\n")
        if link and not resto and all(x[1].strip() == x[2] for x in link):
            fonti.extend(x[2] for x in link)  # paragrafo di soli link = fonte
            continue
        chiudi_fonti()
        if re.fullmatch(r"(ciao|buongiorno)[^,]*,?", testo, re.I):
            continue
        testuali = [x for x in par["pezzi"] if x[0] == "testo" and x[1].strip()]
        if testuali and all(x[2] for x in testuali) and not link:
            titolo = re.sub(r"^\d+\.\s*", "", testo)
            blocchi.append("## " + titolo)
            continue
        if "Rispondi a questa email" in testo or "rispondi a questa email" in testo:
            blocchi.append("---")
            blocchi.append("Hai un dubbio su una di queste novità o vuoi capire se riguarda "
                           "il tuo lavoro? Scrivimi a [marco@marcobacci.it](mailto:marco@marcobacci.it).")
            continue
        m = re.match(r"(Da provare(?: questa settimana)?|Il limite da conoscere|"
                     r"Un limite da (?:sapere|conoscere|tenere presente))\s*:\s*(.+)", testo, re.S)
        if m:
            titolo = "Da provare questa settimana" if m.group(1).startswith("Da provare") \
                else "Un limite da conoscere"
            corpo = m.group(2).strip()
            blocchi.append("## " + titolo)
            blocchi.append(corpo[:1].upper() + corpo[1:])
            continue
        riga = ""
        for tipo, t, extra in par["pezzi"]:
            if tipo == "link":
                riga += t if t.strip() == extra else f"[{t}]({extra})"
            else:
                riga += t
        blocchi.append(riga.strip())
    chiudi_fonti()

    # l'apertura in email parte minuscola dopo "Ciao,": nel blog va maiuscola
    for i, b in enumerate(blocchi):
        if not b.startswith(("##", "Fonte:", "---")):
            blocchi[i] = b[:1].upper() + b[1:]
            break
    return "\n\n".join(blocchi).strip() + "\n"


def articolo(campagna, lunedi, ora):
    data_it = f"{lunedi.day} {MESI[lunedi.month - 1]} {lunedi.year}"
    oggetto = campagna.get("subject", "").strip()
    tema = re.sub(r"^Novità AI\s*:\s*", "", oggetto)
    titolo = f"Novità AI della settimana: {tema}"
    descr = (campagna.get("previewText") or "").strip()
    corpo = in_markdown(campagna.get("htmlContent", ""))
    testa = "\n".join([
        "---",
        f"title: {json.dumps(titolo, ensure_ascii=False)}",
        f"description: {json.dumps(descr, ensure_ascii=False)}",
        f"date: {ora.strftime('%Y-%m-%d %H:%M:00 %z')}",
        "categoria: novita-settimana",
        "---",
        "",
        f"*Questo articolo è la newsletter inviata il {data_it}: un riepilogo preparato con "
        "l'aiuto dell'intelligenza artificiale, a partire dalle fonti ufficiali linkate. "
        "Se vuoi riceverla ogni lunedì, puoi iscriverti in fondo alla pagina.*",
        "",
    ])
    return testa + "\n" + corpo + "\nMarco\n" if not corpo.rstrip().endswith("Marco") \
        else testa + "\n" + corpo


# ---------------------------------------------------------------- main

def main():
    prova = os.environ.get("MODALITA", "invio").strip().lower() == "prova"
    ora = dt.datetime.now(ROMA)
    if os.environ.get("DATA_LUNEDI"):
        lunedi = dt.date.fromisoformat(os.environ["DATA_LUNEDI"])
    else:
        lunedi = ora.date()
        if lunedi.weekday() != 0 and not prova:
            log("Oggi non è lunedì: niente da fare.")
            return
        if ora.time() < ORA_INVIO and not prova:
            log(f"Sono le {ora:%H:%M}: l'invio parte dalle {ORA_INVIO:%H:%M}. Esco.")
            return

    data_it = f"{lunedi.day} {MESI[lunedi.month - 1]} {lunedi.year}"
    nome = f"Newsletter – {data_it}"
    file_post = REPO / "_posts" / f"{lunedi.isoformat()}-novita-ai-settimana-{lunedi.day}-{MESI[lunedi.month - 1]}-{lunedi.year}.md"
    log(f"Campagna attesa: {nome}{' (MODALITÀ PROVA)' if prova else ''}")

    inviata = next((c for c in campagne("sent") + campagne("queued") + campagne("inProcess")
                    if c.get("name") == nome), None)
    if inviata:
        log(f"Già inviata o in invio: id {inviata['id']}.")
        cid = inviata["id"]
    else:
        bozza = next((c for c in campagne("draft") if c.get("name") == nome), None)
        if not bozza:
            if ora.time() >= ORA_ALLARME and not prova:
                sys.exit(f"ATTENZIONE: alle {ora:%H:%M} non c'è nessuna bozza '{nome}' in Brevo "
                         "e la newsletter non è partita. Controlla la notifica della revisione "
                         "automatica o il documento della settimana.")
            log("Nessuna bozza pronta per ora: riprovo al prossimo passaggio.")
            return
        cid = bozza["id"]
        dettagli = brevo("GET", f"/emailCampaigns/{cid}")
        liste = dettagli.get("recipients", {}).get("lists", [])
        if liste != [LISTA_NEWSLETTER]:
            sys.exit(f"Bozza {cid} con destinatari inattesi ({liste}): non invio. "
                     f"Deve essere solo la lista {LISTA_NEWSLETTER}.")
        if prova:
            log(f"[prova] Invierei adesso la bozza {cid}: {dettagli.get('subject')}")
        else:
            brevo("POST", f"/emailCampaigns/{cid}/sendNow")
            log(f"Inviata la bozza {cid}: {dettagli.get('subject')}")

    if file_post.exists():
        log(f"Articolo già presente: {file_post.name}")
        return
    campagna = brevo("GET", f"/emailCampaigns/{cid}")
    testo = articolo(campagna, lunedi, ora)
    if prova:
        log(f"[prova] Scriverei {file_post.relative_to(REPO)}:\n\n{testo}")
        return
    file_post.write_text(testo, encoding="utf-8")
    log(f"Scritto {file_post.relative_to(REPO)}")


if __name__ == "__main__":
    main()
