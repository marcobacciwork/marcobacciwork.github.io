/* Tokenometro — pagina Metodo: i numeri vengono letti da data/parametri.json,
   così la pagina resta sempre allineata ai dati usati dallo strumento. */

import { LIVELLI, caricaParametri, modelloPerId, calcolaRichiesta } from "./calcolo.js";

const $ = (s) => document.querySelector(s);
const v = (d) => (d && typeof d === "object" && "valore" in d ? d.valore : d);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nf = (o) => new Intl.NumberFormat("it-IT", o);
const num = (x) => (typeof x === "number" ? (Math.abs(x) >= 1000 ? nf({ maximumFractionDigits: 0 }).format(x) : nf({ maximumSignificantDigits: 4 }).format(x)) : esc(x));
const dataIt = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });

const badge = (tipo) => {
  const cls = tipo === "ufficiale" ? "badge-ufficiale" : tipo === "stima nostra" ? "badge-stima" : "badge-terzi";
  return `<span class="badge ${cls}">${esc(tipo)}</span>`;
};
const fonte = (url) => {
  if (!url) return "";
  if (!url.startsWith("http")) return `<a href="${esc(url)}">qui sopra</a>`;
  return `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(new URL(url).hostname.replace(/^www\./, ""))}</a>`;
};

/* Una riga per ogni dato: nome, valore, unità, tipo, fiducia, fonte, nota */
function righe(elenco) {
  return elenco.map(([nome, d]) => {
    if (!d) return "";
    return `<tr><td>${esc(nome)}${d.nota ? `<span class="nota">${esc(d.nota)}</span>` : ""}</td>` +
      (typeof v(d) === "string" ? `<td colspan="2">${esc(v(d))}</td>` : `<td class="num">${num(v(d))}</td><td>${esc(d.unita)}</td>`) + `<td>${badge(d.tipo)}</td><td>${esc(d.fiducia)}</td><td>${fonte(d.fonte)}<br><small>${esc(d.data_verifica || "")}</small></td></tr>`;
  }).join("");
}
const testa = `<thead><tr><th>Dato</th><th class="num">Valore</th><th>Unità</th><th>Tipo</th><th>Fiducia</th><th>Fonte</th></tr></thead>`;
const trio = (nome, obj) => LIVELLI.map((L) => [`${nome} (${L})`, obj[L]]);

async function avvia() {
  let P;
  try { P = await caricaParametri(); } catch (e) {
    const el = $("#errore-caricamento");
    el.textContent = "Non riesco a caricare i dati. Ricarica la pagina.";
    el.hidden = false;
    return;
  }

  // Valori singoli nel testo
  document.querySelectorAll("[data-v]").forEach((el) => {
    const d = el.dataset.v.split(".").reduce((o, k) => (o ? o[k] : undefined), P);
    el.textContent = d === undefined ? "?" : num(v(d));
  });
  document.querySelectorAll("[data-ultimo-aggiornamento]").forEach((el) => { el.textContent = dataIt(P.meta.ultimo_aggiornamento); });
  document.querySelectorAll("[data-cambio-data]").forEach((el) => { el.textContent = `tasso del ${dataIt(P.cambio.data_riferimento)}`; });

  // Modelli
  const mt = (n) => (n >= 1e6 ? `${n / 1e6}M` : `${n / 1000}K`);
  $("#tab-modelli").innerHTML =
    `<thead><tr><th>Modello</th><th>Stato</th><th class="num">Ingresso</th><th class="num">Uscita</th><th class="num">Cache: lettura</th><th class="num">Cache: scrittura 5 min</th><th class="num">Batch (ingr./usc.)</th><th class="num">Contesto</th><th class="num">Uscita max</th><th>Tokenizer</th></tr></thead><tbody>` +
    P.modelli.map((m) => {
      const p = m.prezzi;
      const lunghi = m.prezzi_prompt_lunghi ? `<span class="nota">Oltre ${num(v(m.prezzi_prompt_lunghi.soglia_token_prompt))} token di prompt: ${num(v(m.prezzi_prompt_lunghi.input))} / ${num(v(m.prezzi_prompt_lunghi.output))} $</span>` : "";
      return `<tr><td><a href="${esc(m.pagina_documentazione)}" target="_blank" rel="noopener">${esc(m.nome)}</a>${lunghi}</td><td>${esc(m.stato)}</td>` +
        `<td class="num">${num(v(p.input))} $</td><td class="num">${num(v(p.output))} $</td><td class="num">${num(v(p.cache_lettura))} $</td><td class="num">${num(v(p.cache_scrittura_5m))} $</td>` +
        `<td class="num">${num(v(p.batch_input))} / ${num(v(p.batch_output))} $</td><td class="num">${mt(v(m.contesto_max))}</td><td class="num">${mt(v(m.output_max))}</td><td>${esc(m.tokenizer)}</td></tr>`;
    }).join("") + `</tbody><caption>Dollari per milione di token. Fonte: listino e pagine dei modelli Anthropic, verificati il ${dataIt(P.meta.ultimo_aggiornamento)}.</caption>`;
  $("#lista-esclusi").innerHTML = P.modelli_esclusi.map((m) => `<li><code>${esc(m.id)}</code>: ${esc(m.motivo)}</li>`).join("");

  // Scenari
  $("#tab-scenari").innerHTML =
    `<thead><tr><th>Scenario</th><th class="num">Token in ingresso</th><th class="num">Token in uscita</th><th class="num">Letti dalla cache</th><th class="num">Scritti in cache</th><th class="num">Chiamate</th><th class="num">Richieste al giorno</th><th>Modello consigliato</th></tr></thead><tbody>` +
    P.scenari.map((s) => {
      const note = [s.token_input.nota, s.token_output.nota, s.quota_cache_lettura.nota].filter(Boolean).join(" ");
      const m = modelloPerId(P, s.modello_suggerito);
      return `<tr><td><strong>${esc(s.nome)}</strong><span class="nota">${esc(s.descrizione)} ${esc(note)}</span></td>` +
        `<td class="num">${num(v(s.token_input))}</td><td class="num">${num(v(s.token_output))}</td><td class="num">${Math.round(v(s.quota_cache_lettura) * 100)}%</td><td class="num">${Math.round(v(s.quota_cache_scrittura) * 100)}%</td>` +
        `<td class="num">${num(v(s.chiamate_per_richiesta))}</td><td class="num">${num(v(s.richieste_al_giorno))}</td><td>${esc(m ? m.nome : s.modello_suggerito)}</td></tr>`;
    }).join("") + `</tbody><caption>Tutti i valori sono ipotesi nostre (fiducia bassa), modificabili nella vista tecnica.</caption>`;

  // Energia
  const E = P.energia;
  $("#tab-energia").innerHTML = testa + "<tbody>" + righe([
    ["Ipotesi di partenza", E.ipotesi_richiesta_di_riferimento],
    ["Token in ingresso della richiesta di riferimento", E.richiesta_di_riferimento.token_input],
    ["Token in uscita della richiesta di riferimento", E.richiesta_di_riferimento.token_output],
    ...trio("E_rif", E.energia_it_richiesta_riferimento),
    ...trio("r, ingresso rispetto a uscita", E.rapporto_input_su_output),
    ...trio("k_scr, scrittura in cache", E.rapporto_cache_scrittura_su_input),
    ...trio("k_lett, lettura dalla cache", E.rapporto_cache_lettura_su_input),
    ...trio("PUE", E.pue),
    ["Infrastruttura", E.pue.nota_infrastruttura],
    ["Effetto del batch sull'energia", E.batch_fattore_energia],
  ]) + `<tr><td>F_modello<span class="nota">${esc(E.fattore_modello.metodo)}. ${esc(E.fattore_modello.nota)}</span></td><td class="num">–</td><td>rapporto</td><td>${badge(E.fattore_modello.tipo)}</td><td>${esc(E.fattore_modello.fiducia)}</td><td>${fonte(E.fattore_modello.fonte)}</td></tr></tbody>`;

  const son = modelloPerId(P, E.modello_riferimento);
  const rif = calcolaRichiesta(P, son, { tokenInput: v(E.richiesta_di_riferimento.token_input), tokenOutput: v(E.richiesta_di_riferimento.token_output), quotaCacheLettura: 0, quotaCacheScrittura: 0, chiamate: 1 }, { cache: false, batch: false, rete: "usa" });
  $("#riscontro-sonnet").textContent = `${nf({ maximumSignificantDigits: 2 }).format(rif.energia.centrale)} Wh (tra ${nf({ maximumSignificantDigits: 2 }).format(rif.energia.min)} e ${nf({ maximumSignificantDigits: 2 }).format(rif.energia.max)})`;

  // CO2, acqua, paragoni
  $("#tab-co2").innerHTML = testa + "<tbody>" + righe([["Rete USA", P.co2.usa], ["Rete italiana", P.co2.italia]]) + "</tbody>";
  $("#tab-acqua").innerHTML = testa + "<tbody>" + righe([
    ...trio("WUE, raffreddamento", P.acqua.wue_raffreddamento),
    ...trio("Acqua per l'elettricità, USA", P.acqua.acqua_produzione_elettrica.usa),
  ]) + "</tbody>";
  $("#tab-paragoni").innerHTML = testa + "<tbody>" + righe([
    ["Ricarica completa di uno smartphone", P.paragoni.ricarica_smartphone],
    ["Lampadina LED", P.paragoni.lampadina_led],
    ["Ricerca su Google", P.paragoni.ricerca_google],
    ["Goccia d'acqua", P.paragoni.goccia_acqua],
    ["Cambio euro-dollaro", P.cambio.usd_per_eur],
  ]) + "</tbody>";

  // Fonti
  $("#lista-fonti").innerHTML = P.fonti.map((f) =>
    `<li>${esc(f.autore)}${f.anno ? ` (${esc(f.anno)})` : ""}, <a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.titolo)}</a>. <small>Verificata il ${esc(dataIt(f.data_verifica))}.</small></li>`).join("");
  $("#lista-scartate").innerHTML = P.fonti_scartate.map((f) => `<li><strong>${esc(f.fonte)}</strong>: ${esc(f.motivo)}</li>`).join("");
}

avvia();
