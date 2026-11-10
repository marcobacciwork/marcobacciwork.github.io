/* ==========================================================================
   Check-up email e dominio — marcobacci.it/check-up-dominio/
   Gira tutto nel browser. Legge record DNS pubblici con DNS-over-HTTPS
   (Cloudflare, riserva Google). Nessun dato inviato al sito.
   ========================================================================== */
(function (root) {
  "use strict";

  var TIPI = { A: 1, NS: 2, CNAME: 5, MX: 15, TXT: 16, AAAA: 28, DS: 43, CAA: 257 };

  // Selettori DKIM più diffusi (Google, Microsoft 365, Brevo, Mailchimp, Zoho, ecc.)
  var SELETTORI_DKIM = [
    "google", "selector1", "selector2", "default", "mail", "dkim", "smtp",
    "k1", "k2", "k3", "s1", "s2", "brevo1", "brevo2", "mailjet", "mandrill",
    "zoho", "zmail", "protonmail", "protonmail2", "fm1", "key1", "sig1", "mxvault", "cm"
  ];

  /* ---------- Utilità ---------- */

  function normalizzaDominio(input) {
    var s = String(input || "").trim().toLowerCase();
    if (!s) return null;
    if (s.indexOf("@") !== -1) s = s.split("@").pop();
    s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
    s = s.split(/[\/?#:\s]/)[0];
    s = s.replace(/^www\./, "").replace(/\.$/, "");
    try { if (typeof URL !== "undefined") s = new URL("http://" + s).hostname; } catch (e) { return null; }
    var ok = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(s);
    return ok ? s : null;
  }

  // I record TXT arrivano tra virgolette, a volte spezzati in più pezzi
  function testoTxt(data) {
    var d = String(data || "");
    var pezzi = d.match(/"((?:[^"\\]|\\.)*)"/g);
    if (!pezzi) return d.trim();
    return pezzi.map(function (p) { return p.slice(1, -1).replace(/\\"/g, '"'); }).join("");
  }

  function risposte(res, tipo) {
    if (!res || !res.Answer) return [];
    return res.Answer.filter(function (a) { return a.type === TIPI[tipo]; });
  }

  function txt(res) { return risposte(res, "TXT").map(function (a) { return testoTxt(a.data); }); }

  /* ---------- DNS-over-HTTPS ---------- */

  function conTimeout(ms) {
    if (typeof AbortController === "undefined") return { signal: undefined, fine: function () {} };
    var c = new AbortController();
    var t = setTimeout(function () { c.abort(); }, ms);
    return { signal: c.signal, fine: function () { clearTimeout(t); } };
  }

  function chiediDns(nome, tipo) {
    var q = "name=" + encodeURIComponent(nome) + "&type=" + tipo;
    var servizi = [
      "https://cloudflare-dns.com/dns-query?" + q,
      "https://dns.google/resolve?" + q
    ];
    function prova(i) {
      if (i >= servizi.length) return Promise.reject(new Error("dns"));
      var to = conTimeout(7000);
      return fetch(servizi[i], { headers: { accept: "application/dns-json" }, signal: to.signal, cache: "no-store" })
        .then(function (r) { to.fine(); if (!r.ok) throw new Error("http " + r.status); return r.json(); })
        .catch(function () { to.fine(); return prova(i + 1); });
    }
    return prova(0);
  }

  // Raggiungibilità HTTPS: con mode "no-cors" la risposta è opaca,
  // ma la richiesta fallisce se il certificato non è valido o il sito non risponde.
  function provaHttps(host) {
    var to = conTimeout(8000);
    return fetch("https://" + host + "/", { mode: "no-cors", cache: "no-store", signal: to.signal, redirect: "follow" })
      .then(function () { to.fine(); return true; })
      .catch(function () { to.fine(); return false; });
  }

  /* ---------- Analisi (funzioni pure, testabili) ---------- */

  function analizzaMx(mxRes) {
    var mx = risposte(mxRes, "MX").map(function (a) { return String(a.data).split(" ").pop().replace(/\.$/, "").toLowerCase(); });
    var fornitori = [
      ["google.com", "Google Workspace"], ["googlemail.com", "Google Workspace"],
      ["outlook.com", "Microsoft 365"], ["ovh.net", "OVHcloud"], ["aruba.it", "Aruba"],
      ["register.it", "Register.it"], ["zoho", "Zoho Mail"], ["protonmail", "Proton Mail"],
      ["secureserver.net", "GoDaddy"], ["serverdata.net", "Serverdata"], ["libero.it", "Libero"],
      ["ionos", "IONOS"], ["mimecast", "Mimecast"], ["pphosted", "Proofpoint"]
    ];
    var fornitore = null;
    mx.forEach(function (h) { fornitori.forEach(function (f) { if (!fornitore && h.indexOf(f[0]) !== -1) fornitore = f[1]; }); });
    var riceve = mx.length > 0 && !(mx.length === 1 && (mx[0] === "" || mx[0] === "."));
    return {
      id: "mx", nome: "Posta in arrivo", stato: "info", punti: 0, max: 0, riceve: riceve, record: mx,
      esito: riceve ? ("Il dominio riceve email" + (fornitore ? " tramite " + fornitore : "") + ".") : "Il dominio non riceve email (nessun record MX).",
      spiegazione: "Indica quale servizio gestisce la posta del dominio. È solo informativo.",
      azione: ""
    };
  }

  function analizzaSpf(txtRecords, riceveEmail) {
    var spf = txtRecords.filter(function (r) { return /^v=spf1(\s|$)/i.test(r.trim()); });
    var c = { id: "spf", nome: "SPF", max: 25, record: spf,
      spiegazione: "L'SPF elenca i server autorizzati a spedire email con il tuo dominio. Senza, è più facile mandare email false a tuo nome." };
    if (spf.length === 0) {
      c.punti = 0;
      c.stato = riceveEmail ? "critico" : "attenzione";
      c.esito = "Nessun record SPF.";
      c.azione = riceveEmail
        ? "Aggiungere un record SPF con i server che usate per la posta, chiuso con -all o ~all."
        : "Se il dominio non manda email, aggiungere il record \"v=spf1 -all\": dice che nessuno può spedire a suo nome.";
      return c;
    }
    if (spf.length > 1) {
      c.punti = 0; c.stato = "critico";
      c.esito = "Ci sono " + spf.length + " record SPF: così non sono validi.";
      c.azione = "Unire i record SPF in uno solo.";
      return c;
    }
    var r = spf[0].trim();
    var termini = r.split(/\s+/).slice(1);
    var lookup = termini.filter(function (t) {
      return /^[+\-~?]?(include:|exists:|ptr|a(?=$|[:\/])|mx(?=$|[:\/]))/i.test(t) || /^redirect=/i.test(t);
    }).length;
    var all = (r.match(/(?:^|\s)([+\-~?]?)all\s*$/i) || [])[1];
    var redirect = /(?:^|\s)redirect=/i.test(r);
    if (all === "-") { c.punti = 25; c.stato = "ok"; c.esito = "SPF presente e rigoroso (-all)."; c.azione = ""; }
    else if (all === "~") { c.punti = 22; c.stato = "ok"; c.esito = "SPF presente (~all): le email non autorizzate vengono segnalate come sospette."; c.azione = "Quando DMARC è attivo e funziona, si può valutare il passaggio a -all."; }
    else if (all === "?") { c.punti = 10; c.stato = "attenzione"; c.esito = "SPF presente ma neutro (?all): non protegge davvero."; c.azione = "Chiudere il record con ~all o -all."; }
    else if (all === "+" || all === "") { c.punti = 0; c.stato = "critico"; c.esito = "SPF con +all: autorizza chiunque a spedire a tuo nome."; c.azione = "Sostituire +all con -all o ~all il prima possibile."; }
    else if (redirect) { c.punti = 20; c.stato = "ok"; c.esito = "SPF presente, rimanda a un altro record (redirect)."; c.azione = ""; }
    else { c.punti = 8; c.stato = "attenzione"; c.esito = "SPF presente ma senza chiusura (manca \"all\")."; c.azione = "Aggiungere ~all o -all alla fine del record."; }
    if (lookup > 10) {
      c.stato = c.stato === "ok" ? "attenzione" : c.stato;
      c.punti = Math.min(c.punti, 12);
      c.esito += " Contiene " + lookup + " rimandi: oltre 10 il record può smettere di funzionare.";
      c.azione = (c.azione ? c.azione + " " : "") + "Ridurre gli include (oltre 10 rimandi l'SPF fallisce).";
    }
    return c;
  }

  function leggiTag(record) {
    var tag = {};
    record.split(";").forEach(function (p) {
      var i = p.indexOf("=");
      if (i > 0) tag[p.slice(0, i).trim().toLowerCase()] = p.slice(i + 1).trim();
    });
    return tag;
  }

  function analizzaDmarc(txtRecords) {
    var dm = txtRecords.filter(function (r) { return /^v=DMARC1\s*(;|$)/i.test(r.trim()); });
    var c = { id: "dmarc", nome: "DMARC", max: 30, record: dm,
      spiegazione: "Il DMARC dice ai provider (Gmail, Outlook…) cosa fare con le email false che usano il tuo dominio: lasciarle passare, metterle in spam o bloccarle." };
    if (dm.length === 0) {
      c.punti = 0; c.stato = "critico"; c.esito = "Nessun record DMARC.";
      c.azione = "Aggiungere un record DMARC su _dmarc, partendo da p=none con i report (rua) per qualche settimana, poi passare a quarantine o reject.";
      return c;
    }
    if (dm.length > 1) {
      c.punti = 0; c.stato = "critico"; c.esito = "Ci sono più record DMARC: così non sono validi."; c.azione = "Tenere un solo record DMARC.";
      return c;
    }
    var t = leggiTag(dm[0]);
    var p = (t.p || "").toLowerCase();
    var pct = t.pct ? parseInt(t.pct, 10) : 100;
    if (p === "reject") { c.punti = 30; c.stato = "ok"; c.esito = "DMARC attivo e rigoroso (reject): le email false vengono bloccate."; c.azione = ""; }
    else if (p === "quarantine") { c.punti = 24; c.stato = "ok"; c.esito = "DMARC attivo (quarantine): le email false finiscono in spam."; c.azione = "Valutare il passaggio a p=reject."; }
    else if (p === "none") { c.punti = 10; c.stato = "attenzione"; c.esito = "DMARC solo in osservazione (p=none): le email false passano lo stesso."; c.azione = "Dopo aver controllato i report, passare a p=quarantine e poi a p=reject."; }
    else { c.punti = 5; c.stato = "attenzione"; c.esito = "DMARC presente ma senza una politica valida."; c.azione = "Correggere il record indicando p=none, quarantine o reject."; }
    if (pct < 100 && (p === "reject" || p === "quarantine")) {
      c.punti -= 6; c.stato = "attenzione";
      c.esito += " Si applica solo al " + pct + "% delle email.";
      c.azione = (c.azione ? c.azione + " " : "") + "Portare pct a 100.";
    }
    if (!t.rua) {
      c.esito += " Non chiede i report.";
      if (c.stato !== "ok" || !c.azione) c.azione = (c.azione ? c.azione + " " : "") + "Aggiungere rua= per ricevere i report e vedere chi usa il dominio.";
    }
    return c;
  }

  function analizzaDkim(trovati) {
    var c = { id: "dkim", nome: "DKIM", max: 15, record: trovati.map(function (t) { return t.selettore + "._domainkey: " + t.record; }),
      spiegazione: "La DKIM è una firma digitale sulle email in uscita: dimostra che il messaggio parte davvero da te e non è stato modificato." };
    if (trovati.length) {
      c.punti = 15; c.stato = "ok";
      c.esito = "Firma DKIM trovata (selettore " + trovati.map(function (t) { return t.selettore; }).join(", ") + ").";
      c.azione = "";
    } else {
      c.punti = 5; c.stato = "verifica";
      c.esito = "Non trovata con i nomi più comuni. Non vuol dire per forza che manchi.";
      c.azione = "Chiedere a chi gestisce la posta di confermare che la firma DKIM sia attiva.";
    }
    return c;
  }

  function analizzaDnssec(dsRes) {
    var ds = risposte(dsRes, "DS");
    return {
      id: "dnssec", nome: "DNSSEC", max: 10, record: ds.map(function (a) { return a.data; }),
      punti: ds.length ? 10 : 0, stato: ds.length ? "ok" : "attenzione",
      esito: ds.length ? "Il dominio è firmato con DNSSEC." : "DNSSEC non attivo.",
      spiegazione: "Il DNSSEC firma le informazioni del dominio, così nessuno può dirottare chi cerca il tuo sito o la tua posta.",
      azione: ds.length ? "" : "Attivarlo dal pannello del registrar: in molti casi basta un clic."
    };
  }

  function analizzaHttps(haSito, raggiungibile, host) {
    var c = { id: "https", nome: "HTTPS del sito", record: host ? ["https://" + host + "/"] : [],
      spiegazione: "Con HTTPS la connessione tra il visitatore e il sito è cifrata e il browser non mostra avvisi di sito non sicuro." };
    if (!haSito) { c.max = 0; c.punti = 0; c.stato = "info"; c.esito = "Nessun sito collegato al dominio."; c.azione = ""; return c; }
    c.max = 10;
    if (raggiungibile) { c.punti = 10; c.stato = "ok"; c.esito = "Il sito risponde in HTTPS (" + host + ")."; c.azione = ""; }
    else { c.punti = 0; c.stato = "attenzione"; c.esito = "Il sito non risponde in HTTPS, oppure il certificato non è valido."; c.azione = "Verificare il certificato del sito con chi lo gestisce (spesso è gratuito, es. Let's Encrypt)."; }
    return c;
  }

  function analizzaExtra(mtaRes, tlsRes, caaRes, riceveEmail) {
    var mta = txt(mtaRes).filter(function (r) { return /^v=STSv1/i.test(r); });
    var tls = txt(tlsRes).filter(function (r) { return /^v=TLSRPTv1/i.test(r); });
    var caa = risposte(caaRes, "CAA").map(function (a) { return a.data; });
    var punti = 0, max = 0, cose = [], manca = [];
    if (riceveEmail) {
      max += 5;
      if (mta.length) { punti += 4; cose.push("MTA-STS"); } else manca.push("MTA-STS");
      if (tls.length) { punti += 1; cose.push("TLS-RPT"); } else manca.push("TLS-RPT");
    }
    max += 5;
    if (caa.length) { punti += 5; cose.push("CAA"); } else manca.push("CAA");
    return {
      id: "extra", nome: "Protezioni extra", max: max, punti: punti,
      stato: manca.length === 0 ? "ok" : "info",
      record: mta.concat(tls, caa),
      esito: (cose.length ? "Attive: " + cose.join(", ") + ". " : "") + (manca.length ? "Non attive: " + manca.join(", ") + "." : ""),
      spiegazione: "Impostazioni avanzate: MTA-STS e TLS-RPT obbligano la cifratura della posta in arrivo; CAA indica quali enti possono emettere certificati per il dominio.",
      azione: manca.length ? "Da valutare dopo SPF, DKIM e DMARC: utili ma non urgenti." : ""
    };
  }

  function voto(controlli) {
    var p = 0, m = 0;
    controlli.forEach(function (c) { p += Math.max(0, c.punti || 0); m += c.max || 0; });
    var pct = m ? Math.round((p / m) * 100) : 0;
    var lettera, giudizio, frase;
    if (pct >= 90) { lettera = "A"; giudizio = "Ottimo"; frase = "Il dominio è ben protetto. Restano al massimo dettagli."; }
    else if (pct >= 75) { lettera = "B"; giudizio = "Buono"; frase = "Le basi ci sono. Qualche ritocco lo rende più difficile da imitare."; }
    else if (pct >= 55) { lettera = "C"; giudizio = "Da migliorare"; frase = "Qualcosa protegge, ma un'email falsa a tuo nome ha buone possibilità di arrivare."; }
    else if (pct >= 35) { lettera = "D"; giudizio = "Debole"; frase = "Mancano protezioni importanti: imitare le tue email è facile."; }
    else { lettera = "E"; giudizio = "A rischio"; frase = "Chiunque può mandare email a nome della tua azienda senza essere fermato."; }
    // Un controllo critico sulla posta impedisce di superare la C
    var critico = controlli.some(function (c) { return c.stato === "critico"; });
    if (critico && (lettera === "A" || lettera === "B")) { lettera = "C"; giudizio = "Da migliorare"; frase = "Il punteggio è buono, ma c'è un problema serio da sistemare."; }
    return { pct: pct, lettera: lettera, giudizio: giudizio, frase: frase };
  }

  function priorita(controlli) {
    var ordine = { critico: 0, attenzione: 1, verifica: 2 };
    return controlli
      .filter(function (c) { return c.azione && ordine.hasOwnProperty(c.stato); })
      .sort(function (a, b) { return (ordine[a.stato] - ordine[b.stato]) || ((b.max || 0) - (a.max || 0)); })
      .slice(0, 3);
  }

  /* ---------- Check-up completo ---------- */

  function eseguiCheckUp(dominio, avanzamento) {
    var passo = avanzamento || function () {};
    passo("Verifico che il dominio esista…");
    return chiediDns(dominio, "NS").then(function (ns) {
      if (ns.Status === 3) { var e = new Error("nxdomain"); throw e; }
      passo("Leggo le impostazioni della posta…");
      var dkimQuery = SELETTORI_DKIM.map(function (s) {
        return chiediDns(s + "._domainkey." + dominio, "TXT").then(function (r) {
          var rec = txt(r).filter(function (t) { return /(^|;)\s*(v=DKIM1|k=rsa|k=ed25519|p=)/i.test(t) && !/p=\s*(;|$)/i.test(t); });
          // Con Microsoft 365 il selettore è un CNAME: il DNS lo segue e restituisce comunque il TXT
          return rec.length ? { selettore: s, record: rec[0].slice(0, 90) + (rec[0].length > 90 ? "…" : "") } : null;
        }).catch(function () { return null; });
      });
      return Promise.all([
        chiediDns(dominio, "MX"),
        chiediDns(dominio, "TXT"),
        chiediDns("_dmarc." + dominio, "TXT"),
        chiediDns(dominio, "DS").catch(function () { return {}; }),
        chiediDns("_mta-sts." + dominio, "TXT").catch(function () { return {}; }),
        chiediDns("_smtp._tls." + dominio, "TXT").catch(function () { return {}; }),
        chiediDns(dominio, "CAA").catch(function () { return {}; }),
        chiediDns(dominio, "A").catch(function () { return {}; }),
        chiediDns("www." + dominio, "A").catch(function () { return {}; }),
        Promise.all(dkimQuery)
      ]);
    }).then(function (r) {
      var mx = analizzaMx(r[0]);
      var haSito = risposte(r[7], "A").length > 0 || risposte(r[8], "A").length > 0 || risposte(r[8], "CNAME").length > 0;
      passo("Controllo il sito…");
      var hostSito = risposte(r[7], "A").length ? dominio : "www." + dominio;
      var httpsP = haSito
        ? provaHttps(hostSito).then(function (ok) { return ok || hostSito === "www." + dominio ? { ok: ok, host: hostSito } : provaHttps("www." + dominio).then(function (ok2) { return { ok: ok2, host: ok2 ? "www." + dominio : hostSito }; }); })
        : Promise.resolve({ ok: false, host: "" });
      return httpsP.then(function (h) {
        var controlli = [
          analizzaSpf(txt(r[1]), mx.riceve),
          analizzaDkim(r[9].filter(Boolean)),
          analizzaDmarc(txt(r[2])),
          analizzaHttps(haSito, h.ok, h.host),
          analizzaDnssec(r[3]),
          analizzaExtra(r[4], r[5], r[6], mx.riceve),
          mx
        ];
        return { dominio: dominio, data: new Date(), controlli: controlli, voto: voto(controlli), priorita: priorita(controlli) };
      });
    });
  }

  /* ---------- Testo per il tecnico ---------- */

  var ETICHETTE = { ok: "OK", attenzione: "DA MIGLIORARE", critico: "CRITICO", verifica: "DA VERIFICARE", info: "INFO" };

  function riepilogoTesto(res) {
    var righe = [];
    righe.push("Check-up email e dominio: " + res.dominio);
    righe.push("Data: " + res.data.toLocaleDateString("it-IT") + " · Voto: " + res.voto.lettera + " (" + res.voto.giudizio + ", " + res.voto.pct + "/100)");
    righe.push("");
    if (res.priorita.length) {
      righe.push("Da sistemare per primo:");
      res.priorita.forEach(function (c, i) { righe.push((i + 1) + ". " + c.nome + ": " + c.azione); });
      righe.push("");
    }
    righe.push("Dettaglio:");
    res.controlli.forEach(function (c) {
      righe.push("- " + c.nome + " [" + ETICHETTE[c.stato] + "] " + c.esito);
      c.record.forEach(function (rec) { righe.push("    " + rec); });
    });
    righe.push("");
    righe.push("Controllo delle sole impostazioni pubbliche, non è un test di sicurezza completo.");
    righe.push("Strumento gratuito: https://marcobacci.it/check-up-dominio/");
    return righe.join("\n");
  }

  var API = {
    normalizzaDominio: normalizzaDominio, testoTxt: testoTxt, analizzaSpf: analizzaSpf,
    analizzaDmarc: analizzaDmarc, analizzaDkim: analizzaDkim, analizzaDnssec: analizzaDnssec,
    analizzaHttps: analizzaHttps, analizzaExtra: analizzaExtra, analizzaMx: analizzaMx,
    voto: voto, priorita: priorita, riepilogoTesto: riepilogoTesto, eseguiCheckUp: eseguiCheckUp
  };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; return; }

  /* ---------- Interfaccia ---------- */

  var doc = root.document;
  var form = doc.getElementById("cu-form");
  if (!form) return;
  var campo = doc.getElementById("cu-dominio");
  var errore = doc.getElementById("cu-errore");
  var bottone = doc.getElementById("cu-avvia");
  var sezione = doc.getElementById("cu-risultati");
  var contenuto = doc.getElementById("cu-contenuto");
  var ultimo = null;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }

  function mostraErrore(msg) { errore.textContent = msg; errore.hidden = !msg; }

  function render(res) {
    var v = res.voto;
    var h = "";
    h += '<div class="cu-voto cu-voto-' + v.lettera.toLowerCase() + '">';
    h += '<div class="cu-lettera" aria-hidden="true">' + v.lettera + "</div>";
    h += '<div class="cu-voto-testo"><p class="eyebrow">Risultato per ' + esc(res.dominio) + "</p>";
    h += "<h2>" + esc(v.giudizio) + ' <span class="cu-pct">' + v.pct + "/100</span></h2>";
    h += "<p>" + esc(v.frase) + "</p></div></div>";

    if (res.priorita.length) {
      h += '<div class="cu-priorita"><h3>Da sistemare per primo</h3><ol>';
      res.priorita.forEach(function (c) { h += "<li><strong>" + esc(c.nome) + ".</strong> " + esc(c.azione) + "</li>"; });
      h += "</ol></div>";
    }

    h += '<ul class="cu-lista">';
    res.controlli.forEach(function (c) {
      h += '<li class="cu-voce cu-' + c.stato + '">';
      h += '<div class="cu-voce-testa"><span class="cu-badge">' + ETICHETTE[c.stato] + "</span><h3>" + esc(c.nome) + "</h3></div>";
      h += '<p class="cu-esito">' + esc(c.esito) + "</p>";
      h += "<details><summary>Cosa significa</summary><p>" + esc(c.spiegazione) + "</p>";
      if (c.azione) h += "<p><strong>Cosa fare:</strong> " + esc(c.azione) + "</p>";
      if (c.record.length) h += '<pre class="cu-record">' + c.record.map(esc).join("\n") + "</pre>";
      h += "</details></li>";
    });
    h += "</ul>";

    h += '<div class="btn-row cu-azioni">';
    h += '<button class="btn btn-primary" type="button" data-cu="copia">Copia il riepilogo per il tuo tecnico</button>';
    h += '<button class="btn btn-outline" type="button" data-cu="stampa">Stampa o salva in PDF</button>';
    h += '<button class="btn btn-outline" type="button" data-cu="nuovo">Controlla un altro dominio</button>';
    h += "</div>";
    h += '<p class="cu-nota" id="cu-copiato" role="status"></p>';

    h += '<div class="cu-cta"><h3>Vuoi sistemarlo senza perderci tempo?</h3>';
    h += "<p>In una call gratuita di 20 minuti guardiamo insieme il risultato e ti dico cosa chiedere, e a chi, per mettere in sicurezza email e dati prima di usare l'AI.</p>";
    h += '<a class="btn btn-primary" href="/prenota/">Prenota una call</a></div>';

    h += '<p class="cu-nota">Controllo delle sole impostazioni pubbliche del dominio, eseguito il ' +
      res.data.toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short" }) +
      ". Non è un test di sicurezza completo.</p>";

    contenuto.innerHTML = h;
  }

  function avvia(valore) {
    mostraErrore("");
    var dominio = normalizzaDominio(valore);
    if (!dominio) { mostraErrore("Scrivi un dominio valido, per esempio studiorossi.it, oppure un indirizzo email."); campo.focus(); return; }
    campo.value = dominio;
    try { history.replaceState(null, "", "#" + encodeURIComponent(dominio)); } catch (e) {}
    bottone.disabled = true;
    sezione.hidden = false;
    contenuto.innerHTML = '<p class="cu-attesa" id="cu-attesa">Avvio il check-up…</p>';
    sezione.scrollIntoView({ behavior: "smooth", block: "start" });
    eseguiCheckUp(dominio, function (msg) { var a = doc.getElementById("cu-attesa"); if (a) a.textContent = msg; })
      .then(function (res) { ultimo = res; render(res); })
      .catch(function (e) {
        sezione.hidden = true;
        mostraErrore(e && e.message === "nxdomain"
          ? "Il dominio " + dominio + " non esiste. Controlla di averlo scritto bene."
          : "Non riesco a contattare il servizio DNS. Controlla la connessione (alcune reti aziendali lo bloccano) e riprova.");
      })
      .then(function () { bottone.disabled = false; });
  }

  form.addEventListener("submit", function (e) { e.preventDefault(); avvia(campo.value); });

  contenuto.addEventListener("click", function (e) {
    var b = e.target.closest("[data-cu]");
    if (!b || !ultimo) return;
    var azione = b.getAttribute("data-cu");
    if (azione === "stampa") {
      Array.prototype.forEach.call(contenuto.querySelectorAll("details"), function (d) { d.open = true; });
      root.print();
    } else if (azione === "nuovo") {
      campo.value = ""; sezione.hidden = true; ultimo = null;
      try { history.replaceState(null, "", location.pathname); } catch (err) {}
      root.scrollTo({ top: 0, behavior: "smooth" }); campo.focus();
    } else if (azione === "copia") {
      var testo = riepilogoTesto(ultimo);
      var nota = doc.getElementById("cu-copiato");
      var fatto = function () { nota.textContent = "Riepilogo copiato. Incollalo in un'email a chi gestisce il tuo dominio."; };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(testo).then(fatto, function () { nota.textContent = "Copia non riuscita: usa \"Stampa o salva in PDF\"."; });
      } else { nota.textContent = "Copia non disponibile su questo browser: usa \"Stampa o salva in PDF\"."; }
    }
  });

  // Link condivisibile: marcobacci.it/check-up-dominio/#dominio.it (il frammento non arriva al server)
  if (location.hash.length > 1) {
    var preset = decodeURIComponent(location.hash.slice(1));
    if (normalizzaDominio(preset)) { campo.value = preset; avvia(preset); }
  }
})(typeof window !== "undefined" ? window : this);
