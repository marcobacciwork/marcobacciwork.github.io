/* Tokenometro — interfaccia.
   Nessun cookie, nessuna memoria nel browser, nessuna chiamata esterna:
   l'unico file caricato è data/parametri.json. Lo stato vive nell'indirizzo della pagina. */

import { CONFIG } from "./config.js";
import {
  LIVELLI, caricaParametri, modelloPerId, scenarioPerId, calcolaRichiesta, scala,
  coefficienti, fattoreModello, misureTassa,
} from "./calcolo.js";

const $ = (sel) => document.querySelector(sel);
const v = (d) => (d && typeof d === "object" && "valore" in d ? d.valore : d);
const LOCALE = "it-IT";

let P = null;
const stato = {
  scenario: null, modello: null, richieste: 0, giorni: 22, modo: "semplice",
  cache: true, batch: false, rete: "usa",
  tin: 0, tout: 0, ql: 0, qs: 0, chiamate: 1,
  mostraPrecedenti: false, metrica: "costo",
};
let ultimo = null; // ultimo calcolo, per report ed esportazioni

/* ---------------- Formattazione ---------------- */

const nf = (opts) => new Intl.NumberFormat(LOCALE, opts);
function numero(x, dec = 0) { return nf({ maximumFractionDigits: dec, minimumFractionDigits: 0 }).format(x); }
function sig(x, n = 3) {
  if (x === 0) return "0";
  if (Math.abs(x) >= 10 ** n) return numero(x, 0);
  return nf({ maximumSignificantDigits: n }).format(x);
}
function euro(x, preciso = false) {
  if (!Number.isFinite(x)) return "–";
  if (x === 0) return "0 €";
  if (x < 0.01) return nf({ style: "currency", currency: "EUR", maximumSignificantDigits: preciso ? 3 : 2 }).format(x);
  if (preciso && x < 1) return nf({ style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumSignificantDigits: 3 }).format(x);
  if (x < 100 || preciso) return nf({ style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x);
  return nf({ style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(x);
}
function dollari(x, preciso = false) {
  if (!Number.isFinite(x)) return "–";
  if (x === 0) return "0 $";
  const base = { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol" };
  if (x < 0.01) return nf({ ...base, maximumSignificantDigits: preciso ? 3 : 2 }).format(x);
  if (x < 100 || preciso) return nf({ ...base, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x);
  return nf({ ...base, maximumFractionDigits: 0 }).format(x);
}
function token(x) {
  if (x >= 1e9) { const n = x / 1e9; return `${sig(n, 3)} ${n < 1.995 && sig(n, 3) === "1" ? "miliardo" : "miliardi"}`; }
  if (x >= 1e6) { const n = x / 1e6; return `${sig(n, 3)} ${sig(n, 3) === "1" ? "milione" : "milioni"}`; }
  return numero(Math.round(x));
}
function energia(wh) {
  if (wh >= 1e6) return `${sig(wh / 1e6)} MWh`;
  if (wh >= 1000) return `${sig(wh / 1000)} kWh`;
  return `${sig(wh)} Wh`;
}
function co2(g) {
  if (g >= 1e6) return `${sig(g / 1e6)} t`;
  if (g >= 1000) return `${sig(g / 1000)} kg`;
  return `${sig(g)} g`;
}
function acqua(ml) {
  if (ml >= 1000) return `${sig(ml / 1000)} litri`;
  return `${sig(ml)} ml`;
}
function dataIt(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(LOCALE, { day: "numeric", month: "long", year: "numeric" });
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------------- Link ---------------- */

function conUtm(url, utm = CONFIG.utm) {
  const u = new URL(url);
  for (const [k, val] of Object.entries(utm)) u.searchParams.set(k, val);
  return u.toString();
}
function linkPrenota() { return conUtm(CONFIG.prenota); }
function parametriScenario() {
  const s = scenarioPerId(P, stato.scenario);
  const p = new URLSearchParams();
  p.set("scenario", stato.scenario.replace(/_/g, "-"));
  p.set("modello", stato.modello);
  p.set("richieste", String(stato.richieste));
  if (stato.giorni !== v(P.volumi.giorni_lavorativi_mese)) p.set("giorni", String(stato.giorni));
  p.set("modo", stato.modo);
  if (!stato.cache) p.set("cache", "0");
  if (stato.batch) p.set("batch", "1");
  if (stato.rete !== "usa") p.set("rete", stato.rete);
  if (stato.tin !== v(s.token_input)) p.set("in", String(stato.tin));
  if (stato.tout !== v(s.token_output)) p.set("out", String(stato.tout));
  if (stato.ql !== v(s.quota_cache_lettura)) p.set("cl", String(Math.round(stato.ql * 100)));
  if (stato.qs !== v(s.quota_cache_scrittura)) p.set("cs", String(Math.round(stato.qs * 100)));
  if (stato.chiamate !== v(s.chiamate_per_richiesta)) p.set("chiamate", String(stato.chiamate));
  if (stato.mostraPrecedenti) p.set("mostra", "tutti");
  if (stato.metrica !== "costo") p.set("metrica", stato.metrica);
  return p;
}
function linkScenario() { return `${CONFIG.urlStrumento}?${parametriScenario().toString()}`; }

/* ---------------- Lettura dell'indirizzo ---------------- */

function intero(val, min, max) {
  const n = Number.parseInt(String(val ?? "").replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
}
function bool(val) {
  if (val == null) return null;
  const s = String(val).toLowerCase();
  if (["1", "si", "sì", "true", "on"].includes(s)) return true;
  if (["0", "no", "false", "off"].includes(s)) return false;
  return null;
}
function trovaModello(id) {
  if (!id) return null;
  const s = String(id).toLowerCase().trim();
  return P.modelli.find((m) => m.id === s) || P.modelli.find((m) => m.id.startsWith(`${s}-`)) || null;
}
function leggiIndirizzo() {
  const q = new URLSearchParams(location.search); // i parametri UTM e quelli sconosciuti vengono ignorati
  const idScenario = (q.get("scenario") || "").toLowerCase().trim().replace(/-/g, "_");
  const scen = scenarioPerId(P, idScenario) || P.scenari[0];
  applicaScenario(scen, { forzaModello: true });

  const m = trovaModello(q.get("modello"));
  if (m) stato.modello = m.id;
  const r = intero(q.get("richieste"), 0, 1000000); if (r !== null) stato.richieste = r;
  const g = intero(q.get("giorni"), 1, 31); if (g !== null) stato.giorni = g;
  const modo = (q.get("modo") || "").toLowerCase(); if (modo === "tecnico" || modo === "semplice") stato.modo = modo;
  const c = bool(q.get("cache")); if (c !== null) stato.cache = c;
  const b = bool(q.get("batch")); if (b !== null) stato.batch = b;
  const rete = (q.get("rete") || "").toLowerCase(); if (rete === "italia" || rete === "usa") stato.rete = rete;
  const tin = intero(q.get("in"), 0, 5000000); if (tin !== null) stato.tin = tin;
  const tout = intero(q.get("out"), 0, 1000000); if (tout !== null) stato.tout = tout;
  const cl = intero(q.get("cl"), 0, 100); if (cl !== null) stato.ql = cl / 100;
  const cs = intero(q.get("cs"), 0, 100); if (cs !== null) stato.qs = cs / 100;
  if (stato.ql + stato.qs > 1) stato.qs = Math.max(0, 1 - stato.ql);
  const ch = intero(q.get("chiamate"), 1, 1000); if (ch !== null) stato.chiamate = ch;
  if ((q.get("mostra") || "") === "tutti") stato.mostraPrecedenti = true;
  if ((q.get("metrica") || "") === "energia") stato.metrica = "energia";
  const sel = modelloPerId(P, stato.modello);
  if (sel && !sel.in_evidenza) stato.mostraPrecedenti = true;

  if (q.get("inviato") === "1") mostraBanner("Richiesta ricevuta. Controlla la posta e conferma l'indirizzo: poi ti arriva il link al tuo scenario.");
  if (q.get("confermato") === "1") mostraBanner("Indirizzo confermato. Tra poco ti arriva l'email con il link al tuo scenario.");
}
function mostraBanner(testo) { const el = $("#avviso-banner"); el.textContent = testo; el.hidden = false; }

function applicaScenario(scen, { forzaModello = true } = {}) {
  stato.scenario = scen.id;
  stato.tin = v(scen.token_input);
  stato.tout = v(scen.token_output);
  stato.ql = v(scen.quota_cache_lettura);
  stato.qs = v(scen.quota_cache_scrittura);
  stato.chiamate = v(scen.chiamate_per_richiesta);
  stato.richieste = v(scen.richieste_al_giorno);
  if (forzaModello) stato.modello = scen.modello_suggerito;
}

/* ---------------- Costruzione dei controlli ---------------- */

function costruisciScenari() {
  const box = $("#scenari");
  box.innerHTML = P.scenari.map((s) => `
    <label class="scenario">
      <input type="radio" name="scenario" value="${esc(s.id)}">
      <span class="scenario-nome">${esc(s.nome)}</span>
      <span class="scenario-desc">${esc(s.descrizione)}</span>
    </label>`).join("");
}

function costruisciModelli() {
  const sel = $("#modello");
  const suggerito = scenarioPerId(P, stato.scenario).modello_suggerito;
  const opt = (m) => `<option value="${esc(m.id)}">${esc(m.nome)}${m.id === suggerito ? " (consigliato)" : ""}${m.stato === "deprecato" ? " (deprecato)" : ""}</option>`;
  const attuali = P.modelli.filter((m) => m.in_evidenza);
  const precedenti = P.modelli.filter((m) => !m.in_evidenza);
  sel.innerHTML = `<optgroup label="Modelli attuali">${attuali.map(opt).join("")}</optgroup>` +
    (stato.mostraPrecedenti ? `<optgroup label="Modelli precedenti">${precedenti.map(opt).join("")}</optgroup>` : "");
  sel.value = stato.modello;
}

function sincronizzaControlli() {
  document.querySelectorAll('input[name="scenario"]').forEach((r) => { r.checked = r.value === stato.scenario; });
  costruisciModelli();
  $("#mostra-precedenti").checked = stato.mostraPrecedenti;
  $("#richieste").value = stato.richieste;
  $("#giorni").value = stato.giorni;
  $("#cache").checked = stato.cache;
  $("#batch").checked = stato.batch;
  document.querySelectorAll('input[name="rete"]').forEach((r) => { r.checked = r.value === stato.rete; });
  document.querySelectorAll('input[name="metrica"]').forEach((r) => { r.checked = r.value === stato.metrica; });
  $("#tin").value = stato.tin;
  $("#tout").value = stato.tout;
  $("#ql").value = Math.round(stato.ql * 100);
  $("#qs").value = Math.round(stato.qs * 100);
  $("#chiamate").value = stato.chiamate;
  impostaModo(stato.modo, false);
}

function impostaModo(modo, ricalcola = true) {
  stato.modo = modo;
  document.body.dataset.modo = modo;
  document.querySelectorAll(".modo-btn").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modo === modo)));
  if (ricalcola) aggiorna();
}

function collegaEventi() {
  document.querySelectorAll(".modo-btn").forEach((b) => b.addEventListener("click", () => impostaModo(b.dataset.modo)));

  $("#scenari").addEventListener("change", (e) => {
    if (e.target.name !== "scenario") return;
    applicaScenario(scenarioPerId(P, e.target.value));
    sincronizzaControlli();
    aggiorna();
  });
  $("#modello").addEventListener("change", (e) => { stato.modello = e.target.value; aggiorna(); });
  $("#mostra-precedenti").addEventListener("change", (e) => {
    stato.mostraPrecedenti = e.target.checked;
    if (!stato.mostraPrecedenti && !modelloPerId(P, stato.modello).in_evidenza) {
      stato.modello = scenarioPerId(P, stato.scenario).modello_suggerito;
    }
    costruisciModelli();
    aggiorna();
  });

  const numeri = [
    ["#richieste", "richieste", 0, 1000000, 1],
    ["#giorni", "giorni", 1, 31, 1],
    ["#tin", "tin", 0, 5000000, 1],
    ["#tout", "tout", 0, 1000000, 1],
    ["#chiamate", "chiamate", 1, 1000, 1],
  ];
  for (const [sel, chiave, min, max] of numeri) {
    $(sel).addEventListener("input", (e) => {
      const n = intero(e.target.value, min, max);
      if (n === null) return;
      stato[chiave] = n;
      aggiorna();
    });
    $(sel).addEventListener("change", (e) => { e.target.value = stato[chiave]; });
  }
  for (const [sel, chiave, altra] of [["#ql", "ql", "qs"], ["#qs", "qs", "ql"]]) {
    $(sel).addEventListener("input", (e) => {
      const n = intero(e.target.value, 0, 100);
      if (n === null) return;
      stato[chiave] = Math.min(n / 100, 1 - stato[altra]);
      aggiorna();
    });
    $(sel).addEventListener("change", (e) => { e.target.value = Math.round(stato[chiave] * 100); });
  }
  $("#cache").addEventListener("change", (e) => { stato.cache = e.target.checked; aggiorna(); });
  $("#batch").addEventListener("change", (e) => { stato.batch = e.target.checked; aggiorna(); });
  document.querySelectorAll('input[name="rete"]').forEach((r) => r.addEventListener("change", () => { stato.rete = r.value; aggiorna(); }));
  document.querySelectorAll('input[name="metrica"]').forEach((r) => r.addEventListener("change", () => { stato.metrica = r.value; aggiorna(); }));
  $("#ripristina").addEventListener("click", () => {
    const modelloScelto = stato.modello;
    applicaScenario(scenarioPerId(P, stato.scenario), { forzaModello: false });
    stato.modello = modelloScelto;
    sincronizzaControlli();
    aggiorna();
  });

  $("#copia-link").addEventListener("click", copiaLink);
  $("#esporta-csv").addEventListener("click", esportaCsv);
  $("#esporta-json").addEventListener("click", esportaJson);
  $("#cta-report").addEventListener("click", () => { preparaReport(); window.print(); });
  window.addEventListener("beforeprint", preparaReport);
  $("#cta-email").addEventListener("click", apriModulo);
  document.querySelectorAll("[data-chiudi]").forEach((b) => b.addEventListener("click", chiudiModulo));
  $("#dialogo-email").addEventListener("click", (e) => { if (e.target.id === "dialogo-email") chiudiModulo(); });
  $("#modulo-brevo").addEventListener("submit", inviaModulo);
  collegaTooltip();
}

/* ---------------- Calcolo e risultati ---------------- */

function ingresso() {
  return { tokenInput: stato.tin, tokenOutput: stato.tout, quotaCacheLettura: stato.ql, quotaCacheScrittura: stato.qs, chiamate: stato.chiamate };
}
function opzioni() { return { cache: stato.cache, batch: stato.batch, rete: stato.rete }; }

function aggiorna() {
  const modello = modelloPerId(P, stato.modello);
  const scen = scenarioPerId(P, stato.scenario);
  const r = calcolaRichiesta(P, modello, ingresso(), opzioni());
  const periodi = scala(r, stato.richieste, stato.giorni, v(P.volumi.mesi_anno));
  ultimo = { modello, scen, r, periodi };

  // Riepilogo
  $("#riepilogo").textContent =
    `${scen.nome} · ${modello.nome} · ${numero(stato.richieste)} richieste al giorno · ${stato.giorni} giorni al mese` +
    `${stato.cache ? " · con caching" : ""}${stato.batch ? " · in batch" : ""}`;

  // Costo
  const m = periodi.mese, a = periodi.anno;
  $("#costo-mese").textContent = euro(m.eur.totale);
  $("#mini-costo").innerHTML = `${esc(scen.nome)} con ${esc(modello.nome)}: <strong>${euro(m.eur.totale)} al mese</strong>`;
  $("#costo-dettaglio").textContent =
    `circa ${dollari(m.usd.totale)} · ${euro(a.eur.totale)} all'anno · ${euro(r.eur.totale, true)} a richiesta`;

  // Tessere
  $("#token-mese").textContent = token(m.token.totale);
  $("#token-dettaglio").textContent = `${token(r.token.totale)} a richiesta`;
  $("#energia-mese").textContent = energia(m.energia.centrale);
  $("#energia-range").textContent = `tra ${energia(m.energia.min)} e ${energia(m.energia.max)}`;
  $("#co2-mese").textContent = co2(m.co2.centrale);
  $("#co2-range").textContent = `tra ${co2(m.co2.min)} e ${co2(m.co2.max)}`;
  $("#acqua-mese").textContent = acqua(m.acqua.centrale);
  $("#acqua-range").textContent = `tra ${acqua(m.acqua.min)} e ${acqua(m.acqua.max)}`;

  // Aiuto modello
  const pr = modello.prezzi;
  $("#aiuto-modello").textContent =
    `Listino: ${sig(v(pr.input))} $ per milione di token in ingresso, ${sig(v(pr.output))} $ in uscita. ` +
    `Contesto massimo: ${token(v(modello.contesto_max))} di token.`;
  $("#nota-scenario").textContent = scen.token_input.nota ? `Ipotesi dello scenario: ${scen.token_input.nota}` : "";

  disegnaParagoni(r, m);
  disegnaNote(modello, r);
  if (stato.modo === "tecnico") disegnaTecnico(modello, r, periodi);
  disegnaConfronto();
  aggiornaLink();
}

function disegnaParagoni(r, m) {
  const ul = $("#paragoni");
  if (!stato.richieste || m.energia.centrale === 0) { ul.innerHTML = ""; return; }
  const Pg = P.paragoni;
  const ricariche = m.energia.centrale / v(Pg.ricarica_smartphone);
  const ore = m.energia.centrale / v(Pg.lampadina_led);
  const ricerche = r.energia.centrale / v(Pg.ricerca_google);
  const gocce = r.acqua.centrale / v(Pg.goccia_acqua);
  const oreTesto = ore >= 48 ? `${sig(ore, 2)} ore (circa ${sig(ore / 24, 2)} giorni)` : `${sig(ore, 2)} ore`;
  const righe = [
    `In un mese, l'energia stimata vale circa <strong>${sig(ricariche, 2)} ricariche complete di uno smartphone</strong>.`,
    `È come tenere accesa una <strong>lampadina LED da ${v(Pg.lampadina_led)} W per ${oreTesto}</strong>.`,
    `Una singola richiesta consuma quanto circa <strong>${sig(ricerche, 2)} ${ricerche < 1.5 ? "ricerca" : "ricerche"} su Google</strong> <small>(dato Google del 2009)</small>.`,
    `Per una richiesta servono circa <strong>${sig(gocce, 2)} ${gocce < 1.5 ? "goccia" : "gocce"} d'acqua</strong>, compresa quella per produrre l'elettricità.`,
  ];
  ul.innerHTML = righe.map((t) => `<li><span>${t}</span></li>`).join("");
}

function disegnaNote(modello, r) {
  const note = [];
  // Le note interne del file dati non vanno mostrate: qui solo frasi pubbliche
  if (modello.nota && /ragionamento/i.test(modello.nota)) note.push(modello.nota);
  if (modello.stato === "deprecato") note.push("Anthropic ha deprecato questo modello e lo ritirerà a breve: conviene passare a uno attuale.");
  if (r.fattoreTokenizer !== 1) note.push(`Questo modello usa il tokenizer precedente: per lo stesso testo conta circa ${sig((1 - 1 / r.fattoreTokenizer) * 100, 2)}% di token in meno. I token dello scenario sono divisi per ${sig(r.fattoreTokenizer)}.`);
  if (r.fasciaLunga) note.push(`Ogni chiamata supera i ${numero(v(modello.prezzi_prompt_lunghi.soglia_token_prompt))} token: si applicano i prezzi per i prompt lunghi.`);
  if (stato.batch) note.push("Lo sconto batch riduce il prezzo, non l'energia stimata.");
  if (stato.rete === "italia") note.push("CO2 calcolata con la rete italiana (ISPRA, dati 2024): è un confronto, non il luogo reale dei data center. L'acqua per l'elettricità usa sempre il valore USA.");
  $("#note-calcolo").innerHTML = note.map((n) => `<li>${esc(n)}</li>`).join("");
}

/* ---------------- Vista tecnica ---------------- */

const tipoBadge = (tipo) => {
  const cls = tipo === "ufficiale" ? "badge-ufficiale" : tipo === "stima nostra" ? "badge-stima" : "badge-terzi";
  return `<span class="badge ${cls}">${esc(tipo)}</span>`;
};
const linkFonte = (d) => {
  if (!d || !d.fonte) return "";
  const testo = d.fonte.startsWith("http") ? new URL(d.fonte).hostname.replace(/^www\./, "") : "metodo";
  return `<a href="${esc(d.fonte)}" ${d.fonte.startsWith("http") ? 'target="_blank" rel="noopener"' : ""}>${esc(testo)}</a>`;
};

function disegnaTecnico(modello, r, periodi) {
  const per = ["richiesta", "giorno", "mese", "anno"];
  const tit = ["A richiesta", "Al giorno", "Al mese", "All'anno"];
  const righeTok = [
    ["Ingresso (normali)", "input"], ["Letti dalla cache", "cacheLettura"],
    ["Scritti in cache", "cacheScrittura"], ["Uscita", "output"],
  ];
  $("#tab-token").innerHTML =
    `<thead><tr><th>Token</th>${tit.map((t) => `<th class="num">${t}</th>`).join("")}</tr></thead><tbody>` +
    righeTok.map(([n, k]) => `<tr><td>${n}</td>${per.map((p) => `<td class="num">${numero(periodi[p].token[k])}</td>`).join("")}</tr>`).join("") +
    `<tr class="totale"><td>Totale</td>${per.map((p) => `<td class="num">${numero(periodi[p].token.totale)}</td>`).join("")}</tr></tbody>` +
    (r.fattoreTokenizer !== 1 ? `<caption>Token convertiti per il tokenizer precedente (÷ ${sig(r.fattoreTokenizer)}).</caption>` : "");

  const pr = r.fasciaLunga ? modello.prezzi_prompt_lunghi : modello.prezzi;
  const sconto = stato.batch ? v(P.regole_prezzo.batch_moltiplicatore) : 1;
  const righeCosti = [
    ["Ingresso", "input", pr.input], ["Lettura dalla cache", "cacheLettura", pr.cache_lettura],
    ["Scrittura in cache (5 min)", "cacheScrittura", pr.cache_scrittura_5m], ["Uscita", "output", pr.output],
  ];
  $("#tab-costi").innerHTML =
    `<thead><tr><th>Voce</th><th class="num">Prezzo ($/MTok)</th><th class="num">A richiesta</th><th class="num">Al mese</th><th class="num">Al mese ($)</th><th class="num">All'anno</th></tr></thead><tbody>` +
    righeCosti.map(([n, k, prezzo]) => `<tr><td>${n}</td><td class="num">${sig(v(prezzo) * sconto, 4)}</td><td class="num">${euro(periodi.richiesta.eur[k], true)}</td><td class="num">${euro(periodi.mese.eur[k], true)}</td><td class="num">${dollari(periodi.mese.usd[k], true)}</td><td class="num">${euro(periodi.anno.eur[k], true)}</td></tr>`).join("") +
    `<tr class="totale"><td>Totale</td><td class="num"></td><td class="num">${euro(periodi.richiesta.eur.totale, true)}</td><td class="num">${euro(periodi.mese.eur.totale, true)}</td><td class="num">${dollari(periodi.mese.usd.totale, true)}</td><td class="num">${euro(periodi.anno.eur.totale, true)}</td></tr></tbody>` +
    `<caption>Cambio BCE del ${dataIt(P.cambio.data_riferimento)}: 1 € = ${sig(v(P.cambio.usd_per_eur), 5)} $.${stato.batch ? " Prezzi già scontati del 50% (batch)." : ""}</caption>`;

  const misure = [["Energia", "energia", energia], ["CO2", "co2", co2], ["Acqua", "acqua", acqua]];
  let righe = "";
  for (const [nome, k, f] of misure) {
    for (const [p, t] of [["richiesta", "a richiesta"], ["mese", "al mese"], ["anno", "all'anno"]]) {
      righe += `<tr><td>${nome} ${t}</td>${LIVELLI.map((L) => `<td class="num">${f(periodi[p][k][L])}</td>`).join("")}</tr>`;
    }
  }
  $("#tab-stime").innerHTML = `<thead><tr><th>Stima</th><th class="num">Minimo</th><th class="num">Centrale</th><th class="num">Massimo</th></tr></thead><tbody>${righe}</tbody>`;

  const F = fattoreModello(P, modello);
  const rif = modelloPerId(P, P.energia.modello_riferimento);
  $("#formula").innerHTML = [
    "Costo = Σ token × prezzo ($/MTok) ÷ 1.000.000 × sconto batch ÷ cambio BCE",
    "e_uscita = E_rif ÷ (300 + r × 500)   e_ingresso = r × e_uscita",
    "Energia = [Tout·e_uscita + Tin·e_ingresso + Tscr·e_ingresso·k_scr + Tlett·e_ingresso·k_lett] × F_modello × PUE",
    "CO2 = Energia (kWh) × intensità della rete",
    "Acqua = Energia server (kWh) × WUE + Energia (kWh) × acqua per l'elettricità",
    `F_modello = prezzo input ${modello.nome} ÷ prezzo input ${rif.nome} = ${sig(F, 3)}`,
  ].map(esc).join("<br>");

  const c = Object.fromEntries(LIVELLI.map((L) => [L, coefficienti(P, L)]));
  const E = P.energia;
  const riga = (nome, valori, dati, unita) =>
    `<tr><td>${nome}</td>${valori.map((x) => `<td class="num">${x}</td>`).join("")}<td>${unita}</td><td>${dati.map((d) => tipoBadge(d.tipo)).filter((x, i, a) => a.indexOf(x) === i).join(" ")}</td><td>${dati.map(linkFonte).filter((x, i, a) => x && a.indexOf(x) === i).join(", ")}</td></tr>`;
  const tre = (obj) => LIVELLI.map((L) => obj[L]);
  const rete = P.co2[stato.rete === "italia" ? "italia" : "usa"];
  $("#tab-coeff").innerHTML =
    `<thead><tr><th>Parametro</th><th class="num">Min</th><th class="num">Centrale</th><th class="num">Max</th><th>Unità</th><th>Tipo</th><th>Fonte</th></tr></thead><tbody>` +
    riga("E_rif: energia della richiesta di riferimento", tre(E.energia_it_richiesta_riferimento).map((d) => sig(v(d))), tre(E.energia_it_richiesta_riferimento), "Wh") +
    riga("r: token in ingresso rispetto a uscita", tre(E.rapporto_input_su_output).map((d) => sig(v(d))), tre(E.rapporto_input_su_output), "rapporto") +
    riga("e_uscita", LIVELLI.map((L) => sig(c[L].eOut * 1000, 3)), [{ tipo: "stima nostra", fonte: "metodo.html#energia" }], "mWh per token") +
    riga("e_ingresso", LIVELLI.map((L) => sig(c[L].eIn * 1000, 3)), [{ tipo: "stima nostra", fonte: "metodo.html#energia" }], "mWh per token") +
    riga("k_scr: scrittura in cache", tre(E.rapporto_cache_scrittura_su_input).map((d) => sig(v(d))), tre(E.rapporto_cache_scrittura_su_input), "× ingresso") +
    riga("k_lett: lettura dalla cache", tre(E.rapporto_cache_lettura_su_input).map((d) => sig(v(d))), tre(E.rapporto_cache_lettura_su_input), "× ingresso") +
    riga("PUE del data center", tre(E.pue).map((d) => sig(v(d))), tre(E.pue), "rapporto") +
    riga("WUE (raffreddamento)", tre(P.acqua.wue_raffreddamento).map((d) => sig(v(d))), tre(P.acqua.wue_raffreddamento), "L/kWh") +
    riga("Acqua per produrre elettricità (USA)", tre(P.acqua.acqua_produzione_elettrica.usa).map((d) => sig(v(d))), tre(P.acqua.acqua_produzione_elettrica.usa), "L/kWh") +
    riga(`Intensità CO2 della rete (${stato.rete === "italia" ? "Italia" : "USA"})`, [sig(v(rete), 4), sig(v(rete), 4), sig(v(rete), 4)], [rete], esc(rete.unita)) +
    riga("F_modello", [sig(F), sig(F), sig(F)], [{ tipo: "stima nostra", fonte: "metodo.html#energia" }], "× Sonnet 5.5") +
    `</tbody>`;
}

/* ---------------- Confronto tra modelli ---------------- */

function datiConfronto() {
  const modelli = P.modelli.filter((m) => m.in_evidenza || stato.mostraPrecedenti);
  return modelli.map((m) => {
    const r = calcolaRichiesta(P, m, ingresso(), opzioni());
    const p = scala(r, stato.richieste, stato.giorni, v(P.volumi.mesi_anno));
    return { m, r, mese: p.mese };
  });
}

function disegnaConfronto() {
  const dati = datiConfronto();
  const valore = (d) => (stato.metrica === "costo" ? d.mese.eur.totale : d.mese.energia.centrale);
  const fmt = (d) => (stato.metrica === "costo" ? euro(d.mese.eur.totale) : energia(d.mese.energia.centrale));
  dati.sort((a, b) => valore(b) - valore(a));
  const max = Math.max(...dati.map(valore), 0);
  const scen = scenarioPerId(P, stato.scenario);
  $("#confronto-sottotitolo").textContent =
    `${scen.nome}, ${numero(stato.richieste)} richieste al giorno per ${stato.giorni} giorni${stato.cache ? ", con caching" : ""}${stato.batch ? ", in batch" : ""}.`;
  $("#barre").innerHTML = dati.map((d, i) => {
    const sel = d.m.id === stato.modello;
    const w = max > 0 ? Math.max(0.4, (valore(d) / max) * 100) : 0;
    return `<div class="barra${sel ? " selezionata" : ""}" role="listitem" tabindex="0" data-i="${i}">
      <span class="barra-nome">${esc(d.m.nome)}${sel ? "<small>selezionato</small>" : ""}${d.m.stato === "deprecato" ? "<small>deprecato</small>" : ""}</span>
      <span class="barra-pista"><span class="barra-fill" style="width:${w.toFixed(2)}%"></span></span>
      <span class="barra-valore">${fmt(d)}</span>
    </div>`;
  }).join("");
  $("#barre").dataset.metrica = stato.metrica;
  datiTooltip = dati;
  $("#confronto-nota").textContent = stato.metrica === "costo"
    ? "Costi dal listino ufficiale. Il modello selezionato è in blu scuro."
    : "Energia stimata (valore centrale): per ogni modello è proporzionale al prezzo, un'ipotesi spiegata nel metodo. Passa sopra una barra per vedere minimo e massimo.";

  $("#tab-confronto").innerHTML =
    `<thead><tr><th>Modello</th><th class="num">€ al mese</th><th class="num">$ al mese</th><th class="num">Energia min</th><th class="num">Energia centrale</th><th class="num">Energia max</th><th class="num">F_modello</th></tr></thead><tbody>` +
    dati.map((d) => `<tr><td>${esc(d.m.nome)}</td><td class="num">${euro(d.mese.eur.totale, true)}</td><td class="num">${dollari(d.mese.usd.totale, true)}</td><td class="num">${energia(d.mese.energia.min)}</td><td class="num">${energia(d.mese.energia.centrale)}</td><td class="num">${energia(d.mese.energia.max)}</td><td class="num">${sig(d.r.fattoreModello)}</td></tr>`).join("") +
    `</tbody><caption>Valori al mese per lo scenario selezionato.</caption>`;
}

let datiTooltip = [];
function collegaTooltip() {
  const tip = $("#tooltip");
  const barre = $("#barre");
  const mostra = (el, x, y) => {
    const d = datiTooltip[Number(el.dataset.i)];
    if (!d) return;
    tip.innerHTML = `<strong>${esc(d.m.nome)}</strong><br>` +
      `Costo: ${euro(d.mese.eur.totale)} al mese (${euro(d.r.eur.totale, true)} a richiesta)<br>` +
      `Energia: ${energia(d.mese.energia.centrale)} al mese<br><small>stima tra ${energia(d.mese.energia.min)} e ${energia(d.mese.energia.max)}</small>`;
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    const left = Math.min(window.innerWidth - w - 8, Math.max(8, x + 14));
    const top = y - h - 12 < 8 ? y + 18 : y - h - 12;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  };
  barre.addEventListener("pointermove", (e) => {
    const el = e.target.closest(".barra");
    if (el) mostra(el, e.clientX, e.clientY); else tip.hidden = true;
  });
  barre.addEventListener("pointerleave", () => { tip.hidden = true; });
  barre.addEventListener("focusin", (e) => {
    const el = e.target.closest(".barra");
    if (!el) return;
    const r = el.getBoundingClientRect();
    mostra(el, r.left + 20, r.top);
  });
  barre.addEventListener("focusout", () => { tip.hidden = true; });
  window.addEventListener("scroll", () => { tip.hidden = true; }, { passive: true });
}

/* ---------------- Tassa dell'italiano ---------------- */

function disegnaTassa() {
  // Solo i modelli attuali, per tenere la tabella corta (gli altri restano nel file dati)
  const misure = misureTassa(P).filter((ms) => modelloPerId(P, ms.modello)?.in_evidenza);
  const sezione = $("#tassa");
  if (!misure.length) { sezione.hidden = true; return; } // fase 2: compare solo con misure salvate
  const t = P.tassa_italiano;
  $("#tassa-it").textContent = t.testo_it;
  $("#tassa-en").textContent = t.testo_en;
  const cambio = v(P.cambio.usd_per_eur);
  $("#tab-tassa").innerHTML =
    `<thead><tr><th>Modello</th><th class="num">Token italiano</th><th class="num">Token inglese</th><th class="num">Differenza</th><th class="num">Costo in più ogni 1.000 testi</th></tr></thead><tbody>` +
    misure.map((ms) => {
      const m = modelloPerId(P, ms.modello);
      if (!m) return "";
      const diff = ms.token_it_netti / ms.token_en_netti - 1;
      const extra = ((ms.token_it_netti - ms.token_en_netti) * v(m.prezzi.input) * 1000) / 1e6 / cambio;
      return `<tr><td>${esc(m.nome)}</td><td class="num">${numero(ms.token_it_netti)}</td><td class="num">${numero(ms.token_en_netti)}</td><td class="num">+${sig(diff * 100, 2)}%</td><td class="num">${euro(extra, true)}</td></tr>`;
    }).join("") + "</tbody>";
  const date = [...new Set(misure.map((m) => m.data_misura).filter(Boolean))];
  $("#tassa-nota").textContent = `Conteggi misurati con l'API ufficiale di Anthropic${date.length ? ` il ${date.map(dataIt).join(", ")}` : ""}. Costo calcolato sul prezzo dei token in ingresso.`;
  sezione.hidden = false;
}

/* ---------------- Link, condivisione, esportazioni ---------------- */

function aggiornaLink() {
  const params = parametriScenario();
  history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
  const pubblico = new URL(linkScenario());
  for (const [k, val] of Object.entries(CONFIG.utmCondivisione)) pubblico.searchParams.set(k, val);
  $("#condividi-linkedin").href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pubblico.toString())}`;
}

let timerToast = null;
function toast(testo) {
  const el = $("#toast");
  el.textContent = testo;
  clearTimeout(timerToast);
  timerToast = setTimeout(() => { el.textContent = ""; }, 4000);
}
async function copiaLink() {
  const url = linkScenario();
  try {
    await navigator.clipboard.writeText(url);
    toast("Link copiato.");
  } catch {
    const area = document.createElement("textarea");
    area.value = url;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    area.remove();
    toast(ok ? "Link copiato." : `Copia questo link: ${url}`);
  }
}

function scarica(nome, contenuto, tipo) {
  const blob = new Blob([contenuto], { type: tipo });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function righeEsportazione() {
  const { modello, scen, periodi } = ultimo;
  const righe = [["sezione", "voce", "periodo", "livello", "valore", "unita"]];
  const imp = { scenario: scen.nome, modello: modello.nome, richieste_al_giorno: stato.richieste, giorni_al_mese: stato.giorni, caching: stato.cache ? "si" : "no", batch: stato.batch ? "si" : "no", rete_co2: stato.rete, token_input_per_richiesta: stato.tin, token_output_per_richiesta: stato.tout, quota_cache_lettura: stato.ql, quota_cache_scrittura: stato.qs, chiamate_per_richiesta: stato.chiamate };
  for (const [k, val] of Object.entries(imp)) righe.push(["impostazioni", k, "", "", val, ""]);
  for (const p of ["richiesta", "giorno", "mese", "anno"]) {
    for (const [k, val] of Object.entries(periodi[p].token)) righe.push(["token", k, p, "", Math.round(val), "token"]);
    righe.push(["costo", "totale", p, "", periodi[p].eur.totale.toFixed(6), "EUR"]);
    righe.push(["costo", "totale", p, "", periodi[p].usd.totale.toFixed(6), "USD"]);
    for (const L of LIVELLI) {
      righe.push(["energia", "totale", p, L, periodi[p].energia[L].toFixed(6), "Wh"]);
      righe.push(["co2", "totale", p, L, periodi[p].co2[L].toFixed(6), "g"]);
      righe.push(["acqua", "totale", p, L, periodi[p].acqua[L].toFixed(6), "ml"]);
    }
  }
  righe.push(["fonte", "versione_dati", "", "", P.meta.versione_dati, ""]);
  righe.push(["fonte", "link_scenario", "", "", linkScenario(), ""]);
  return righe;
}
function esportaCsv() {
  const csv = righeEsportazione().map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  scarica(`tokenometro-${stato.scenario}.csv`, "﻿" + csv, "text/csv;charset=utf-8");
}
function esportaJson() {
  const { modello, scen, r, periodi } = ultimo;
  const out = {
    generato_il: new Date().toISOString(),
    versione_dati: P.meta.versione_dati,
    link_scenario: linkScenario(),
    avviso: P.meta.avviso,
    impostazioni: { scenario: scen.id, modello: modello.id, richieste_al_giorno: stato.richieste, giorni_al_mese: stato.giorni, caching: stato.cache, batch: stato.batch, rete_co2: stato.rete, token_input: stato.tin, token_output: stato.tout, quota_cache_lettura: stato.ql, quota_cache_scrittura: stato.qs, chiamate_per_richiesta: stato.chiamate },
    unita: { energia: "Wh", co2: "g", acqua: "ml", costo: "EUR e USD" },
    fattore_modello: r.fattoreModello,
    fattore_tokenizer: r.fattoreTokenizer,
    fascia_prompt_lunghi: r.fasciaLunga,
    risultati: periodi,
  };
  scarica(`tokenometro-${stato.scenario}.json`, JSON.stringify(out, null, 2), "application/json");
}

/* ---------------- Report PDF (window.print) ---------------- */

function preparaReport() {
  if (!ultimo) return;
  const { modello, scen, r, periodi } = ultimo;
  const m = periodi.mese, a = periodi.anno;
  const oggi = new Date().toLocaleDateString(LOCALE, { day: "numeric", month: "long", year: "numeric" });
  const k = CONFIG.contatti;
  const confronto = datiConfronto().sort((x, y) => y.mese.eur.totale - x.mese.eur.totale);
  $("#report").innerHTML = `
    <div class="r-testa"><span class="r-marchio">Marco Bacci<span></span></span><span class="r-data">Tokenometro · report del ${esc(oggi)}</span></div>
    <h1>Il tuo scenario</h1>
    <p><strong>${esc(scen.nome)}.</strong> ${esc(scen.descrizione)}</p>
    <p>Modello: <strong>${esc(modello.nome)}</strong> · ${numero(stato.richieste)} richieste al giorno · ${stato.giorni} giorni lavorativi al mese · caching ${stato.cache ? "attivo" : "non attivo"} · batch ${stato.batch ? "attivo" : "non attivo"} · rete per la CO2: ${stato.rete === "italia" ? "Italia" : "USA"}.</p>
    <p>Per richiesta: ${numero(stato.tin)} token in ingresso, ${numero(stato.tout)} in uscita${stato.cache ? `, ${Math.round(stato.ql * 100)}% letti dalla cache` : ""}.</p>

    <h2>Risultato</h2>
    <p>Costo al mese</p>
    <p class="r-cifra">${euro(m.eur.totale)}</p>
    <p>circa ${dollari(m.usd.totale)} · ${euro(a.eur.totale)} all'anno · ${euro(r.eur.totale, true)} a richiesta</p>
    <table>
      <thead><tr><th></th><th class="num">Al mese</th><th class="num">All'anno</th><th class="num">Intervallo al mese</th></tr></thead>
      <tbody>
        <tr><td>Token</td><td class="num">${token(m.token.totale)}</td><td class="num">${token(a.token.totale)}</td><td class="num">–</td></tr>
        <tr><td>Energia <span class="stima">stima</span></td><td class="num">${energia(m.energia.centrale)}</td><td class="num">${energia(a.energia.centrale)}</td><td class="num">${energia(m.energia.min)} – ${energia(m.energia.max)}</td></tr>
        <tr><td>CO2 <span class="stima">stima</span></td><td class="num">${co2(m.co2.centrale)}</td><td class="num">${co2(a.co2.centrale)}</td><td class="num">${co2(m.co2.min)} – ${co2(m.co2.max)}</td></tr>
        <tr><td>Acqua <span class="stima">stima</span></td><td class="num">${acqua(m.acqua.centrale)}</td><td class="num">${acqua(a.acqua.centrale)}</td><td class="num">${acqua(m.acqua.min)} – ${acqua(m.acqua.max)}</td></tr>
      </tbody>
    </table>

    <h2>Lo stesso scenario sugli altri modelli</h2>
    <table>
      <thead><tr><th>Modello</th><th class="num">Costo al mese</th><th class="num">Energia al mese (stima)</th></tr></thead>
      <tbody>${confronto.map((d) => `<tr><td>${esc(d.m.nome)}${d.m.id === modello.id ? " (selezionato)" : ""}</td><td class="num">${euro(d.mese.eur.totale)}</td><td class="num">${energia(d.mese.energia.centrale)}</td></tr>`).join("")}</tbody>
    </table>

    <h2>Metodo in breve</h2>
    <p>Prezzi dal listino ufficiale Anthropic, convertiti in euro con il cambio BCE del ${esc(dataIt(P.cambio.data_riferimento))}. Dati aggiornati al ${esc(dataIt(P.meta.ultimo_aggiornamento))}.</p>
    <p>Energia, CO2 e acqua sono stime: Anthropic non pubblica dati energetici per richiesta. Il punto di partenza è la misura di Google sulla richiesta mediana di Gemini (0,24 Wh), adattata ai token di ogni richiesta e al modello in proporzione al prezzo (ipotesi nostra). Per questo diamo sempre un minimo e un massimo.</p>
    <p>Metodo completo, formule e fonti: <a href="${esc(CONFIG.urlStrumento)}metodo.html">${esc(CONFIG.urlStrumento)}metodo.html</a></p>

    <h2>Riapri questo scenario</h2>
    <p class="r-link"><a href="${esc(linkScenario())}">${esc(linkScenario())}</a></p>

    <div class="r-contatti">
      <p><strong>${esc(k.nome)}</strong> · ${esc(k.ruolo)}</p>
      <p>${esc(k.email)} · ${esc(k.telefono)} · ${esc(k.sito)} · ${esc(k.linkedin)}</p>
      <p>Vuoi i numeri del tuo studio o della tua azienda? Prenota una call: ${esc(linkPrenota())}</p>
    </div>
    <p class="r-nota">Progetto indipendente, non affiliato ad Anthropic. I valori di energia, CO2 e acqua sono stime con margini ampi.</p>`;
}

/* ---------------- Modulo email (Brevo, HTML semplice) ---------------- */

function moduloConfigurato() { return /^https:\/\/[^\s]+sibforms\.com\//.test(CONFIG.brevoFormUrl); }

function apriModulo() {
  const dlg = $("#dialogo-email");
  const form = $("#modulo-brevo");
  $("#campo-scenario-url").value = linkScenario();
  $("#modulo-stato").textContent = "";
  $("#invia-email").disabled = false;
  if (moduloConfigurato()) {
    form.action = CONFIG.brevoFormUrl;
  } else {
    form.removeAttribute("action");
    $("#invia-email").disabled = true;
    $("#modulo-stato").textContent = `Il modulo non è ancora collegato. Nel frattempo scrivimi a ${CONFIG.contatti.email}.`;
  }
  if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
  setTimeout(() => $("#campo-email").focus(), 50);
}
function chiudiModulo() {
  const dlg = $("#dialogo-email");
  if (typeof dlg.close === "function") dlg.close(); else dlg.removeAttribute("open");
}
function inviaModulo(e) {
  if (!moduloConfigurato()) { e.preventDefault(); return; }
  $("#campo-scenario-url").value = linkScenario();
  const frame = $("#invio-brevo");
  $("#modulo-stato").textContent = "Invio in corso…";
  $("#invia-email").disabled = true;
  frame.addEventListener("load", () => {
    $("#modulo-stato").textContent = "Fatto. Controlla la posta e conferma l'indirizzo: subito dopo ti arriva il link. Se non trovi l'email, guarda nello spam.";
  }, { once: true });
  // l'invio prosegue in modo normale verso Brevo, dentro l'iframe nascosto: la pagina resta com'è
}

/* ---------------- Avvio ---------------- */

async function avvia() {
  try {
    P = await caricaParametri();
  } catch (err) {
    const el = $("#errore-caricamento");
    el.textContent = "Non riesco a caricare i dati del Tokenometro. Ricarica la pagina tra qualche secondo.";
    el.hidden = false;
    console.error(err);
    return;
  }
  document.querySelectorAll("[data-ultimo-aggiornamento]").forEach((el) => { el.textContent = dataIt(P.meta.ultimo_aggiornamento); });
  costruisciScenari();
  leggiIndirizzo();
  sincronizzaControlli();
  collegaEventi();
  disegnaTassa();
  aggiorna();
}

avvia();
