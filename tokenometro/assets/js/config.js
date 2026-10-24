/* ==========================================================================
   Tokenometro — impostazioni da modificare a mano
   Qui ci sono solo link e contatti. I numeri dei calcoli stanno in data/parametri.json.
   ========================================================================== */

export const CONFIG = {
  // Indirizzo pubblico dello strumento (serve per i link da copiare e condividere)
  urlStrumento: "https://marcobacci.it/tokenometro/",

  // Sito principale
  sito: "https://marcobacci.it/",
  strumenti: "https://marcobacci.it/strumenti/",
  privacy: "https://marcobacci.it/privacy/",
  prenota: "https://marcobacci.it/prenota/",

  // Parametri aggiunti a tutti i link verso marcobacci.it
  utm: { utm_source: "tokenometro", utm_medium: "strumento" },

  // Parametri aggiunti al link condiviso con il pulsante "Condividi su LinkedIn"
  utmCondivisione: { utm_source: "linkedin", utm_medium: "condivisione" },

  // >>> SEGNAPOSTO — Indirizzo del modulo Brevo "Tokenometro" (versione HTML semplice).
  //     In Brevo: Moduli → il tuo modulo → Condividi → "Codice HTML semplice":
  //     copia solo il valore di action="https://….sibforms.com/serve/…" e incollalo qui.
  //     Nessuno script di Brevo viene caricato: il modulo è HTML puro, come quello della newsletter del sito.
  brevoFormUrl: "INCOLLA-QUI-L-INDIRIZZO-DEL-MODULO-BREVO",

  // Contatti mostrati nel report PDF
  contatti: {
    nome: "Marco Bacci",
    ruolo: "Consulenza e formazione AI per studi professionali e imprese",
    email: "marco@marcobacci.it",
    telefono: "+39 352 295 7889",
    sito: "marcobacci.it",
    linkedin: "linkedin.com/in/marcobacci94",
  },
};
