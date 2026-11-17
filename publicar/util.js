// Funções comuns: CPF, telefone, dinheiro, datas e geração do prefixo do cupom.
window.U = (() => {
  const so = (s) => String(s || "").replace(/\D/g, "");
  const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");

  function cpfValido(c) {
    c = so(c);
    if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
    for (let t = 9; t < 11; t++) {
      let s = 0;
      for (let i = 0; i < t; i++) s += +c[i] * (t + 1 - i);
      const d = ((s * 10) % 11) % 10;
      if (d !== +c[t]) return false;
    }
    return true;
  }
  const fmtCPF = (c) => { c = so(c).slice(0, 11); return c.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2"); };
  const mascaraCPF = (c) => { c = so(c); return c.length === 11 ? `***.${c.slice(3, 6)}.${c.slice(6, 9)}-**` : "***"; };
  const fmtTel = (t) => {
    t = so(t).slice(0, 11);
    if (t.length <= 2) return t;
    if (t.length <= 7) return `(${t.slice(0, 2)}) ${t.slice(2)}`;
    return `(${t.slice(0, 2)}) ${t.slice(2, t.length - 4)}-${t.slice(-4)}`;
  };
  const brl = (v) => (+v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const brl2 = (v) => (+v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const n = (v) => (+v || 0).toLocaleString("pt-BR");
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const dataBR = (iso) => { if (!iso) return ""; const [y, m, d] = String(iso).slice(0, 10).split("-"); return `${d}/${m}`; };
  const dataLonga = (iso) => { if (!iso) return ""; const d = new Date(String(iso).slice(0, 10) + "T12:00:00"); return `${DIAS[d.getDay()]} · ${dataBR(iso)}`; };
  const horaBR = (iso) => { if (!iso) return ""; const d = new Date(iso); return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); };
  const hojeISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const primeiroNome = (nome) => String(nome || "").trim().split(/\s+/)[0] || "";

  // Prefixo do cupom: primeiro nome em maiúsculas, sem acento. Se já existe, primeiro nome + inicial do sobrenome; depois numera.
  function gerarPrefixo(nome, usados) {
    const partes = semAcento(nome).toUpperCase().replace(/[^A-Z ]/g, "").trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return "";
    const base = partes[0].slice(0, 10);
    const set = new Set((usados || []).map((p) => String(p).toUpperCase()));
    if (!set.has(base)) return base;
    if (partes[1]) { const b2 = base + partes[1][0]; if (!set.has(b2)) return b2; }
    for (let i = 2; i < 100; i++) if (!set.has(base + i)) return base + i;
    return base + Date.now() % 1000;
  }
  const codigo = (prefixo, seq) => `${prefixo}${String(seq).padStart(3, "0")}`;
  const normCodigo = (s) => semAcento(s).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const aleatorio = (n = 12) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => (b % 36).toString(36)).join("");

  // NFC-e: a chave de acesso tem 44 dígitos e vem no QR do cupom fiscal (parâmetro p=CHAVE|...).
  // cUF(2) AAMM(4) CNPJ(14) modelo(2) série(3) número(9) tpEmis(1) código(8) DV(1)
  function lerNFCe(texto) {
    const m = String(texto || "").match(/\d{44}/) || [so(texto)].filter((x) => x.length === 44);
    if (!m || !m[0]) return null;
    const k = m[0];
    return { chave: k, uf: k.slice(0, 2), aamm: k.slice(2, 6), cnpj: k.slice(6, 20), modelo: k.slice(20, 22), serie: +k.slice(22, 25), numero: +k.slice(25, 34) };
  }
  const fmtCNPJ = (c) => { c = so(c); return c.length === 14 ? c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : c; };
  // data em dd/mm/aaaa [hh:mm] ou ISO -> ISO
  function dataISO(t) {
    t = String(t || "").trim(); if (!t) return "";
    const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2}))?/);
    if (br) return `${br[3]}-${br[2]}-${br[1]}T${br[4] || "12"}:${br[5] || "00"}:00-03:00`;
    // ISO sem fuso (2026-11-28 14:30:00) é horário de Brasília; com fuso (Z ou -03:00) fica como veio
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
      if (/(Z|[+-]\d{2}:?\d{2})$/.test(t)) return t.replace(" ", "T");
      const m = t.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
      return `${m[1]}T${m[2] || "12"}:${m[3] || "00"}:${m[4] || "00"}-03:00`;
    }
    return "";
  }

  // valor em reais: "R$ 1.234,56", "189,90" ou "189.90" -> número (null se vazio)
  function valorNum(t) {
    t = String(t ?? "").replace(/[^\d,.-]/g, ""); if (!t) return null;
    if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
    const v = +t; return isFinite(v) ? v : null;
  }

  // acha UMA loja pelo texto que veio da planilha: id, nome completo, nome sem a marca ou trecho do nome.
  // devolve {loja} ou {erro}; se mais de uma loja serve, não escolhe: pede o nome completo (com 100 lojas, "Centro" casa com dezenas)
  function acharLoja(lojas, txt, bandeira) {
    const n = (x) => semAcento(String(x || "")).toLowerCase().replace(/\s+/g, " ").trim();
    const sem = (x) => n(x).replace(/^(tesoura de ouro|magazine da economia|free center calcados|free center) /, "");
    const alvo = n(txt);
    if (!alvo) return { erro: "loja em branco" };
    const base = lojas.filter((l) => !bandeira || l.bandeira === bandeira);
    const porId = base.filter((l) => String(l.id) === String(txt).trim());
    if (porId.length === 1) return { loja: porId[0] };
    for (const f of [(l) => n(l.nome) === alvo, (l) => sem(l.nome) === sem(alvo), (l) => n(l.nome).includes(alvo), (l) => sem(l.nome).includes(sem(alvo))]) {
      const m = base.filter(f);
      if (m.length === 1) return { loja: m[0] };
      if (m.length > 1) return { erro: `"${txt}" serve para ${m.length} lojas (${m.slice(0, 3).map((l) => l.nome).join("; ")}${m.length > 3 ? "…" : ""}). Use o nome completo ou informe a bandeira na 7ª coluna.` };
    }
    return { erro: `loja "${txt}" não encontrada` };
  }

  return { acharLoja, valorNum, lerNFCe, fmtCNPJ, dataISO, so, semAcento, cpfValido, fmtCPF, mascaraCPF, fmtTel, brl, brl2, n, pct, dataBR, dataLonga, horaBR, hojeISO, esc, primeiroNome, gerarPrefixo, codigo, normCodigo, aleatorio };
})();
