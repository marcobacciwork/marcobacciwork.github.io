#!/usr/bin/env python3
"""
Misura i token dei testi della "Tassa dell'italiano" con l'API ufficiale di Anthropic
(POST /v1/messages/count_tokens) e li scrive in data/parametri.json.

Uso (in locale, MAI nel browser):
    export ANTHROPIC_API_KEY="la-tua-chiave"
    python3 strumenti/misura_token.py

Il conteggio dei token è gratuito (ha solo un limite di richieste al minuto).
Lo script usa solo la libreria standard di Python: non serve installare nulla.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

ENDPOINT = "https://api.anthropic.com/v1/messages/count_tokens"
API_VERSION = "2026-10-21"  # come nell'esempio della documentazione ufficiale
FILE_DATI = Path(__file__).resolve().parent.parent / "data" / "parametri.json"


def conta(chiave: str, modello: str, testo: str) -> int:
    corpo = json.dumps({
        "model": modello,
        "messages": [{"role": "user", "content": testo}],
    }).encode("utf-8")
    intestazioni_base = {"content-type": "application/json", "anthropic-version": API_VERSION}
    # La documentazione usa "Authorization: Bearer"; se la chiave viene rifiutata riprova con "x-api-key".
    for auth in ({"authorization": f"Bearer {chiave}"}, {"x-api-key": chiave}):
        req = urllib.request.Request(ENDPOINT, data=corpo, method="POST",
                                     headers={**intestazioni_base, **auth})
        try:
            with urllib.request.urlopen(req, timeout=30) as risposta:
                return int(json.load(risposta)["input_tokens"])
        except urllib.error.HTTPError as errore:
            if errore.code == 401:
                continue
            dettaglio = errore.read().decode("utf-8", "replace")[:300]
            raise RuntimeError(f"{modello}: errore HTTP {errore.code} – {dettaglio}") from None
    raise RuntimeError("Chiave API rifiutata (401). Controlla ANTHROPIC_API_KEY.")


def main() -> int:
    chiave = os.environ.get("ANTHROPIC_API_KEY")
    if not chiave:
        print("Imposta prima la variabile ANTHROPIC_API_KEY.", file=sys.stderr)
        return 1

    dati = json.loads(FILE_DATI.read_text(encoding="utf-8"))
    tassa = dati["tassa_italiano"]
    oggi = date.today().isoformat()
    errori = 0

    for misura in tassa["misure"]:
        modello = misura["modello"]
        try:
            overhead = conta(chiave, modello, ".")
            tok_it = conta(chiave, modello, tassa["testo_it"])
            tok_en = conta(chiave, modello, tassa["testo_en"])
        except RuntimeError as e:
            print(f"  ✗ {e}", file=sys.stderr)
            errori += 1
            continue
        misura.update({
            "token_it": tok_it,
            "token_en": tok_en,
            "overhead_messaggio": overhead,
            # il messaggio minimo "." conta 1 token di testo: lo riaggiungiamo
            "token_it_netti": tok_it - overhead + 1,
            "token_en_netti": tok_en - overhead + 1,
            "data_misura": oggi,
        })
        diff = (misura["token_it_netti"] / misura["token_en_netti"] - 1) * 100
        print(f"  ✓ {modello:28s} IT {misura['token_it_netti']:4d}  EN {misura['token_en_netti']:4d}  (+{diff:.0f}%)")
        time.sleep(0.3)

    tassa["stato"] = "misurato" if errori == 0 else f"misurato con {errori} errori"
    FILE_DATI.write_text(json.dumps(dati, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nAggiornato {FILE_DATI}")
    return 0 if errori == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
