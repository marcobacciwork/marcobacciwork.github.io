/* Tokenometro — motore di calcolo.
   Tutti i numeri arrivano da data/parametri.json: qui ci sono solo le formule.
   Le stesse formule sono spiegate in metodo.html. */

export const LIVELLI = ["min", "centrale", "max"];

export async function caricaParametri(url = "data/parametri.json") {
  const risposta = await fetch(url, { cache: "no-cache" });
  if (!risposta.ok) throw new Error(`Impossibile leggere ${url} (${risposta.status})`);
  return risposta.json();
}

const v = (dato) => (dato && typeof dato === "object" && "valore" in dato ? dato.valore : dato);

export function modelloPerId(P, id) {
  return P.modelli.find((m) => m.id === id);
}

export function scenarioPerId(P, id) {
  return P.scenari.find((s) => s.id === id);
}

/* Coefficienti energetici per un livello (min / centrale / max). */
export function coefficienti(P, livello) {
  const E = P.energia;
  const tinRif = v(E.richiesta_di_riferimento.token_input);
  const toutRif = v(E.richiesta_di_riferimento.token_output);
  const eRif = v(E.energia_it_richiesta_riferimento[livello]);
  const r = v(E.rapporto_input_su_output[livello]);
  const eOut = eRif / (toutRif + r * tinRif); // Wh per token in uscita (energia dei server)
  const eIn = r * eOut; // Wh per token in ingresso
  return {
    eOut,
    eIn,
    kCacheScrittura: v(E.rapporto_cache_scrittura_su_input[livello]),
    kCacheLettura: v(E.rapporto_cache_lettura_su_input[livello]),
    pue: v(E.pue[livello]),
    wue: v(P.acqua.wue_raffreddamento[livello]),
    acquaElettrica: v(P.acqua.acqua_produzione_elettrica.usa[livello]),
  };
}

/* Fattore modello: prezzo input del modello / prezzo input del modello di riferimento (fascia base). */
export function fattoreModello(P, modello) {
  const rif = modelloPerId(P, P.energia.modello_riferimento);
  return v(modello.prezzi.input) / v(rif.prezzi.input);
}

/*
  Calcola una richiesta.
  ingresso = { tokenInput, tokenOutput, quotaCacheLettura, quotaCacheScrittura, chiamate }
  opzioni  = { cache: bool, batch: bool, rete: "usa" | "italia" }
  I token dello scenario sono espressi nel tokenizer nuovo: per i modelli col tokenizer
  precedente si dividono per il fattore ufficiale (circa 1,30).
*/
export function calcolaRichiesta(P, modello, ingresso, opzioni) {
  const fattTok = modello.tokenizer === "precedente" ? v(P.regole_prezzo.tokenizer_nuovo_fattore) : 1;
  const tin = ingresso.tokenInput / fattTok;
  const tout = ingresso.tokenOutput / fattTok;
  const qL = opzioni.cache ? ingresso.quotaCacheLettura : 0;
  const qS = opzioni.cache ? ingresso.quotaCacheScrittura : 0;
  const token = {
    cacheLettura: tin * qL,
    cacheScrittura: tin * qS,
    input: tin * (1 - qL - qS),
    output: tout,
  };
  token.totale = token.input + token.cacheLettura + token.cacheScrittura + token.output;

  // Prezzi: fascia per prompt lunghi (solo Haiku 5.5) se il prompt di una chiamata supera la soglia
  let prezzi = modello.prezzi;
  let fasciaLunga = false;
  const lunghi = modello.prezzi_prompt_lunghi;
  const chiamate = Math.max(1, ingresso.chiamate || 1);
  if (lunghi && tin / chiamate > v(lunghi.soglia_token_prompt)) {
    prezzi = lunghi;
    fasciaLunga = true;
  }
  const sconto = opzioni.batch ? v(P.regole_prezzo.batch_moltiplicatore) : 1;
  const mtok = (n, prezzo) => (n * v(prezzo)) / 1e6;
  const usd = {
    input: mtok(token.input, prezzi.input) * sconto,
    output: mtok(token.output, prezzi.output) * sconto,
    cacheScrittura: mtok(token.cacheScrittura, prezzi.cache_scrittura_5m) * sconto,
    cacheLettura: mtok(token.cacheLettura, prezzi.cache_lettura) * sconto,
  };
  usd.totale = usd.input + usd.output + usd.cacheScrittura + usd.cacheLettura;
  const cambio = v(P.cambio.usd_per_eur);
  const eur = Object.fromEntries(Object.entries(usd).map(([k, x]) => [k, x / cambio]));

  // Energia, CO2 e acqua per livello
  const F = fattoreModello(P, modello);
  const fattBatch = opzioni.batch ? v(P.energia.batch_fattore_energia) : 1;
  const intensita = v(P.co2[opzioni.rete === "italia" ? "italia" : "usa"]);
  const energiaServer = {}, energia = {}, co2 = {}, acqua = {};
  for (const L of LIVELLI) {
    const c = coefficienti(P, L);
    const whServer =
      (token.output * c.eOut +
        token.input * c.eIn +
        token.cacheScrittura * c.eIn * c.kCacheScrittura +
        token.cacheLettura * c.eIn * c.kCacheLettura) *
      F * fattBatch;
    const whTotale = whServer * c.pue;
    energiaServer[L] = whServer;
    energia[L] = whTotale; // Wh
    co2[L] = (whTotale / 1000) * intensita; // g
    acqua[L] = (whServer / 1000) * c.wue * 1000 + (whTotale / 1000) * c.acquaElettrica * 1000; // mL
  }
  return { token, usd, eur, energiaServer, energia, co2, acqua, fasciaLunga, fattoreModello: F, fattoreTokenizer: fattTok };
}

/* Moltiplica una richiesta per i volumi: giorno, mese, anno. */
export function scala(risultato, richiesteGiorno, giorniMese, mesiAnno = 12) {
  const fattori = {
    richiesta: 1,
    giorno: richiesteGiorno,
    mese: richiesteGiorno * giorniMese,
    anno: richiesteGiorno * giorniMese * mesiAnno,
  };
  const per = (obj, f) => Object.fromEntries(Object.entries(obj).map(([k, x]) => [k, x * f]));
  const out = {};
  for (const [periodo, f] of Object.entries(fattori)) {
    out[periodo] = {
      token: per(risultato.token, f),
      usd: per(risultato.usd, f),
      eur: per(risultato.eur, f),
      energia: per(risultato.energia, f),
      co2: per(risultato.co2, f),
      acqua: per(risultato.acqua, f),
    };
  }
  return out;
}

/* "Tassa dell'italiano": disponibile solo se ci sono misure salvate. */
export function misureTassa(P) {
  const t = P.tassa_italiano;
  if (!t || !Array.isArray(t.misure)) return [];
  return t.misure.filter((m) => Number.isFinite(m.token_it_netti) && Number.isFinite(m.token_en_netti));
}
