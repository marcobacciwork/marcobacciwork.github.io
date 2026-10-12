# Carosello settimanale "Le principali novità AI della settimana"

Questa cartella non viene pubblicata sul sito (inizia con `_`). Serve all'attività programmata della domenica per impaginare il carosello con una grafica sempre uguale.

## Come si usa

```
python3 render.py slides.json cartella_output
```

Crea `slide-01.png`, `slide-02.png`, … (1080×1350, per Instagram) e `carosello.pdf` (per LinkedIn, da caricare come documento).

Serve Playwright con Chromium. I caratteri (DM Serif Display, DM Sans, licenza OFL) sono nella cartella `fonts/`, quindi non serve internet.

## Il file slides.json

Vedi `esempio.json`. Quattro tipi di slide:

| tipo | campi | uso |
|---|---|---|
| `copertina` | `etichetta`, `titolo`, `testo` | prima slide, con la settimana nell'etichetta |
| `novita` | `etichetta` (es. "Claude · 14 ottobre"), `titolo`, `testo` (max 30-40 parole), `fonte` (facoltativa) | una novità per slide |
| `pratica` | `titolo`, `punti` (2-3 frasi brevi) | penultima slide |
| `chiusura` | `titolo`, `testo`, `cta` (righe brevi) | ultima slide |

Una parola tra asterischi (`*settimana*`) diventa corsiva in ottone. Usarla al massimo una volta per titolo.

## Controlli

- Se lo script scrive "Testo rimpicciolito parecchio", accorcia il testo di quelle slide e rilancia.
- Se scrive "testo fuori margine" ed esce con errore, il testo è troppo lungo: va accorciato.
- La grafica (colori, caratteri, impaginazione) non si cambia da qui: si cambiano solo i testi.
