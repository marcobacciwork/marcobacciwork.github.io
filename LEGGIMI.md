# marcobacci.it

Sito vetrina statico. Jekyll su GitHub Pages, nessun backend.

---

## Struttura

```
_config.yml          Dati e link: email, telefono, P.IVA, profili social, interruttore newsletter
_data/progetti.yml   I progetti del Laboratorio, in fondo alla pagina Strumenti
_data/clienti.yml    Partner e clienti mostrati in home (logo, nome, settore)
_layouts/default     Head, meta social, struttura pagina, animazioni
_includes/           header.html (menu) · footer.html · social.html (pulsanti LinkedIn e Instagram)
assets/css/style.css Tutto il foglio di stile
assets/fonts/        Space Grotesk e Inter ospitati sul sito
assets/img/          favicon.svg · og-image.png · progetti/ (screenshot facoltativi)
assets/img/clienti/  loghi di partner e clienti (SVG o PNG trasparente)
assets/img/logo/     logo MB Ai: splash (apertura animata, orizzontale e verticale), statico (footer), animato completo

index.html           Home
servizi.html         Tre servizi + formati + domande frequenti
progetti.html        Solo rimando: /progetti/ porta a /strumenti/#laboratorio
strumenti.html       Strumenti gratuiti + Laboratorio (progetti personali)
libri.html           Libri
chi-sono.html        Storia professionale
prenota.html         Contatti: modulo «Scrivimi» (→ Google Modulo «Richieste dal sito») + calendario Cal.com
grazie.html          Dopo l'iscrizione alla newsletter: "controlla la posta e conferma"
iscrizione-confermata.html  Dopo il clic sul link di conferma nell'email
privacy.html         Bozza da far verificare
cookie-policy.html   Valida finché non aggiungi strumenti che tracciano
404.html             Pagina mostrata quando un indirizzo non esiste
```

Il sito non vende prodotti: niente shop e niente link di affiliazione, per restare
dentro i codici ATECO attuali (62.20.10 e 85.59.20, dal 20/10/2026) senza iscrizione
alla Gestione commercianti INPS. I libri si vendono su Amazon (royalties fatturate sul 62.20.10).

---

## Messa online del dominio

1. Pannello OVH → Web Cloud → Nomi di dominio → `marcobacci.it` → scheda **Zona DNS**
   - quattro record `A` su `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - un record `CNAME` su `www` → `marcobacciwork.github.io`
   - se ci sono record `A` su `@` che puntano a indirizzi OVH, cancellali
2. GitHub → repository → Settings → Pages → Custom domain: `marcobacci.it` → Save
3. Quando compare la spunta verde, attiva **Enforce HTTPS**

I progetti (WorldEconomy, CloudScanner) stanno sullo stesso account GitHub:
dopo il collegamento del dominio si aprono anche da `marcobacci.it/WorldEconomy/`.

---

## Da completare

| Dove | Cosa |
|---|---|
| `_config.yml` → `booking_url` | Il tuo link Cal.com vero. Finché l'account non esiste, il calendario in Prenota non si carica |
| `_config.yml` → `amazon_author_url` | La tua pagina autore Amazon. Finché resta PLACEHOLDER il pulsante Amazon non compare |
| `privacy.html` e `cookie-policy.html` | Far verificare a un professionista |
| `assets/img/favicon.svg` | Sostituire con la nuova icona |

---

## Come modificare

**Testo di una pagina** → apri solo quel file `.html`, il contenuto è sotto le tre trattine iniziali.

**Menu o footer** → `_includes/header.html` o `_includes/footer.html`, si aggiornano ovunque.

**Telefono, WhatsApp, email, P.IVA, profili social** → `_config.yml`, si aggiornano ovunque.

**Nuovo progetto** → in `_data/progetti.yml` copia un blocco intero e cambia i testi.
Per lo screenshot: salvalo in `assets/img/progetti/` e scrivi il nome del file nel campo `immagine`.

**Nuovo partner o cliente** → salva il logo in `assets/img/clienti/`, poi in `_data/clienti.yml`
copia un blocco e cambia nome, logo e settore. Le schede si affiancano tre per riga.
Prima di pubblicare un logo fatti dare l'ok scritto dall'azienda.

**Colori e caratteri** → le variabili in cima a `style.css`, sezione 1.
Il foglio di stile mantiene degli alias (`--navy`, `--brass`, `--ivory`) perché alcune pagine
li usano negli stili scritti nell'HTML. Non rimuoverli: puntano ai colori nuovi.

**Impaginazione (restyling di novembre 2026)** → in cima a `style.css` ci sono le variabili della griglia
(`--wrap`, `--gutter`, `--gap`, `--measure`) e i livelli tipografici (`--t-display`, `--t-page`, `--t-section`,
`--t-item`, `--t-meta`). Tutto parte dallo stesso bordo sinistro; nelle sezioni a due colonne (`.split`)
il contenuto parte a un terzo. Sullo stesso asse stanno l'elenco dei mestieri in home, il blog, i libri,
le pagine di testo (`.wrap-narrow`) e il modulo Scrivimi. L'apertura della home usa `.hero-home`,
le pagine interne la `.hero` compatta. Il logo in testata è `assets/img/logo/logo-mb-ai-testata.svg`
(il segno di `logo-mb-ai.svg` senza motto, con i colori originali: per questo la testata è scura). Per le email c'è `logo-mb-ai-email.png`, logo originale su fondo blu notte.

**Immagine per i social** → `assets/img/og-image.source.html`: screenshot 1200×630 della pagina,
salvato come `og-image.png`. Il sorgente non viene pubblicato.

---

## Scelte tecniche

- **Caratteri ospitati sul sito**: nessuna chiamata a Google Fonts, quindi nessun indirizzo IP
  comunicato a terzi per caricare le pagine. Se aggiungi font o icone da servizi esterni,
  questo vantaggio si perde.
- **Nessun cookie di profilazione e nessuna statistica**: niente banner. Se aggiungi Google
  Analytics o pixel pubblicitari servono il banner con consenso e una nuova cookie policy.
- **Pulsanti social senza loghi**: nome del profilo e freccia, nessun file esterno.
- **Modulo di contatto senza server**: il modulo «Scrivimi» in /prenota/ invia i dati al Google Modulo
  «Richieste dal sito» (`modulo_richieste` in `_config.yml`) solo al clic su Invia. Nel Google Modulo nessuna
  domanda deve essere obbligatoria. Se cambi le domande, aggiorna i codici entry.* in `_config.yml`.
- **I prezzi non compaiono** per i servizi, come da posizionamento.
- **Accessibilità**: contrasto verificato, navigazione da tastiera, `prefers-reduced-motion`
  rispettato, salto al contenuto.

## Blog

- Gli articoli stanno in `_posts/`, uno per file, con il nome `AAAA-MM-GG-parole-del-titolo.md`.
- Per scriverne uno nuovo copia `_modelli/modello-articolo.md` dentro `_posts/`, rinominalo e compila `title`, `description` e `date`.
- L'articolo compare da solo nella pagina /blog, con indirizzo `marcobacci.it/blog/parole-del-titolo/`, e nella sitemap.
- I meta per Google e per le anteprime social li genera `jekyll-seo-tag` dal titolo e dalla descrizione.

## Cartella social/

- Contiene le slide del carosello settimanale (`social/AAAA-MM-GG/slide-01.png` … e `carosello.pdf`), caricate dall'automazione della domenica.
- Servono a Metricool per pubblicare su Instagram (prende le immagini dal link) e a Marco per scaricare il PDF da pubblicare su LinkedIn.
- Non sono collegate da nessuna pagina e sono escluse dalla mappa del sito; chi ha il link esatto però le vede: metterci solo contenuti già pubblici.
- Ogni domenica l'automazione cancella le cartelle delle settimane precedenti.
