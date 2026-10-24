# Tokenometro

Simulatore gratuito dei costi, dei token e dei consumi stimati (energia, CO2, acqua) dei modelli Claude.
Sito statico pubblicato su **https://marcobacci.it/tokenometro/** tramite GitHub Pages.

- Nessun backend, nessun cookie, nessuna memoria nel browser, nessuna chiamata API.
- Caratteri, logo e script sono tutti nel repository: la pagina non carica nulla da CDN.
- L'unico servizio esterno è Brevo, e solo quando qualcuno invia il modulo email.
- Lo stato dello scenario vive nell'indirizzo della pagina, quindi ogni scenario si può condividere.

## Struttura

```
index.html                 lo strumento
metodo.html                formule, ipotesi, fonti e limiti (i numeri arrivano da parametri.json)
data/parametri.json        TUTTI i numeri: prezzi, modelli, stime, scenari, cambio
assets/js/config.js        link e contatti da modificare a mano (Cal.com, Brevo)
assets/js/calcolo.js       le formule
assets/js/app.js           l'interfaccia dello strumento
assets/js/metodo.js        la pagina Metodo
assets/css/stile.css       stile (stesso sistema di marcobacci.it) + CSS di stampa per il report PDF
assets/fonts/              Inter e Space Grotesk (licenza OFL, file inclusi)
assets/img/                logo, favicon, immagine di anteprima og-tokenometro.png
strumenti/misura_token.py  misura i token della "Tassa dell'italiano" con l'API ufficiale
strumenti/anteprima.source.html  sorgente dell'immagine di anteprima
.nojekyll                  dice a GitHub Pages di pubblicare i file così come sono
```

## Pubblicazione

1. Su GitHub, con l'account del sito (`marcobacciwork`), crea un repository **pubblico** chiamato esattamente `tokenometro`.
2. Carica tutti i file di questa cartella, compreso `.nojekyll`.
   Dal browser i file che iniziano col punto non si vedono: se usi "Upload files", trascina la cartella intera.
3. **Settings → Pages → Build and deployment**: Source "Deploy from a branch", Branch `main`, cartella `/ (root)`, Save.
4. Dopo 1-2 minuti lo strumento è su `https://marcobacci.it/tokenometro/`.
   Non serve un file CNAME: il dominio arriva dal sito principale (`marcobacciwork.github.io`).
5. Sul sito principale metti il Tokenometro "online" in `_data/strumenti.yml` (vedi la cartella `per-il-sito`, se ce l'hai).

Tutti i percorsi interni sono relativi, quindi lo strumento funziona anche in una sottocartella.
Gli unici URL assoluti sono quelli obbligatori: indirizzo canonico, immagine di anteprima e link verso marcobacci.it.

## Da completare prima del lancio

Tutto in `assets/js/config.js`:

| Segnaposto | Cosa incollare | Finché non lo fai |
|---|---|---|
| `brevoFormUrl` | l'indirizzo `action` del modulo Brevo (vedi sotto) | il modulo si apre ma dice "non ancora collegato" |

Statistiche senza cookie: in `index.html` e `metodo.html` c'è un segnaposto commentato nel `<head>`.
Se le attivi, aggiorna privacy e cookie policy del sito (oggi dicono che non usi statistiche).

## Modulo Brevo "Ricevi il link al tuo scenario"

Il modulo è **HTML semplice**, come quello della newsletter del sito: nessuno script di Brevo, nessun reCAPTCHA.
Viene inviato a Brevo dentro un riquadro nascosto, così la pagina dello strumento resta aperta.

Il generatore di moduli di Brevo non ha un campo "nascosto". La soluzione: crei i campi normalmente in Brevo
e nel nostro HTML li mandiamo nascosti, con i valori scritti dallo strumento.

In Brevo:

1. **Contatti → Impostazioni → Attributi**: crea
   - `SCENARIO_URL` (Testo)
   - `FONTE` (Testo)
   - `AGGIORNAMENTI` (Booleano)
2. **Contatti → Liste**: crea la lista `Tokenometro`.
3. **Moduli → Crea modulo** "Tokenometro", lista `Tokenometro`, con questi campi:
   `EMAIL`, `SCENARIO_URL`, `FONTE`, `AGGIORNAMENTI`. Non aggiungere captcha né il blocco GDPR di Brevo
   (le caselle di consenso sono già nel nostro HTML).
4. **Conferma**: attiva la **doppia conferma (double opt-in)**. Come pagina dopo la conferma usa
   `https://marcobacci.it/tokenometro/?confermato=1`.
5. **Condividi → Codice HTML semplice**: copia solo il valore di `action="https://….sibforms.com/serve/…"`
   e incollalo in `brevoFormUrl`.
6. **Automazioni**: quando un contatto entra nella lista `Tokenometro`, invia un'email con il link
   `{{ contact.SCENARIO_URL }}`. Se `AGGIORNAMENTI` è vero, aggiungilo anche alla lista per gli aggiornamenti.
7. Fai una prova con il tuo indirizzo e controlla nel contatto che `SCENARIO_URL` e `FONTE` siano compilati.
   Se restano vuoti, scrivimelo: l'alternativa è un'automazione Make che riceve il modulo e crea il contatto.

## Indirizzi che precompilano lo strumento

```
https://marcobacci.it/tokenometro/?scenario=contratti&modello=claude-opus-5-5&richieste=5&modo=semplice
```

| Parametro | Valori |
|---|---|
| `scenario` | `email`, `pdf`, `chatbot`, `contratti`, `agente-codice` |
| `modello` | un id di `parametri.json`, es. `claude-sonnet-5-5` (va bene anche senza data finale) |
| `richieste` | richieste al giorno (0–1.000.000) |
| `giorni` | giorni lavorativi al mese (1–31, predefinito 22) |
| `modo` | `semplice` o `tecnico` |
| `cache` | `1` o `0` (predefinito 1) |
| `batch` | `1` o `0` (predefinito 0) |
| `rete` | `usa` o `italia` |
| `in`, `out` | token in ingresso e in uscita per richiesta |
| `cl`, `cs` | percentuale letta / scritta in cache |
| `chiamate` | chiamate al modello per richiesta |
| `mostra=tutti` | mostra anche i modelli precedenti |
| `metrica=energia` | confronto per energia invece che per costo |

Parametri sconosciuti o sbagliati (compresi `utm_*`) vengono ignorati senza errori.
Il pulsante "Condividi su LinkedIn" aggiunge `utm_source=linkedin&utm_medium=condivisione`.
I link dallo strumento al sito portano `utm_source=tokenometro&utm_medium=strumento`.

Dopo l'invio del modulo o la conferma, `?inviato=1` e `?confermato=1` mostrano un messaggio in alto.

## Aggiornare `data/parametri.json`

Regola fondamentale: **ogni numero sta in questo file**, con `valore`, `unita`, `fonte` (URL),
`data_verifica`, `tipo` (`ufficiale` | `stima nostra` | `stima di terzi`) e `fiducia` (`alta` | `media` | `bassa`).
Le pagine si aggiornano da sole.

Ogni volta che lo modifichi:

1. aggiorna `meta.ultimo_aggiornamento` e `meta.versione_dati` (AAAA-MM-GG): la data compare nel piè di pagina;
2. aggiorna `data_verifica` dei valori che hai controllato;
3. controlla che il file sia valido incollandolo in un validatore JSON
   (oppure `python3 -m json.tool data/parametri.json`): una virgola sbagliata blocca lo strumento;
4. apri lo strumento e la pagina Metodo e verifica che non compaiano errori.

Casi tipici:

- **Prezzi**: solo dalla pagina ufficiale https://platform.claude.com/docs/en/about-claude/pricing.
  Cambia `modelli[].prezzi.*.valore`. Le regole (cache 1,25× / 2× / 0,1×, batch 0,5×) stanno in `regole_prezzo`.
- **Nuovo modello**: copia un blocco in `modelli`, cambia `id`, `nome`, prezzi, `contesto_max`, `output_max`, `tokenizer`.
  `in_evidenza: true` lo mette tra i modelli attuali (tienine al massimo 4-5).
- **Modello ritirato**: togli il blocco da `modelli` e aggiungilo a `modelli_esclusi` con il motivo.
  Da controllare: Claude Sonnet 4.5 si ritira il 30/11/2026; Claude Opus 4.5 "non prima del 24/11/2026".
- **Cambio BCE**: `cambio.usd_per_eur.valore` e `cambio.data_riferimento`
  (https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-usd.it.html).
- **Stime energia, CO2, acqua**: cambiale solo con una fonte primaria e aggiorna nota, tipo e fiducia.
  Il blocco `energia.coefficienti_wh_per_token` è solo per controllo: lo strumento ricalcola da solo.

### Tassa dell'italiano

La scheda compare solo quando in `tassa_italiano.misure` ci sono conteggi salvati. Per misurarli (gratis):

```
export ANTHROPIC_API_KEY="la-tua-chiave"
python3 strumenti/misura_token.py
```

Lo script scrive i numeri in `parametri.json`. La chiave resta sul tuo computer: non va mai nel browser né nel repository.

## Immagine di anteprima

`assets/img/og-tokenometro.png` (1200×630) nasce da `strumenti/anteprima.source.html`.
Per rifarla: apri il file con il server locale, finestra 1200×630, screenshot.
Dopo aver cambiato l'immagine, ripassa il link nel LinkedIn Post Inspector per aggiornare la cache.

## Prova in locale

```
python3 -m http.server 8000
```

poi apri `http://localhost:8000/`. Serve un server: aprendo `index.html` con doppio clic i dati non si caricano.

---

Progetto indipendente, non affiliato ad Anthropic. Energia, CO2 e acqua sono stime.
