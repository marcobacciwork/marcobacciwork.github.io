# Newsletter del lunedì: come parte

1. **Domenica 8:52** – Claude scrive il documento "Contenuti AI – settimana del …" (attività programmata).
2. **Lunedì 8:47** (secondo tentativo alle 10:47) – Claude rivede il testo sulle fonti e crea in Brevo la **bozza** "Newsletter – 9 novembre 2026" (nome esatto, con il trattino lungo). Il collegamento Claude–Brevo può solo creare bozze, non inviare.
3. **Lunedì dalle 9:15** – il workflow `.github/workflows/newsletter-lunedi.yml` trova la bozza con quel nome, la **invia** alla lista Newsletter (id 3) e pubblica lo stesso testo sul blog.

## Come fermare un invio
- Prima delle 8:45: `STATO: BLOCCATO` nella prima riga del documento della settimana.
- Dopo: in Brevo rinomina la bozza (es. "BLOCCATA – …") o cancellala. Il workflow invia solo una bozza con il nome esatto.

## Se qualcosa non parte
- Dalle 11:30 (ora di Roma), se non c'è né la bozza né una campagna inviata, il workflow fallisce e GitHub manda un'email a Marco.
- Prova a mano: GitHub → Actions → "Newsletter del lunedì" → Run workflow → modalità `prova` (non invia nulla, mostra cosa farebbe).

## Requisito
Segreto del repository `BREVO_API_KEY` (Settings → Secrets and variables → Actions). La chiave si crea in Brevo → SMTP e API → Chiavi API. Non va mai scritta in un file o in una chat.
