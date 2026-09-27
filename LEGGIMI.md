# marcobacci.it

Sito vetrina statico. Jekyll su GitHub Pages, nessun backend.

---

## Struttura

```
_config.yml          Dati e link: email, telefono, P.IVA, profili social, interruttore guida
_data/progetti.yml   I progetti mostrati nella pagina Progetti e in home
_layouts/default     Head, meta social, struttura pagina, animazioni
_includes/           header.html (menu) · footer.html · social.html (pulsanti LinkedIn e Instagram)
assets/css/style.css Tutto il foglio di stile
assets/fonts/        Space Grotesk e Inter ospitati sul sito
assets/img/          favicon.svg · og-image.png · progetti/ (screenshot facoltativi)

index.html           Home
servizi.html         Tre servizi + formati + domande frequenti
progetti.html        Cosa ho costruito
libri.html           Libri
chi-sono.html        Storia professionale
prenota.html         Calendario Cal.com incorporato
grazie.html          Atterraggio dopo l'iscrizione alla guida (serve quando la guida è attiva)
privacy.html         Bozza da far verificare
cookie-policy.html   Valida finché non aggiungi strumenti che tracciano
404.html             Pagina mostrata quando un indirizzo non esiste
```

Il sito non vende prodotti: niente shop e niente link di affiliazione, per restare
dentro i codici ATECO attuali (62.20.10 e 90.11.09) senza iscrizione alla Gestione
commercianti INPS. I libri si vendono su Amazon.

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
| `_config.yml` → `newsletter_attiva` | Metti `true` quando il PDF della guida esiste e il modulo Brevo è collegato |
| `index.html` | Cerca `INSERIRE_URL_MODULO_BREVO` e sostituisci con l'action del modulo Brevo |
| `privacy.html` e `cookie-policy.html` | Far verificare a un professionista |
| `assets/img/favicon.svg` | Sostituire con la nuova icona |

---

## Come modificare

**Testo di una pagina** → apri solo quel file `.html`, il contenuto è sotto le tre trattine iniziali.

**Menu o footer** → `_includes/header.html` o `_includes/footer.html`, si aggiornano ovunque.

**Telefono, email, P.IVA, profili social** → `_config.yml`, si aggiornano ovunque.

**Nuovo progetto** → in `_data/progetti.yml` copia un blocco intero e cambia i testi.
Per lo screenshot: salvalo in `assets/img/progetti/` e scrivi il nome del file nel campo `immagine`.

**Colori e caratteri** → le variabili in cima a `style.css`, sezione 1.
Il foglio di stile mantiene degli alias (`--navy`, `--brass`, `--ivory`) perché alcune pagine
li usano negli stili scritti nell'HTML. Non rimuoverli: puntano ai colori nuovi.

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
- **Nessun modulo di contatto**: GitHub Pages è statico. Ci sono email, telefono e prenotazione.
- **I prezzi non compaiono** per i servizi, come da posizionamento.
- **Accessibilità**: contrasto verificato, navigazione da tastiera, `prefers-reduced-motion`
  rispettato, salto al contenuto.
