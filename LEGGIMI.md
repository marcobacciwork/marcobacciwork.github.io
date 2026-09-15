# marcobacci.it

Sito vetrina statico. Jekyll su GitHub Pages, nessun backend.

---

## Struttura

```
_config.yml          Link esterni e dati legali (unico punto da modificare)
_layouts/default     Head, meta social, struttura pagina
_includes/           header.html · footer.html
assets/css/style.css Tutto il foglio di stile
assets/fonts/        Space Grotesk e Inter ospitati sul sito
assets/img/          favicon.svg · og-image.png

index.html           Home — solo B2B
servizi.html         Tre ambiti + quattro formati + domande frequenti
prenota.html         Calendario Cal.com incorporato
libri.html           Quattro libri con link Amazon
risorse.html         Lead magnet in alto + catalogo Gumroad
toolbox.html         Strumenti con link di affiliazione
chi-sono.html        Storia professionale
grazie.html          Atterraggio dopo l'iscrizione
eolo.html            Progetto parallelo (solo dal footer)
privacy.html         Da completare e far verificare
cookie-policy.html   Valido finché non aggiungi strumenti che tracciano
404.html
```

Lo shop è nel menu sotto la voce **Risorse**. La home non contiene prodotti
a basso prezzo: chi arriva vede solo consulenza. Eolo e i progetti personali
stanno nella colonna "Dietro le quinte" del footer.

---

## Messa online

1. Crea un repository pubblico su GitHub e carica questi file nella radice
2. Impostazioni → Pages → Source: `Deploy from a branch` → `main` / `root`
3. Nel pannello del dominio, punta il DNS a GitHub:
   - quattro record `A` per la radice: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - un record `CNAME` per `www` → `tuo-utente.github.io`
4. Impostazioni → Pages → Custom domain: `marcobacci.it`, poi spunta **Enforce HTTPS**

Il file `CNAME` è già presente. La propagazione del dominio richiede fino a 24 ore.

---

## Da compilare prima di pubblicare

### In `_config.yml`
| Voce | Cosa mettere |
|---|---|
| `booking_url` | Il tuo link Cal.com |
| `gumroad_url` | Il tuo negozio Gumroad |
| `amazon_author_url` | La tua pagina autore Amazon |
| `linkedin_url` · `instagram_url` | I profili |
| `legal.piva` · `legal.pec` | All'apertura della partita IVA |
| `author.email` | L'indirizzo che vuoi pubblicare |

### Nei file
| Dove | Cosa |
|---|---|
| `index.html` e `risorse.html` | Cerca `INSERIRE_URL_MODULO_BREVO` e sostituisci con l'action del modulo Brevo (due occorrenze) |
| `toolbox.html` | Sostituisci gli `href="#"` con i link di affiliazione |
| `privacy.html` | Le parti tra parentesi quadre, poi far verificare |
| `cookie-policy.html` | La data di aggiornamento |

### Immagine social
`assets/img/og-image.png` è una versione provvisoria generata con font di sistema.
Rendi `assets/img/og-image.source.html` a 1200×630 con la tua pipeline Playwright
per ottenere la versione con Space Grotesk e sovrascrivi il PNG.

---

## Come modificare

**Testo di una pagina** → apri solo quel file `.html`, il contenuto è sotto le tre trattine iniziali.

**Menu o footer** → `_includes/header.html` o `_includes/footer.html`, si aggiornano ovunque.

**Colori e caratteri** → le variabili in cima a `style.css`, sezione 1. Cambia `--accent`
e cambia ogni pulsante, link e dettaglio del sito.

Il foglio di stile mantiene degli alias (`--navy`, `--brass`, `--ivory`) perché alcune pagine
li usano in stili scritti direttamente nell'HTML. Non rimuoverli: puntano ai nuovi colori.

**Nuovo prodotto nello shop** → duplica un blocco `<a class="card">` in `risorse.html`.

---

## Scelte tecniche

- **Caratteri ospitati sul sito**: nessuna chiamata a Google Fonts, quindi nessun indirizzo IP
  comunicato a terzi solo per caricare le pagine. È una scelta di conformità, non estetica:
  in Germania un tribunale ha condannato un sito proprio per la chiamata a Google Fonts.
  Se aggiungi font o icone da servizi esterni, quel vantaggio si perde.
- **Nessun cookie di profilazione**: niente banner da chiudere. Se aggiungi Google Analytics
  o pixel pubblicitari, serve il banner con consenso e la cookie policy va riscritta.
  Per le statistiche usa uno strumento senza cookie.
- **Nessun modulo di contatto**: GitHub Pages è statico e non invia email. In "Chi sono"
  ci sono email diretta e pulsante di prenotazione. Se vuoi un modulo vero serve un servizio
  esterno tipo Formspree.
- **I prezzi non compaiono** per i servizi, come da posizionamento. Compaiono solo nello shop,
  dove sono un dato di fatto.
- **Accessibilità**: contrasto verificato, navigazione da tastiera, `prefers-reduced-motion`
  rispettato, salto al contenuto.
