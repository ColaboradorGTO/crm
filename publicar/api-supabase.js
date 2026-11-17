// Bateria real: chama as funções (RPC) do banco definidas em ../supabase/schema.sql (PostgreSQL próprio da GTO ou Supabase).
// As tabelas ficam fechadas para o público; tudo passa por estas funções, que conferem PIN e regras no servidor.
//
// Resiliência (o resultado da ação depende de cada cadastro chegar ao banco):
//  - chamadas públicas (página da influencer) tentam de novo sozinhas se a rede ou o servidor falharem;
//  - cadastrar() pode ser repetido sem risco: o banco devolve o mesmo cupom para o mesmo CPF;
//  - nada que muda dados do CRM é repetido sozinho (evita contar duas vezes);
//  - arquivos grandes são enviados em blocos.
(() => {
  const C = window.CONFIG;
  if (C.MODO !== "supabase" && C.MODO !== "servidor") return;

  // Supabase: SUPABASE_URL + /rest/v1/rpc/. Servidor próprio (PostgREST): API_URL + /rpc/ (ex.: "/api", atrás do mesmo domínio).
  const BASE_RPC = C.API_URL ? `${C.API_URL.replace(/\/$/, "")}/rpc/` : `${String(C.SUPABASE_URL || "").replace(/\/$/, "")}/rest/v1/rpc/`;
  const AUTH = {};
  if (C.SUPABASE_ANON) { AUTH.apikey = C.SUPABASE_ANON; AUTH.Authorization = `Bearer ${C.SUPABASE_ANON}`; }
  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const ATRASOS = [700, 1800, 4000, 8000];

  // uma tentativa: devolve o corpo ou lança Error (com .rede = true quando nem chegou ao servidor, .temporario = vale tentar de novo)
  async function uma(fn, args, { get, limite }) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), limite);
    let r;
    try {
      if (get) {
        const q = new URLSearchParams(Object.entries(args || {}).map(([k, v]) => [k, String(v)])).toString();
        r = await fetch(`${BASE_RPC}${fn}?${q}`, { method: "GET", headers: { ...AUTH }, signal: ctl.signal });
      } else {
        r = await fetch(BASE_RPC + fn, { method: "POST", headers: { "Content-Type": "application/json", ...AUTH }, body: JSON.stringify(args || {}), signal: ctl.signal });
      }
    } catch (e) {
      clearTimeout(t);
      const err = new Error(e.name === "AbortError" ? "O servidor demorou para responder." : "Sem conexão com a internet.");
      err.rede = true; err.temporario = true; throw err;
    }
    clearTimeout(t);
    const txt = await r.text();
    let corpo = null;
    try { corpo = txt ? JSON.parse(txt) : null; } catch (e) { corpo = null; } // página de erro do proxy (HTML) não é JSON
    if (!r.ok) {
      const temp = r.status === 429 || r.status >= 500;
      const msg = (corpo && (corpo.message || corpo.hint)) ||
        (r.status === 429 ? "Muitos acessos ao mesmo tempo. Aguarde alguns segundos." : r.status >= 500 ? "O servidor está ocupado. Tentando de novo." : "Erro no servidor. Tente de novo.");
      const err = new Error(msg); err.status = r.status; err.temporario = temp; err.sem_corpo = !corpo;
      err.naoProcessado = r.status === 429; // barrado pelo limite do nginx antes de chegar ao banco: repetir é seguro
      throw err;
    }
    return corpo;
  }

  // tentativas: 0 = uma só; n = até n repetições com espera crescente
  async function rpc(fn, args, { tentativas = 0, get = false, limite = 30000 } = {}) {
    let k = 0, bloqueios = 0;
    while (true) {
      try { return await uma(fn, args, { get, limite }); }
      catch (e) {
        // "muitos acessos" (429): o pedido nem chegou ao banco, então qualquer chamada pode ser repetida com segurança
        if (e.naoProcessado && bloqueios < 8) { bloqueios++; await espera(900 + bloqueios * 400); continue; }
        // erro com mensagem do banco (regra de negócio) nunca é repetido
        if (!e.temporario || k >= tentativas) throw e;
        await espera(ATRASOS[Math.min(k, ATRASOS.length - 1)]);
        k++;
      }
    }
  }

  // envia listas grandes em blocos; junta os totais. substituirSoPrimeiro: o "substituir tudo" só vale no 1º bloco.
  async function blocos(fn, pin, lista, tam, extra, somar, substituir) {
    const total = {};
    for (let i = 0; i < Math.max(1, lista.length); i += tam) {
      const r = await rpc(fn, { p_pin: String(pin), ...extra(i === 0 ? !!substituir : false), p: lista.slice(i, i + tam) }, { limite: 120000 });
      for (const k of somar) total[k] = (total[k] || 0) + (r[k] || 0);
      total.detalhes = (total.detalhes || []).concat(r.detalhes || []).slice(0, 12);
      for (const k of Object.keys(r)) if (!somar.includes(k) && k !== "detalhes") total[k] = r[k]; // totais finais do banco (do último bloco)
    }
    return total;
  }
  const dinheiro = (v) => (v === "" || v == null ? null : U.valorNum(v));

  window.API = {
    modo: C.MODO,
    // página pública: leitura em cache (GET) com repetição; o servidor guarda poucos segundos para aguentar pico de acessos
    lpInfo: (slug) => rpc("lp_info", { p_slug: String(slug || "").toLowerCase() }, { get: true, tentativas: 3, limite: 15000 }),
    cadastrar: (d) => rpc("cadastrar", { p_slug: String(d.slug).toLowerCase(), p_nome: d.nome, p_cpf: U.so(d.cpf), p_whatsapp: U.so(d.whatsapp), p_bairro: d.bairro || "", p_aceite: !!d.aceite }, { tentativas: 4, limite: 20000 }),
    balcaoEntrar: (pin) => rpc("balcao_entrar", { p_pin: String(pin) }, { tentativas: 1 }),
    balcaoBuscar: (pin, termo) => rpc("balcao_buscar", { p_pin: String(pin), p_termo: String(termo) }, { tentativas: 1 }),
    balcaoValidar: (pin, codigo, fiscal, valor) => rpc("balcao_validar", { p_pin: String(pin), p_codigo: U.normCodigo(codigo), p_cupom_fiscal: String(fiscal || ""), p_valor: dinheiro(valor) }),
    balcaoRecentes: (pin) => rpc("balcao_recentes", { p_pin: String(pin) }, { tentativas: 1 }),
    admEntrar: (pin) => rpc("adm_entrar", { p_pin: String(pin) }, { tentativas: 1 }),
    dados: (pin, sid, band) => rpc("adm_dados", { p_pin: String(pin), p_sabado: +sid || null, p_bandeira: band || null }, { tentativas: 2 }),
    fotoInfluencer: (pin, id) => rpc("adm_influencer_foto", { p_pin: String(pin), p_id: +id }, { tentativas: 1 }),
    // foto: só vai se mudou (undefined = o banco mantém a que já está)
    salvarInfluencer: (pin, o) => rpc("adm_salvar_influencer", { p_pin: String(pin), p: { ...o, whatsapp: U.so(o.whatsapp), prefixo: U.normCodigo(o.prefixo || "") } }),
    async importarInfluencers(pin, linhas) {
      const d = await this.dados(pin, null, null);
      const res = { criadas: [], erros: [] };
      for (const [i, l] of linhas.entries()) {
        const ac = U.acharLoja(d.lojas, l.loja, l.bandeira);
        const sab = d.sabados.find((x) => String(x.n) === String(l.sabado || 1));
        if (!ac.loja) { res.erros.push(`Linha ${i + 1}: ${ac.erro}.`); continue; }
        const loja = ac.loja;
        const prefixos = d.influencers.map((x) => x.prefixo).concat(res.criadas);
        try {
          const inf = await this.salvarInfluencer(pin, { nome: l.nome, instagram: l.instagram, whatsapp: "", prefixo: U.gerarPrefixo(l.nome, prefixos), loja_id: loja.id, sabado_id: sab ? sab.id : d.sabados[0].id, lote: l.lote || 100, meta: l.meta || (sab ? sab.meta : 50), ativo: true });
          res.criadas.push(inf.prefixo);
        } catch (e) { res.erros.push(`Linha ${i + 1}: ${e.message}`); }
      }
      return res;
    },
    salvarLoja: (pin, o) => rpc("adm_salvar_loja", { p_pin: String(pin), p: o }),
    salvarSabado: (pin, o) => rpc("adm_salvar_sabado", { p_pin: String(pin), p: o }),
    cadastros: (pin, f) => rpc("adm_cadastros", { p_pin: String(pin), p_busca: f.busca || "", p_sabado: +f.sabado_id || null, p_influencer: +f.influencer_id || null, p_status: f.status || "", p_loja: +f.loja_id || null, p_bandeira: f.bandeira || null }, { tentativas: 1 }),
    importarNotas: (pin, linhas) => blocos("adm_importar_notas", pin, linhas.map((l) => ({ cpf: U.so(l.cpf), chave: (U.lerNFCe(l.chave) || {}).chave || "", data: U.dataISO(l.data), valor: dinheiro(l.valor) })), 4000, () => ({}), ["usados", "ja_usados", "sem_cupom", "recusadas"]),
    importarVendas: (pin, linhas) => blocos("adm_importar_vendas", pin, linhas.map((l) => ({ cupom: U.normCodigo(l.cupom), cpf: U.so(l.cpf), nota: String(l.nota || ""), data: U.dataISO(l.data), valor: dinheiro(l.valor) })), 4000, () => ({}), ["usados", "ja_usados", "sem_cupom", "recusadas"]),
    baseCpfs: async (pin, cpfs, substituir) => {
      const t = { lidos: 0, total: 0 };
      for (let i = 0; i < Math.max(1, cpfs.length); i += 50000) {
        const r = await rpc("adm_base_cpfs", { p_pin: String(pin), p_cpfs: cpfs.slice(i, i + 50000), p_substituir: i === 0 ? !!substituir : false }, { limite: 120000 });
        t.lidos += r.lidos; t.total = r.total;
      }
      return t;
    },
    importarFimDeAno: (pin, linhas, substituir, band) => blocos("adm_importar_fimdeano", pin,
      linhas.map((l) => ({ cpf: U.so(l.cpf), nome: l.nome || "", nota: String(l.nota || "").trim(), data: U.dataISO(l.data), valor: dinheiro(l.valor), loja: l.loja || "" })),
      4000, (primeiro) => ({ p_substituir: primeiro, p_bandeira: band }), ["importadas", "repetidas", "recusadas"], substituir),
    // lista de tokens é pequena (até alguns milhares): vai de uma vez para o "substituir" valer por influencer
    importarTokens: (pin, linhas, substituir, sabado) => rpc("adm_importar_tokens", { p_pin: String(pin), p_substituir: !!substituir, p_sabado: +sabado || null, p: linhas }, { limite: 120000 }),
    tokens: (pin, sabado) => rpc("adm_tokens", { p_pin: String(pin), p_sabado: +sabado || null }, { tentativas: 1 }),
    comparativo: (pin, sid, band, todos) => rpc("adm_comparativo", { p_pin: String(pin), p_sabado: +sid || null, p_bandeira: band || null, p_todos: !!todos }, { tentativas: 1, limite: 120000 }),
    definirTeste: (pin, teste) => rpc("adm_teste", { p_pin: String(pin), p_teste: !!teste }),
    // chaves da API de relatórios (a chave completa só volta na criação)
    chavesApi: (pin) => rpc("adm_chaves_api", { p_pin: String(pin) }, { tentativas: 1 }),
    criarChaveApi: (pin, o) => rpc("adm_criar_chave_api", { p_pin: String(pin), p_nome: o.nome, p_escopo: o.escopo, p_influencer: +o.influencer || null, p_bandeira: o.bandeira || null, p_expira_em: o.expira_em || null }),
    revogarChaveApi: (pin, id) => rpc("adm_revogar_chave_api", { p_pin: String(pin), p_id: +id }),
  };
})();
