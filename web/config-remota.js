// Carrega os ajustes de conteúdo salvos no banco (config_publica) e mistura sobre window.CONFIG antes de abrir o app.
// Falhou ou demorou mais de 2,5 s? Segue com o config.js. Só no modo servidor ou supabase.
(async () => {
  const C = window.CONFIG;
  const abrir = () => { const s = document.createElement("script"); s.src = "/app.js"; document.body.appendChild(s); };
  const mistura = (a, b) => { for (const k of Object.keys(b)) a[k] = b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && a[k] && typeof a[k] === "object" ? mistura(a[k], b[k]) : b[k]; return a; };
  try {
    if (C.MODO === "servidor" || C.MODO === "supabase") {
      const base = C.API_URL ? C.API_URL.replace(/\/$/, "") + "/rpc/" : String(C.SUPABASE_URL || "").replace(/\/$/, "") + "/rest/v1/rpc/";
      const h = C.SUPABASE_ANON ? { apikey: C.SUPABASE_ANON, Authorization: "Bearer " + C.SUPABASE_ANON } : {};
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 2500);
      const r = await fetch(base + "config_publica", { headers: h, signal: ctl.signal });
      clearTimeout(t);
      if (r.ok) { const o = await r.json(); if (o && typeof o === "object") ["CAMPANHA", "REGRAS", "LGPD", "BANDEIRAS"].forEach((k) => { if (o[k] !== undefined) C[k] = typeof o[k] === "object" ? mistura(C[k] || {}, o[k]) : o[k]; }); }
    }
  } catch (e) { /* segue com o config.js */ }
  abrir();
})();
