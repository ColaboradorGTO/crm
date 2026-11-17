// Sábado Premiado · app único
//  Público: página da influencer (LP) e balcão da loja.
//  V4: CRM da promo com menu lateral (visão geral, influencers, links e QR, clientes, lojas, sábados, base GTO, configurações).
(() => {
  const C = window.CONFIG, A = window.API, L = window.LOGOS || {};
  const { esc } = U;
  const app = document.getElementById("app");
  const COMISSAO_POR_NOVO = 5, TETO_COMISSAO = 1250;
  // ---------- bandeiras ----------
  const BAND = C.BANDEIRAS || {}, BKEYS = ["tesoura", "magazine", "free"];
  const bInfo = (b) => BAND[b] || BAND.tesoura || { NOME: "Tesoura de Ouro", CURTO: "Tesoura" };
  const PONTO = { "": "#FFFFFF", tesoura: "#E2B567", magazine: "#EC008D", free: "#F16F2C" };
  const RE_MARCAS = new RegExp("^(" + BKEYS.map((k) => bInfo(k).NOME).concat(["Free Center"]).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ") ");
  const semMarca = (nome) => String(nome || "").replace(RE_MARCAS, "");
  // logo da bandeira (imagem de logos.js) ou o nome escrito nas cores dela; claro = para fundo claro
  function marca(b, claro, alt) {
    const x = bInfo(b), src = L[claro ? x.LOGO_CLARO : x.LOGO];
    if (src) return `<img src="${src}" alt="${esc(x.NOME)}"${alt ? ` style="${alt}"` : ""}>`;
    const [p1, ...resto] = x.NOME.split(" ");
    return `<span class="wordmark" style="color:${claro ? x.COR : "#fff"}"><b style="color:${claro ? x.COR : x.DESTAQUE}">${esc(p1)}</b> ${esc(resto.join(" "))}</span>`;
  }
  // variáveis de cor da página pública para a bandeira
  const coresLP = (b) => { const x = bInfo(b); return x.COR ? `--azul:${x.COR};--azul2:${x.COR2};--azul-esc:${x.COR_ESC};--ouro:${x.DESTAQUE};--ouro-esc:${x.DESTAQUE_ESC};--creme:${x.CLARO}` : ""; };
  const ETAPAS = [["convidada", "Convidada"], ["contrato", "Contrato assinado"], ["kit", "Kit entregue"], ["gravacao", "Vídeos enviados"], ["aprovada", "Aprovada"], ["no_ar", "No ar"]];
  const nomeEtapa = (k) => (ETAPAS.find((e) => e[0] === k) || ["", "Convidada"])[1];

  // ---------- sessão (PIN) ----------
  const mem = {};
  const sess = {
    get: (k) => { try { return sessionStorage.getItem("sp-" + k) || mem[k] || ""; } catch (e) { return mem[k] || ""; } },
    set: (k, v) => { mem[k] = v; try { v ? sessionStorage.setItem("sp-" + k, v) : sessionStorage.removeItem("sp-" + k); } catch (e) { /* memória */ } },
  };

  // ---------- rotas ----------
  // hash (artefato): #lp-ana, #balcao, #visao, #influencers, #inf-ana, #links, #clientes, #lojas, #sabados, #base, #config
  // path (hospedado): /ana, /balcao, /crm, /crm/influencers, /crm/inf/ana …
  const SECOES = ["visao", "comparativo", "influencers", "links", "clientes", "lojas", "sabados", "base", "integracoes", "chaves", "config"];
  function rota() {
    if (C.ROTAS === "path") {
      const p = decodeURIComponent(location.pathname.replace(/^\/+|\/+$/g, "")).toLowerCase().split("/");
      if (!p[0]) return { v: "visao" };
      if (p[0] === "balcao") return { v: "balcao" };
      if (p[0] === "crm") { if (p[1] === "inf" && p[2]) return { v: "inf", slug: p[2] }; if (p[1] === "loja" && p[2]) return { v: "loja", slug: p[2] }; return { v: SECOES.includes(p[1]) ? p[1] : "visao" }; }
      return { v: "lp", slug: p[0] };
    }
    const h = decodeURIComponent(location.hash.slice(1)).toLowerCase();
    if (h.startsWith("lp-")) return { v: "lp", slug: h.slice(3) };
    if (h.startsWith("inf-")) return { v: "inf", slug: h.slice(4) };
    if (h.startsWith("loja-")) return { v: "loja", slug: h.slice(5) };
    if (h === "balcao" || SECOES.includes(h)) return { v: h };
    return { v: "visao" };
  }
  function link(v, slug) {
    if (C.ROTAS === "path") {
      if (v === "lp") return `/${slug}`;
      if (v === "balcao") return "/balcao";
      if (v === "inf") return `/crm/inf/${slug}`;
      if (v === "loja") return `/crm/loja/${slug}`;
      return `/crm/${v}`;
    }
    if (v === "lp") return `#lp-${slug}`;
    if (v === "inf") return `#inf-${slug}`;
    if (v === "loja") return `#loja-${slug}`;
    return `#${v}`;
  }
  const linkPublico = (slug) => (C.BASE_URL ? C.BASE_URL.replace(/\/$/, "") + (C.ROTAS === "path" ? `/${slug}` : `/#lp-${slug}`) : link("lp", slug));
  const urlQR = (slug) => { const u = linkPublico(slug); return u.startsWith("http") ? u : location.href.split("#")[0] + u; };
  function ir(v, slug) {
    if (C.ROTAS === "path") { history.pushState(null, "", link(v, slug)); render(); }
    else { const h = link(v, slug); if (location.hash === h) render(); else location.hash = h.slice(1); }
  }
  window.addEventListener("hashchange", render);
  window.addEventListener("popstate", render);
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-ir]");
    if (a && C.ROTAS === "path") { e.preventDefault(); history.pushState(null, "", a.getAttribute("href")); render(); }
  });

  // ---------- utilidades de tela ----------
  let toastT;
  function toast(msg) {
    let t = document.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600);
  }
  async function copiar(texto, el) {
    try { await navigator.clipboard.writeText(texto); toast("Copiado"); return true; }
    catch (e) {
      if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
      toast("Texto selecionado: use Copiar do aparelho"); return false;
    }
  }
  async function salvarArquivo(nome, blob) {
    try {
      const dl = window.claude && window.claude.use ? await window.claude.use("downloads") : null;
      if (dl) { await dl.save({ filename: nome, data: blob }); return; }
    } catch (e) { /* segue para o link */ }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  function qr(el, texto, tam = 150) {
    el.innerHTML = "";
    if (window.QRCode) new QRCode(el, { text: texto, width: tam, height: tam, colorDark: "#001D7E", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M });
    else el.innerHTML = `<div style="width:${tam}px;height:${tam}px;display:grid;place-items:center;font-size:12px;color:#59618A">QR indisponível</div>`;
  }
  const qrCanvas = (el) => el.querySelector("canvas");
  function modal(html, aoAbrir) {
    const f = document.createElement("div");
    f.className = "modal-fundo";
    f.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    f.addEventListener("click", (e) => { if (e.target === f || e.target.closest("[data-fechar]")) f.remove(); });
    document.addEventListener("keydown", function k(e) { if (e.key === "Escape") { f.remove(); document.removeEventListener("keydown", k); } });
    document.body.appendChild(f);
    if (aoAbrir) aoAbrir(f.querySelector(".modal"), () => f.remove());
    const pri = f.querySelector("input,select,textarea"); if (pri) pri.focus();
    return f;
  }
  const faixaDemo = () => ""; // faixa de demonstração removida a pedido (12/11/2026)
  const metaBarra = (feito, meta) => {
    const p = U.pct(feito, meta);
    return `<div class="barra-meta"><div class="trilho"><i class="${p >= 100 ? "bateu" : ""}" style="width:${Math.min(100, p)}%"></i></div><span>${p}%</span></div>`;
  };
  const comissao = (fixo, novos) => (+fixo || 0) + Math.min((novos || 0) * COMISSAO_POR_NOVO, TETO_COMISSAO);
  const avatar = (i, peq) => (i.foto ? `<img class="avatar ${peq ? "peq" : ""}" src="${esc(i.foto)}" alt="">` : `<span class="avatar ${peq ? "peq" : ""}" aria-hidden="true">${esc((i.nome || "?")[0])}</span>`);
  // lê um arquivo de texto: UTF-8 e, se não for, Windows-1252 (CSV do Excel em português); tira o BOM
  function lerArquivo(fl) {
    return new Promise((ok, falha) => {
      const rd = new FileReader();
      rd.onerror = () => falha(new Error("Não consegui ler o arquivo."));
      rd.onload = () => {
        const buf = rd.result;
        let t;
        try { t = new TextDecoder("utf-8", { fatal: true }).decode(buf); }
        catch (e) { t = new TextDecoder("windows-1252").decode(buf); }
        ok(t.replace(/^\uFEFF/, ""));
      };
      rd.readAsArrayBuffer(fl);
    });
  }
  const csvBlob = (cab, linhas) => new Blob(["﻿" + [cab, ...linhas].map((r) => r.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(";")).join("\n")], { type: "text/csv;charset=utf-8" });

  // =====================================================================
  // LP DA INFLUENCER
  // =====================================================================
  async function vLP(slug) {
    app.innerHTML = `<div class="lp"><div class="wrap lp-topo"></div><div class="lp-hero"><p class="muted">Carregando…</p></div></div>`;
    let d;
    try { d = await A.lpInfo(slug); }
    catch (e) {
      app.innerHTML = `<div class="lp"><div class="wrap lp-topo"></div><div class="wrap lp-hero"><h1>Página não encontrada</h1><p>Confira o link que a influencer postou.</p></div></div>`;
      return;
    }
    const pn = U.primeiroNome(d.influencer.nome);
    const bd = (d.loja && d.loja.bandeira) || "tesoura", BX = bInfo(bd);
    document.title = `${C.CAMPANHA} com ${pn}`;
    // cupom já pego neste aparelho: só vale para o sábado atual da influencer (no sábado seguinte a cliente pega outro)
    const salvo = (() => {
      try {
        const x = JSON.parse(localStorage.getItem("sp-cupom-" + slug) || "null");
        if (x && x.data && d.sabado && String(x.data).slice(0, 10) !== String(d.sabado.data).slice(0, 10)) { localStorage.removeItem("sp-cupom-" + slug); return null; }
        return x;
      } catch (e) { return null; }
    })();
    // cadastro que não chegou ao servidor (queda de rede ou do servidor): fica guardado e é reenviado sozinho
    const PK = "sp-pend-" + slug;
    const lerPend = () => { try { const x = JSON.parse(localStorage.getItem(PK) || "null"); return x && Date.now() - x.ts < 6 * 3600 * 1000 ? x : null; } catch (e) { return null; } };
    const guardarPend = (dd) => { try { localStorage.setItem(PK, JSON.stringify({ ...dd, ts: Date.now() })); } catch (e) { /* sem armazenamento */ } };
    const limparPend = () => { try { localStorage.removeItem(PK); } catch (e) { /* ok */ } };
    const foto = d.influencer.foto ? `<img class="lp-foto" src="${esc(d.influencer.foto)}" alt="${esc(pn)}">` : `<div class="lp-foto" aria-hidden="true">${esc(pn[0] || "")}</div>`;
    app.innerHTML = `${faixaDemo()}<div class="lp" data-b="${bd}" style="${coresLP(bd)}">
      <div class="wrap lp-topo">${marca(bd, false)}</div>
      <section class="wrap lp-hero">
        ${foto}
        <span class="lp-eb">${esc(C.CAMPANHA)}</span>
        <h1>Vem comigo na <b>${esc(BX.NOME)}</b></h1>
        <p>Pega o seu cupom aqui e usa no caixa da loja no sábado: o vale entra na hora. Quem convida é a <b style="color:#fff">${esc(pn)}</b>${d.influencer.instagram ? ` (${esc(d.influencer.instagram)})` : ""}.</p>
        <div class="lp-data"><span>Sábado ${U.dataBR(d.sabado.data)}</span><span>${esc(d.loja.nome)}</span>${d.loja.horario ? `<span>${esc(d.loja.horario)}</span>` : ""}</div>
      </section>
      <section class="lp-card" id="lp-corpo"></section>
      <p class="lp-fim">${esc(C.REGRAS)}</p>
      ${termosFimDeAno(bd)}
    </div>`;
    const corpo = document.getElementById("lp-corpo");
    if (salvo && salvo.codigo) return mostrarCupom(corpo, { ...salvo, bandeira: salvo.bandeira || bd }, slug);
    if (d.liberado === false && !lerPend()) {
      corpo.innerHTML = `<h2>Os cupons da ${esc(pn)} ainda não foram liberados</h2><p class="muted" style="margin:0">Volte em breve: assim que o lote for liberado, o cadastro abre aqui. Fica de olho no perfil dela.</p>`;
      return;
    }
    if (d.disponiveis <= 0 && !lerPend()) {
      corpo.innerHTML = `<h2>Os cupons da ${esc(pn)} acabaram</h2><p class="muted" style="margin:0">Todos os cupons deste sábado já foram pegos. Fica de olho no perfil dela: pode ter mais no próximo.</p>`;
      return;
    }
    corpo.innerHTML = `
      <h2>Pegue o seu cupom</h2>
      <ol class="lp-passos"><li>Cadastre-se aqui e receba o seu cupom.</li><li>No sábado ${U.dataBR(d.sabado.data)}, compre na ${esc(d.loja.nome)}.</li><li>Na hora de pagar, mostre o cupom e informe o seu CPF. O vale entra na compra.</li></ol>
      <form id="f-cad" novalidate style="display:grid;gap:12px">
        <div class="campo"><label for="c-nome">Nome completo</label><input id="c-nome" name="nome" autocomplete="name" required></div>
        <div class="campo"><label for="c-cpf">CPF</label><input id="c-cpf" name="cpf" inputmode="numeric" autocomplete="off" placeholder="000.000.000-00" required><span class="dica">O cupom fica ligado ao seu CPF. Só você consegue usar.</span></div>
        <div class="campo"><label for="c-wpp">WhatsApp</label><input id="c-wpp" name="whatsapp" inputmode="tel" autocomplete="tel" placeholder="(61) 90000-0000" required></div>
        <div class="campo"><label for="c-bairro">Bairro <span style="font-weight:400">(opcional)</span></label><input id="c-bairro" name="bairro" autocomplete="address-level3"></div>
        <label class="check" for="c-aceite"><input type="checkbox" id="c-aceite" name="aceite"><span>${esc(String(C.LGPD).replace(/\{MARCA\}/g, BX.NOME))}</span></label>
        <div id="cad-msg"></div>
        <button class="btn ouro" type="submit" style="padding:14px;font-size:16px">Quero o meu cupom</button>
        <p class="lp-regras">${d.disponiveis <= 20 ? `<b style="color:#A86400">Restam só ${d.disponiveis} cupons.</b> ` : ""}Um cupom por CPF.</p>
      </form>`;
    const f = document.getElementById("f-cad");
    f.cpf.addEventListener("input", () => (f.cpf.value = U.fmtCPF(f.cpf.value)));
    f.whatsapp.addEventListener("input", () => (f.whatsapp.value = U.fmtTel(f.whatsapp.value)));
    const msg = document.getElementById("cad-msg");
    const btn = f.querySelector("button[type=submit]");
    let enviando = false, rodadas = 0;
    const concluir = (r, nome) => {
      const dados = { codigo: r.codigo, ja_existia: r.ja_existia, outra: r.outra_influencer, loja: r.loja.nome, endereco: r.loja.endereco, horario: r.loja.horario, data: r.sabado.data, nome: U.primeiroNome(nome), bandeira: (r.loja && r.loja.bandeira) || bd };
      try { localStorage.setItem("sp-cupom-" + slug, JSON.stringify(dados)); } catch (err) { /* sem armazenamento */ }
      limparPend();
      mostrarCupom(corpo, dados, slug);
      corpo.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    async function enviar(dd) {
      if (enviando) return;
      enviando = true; btn.disabled = true; btn.textContent = "Gerando o seu cupom…";
      try {
        const r = await A.cadastrar({ slug, ...dd });
        concluir(r, dd.nome);
      } catch (err) {
        if (err.temporario) {
          // o servidor não respondeu: os dados ficam guardados neste aparelho e a página tenta de novo sozinha
          guardarPend(dd);
          msg.innerHTML = `<div class="aviso alerta">Estamos com instabilidade para confirmar o seu cupom. Os seus dados estão guardados neste aparelho e vamos tentar de novo sozinhos. Não feche esta página.</div>`;
          btn.textContent = "Tentando de novo…";
          rodadas++;
          if (rodadas <= 60) setTimeout(() => { enviando = false; if (document.getElementById("f-cad") === f) enviar(dd); }, 6000);
          else { btn.disabled = false; btn.textContent = "Tentar de novo"; }
        } else {
          limparPend();
          msg.innerHTML = `<div class="aviso erro">${esc(err.message)}</div>`;
          btn.disabled = false; btn.textContent = "Quero o meu cupom";
        }
      } finally { enviando = false; }
    }
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      rodadas = 0;
      enviar({ nome: f.nome.value, cpf: f.cpf.value, whatsapp: f.whatsapp.value, bairro: f.bairro.value, aceite: f.aceite.checked });
    });
    // voltou à página com um cadastro que ficou pendente: reenvia sozinho
    const pend = lerPend();
    if (pend) {
      f.nome.value = pend.nome || ""; f.cpf.value = U.fmtCPF(pend.cpf || ""); f.whatsapp.value = U.fmtTel(pend.whatsapp || ""); f.bairro.value = pend.bairro || ""; f.aceite.checked = !!pend.aceite;
      msg.innerHTML = `<div class="aviso alerta">Retomando o seu cadastro que não tinha chegado ao servidor…</div>`;
      enviar({ nome: pend.nome, cpf: pend.cpf, whatsapp: pend.whatsapp, bairro: pend.bairro, aceite: pend.aceite });
    }
  }

  // termos da campanha de fim de ano no rodapé da página (texto em config.js), com link para o regulamento
  function termosFimDeAno(b) {
    const F = bInfo(b);
    if (!F || !F.TERMOS) return "";
    const t = esc(F.TERMOS).replace(/www\.sonhonovo\.tesouradeouro\.com\.br/g, `<a href="${esc(F.SITE)}" target="_blank" rel="noopener">www.sonhonovo.tesouradeouro.com.br</a>`)
      .replace(/www\.tesouradeouro\.com\.br/g, `<a href="https://www.tesouradeouro.com.br" target="_blank" rel="noopener">www.tesouradeouro.com.br</a>`);
    return `<p class="lp-termos">${t}</p>`;
  }

  function passo4(b) {
    const F = bInfo(b);
    if (!F.SITE && !F.WHATSAPP) return "";
    const onde = [F.SITE ? `em <a href="${esc(F.SITE)}" target="_blank" rel="noopener">${esc(F.SITE_TEXTO || F.SITE)}</a>` : "", F.WHATSAPP ? `no WhatsApp ${esc(F.WHATSAPP)}` : ""].filter(Boolean).join(" ou ");
    return `<li><span>Depois, cadastre o cupom fiscal no sorteio ${esc(F.CAMPANHA || "de fim de ano")} ${onde}${F.PREMIO ? ` e concorra a ${esc(F.PREMIO)}` : ""}.</span></li>`;
  }

  function mostrarCupom(corpo, c, slug) {
    const aviso = c.outra ? `<div class="aviso alerta">Este CPF já tinha um cupom pelo convite da ${esc(U.primeiroNome(c.outra))}. Vale o cupom abaixo.</div>` : c.ja_existia ? `<div class="aviso ok">Você já tinha se cadastrado. Este é o seu cupom.</div>` : "";
    corpo.innerHTML = `
      <h2>${c.nome ? esc(c.nome) + ", " : ""}seu cupom está garantido!</h2>${aviso}
      <div class="cupom" id="cupom-cartao">
        <small>Seu cupom</small>
        <div class="cod" id="cupom-cod">${esc(c.codigo)}</div>
        <div class="qr" id="cupom-qr"></div>
        <div class="info">Sábado <b>${U.dataBR(c.data)}</b> · <b>${esc(c.loja)}</b>${c.horario ? `<br>${esc(c.horario)}` : ""}${c.endereco ? `<br>${esc(c.endereco)}` : ""}</div>
      </div>
      <div class="acoes"><button class="btn" id="b-copiar" type="button">Copiar cupom</button><button class="btn sec" id="b-salvar" type="button">Salvar imagem</button></div>
      <ol class="lp-passos"><li>Tire um print desta tela ou salve a imagem.</li><li>No sábado, escolha as suas peças na loja.</li><li>No caixa, mostre este cupom e informe o seu CPF. O vale entra na hora.</li>${passo4(c.bandeira)}</ol>
      <p class="lp-regras">${esc(C.REGRAS)}</p>
      <button class="btn sec peq" id="b-outro" type="button" style="justify-self:center">Cadastrar outro CPF</button>`;
    qr(document.getElementById("cupom-qr"), c.codigo, 150);
    document.getElementById("b-copiar").onclick = () => copiar(c.codigo, document.getElementById("cupom-cod"));
    document.getElementById("b-salvar").onclick = () => salvarImagemCupom(c);
    document.getElementById("b-outro").onclick = () => { try { localStorage.removeItem("sp-cupom-" + slug); } catch (e) { /* ok */ } vLP(slug); };
  }

  function salvarImagemCupom(c) {
    const W = 720, H = 1000, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    const X = bInfo(c.bandeira || "tesoura");
    g.fillStyle = X.COR || "#001D7E"; g.fillRect(0, 0, W, H);
    const logo = new Image();
    const desenhar = () => {
      if (logo.width) { const lw = 260, lh = (logo.height * lw) / logo.width; g.drawImage(logo, (W - lw) / 2, 60, lw, Math.min(lh, 110)); }
      else { g.fillStyle = "#FFFFFF"; g.font = "700 46px Raleway, Arial"; g.textAlign = "center"; g.fillText(X.NOME, W / 2, 130); }
      g.textAlign = "center";
      g.fillStyle = X.DESTAQUE || "#BF9556"; g.font = "700 26px Roboto, Arial"; g.textAlign = "center"; g.fillText(C.CAMPANHA.toUpperCase(), W / 2, 200);
      g.fillStyle = "#FFFBF5"; roundRect(g, 60, 240, W - 120, 640, 28); g.fill();
      g.setLineDash([12, 10]); g.strokeStyle = X.DESTAQUE || "#BF9556"; g.lineWidth = 4; roundRect(g, 76, 256, W - 152, 608, 22); g.stroke(); g.setLineDash([]);
      g.fillStyle = X.DESTAQUE_ESC || "#9C7438"; g.font = "700 24px Roboto, Arial"; g.fillText("SEU CUPOM", W / 2, 320);
      g.fillStyle = X.COR || "#001D7E"; g.font = "700 84px 'Roboto Mono', Menlo, monospace"; g.fillText(c.codigo, W / 2, 415);
      const q = qrCanvas(document.getElementById("cupom-qr")); if (q) g.drawImage(q, (W - 260) / 2, 450, 260, 260);
      g.fillStyle = "#0D1540"; g.font = "600 28px Roboto, Arial"; g.fillText(`Sábado ${U.dataBR(c.data)}`, W / 2, 760);
      g.fillStyle = "#59618A"; g.font = "400 24px Roboto, Arial"; g.fillText(c.loja, W / 2, 800); if (c.horario) g.fillText(c.horario, W / 2, 836);
      g.fillStyle = "rgba(255,255,255,.85)"; g.font = "400 21px Roboto, Arial";
      quebra(g, "No caixa, mostre este cupom e informe o seu CPF. O vale entra na hora.", W / 2, 930, W - 120, 28);
      cv.toBlob((b) => salvarArquivo(`cupom-${c.codigo}.png`, b), "image/png");
    };
    logo.onload = desenhar; logo.onerror = desenhar;
    if (L[X.LOGO]) logo.src = L[X.LOGO]; else desenhar();
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function quebra(g, txt, x, y, max, alt) { const p = txt.split(" "); let l = "", ys = y; for (const w of p) { if (g.measureText(l + w).width > max) { g.fillText(l.trim(), x, ys); l = ""; ys += alt; } l += w + " "; } g.fillText(l.trim(), x, ys); }

  // =====================================================================
  // BALCÃO DA LOJA (tela própria, sem o CRM)
  // =====================================================================
  const FILA = "sp-fila-validacoes";
  const lerFila = () => { try { return JSON.parse(localStorage.getItem(FILA) || "[]"); } catch (e) { return []; } };
  const gravarFila = (f) => { try { localStorage.setItem(FILA, JSON.stringify(f)); } catch (e) { /* ok */ } };
  async function enviarFila() {
    const f = lerFila(); if (!f.length) return;
    const resto = [];
    for (const it of f) { try { await A.balcaoValidar(it.pin, it.codigo, it.fiscal, it.valor); } catch (e) { resto.push(e.rede ? it : { ...it, erro: e.message }); } }
    const recusadas = resto.filter((x) => x.erro);
    gravarFila(resto.filter((x) => !x.erro));
    if (recusadas.length) toast(`${recusadas.length} validação(ões) recusadas: ${recusadas.map((x) => x.codigo + " (" + x.erro + ")").join(", ")}`);
    else if (resto.length < f.length) toast(`${f.length - resto.length} validação(ões) enviadas`);
  }
  window.addEventListener("online", enviarFila);

  const barraBalcao = (extra) => `${faixaDemo()}<header class="barra"><div class="wrap"><img class="tes" src="${L.tesouraBranco || ""}" alt="Tesoura de Ouro"><span class="nome">${esc(C.CAMPANHA)} · Consulta do cupom</span>${extra || ""}</div></header>`;

  function loginBalcao() {
    app.innerHTML = `${barraBalcao()}<main class="wrap"><form class="login painel" id="f-login">
      <h1 style="font-size:22px;font-weight:400">Consulta do cupom</h1>
      <p class="muted" style="margin:0">Digite o PIN da sua loja para conferir os cupons.</p>
      <div class="campo"><label for="pin">PIN</label><input id="pin" inputmode="numeric" autocomplete="off" maxlength="8" required style="text-align:center;font-size:22px;letter-spacing:.3em"></div>
      <div id="login-msg"></div><button class="btn" type="submit">Entrar</button>
      ${A.modo === "demo" ? `<p class="muted" style="font-size:13px">Demonstração: PIN da loja Ceilândia Centro <b>${A.pinDemo.loja}</b></p>` : ""}
    </form></main>`;
    const f = document.getElementById("f-login"); f.pin.focus();
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      try { const r = await A.balcaoEntrar(f.pin.value.trim()); sess.set("loja", f.pin.value.trim()); sess.set("loja-nome", r.loja.nome); vBalcao(); }
      catch (err) { document.getElementById("login-msg").innerHTML = `<div class="aviso erro">${esc(err.message)}</div>`; }
    });
  }

  async function vBalcao() {
    document.title = `${C.CAMPANHA} · Balcão`;
    const pin = sess.get("loja");
    if (!pin) return loginBalcao();
    enviarFila();
    app.innerHTML = `${barraBalcao(`<button class="btn sec peq" id="b-sair" type="button">Trocar loja</button>`)}<main class="wrap pagina"><div class="balcao grade">
      <div class="cab"><div><h1>${esc(sess.get("loja-nome"))}</h1><p>Confira o cupom ou o CPF da cliente antes de digitar o código no PDV.</p></div></div>
      <form class="busca" id="f-busca"><input id="termo" placeholder="ANA014 ou CPF" autocomplete="off" autocapitalize="characters" aria-label="Cupom ou CPF"><button class="btn" type="submit">Buscar</button></form>
      <div id="b-camera"></div>
      <div id="res"></div>
      <div class="painel"><h2>Últimas validações nesta loja</h2><div class="hist" id="hist"><span class="muted">Carregando…</span></div></div>
    </div></main>`;
    document.getElementById("b-sair").onclick = () => { sess.set("loja", ""); vBalcao(); };
    const f = document.getElementById("f-busca"), res = document.getElementById("res");
    f.termo.focus();
    if ("BarcodeDetector" in window && navigator.mediaDevices) {
      document.getElementById("b-camera").innerHTML = `<button class="btn sec" type="button" id="b-ler">Ler QR do cupom com a câmera</button>`;
      document.getElementById("b-ler").onclick = () => lerQR((cod) => { f.termo.value = cod; buscar(); });
    }
    async function historico() {
      const h = await A.balcaoRecentes(pin).catch(() => []);
      const fila = lerFila();
      document.getElementById("hist").innerHTML = fila.map((x) => `<div><span><code>${esc(x.codigo)}</code> <span class="pill alerta">aguardando internet</span></span><span class="muted">${U.horaBR(x.ts)}</span></div>`).join("") +
        (h.length ? h.map((c) => `<div><span><code>${esc(c.codigo)}</code> · ${esc(c.nome)} · ${esc(U.primeiroNome(c.influencer))}</span><span class="muted num">${U.horaBR(c.usado_em)}</span></div>`).join("") : fila.length ? "" : `<span class="muted">Nenhuma ainda.</span>`);
    }
    historico();
    async function buscar() {
      const termo = f.termo.value.trim(); if (!termo) return;
      res.innerHTML = `<p class="muted">Buscando…</p>`;
      try {
        const r = await A.balcaoBuscar(pin, termo);
        const c = r.cupom;
        res.innerHTML = `<div class="resultado ${r.valido ? "valido" : "invalido"}">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span class="grande">${esc(c.codigo)}</span>${r.valido ? `<span class="pill ok">Válido</span>` : `<span class="pill erro">Não pode usar</span>`}</div>
          ${r.aviso_teste ? `<div class="aviso alerta">${esc(r.aviso_teste)}</div>` : ""}
          ${r.motivos.length ? `<div class="aviso erro">${r.motivos.map(esc).join("<br>")}</div>` : ""}
          <dl class="dl"><dt>Cliente</dt><dd>${esc(c.nome)}</dd><dt>CPF</dt><dd class="num">${esc(c.cpf_mascara)}</dd><dt>Influencer</dt><dd>${esc(c.influencer)}</dd><dt>Loja</dt><dd>${esc(c.loja_nome)}</dd><dt>Sábado</dt><dd>${U.dataBR(c.sabado_data)}</dd>
          ${c.status === "usado" ? `<dt>Cupom fiscal</dt><dd>${esc(c.cupom_fiscal || "")}</dd>` : ""}</dl>
          ${r.valido ? `<form id="f-val" style="display:grid;gap:10px">
            <div class="campo"><label for="v-fiscal">Cupom fiscal</label><input id="v-fiscal" autocomplete="off" placeholder="Leia o QR da nota ou digite o número" required><span class="dica" id="v-nota">Com o QR da nota, o sistema confere a loja e o mês e impede usar a mesma nota duas vezes.</span></div>
            ${"BarcodeDetector" in window && navigator.mediaDevices ? `<button class="btn sec" type="button" id="v-ler">Ler QR do cupom fiscal</button>` : ""}
            <div class="campo"><label for="v-valor">Valor da compra (R$)</label><input id="v-valor" inputmode="decimal" placeholder="0,00"></div>
            <div id="v-msg"></div>
            <button class="btn ouro" type="submit" style="padding:14px">Confirmar e entregar o vale</button></form>` : ""}
        </div>`;
        const fv = document.getElementById("f-val");
        if (fv) {
          const vf = fv.querySelector("#v-fiscal"), vn = fv.querySelector("#v-nota");
          const mostrarNota = () => { const nf = U.lerNFCe(vf.value); vn.textContent = nf ? `NFC-e nº ${nf.numero} · série ${nf.serie} · CNPJ ${U.fmtCNPJ(nf.cnpj)} · ${nf.aamm.slice(2)}/20${nf.aamm.slice(0, 2)}` : "Com o QR da nota, o sistema confere a loja e o mês e impede usar a mesma nota duas vezes."; };
          vf.addEventListener("input", mostrarNota);
          const bl = fv.querySelector("#v-ler"); if (bl) bl.onclick = () => lerQR((t) => { vf.value = t; mostrarNota(); });
          vf.focus();
          fv.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fiscal = fv.querySelector("#v-fiscal").value.trim(), valor = fv.querySelector("#v-valor").value.trim();
            if (!fiscal) { fv.querySelector("#v-msg").innerHTML = `<div class="aviso erro">Leia o QR do cupom fiscal ou digite o número da nota.</div>`; return; }
            const bt = fv.querySelector("button"); bt.disabled = true;
            try {
              await A.balcaoValidar(pin, c.codigo, fiscal, valor);
              res.innerHTML = `<div class="resultado valido"><span class="pill ok" style="justify-self:start">Vale liberado</span><span class="grande">${esc(c.codigo)}</span><p style="margin:0">Entregue o vale para ${esc(U.primeiroNome(c.nome))}. Cupom marcado como usado.</p></div>`;
              f.termo.value = ""; f.termo.focus(); historico();
            } catch (err) {
              if (err.rede) {
                const fila = lerFila(); fila.push({ pin, codigo: c.codigo, fiscal, valor, ts: new Date().toISOString() }); gravarFila(fila);
                res.innerHTML = `<div class="resultado"><span class="pill alerta" style="justify-self:start">Sem internet</span><p style="margin:0">Validação guardada neste aparelho. Ela é enviada quando a internet voltar. Pode entregar o vale.</p></div>`;
                f.termo.value = ""; historico();
              } else { fv.querySelector("#v-msg").innerHTML = `<div class="aviso erro">${esc(err.message)}</div>`; bt.disabled = false; }
            }
          });
        }
      } catch (err) {
        res.innerHTML = err.rede ? `<div class="aviso alerta">Sem internet para consultar. Anote CPF, cupom e nº do cupom fiscal na ficha de papel.</div>` : `<div class="aviso erro">${esc(err.message)}</div>`;
      }
    }
    f.addEventListener("submit", (e) => { e.preventDefault(); buscar(); });
  }

  async function lerQR(aoLer) {
    let stream;
    const m = modal(`<h2>Aponte a câmera para o QR</h2><video id="cam" playsinline muted style="width:100%;border-radius:10px;background:#000"></video><div class="rodape"><button class="btn sec" data-fechar type="button">Fechar</button></div>`);
    const parar = () => { if (stream) stream.getTracks().forEach((t) => t.stop()); };
    m.addEventListener("click", (e) => { if (e.target === m || e.target.closest("[data-fechar]")) parar(); });
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const v = m.querySelector("#cam"); v.srcObject = stream; await v.play();
      const det = new BarcodeDetector({ formats: ["qr_code"] });
      const loop = async () => {
        if (!document.body.contains(m)) return parar();
        try { const cods = await det.detect(v); if (cods.length) { parar(); m.remove(); return aoLer(cods[0].rawValue); } } catch (e) { /* tenta de novo */ }
        requestAnimationFrame(loop);
      };
      loop();
    } catch (e) { m.querySelector(".modal").insertAdjacentHTML("beforeend", `<div class="aviso erro">Não foi possível abrir a câmera. Digite o cupom.</div>`); }
  }

  // =====================================================================
  // CRM DA PROMO (V4)
  // =====================================================================
  const IC = {
    visao: '<path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"/>',
    influencers: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M16 4a4 4 0 0 1 0 8M22 21c0-3-2-5-4-5.6"/>',
    links: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    clientes: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
    lojas: '<path d="M3 9l2-5h14l2 5M4 9v11h16V9M3 9h18M9 20v-6h6v6"/>',
    sabados: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    base: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    config: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    balcao: '<path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M7 12h10"/>',
    comparativo: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>',
    chaves: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>',
    integracoes: '<path d="M7 7h10v10H7z"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
    loja: '<path d="M3 9l2-5h14l2 5M4 9v11h16V9M3 9h18M9 20v-6h6v6"/>',
    lp: '<path d="M12 21s-7-4.4-7-11a7 7 0 0 1 14 0c0 6.6-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  };
  const ico = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[k] || ""}</svg>`;

  let D = null, sabSel = "1", band = sess.get("band") || "";
  if (band && !BKEYS.includes(band)) band = "";
  async function carregar(sid) { D = await A.dados(sess.get("adm"), sid, band); return D; }
  const nomeLoja = (id) => semMarca((D.lojas.find((l) => l.id === +id) || {}).nome || "");
  const nomeBand = () => (band ? bInfo(band).NOME : "Grupo GTO");
  const sabado = (id) => D.sabados.find((s) => s.id === +id) || {};
  const infPorSlug = (slug) => D.influencers.find((i) => i.slug === slug);

  function loginCRM() {
    document.title = `${C.CAMPANHA} · CRM`;
    app.innerHTML = `${faixaDemo()}<div class="lp" style="display:grid;align-content:center;padding:24px 16px">
      <form class="login painel" id="f-login" style="margin:0 auto;color:var(--tinta)">
        <img src="${L.tesouraAzul || ""}" alt="Tesoura de Ouro" style="height:36px;width:auto;justify-self:center">
        <h1 style="font-size:22px;font-weight:400">CRM do ${esc(C.CAMPANHA)}</h1>
        <p class="muted" style="margin:0">Área da V4. Entre com o PIN.</p>
        <div class="campo"><label for="pin">Senha</label><input id="pin" type="password" autocomplete="current-password" maxlength="40" required style="text-align:center;font-size:20px"></div>
        <div id="login-msg"></div><button class="btn" type="submit">Entrar</button>
        ${A.modo === "demo" ? `<p class="muted" style="font-size:13px">Demonstração: PIN <b>${A.pinDemo.admin}</b></p>` : ""}
        <img src="${L.v4Preto || ""}" alt="V4 Company Kloh" style="height:18px;width:auto;justify-self:center;opacity:.7">
      </form></div>`;
    const f = document.getElementById("f-login"); f.pin.focus();
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      try { await A.admEntrar(f.pin.value.trim()); sess.set("adm", f.pin.value.trim()); render(); }
      catch (err) { document.getElementById("login-msg").innerHTML = `<div class="aviso erro">${esc(err.message)}</div>`; }
    });
  }

  // casca do CRM (menu lateral + área de trabalho); devolve o elemento de conteúdo
  function casca(ativo, titulo) {
    document.title = `${titulo} · ${nomeBand()} · ${C.CAMPANHA}`;
    const nInf = D.influencers.filter((i) => i.ativo).length;
    const nCli = D.influencers.reduce((a, i) => a + i.emitidos, 0);
    const it = (k, t, cont) => `<a href="${link(k)}" data-ir class="${k === ativo ? "on" : ""}">${ico(k)}<span>${t}</span>${cont != null ? `<span class="cont">${U.n(cont)}</span>` : ""}</a>`;
    app.innerHTML = `${faixaDemo()}<div class="crm" id="crm">
      <aside class="lateral" aria-label="Menu">
        <div class="marca">${band ? marca(band, false) : `<img src="${L.tesouraBranco || ""}" alt="Grupo Tesoura de Ouro">`}<b>${esc(C.CAMPANHA)}</b><span>CRM da promo · ${esc(nomeBand())}</span></div>
        <div class="bandeiras" role="group" aria-label="Bandeira">
          ${[["", "Geral (grupo)"]].concat(BKEYS.map((k) => [k, bInfo(k).NOME])).map(([k, n]) => `<button type="button" data-band="${k}" class="${band === k ? "on" : ""}" aria-pressed="${band === k}"><i style="background:${PONTO[k]}"></i>${esc(n)}</button>`).join("")}
        </div>
        <nav class="menu">
          <span class="grupo">Acompanhar</span>
          ${it("visao", "Visão geral")}
          ${it("comparativo", "Comparativo fim de ano")}
          ${it("influencers", "Influencers", nInf)}
          ${it("clientes", "Clientes e cupons", nCli)}
          <span class="grupo">Gerenciar</span>
          ${it("links", "Links e QR")}
          ${it("lojas", "Lojas", D.lojas.length)}
          ${it("sabados", "Sábados", D.sabados.length)}
          ${it("base", "Base GTO")}
          ${it("integracoes", "Caixa (PDV)")}
          ${it("chaves", "API e relatórios")}
          ${it("config", "Configurações")}
          <span class="grupo">Atalhos</span>
          <a href="${link("balcao")}" data-ir>${ico("balcao")}<span>Consulta do cupom</span></a>
          <a href="${link("lp", (D.influencers[0] || {}).slug || "")}" data-ir>${ico("lp")}<span>Ver uma página</span></a>
        </nav>
        <div class="pe">
          ${A.modo === "demo" ? `<span class="modo">Modo demonstração</span>` : `<span>Banco conectado</span>`}
          ${D.teste ? `<span class="pill alerta" style="justify-self:start">Modo teste ligado</span>` : ""}
          <button type="button" id="b-sair">Sair</button>
          <img src="${L.v4Branco || ""}" alt="V4 Company Kloh">
        </div>
      </aside>
      <div class="trabalho">
        <div class="topo-crm"><button type="button" id="b-menu" aria-label="Abrir menu">Menu</button><span style="font-size:14px">${esc(nomeBand())} · ${esc(titulo)}</span></div>
        <main class="conteudo" id="conteudo"></main>
      </div>
    </div>`;
    const crm = document.getElementById("crm");
    document.getElementById("b-menu").onclick = (e) => { e.stopPropagation(); crm.classList.toggle("aberto"); };
    crm.addEventListener("click", (e) => { if (crm.classList.contains("aberto") && (e.target.closest(".menu a") || !e.target.closest(".lateral"))) crm.classList.remove("aberto"); });
    document.getElementById("b-sair").onclick = () => { sess.set("adm", ""); render(); };
    crm.querySelectorAll("[data-band]").forEach((b) => (b.onclick = () => {
      band = b.dataset.band; sess.set("band", band);
      const v = rota().v; if (v === "inf" || v === "loja") ir("visao"); else render();
    }));
    return document.getElementById("conteudo");
  }
  const seletorSabado = (id, comTodos = true) => `<div class="campo"><label for="${id}">Sábado</label><select id="${id}">${comTodos ? `<option value="">Todos</option>` : ""}${D.sabados.map((s) => `<option value="${s.id}" ${+sabSel === s.id ? "selected" : ""}>${s.n}º · ${U.dataBR(s.data)}</option>`).join("")}</select></div>`;
  function ligarSeletor(el, id) { const s = el.querySelector("#" + id); if (s) s.onchange = (e) => { sabSel = e.target.value; render(); }; }

  async function vCRM(r) {
    if (!sess.get("adm")) return loginCRM();
    try { await carregar(sabSel); } catch (e) { sess.set("adm", ""); return loginCRM(); }
    return ({ visao: secVisao, comparativo: secComparativo, influencers: secInfluencers, inf: secFicha, loja: secLoja, links: secLinks, clientes: secClientes, lojas: secLojas, sabados: secSabados, base: secBase, integracoes: secIntegracoes, chaves: secChaves, config: secConfig })[r.v](r);
  }

  // ---------- visão geral ----------
  let auto;
  function secVisao() {
    clearInterval(auto);
    const el = casca("visao", "Visão geral");
    const s = sabado(sabSel);
    const infs = D.influencers.filter((i) => i.ativo || i.emitidos).map((i) => ({ ...i, disp: Math.max(0, i.lote - i.emitidos), com: comissao(s.fixo != null ? s.fixo : sabado(i.sabado_id).fixo, i.novos) }));
    const tot = infs.reduce((a, i) => ({ em: a.em + i.emitidos, lote: a.lote + i.lote, us: a.us + i.usados, nov: a.nov + (i.novos || 0), meta: a.meta + i.meta, com: a.com + i.com, bateu: a.bateu + (i.usados >= i.meta ? 1 : 0) }), { em: 0, lote: 0, us: 0, nov: 0, meta: 0, com: 0, bateu: 0 });
    const temNovos = infs.some((i) => i.novos !== null);
    const alertas = [];
    infs.filter((i) => i.disp === 0).forEach((i) => alertas.push(["erro", `Lote esgotado: ${U.primeiroNome(i.nome)}. Aumente o lote se quiser seguir distribuindo.`, i.slug]));
    infs.filter((i) => i.disp > 0 && i.disp <= 10).forEach((i) => alertas.push(["alerta", `Lote quase no fim: ${U.primeiroNome(i.nome)} tem ${i.disp} cupons disponíveis.`, i.slug]));
    const fora = D.influencers.filter((i) => i.ativo && i.etapa !== "no_ar");
    if (fora.length) alertas.push(["alerta", `${fora.length} influencer(s) ainda não estão no ar: ${fora.map((i) => U.primeiroNome(i.nome)).slice(0, 6).join(", ")}${fora.length > 6 ? "…" : ""}.`, "__inf"]);
    infs.filter((i) => i.ativo && i.tokens_modo && i.tokens_livres < 10).forEach((i) => alertas.push([i.tokens_livres ? "alerta" : "erro", i.tokens_livres ? `Tokens quase no fim: ${U.primeiroNome(i.nome)} tem ${i.tokens_livres} livres.` : `Sem tokens do PDV: ${U.primeiroNome(i.nome)}. A página dela está avisando que acabou.`, i.slug]));
    if (!temNovos) alertas.push(["alerta", "Base da GTO não carregada: clientes novos e comissão ficam incompletos.", "__base"]);
    if (D.teste) alertas.push(["alerta", "Modo teste ligado: o balcão aceita cupom fora do sábado. Desligar antes de 28/11.", "__config"]);
    const destino = (k) => (k === "__inf" ? link("influencers") : k === "__base" ? link("base") : k === "__config" ? link("config") : link("inf", k));
    const top = [...infs].sort((a, b) => b.usados - a.usados).slice(0, 6);
    const pior = [...infs].sort((a, b) => a.usados / a.meta - b.usados / b.meta).slice(0, 6);
    const fun = [["Cupons no lote", tot.lote], ["Distribuídos", tot.em], ["Usados", tot.us], ["Clientes novos", temNovos ? tot.nov : null]];
    const ativas = D.influencers.filter((i) => i.ativo).length || 1;
    el.innerHTML = `
      <div class="titulo-pag"><div><h1>Visão geral · ${esc(nomeBand())}</h1><p>${s.n ? `${s.n}º sábado · ${U.dataLonga(s.data)} · ${esc(s.label || "")}` : "Todos os sábados"} · atualiza a cada 30 s</p></div>
        <div class="acoes-pag">${seletorSabado("v-sab")}</div></div>
      <div class="grade g4">
        <div class="painel kpi"><small>Cupons distribuídos</small><b>${U.n(tot.em)}</b><span>de ${U.n(tot.lote)} · ${U.n(Math.max(0, tot.lote - tot.em))} disponíveis</span></div>
        <div class="painel kpi"><small>Cupons usados</small><b>${U.n(tot.us)}</b><span>${U.pct(tot.us, tot.em)}% dos distribuídos · meta ${U.n(tot.meta)}</span></div>
        <div class="painel kpi"><small>Clientes novos</small><b>${temNovos ? U.n(tot.nov) : "—"}</b><span>${temNovos ? `${U.pct(tot.nov, tot.us)}% dos usados · alvo 50%` : "carregue a Base GTO"}</span></div>
        <div class="painel kpi"><small>Comissão estimada</small><b>${U.brl(tot.com)}</b><span>${tot.bateu} de ${infs.length} bateram a meta</span></div>
      </div>
      ${band ? "" : porBandeira()}
      ${alertas.length ? `<div class="alertas">${alertas.slice(0, 6).map(([t, m, k]) => `<a href="${destino(k)}" data-ir class="aviso ${t}">${esc(m)}</a>`).join("")}${alertas.length > 6 ? `<span class="muted" style="font-size:13px">e mais ${alertas.length - 6} aviso(s)</span>` : ""}</div>` : ""}
      <div class="grade g2" style="align-items:start">
        <div class="painel"><h2>Funil da promo</h2><div class="funil">${fun.map(([n, v]) => `<div class="et"><span>${n}</span><div class="tr"><i style="width:${v == null ? 0 : Math.max(2, U.pct(v, tot.lote || 1))}%"></i></div><b>${v == null ? "—" : U.n(v)}</b></div>`).join("")}</div>
          <p class="muted" style="font-size:12.5px;margin:12px 0 0">Do lote à venda: quantos pegaram o cupom, quantos compraram e quantos eram clientes novos.</p></div>
        <div class="painel"><h2>Etapas das influencers</h2><div class="funil">${ETAPAS.map(([k, n]) => { const q = D.influencers.filter((i) => i.ativo && i.etapa === k).length; return `<div class="et"><span>${n}</span><div class="tr"><i style="width:${U.pct(q, ativas)}%"></i></div><b>${q}</b></div>`; }).join("")}</div></div>
      </div>
      <div class="painel grafico"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px"><h2 style="margin:0">Cupons por dia</h2><div class="legenda"><span><i style="background:#BF9556"></i>Distribuídos</span><span><i style="background:#001D7E"></i>Usados</span></div></div>${grafico(D.serie)}</div>
      <div class="grade g2" style="align-items:start">
        <div class="painel"><h2>Quem mais trouxe clientes</h2>${listaRank(top)}</div>
        <div class="painel"><h2>Precisam de atenção</h2>${listaRank(pior)}</div>
      </div>
      <p class="muted" style="font-size:12.5px;margin:0">Comissão estimada = fixo do sábado + R$ ${COMISSAO_POR_NOVO} por cliente novo (até ${U.brl(TETO_COMISSAO)}). Cliente novo = CPF que usou o cupom e não estava na base da GTO.</p>`;
    ligarSeletor(el, "v-sab");
    auto = setInterval(() => { if (rota().v !== "visao") return clearInterval(auto); const y = scrollY; vCRM({ v: "visao" }).then(() => scrollTo(0, y)); }, 30000);
  }
  // quadro do grupo: uma linha por bandeira (só na visão Geral)
  function porBandeira() {
    const linhas = BKEYS.map((k) => {
      const lojas = D.lojas.filter((l) => (l.bandeira || "tesoura") === k), ids = new Set(lojas.map((l) => l.id));
      const infs = D.influencers.filter((i) => ids.has(i.loja_id));
      const t = infs.reduce((a, i) => ({ em: a.em + i.emitidos, us: a.us + i.usados, meta: a.meta + i.meta, nov: a.nov + (i.novos || 0), lote: a.lote + i.lote }), { em: 0, us: 0, meta: 0, nov: 0, lote: 0 });
      return { k, lojas: lojas.length, ativas: infs.filter((i) => i.ativo).length, ...t };
    });
    const tot = linhas.reduce((a, x) => ({ lojas: a.lojas + x.lojas, ativas: a.ativas + x.ativas, em: a.em + x.em, us: a.us + x.us, meta: a.meta + x.meta, nov: a.nov + x.nov, lote: a.lote + x.lote }), { lojas: 0, ativas: 0, em: 0, us: 0, meta: 0, nov: 0, lote: 0 });
    const temNovos = D.influencers.some((i) => i.novos !== null);
    return `<div class="painel"><h2>Por bandeira</h2><div class="tab" style="border:0"><table><thead><tr><th>Bandeira</th><th class="num">Lojas</th><th class="num">Influencers</th><th class="num">Distribuídos</th><th class="num">Usados</th><th>Meta</th><th class="num">Clientes novos</th></tr></thead><tbody>
      ${linhas.map((x) => `<tr class="clicavel" data-trocar="${x.k}"><td><span class="ponto" style="background:${PONTO[x.k]}"></span><b>${esc(bInfo(x.k).NOME)}</b></td><td class="num">${U.n(x.lojas)}</td><td class="num">${U.n(x.ativas)}</td><td class="num">${U.n(x.em)} <span class="sub">de ${U.n(x.lote)}</span></td><td class="num">${U.n(x.us)}</td><td style="width:170px">${metaBarra(x.us, x.meta || 1)}<span class="sub">${U.n(x.us)} de ${U.n(x.meta)}</span></td><td class="num">${temNovos ? U.n(x.nov) : "·"}</td></tr>`).join("")}
      <tr><td><b>Grupo</b></td><td class="num"><b>${U.n(tot.lojas)}</b></td><td class="num"><b>${U.n(tot.ativas)}</b></td><td class="num"><b>${U.n(tot.em)}</b></td><td class="num"><b>${U.n(tot.us)}</b></td><td>${metaBarra(tot.us, tot.meta || 1)}</td><td class="num"><b>${temNovos ? U.n(tot.nov) : "·"}</b></td></tr>
      </tbody></table></div><p class="muted" style="font-size:12.5px;margin:10px 0 0">Clique numa bandeira para abrir o controle dela.</p></div>`;
  }
  document.addEventListener("click", (e) => {
    const t = e.target.closest("tr[data-trocar]"); if (!t) return;
    band = t.dataset.trocar; sess.set("band", band); render();
  });

  const listaRank = (lista) => `<div class="tab" style="border:0"><table><tbody>${lista.map((i) => `<tr class="clicavel" data-slug="${i.slug}"><td style="width:44px">${avatar(i, true)}</td><td><b>${esc(i.nome)}</b><span class="sub">${esc(nomeLoja(i.loja_id))}</span></td><td style="width:170px">${metaBarra(i.usados, i.meta)}<span class="sub">${U.n(i.usados)} de ${U.n(i.meta)}</span></td></tr>`).join("")}</tbody></table></div>`;

  function grafico(serie) {
    if (!serie.length) return `<p class="muted">Sem cupons ainda.</p>`;
    const W = 900, H = 220, pe = 34, pb = 26, pt = 10;
    const max = Math.max(...serie.map((d) => Math.max(d.emitidos, d.usados)), 1);
    const passo = Math.pow(10, Math.floor(Math.log10(max))), topo = Math.ceil(max / passo) * passo;
    const bw = (W - pe) / serie.length, y = (v) => pt + (H - pt - pb) * (1 - v / topo);
    let g = "";
    for (let k = 0; k <= 4; k++) { const v = (topo / 4) * k; g += `<line x1="${pe}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="#E6E9F3"/><text x="${pe - 6}" y="${y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`; }
    serie.forEach((d, i) => {
      const x = pe + i * bw, w = Math.min(22, bw / 3);
      g += `<rect x="${x + bw / 2 - w - 1}" y="${y(d.emitidos)}" width="${w}" height="${H - pb - y(d.emitidos)}" fill="#BF9556" rx="2"><title>${U.dataBR(d.dia)}: ${d.emitidos} distribuídos</title></rect>`;
      g += `<rect x="${x + bw / 2 + 1}" y="${y(d.usados)}" width="${w}" height="${H - pb - y(d.usados)}" fill="#001D7E" rx="2"><title>${U.dataBR(d.dia)}: ${d.usados} usados</title></rect>`;
      g += `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${U.dataBR(d.dia)}</text>`;
    });
    return `<div style="overflow-x:auto"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cupons distribuídos e usados por dia" style="min-width:560px">${g}</svg></div>`;
  }

  // cliques em linhas: influencer abre a ficha, cliente abre o histórico do CPF
  document.addEventListener("click", async (e) => {
    const ti = e.target.closest("tr[data-slug]");
    if (ti) return ir("inf", ti.dataset.slug);
    const tl = e.target.closest("tr[data-loja]");
    if (tl) return ir("loja", tl.dataset.loja);
    const tc = e.target.closest("tr[data-cpf]");
    if (tc) return fichaCliente(tc.dataset.cpf);
  });

  // ---------- influencers: quadro de etapas e lista ----------
  let visInf = "quadro", buscaInf = "", ordem = { k: "usados", d: -1 };
  function secInfluencers() {
    const el = casca("influencers", "Influencers");
    el.innerHTML = `
      <div class="titulo-pag"><div><h1>Influencers</h1><p>${D.influencers.filter((i) => i.ativo).length} ativas. No quadro, arraste o cartão para mudar a etapa e clique para abrir a ficha.</p></div>
        <div class="acoes-pag"><button class="btn sec" id="b-import" type="button">Importar lista</button><button class="btn" id="b-nova" type="button">Nova influencer</button></div></div>
      <div class="filtros">
        <div class="campo" style="flex:1"><label for="i-busca">Buscar</label><input id="i-busca" placeholder="Nome, prefixo ou loja" value="${esc(buscaInf)}"></div>
        ${seletorSabado("i-sab")}
        <div class="alterna" role="group" aria-label="Visualização"><button type="button" data-vis="quadro" class="${visInf === "quadro" ? "on" : ""}">Quadro</button><button type="button" data-vis="lista" class="${visInf === "lista" ? "on" : ""}">Lista</button></div>
      </div>
      <div id="i-area"></div>`;
    const area = el.querySelector("#i-area");
    const filtradas = () => { const b = U.semAcento(buscaInf).toLowerCase(); return D.influencers.filter((i) => !b || U.semAcento(`${i.nome} ${i.prefixo} ${nomeLoja(i.loja_id)}`).toLowerCase().includes(b)); };
    const desenhar = () => (visInf === "quadro" ? quadro(area, filtradas()) : listaInf(area, filtradas()));
    desenhar();
    el.querySelector("#i-busca").addEventListener("input", (e) => { buscaInf = e.target.value; desenhar(); });
    el.querySelectorAll("[data-vis]").forEach((b) => (b.onclick = () => { visInf = b.dataset.vis; secInfluencers(); }));
    ligarSeletor(el, "i-sab");
    el.querySelector("#b-nova").onclick = () => formInfluencer(null);
    el.querySelector("#b-import").onclick = importarLista;
  }
  function quadro(area, lista) {
    area.innerHTML = `<div class="quadro">${ETAPAS.map(([k, n]) => {
      const it = lista.filter((i) => (i.etapa || "convidada") === k);
      return `<div class="coluna" data-etapa="${k}"><h3><span>${n}</span><span>${it.length}</span></h3>${it.map((i) => `<a class="cartao" draggable="true" data-id="${i.id}" href="${link("inf", i.slug)}" data-ir>
        <div style="display:flex;gap:8px;align-items:center">${avatar(i, true)}<div style="min-width:0"><b>${esc(i.nome)}</b><div class="sub">${esc(nomeLoja(i.loja_id))}</div></div></div>
        <div class="sub"><code>${esc(i.prefixo)}</code> · ${U.n(i.emitidos)} de ${U.n(i.lote)} cupons${i.ativo ? "" : " · pausada"}</div>${metaBarra(i.usados, i.meta)}</a>`).join("")}</div>`;
    }).join("")}</div>`;
    let arrastado = null;
    area.querySelectorAll(".cartao").forEach((c) => {
      c.addEventListener("dragstart", (e) => { arrastado = +c.dataset.id; c.classList.add("arrastando"); e.dataTransfer.effectAllowed = "move"; });
      c.addEventListener("dragend", () => c.classList.remove("arrastando"));
    });
    area.querySelectorAll(".coluna").forEach((col) => {
      col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("sobre"); });
      col.addEventListener("dragleave", () => col.classList.remove("sobre"));
      col.addEventListener("drop", async (e) => {
        e.preventDefault(); col.classList.remove("sobre");
        const i = D.influencers.find((x) => x.id === arrastado); if (!i || i.etapa === col.dataset.etapa) return;
        await moverEtapa(i, col.dataset.etapa); secInfluencers();
      });
    });
  }
  async function moverEtapa(i, etapa) {
    try { await A.salvarInfluencer(sess.get("adm"), { ...i, etapa }); i.etapa = etapa; toast(`${U.primeiroNome(i.nome)}: ${nomeEtapa(etapa)}`); }
    catch (err) { toast(err.message); }
  }
  function listaInf(area, lista) {
    const th = (k, t, n) => `<th class="ord ${n ? "n" : ""}" data-o="${k}">${t}${ordem.k === k ? (ordem.d > 0 ? " ↑" : " ↓") : ""}</th>`;
    const l = lista.map((i) => ({ ...i, disp: Math.max(0, i.lote - i.emitidos), pmeta: i.usados / i.meta, conv: i.emitidos ? i.usados / i.emitidos : 0, com: comissao(sabSel ? sabado(sabSel).fixo : sabado(i.sabado_id).fixo, i.novos), lojaN: nomeLoja(i.loja_id) }));
    l.sort((a, b) => { const x = a[ordem.k], y = b[ordem.k]; return (typeof x === "string" ? x.localeCompare(y) : (x || 0) - (y || 0)) * ordem.d; });
    area.innerHTML = `<div class="tab"><table><thead><tr>${th("nome", "Influencer")}${th("etapa", "Etapa")}${th("emitidos", "Distribuídos", 1)}${th("disp", "Disponíveis", 1)}${th("usados", "Usados", 1)}${th("pmeta", "Meta")}${th("conv", "Conversão", 1)}${th("novos", "Novos", 1)}${th("com", "Comissão est.", 1)}</tr></thead><tbody>
      ${l.map((i) => `<tr class="clicavel" data-slug="${i.slug}"><td><div style="display:flex;gap:10px;align-items:center">${avatar(i, true)}<div><b>${esc(i.nome)}</b><span class="sub"><code>${esc(i.prefixo)}</code> · ${esc(i.lojaN)}</span></div></div></td>
        <td><span class="pill ${i.etapa === "no_ar" ? "ok" : "neutro"}">${nomeEtapa(i.etapa)}</span></td><td class="n">${U.n(i.emitidos)}</td><td class="n">${i.disp === 0 ? `<span class="pill alerta">esgotado</span>` : U.n(i.disp)}</td><td class="n">${U.n(i.usados)}</td>
        <td>${metaBarra(i.usados, i.meta)}</td><td class="n">${Math.round(i.conv * 100)}%</td><td class="n">${i.novos === null ? `<span class="muted">a cruzar</span>` : U.n(i.novos)}</td><td class="n">${U.brl(i.com)}</td></tr>`).join("") || `<tr><td colspan="9" class="muted">Nenhuma influencer encontrada.</td></tr>`}
      </tbody></table></div>`;
    area.querySelectorAll("th[data-o]").forEach((t) => (t.onclick = () => { const k = t.dataset.o; ordem = { k, d: ordem.k === k ? -ordem.d : k === "nome" || k === "etapa" ? 1 : -1 }; listaInf(area, lista); }));
  }

  // ---------- ficha da influencer ----------
  async function secFicha(r) {
    const i = infPorSlug(r.slug);
    if (!i) { casca("influencers", "Influencers").innerHTML = `<p>Influencer não encontrada. <a href="${link("influencers")}" data-ir>Voltar</a></p>`; return; }
    const el = casca("influencers", i.nome);
    const loja = D.lojas.find((l) => l.id === i.loja_id) || {}, s = sabado(i.sabado_id);
    const url = linkPublico(i.slug);
    const disp = Math.max(0, i.lote - i.emitidos);
    const idx = ETAPAS.findIndex((e) => e[0] === i.etapa);
    el.innerHTML = `
      <a class="volta" href="${link("influencers")}" data-ir>‹ Influencers</a>
      <div class="painel ficha-topo">${avatar(i)}
        <div style="flex:1;min-width:220px"><h1 style="font-size:24px;font-weight:400">${esc(i.nome)}</h1>
          <p class="muted" style="margin:2px 0 0">${esc(i.instagram || "")}${i.whatsapp ? " · " + U.fmtTel(i.whatsapp) : ""} · ${esc(loja.nome || "")} · ${s.n}º sábado ${U.dataBR(s.data)}</p>
          <p style="margin:6px 0 0">Cupons <code class="cod-inline">${esc(i.prefixo)}001</code> em diante ${i.ativo ? `<span class="pill ok">Página ativa</span>` : `<span class="pill neutro">Página pausada</span>`}</p></div>
        <div class="acoes-pag"><a class="btn sec" href="${link("lp", i.slug)}" data-ir>Ver a página</a><button class="btn" id="f-ed" type="button">Editar</button></div>
      </div>
      <div class="painel"><h2>Etapa</h2><div class="etapas-linha">${ETAPAS.map(([k, n], j) => `<button type="button" data-et="${k}" class="${k === i.etapa ? "on" : j < idx ? "feita" : ""}">${n}</button>`).join("")}</div></div>
      <div class="grade g4">
        <div class="painel kpi"><small>Distribuídos</small><b>${U.n(i.emitidos)}</b><span>${U.n(disp)} disponíveis de ${U.n(i.lote)}</span></div>
        <div class="painel kpi"><small>Usados</small><b>${U.n(i.usados)}</b><span>meta ${U.n(i.meta)} · ${U.pct(i.usados, i.meta)}%</span></div>
        <div class="painel kpi"><small>Clientes novos</small><b>${i.novos === null ? "—" : U.n(i.novos)}</b><span>${i.novos === null ? "aguardando a Base GTO" : U.pct(i.novos, i.usados) + "% dos usados"}</span></div>
        <div class="painel kpi"><small>Comissão estimada</small><b>${U.brl(comissao(s.fixo, i.novos))}</b><span>fixo ${U.brl(s.fixo)} + novos</span></div>
      </div>
      <div class="grade g2" style="align-items:start">
        <div class="painel grade"><h2 style="margin:0">Link e QR</h2>
          <div class="link-card"><div class="qrm" id="f-qr"></div><div style="min-width:0"><div class="u" id="f-url">${esc(url)}</div><div class="bts"><button class="btn peq" id="f-cp" type="button">Copiar link</button><button class="btn sec peq" id="f-qrs" type="button">Baixar QR</button><button class="btn sec peq" id="f-kit" type="button">Mensagem para ela</button></div></div></div></div>
        <div class="painel grade"><h2 style="margin:0">Anotações</h2><div class="campo"><label for="f-notas" class="muted">Combinados, contrato, contato, pendências</label><textarea id="f-notas" style="font-family:var(--f-texto);font-size:14px">${esc(i.notas || "")}</textarea></div><button class="btn sec peq" id="f-salvar-notas" type="button" style="justify-self:start">Salvar anotações</button></div>
      </div>
      <div class="painel"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px"><h2 style="margin:0">Clientes dela</h2><span class="muted" id="f-tot"></span></div><div id="f-cli"><p class="muted">Carregando…</p></div></div>`;
    qr(el.querySelector("#f-qr"), urlQR(i.slug), 74);
    el.querySelector("#f-cp").onclick = () => copiar(url, el.querySelector("#f-url"));
    el.querySelector("#f-qrs").onclick = () => baixarQR(i);
    el.querySelector("#f-kit").onclick = () => mensagemKit(i);
    el.querySelector("#f-ed").onclick = () => formInfluencer(i);
    el.querySelectorAll("[data-et]").forEach((b) => (b.onclick = async () => { await moverEtapa(i, b.dataset.et); secFicha(r); }));
    el.querySelector("#f-salvar-notas").onclick = async () => { const n = el.querySelector("#f-notas").value; try { await A.salvarInfluencer(sess.get("adm"), { ...i, notas: n }); i.notas = n; toast("Anotações salvas"); } catch (e) { toast(e.message); } };
    const c = await A.cadastros(sess.get("adm"), { influencer_id: i.id });
    el.querySelector("#f-tot").textContent = `${U.n(c.total)} cupons`;
    el.querySelector("#f-cli").innerHTML = tabelaClientes(c.linhas, false);
  }
  function baixarQR(i) {
    const tmp = document.createElement("div"); qr(tmp, urlQR(i.slug), 600);
    const cv = qrCanvas(tmp); if (cv) cv.toBlob((b) => salvarArquivo(`qr-${i.slug}.png`, b));
  }
  function textoKit(i) {
    const loja = D.lojas.find((l) => l.id === i.loja_id) || {}, s = sabado(i.sabado_id);
    return `Oi, ${U.primeiroNome(i.nome)}! Aqui está o seu link do ${C.CAMPANHA}:\n${linkPublico(i.slug)}\n\nQuem entrar nesse link se cadastra com CPF e recebe um cupom seu (${i.prefixo}001, ${i.prefixo}002…). Você tem ${i.lote} cupons para distribuir.\nSábado ${U.dataBR(s.data)} na ${loja.nome || ""}${loja.horario ? ", " + loja.horario : ""}. A cliente compra no caixa com o CPF e mostra o cupom no balcão para ganhar o vale.\nSua meta: ${i.meta} cupons usados.`;
  }
  function mensagemKit(i) {
    const t = textoKit(i);
    modal(`<h2>Mensagem para ${esc(U.primeiroNome(i.nome))}</h2><div class="kit" id="k-txt">${esc(t)}</div><div class="rodape"><button class="btn sec" data-fechar type="button">Fechar</button><button class="btn" id="k-cp" type="button">Copiar mensagem</button></div>`, (m) => {
      m.querySelector("#k-cp").onclick = () => copiar(t, m.querySelector("#k-txt"));
    });
  }

  // lê a imagem enviada, recorta o centro em quadrado e reduz para 480 px (JPEG), para guardar junto da influencer
  function fotoQuadrada(arquivo, lado = 480) {
    return new Promise((ok, falha) => {
      if (!/^image\//.test(arquivo.type)) return falha(new Error("Envie uma imagem em JPG, PNG ou WebP."));
      if (arquivo.size > 15 * 1024 * 1024) return falha(new Error("A imagem passa de 15 MB. Envie uma menor."));
      const url = URL.createObjectURL(arquivo), img = new Image();
      img.onload = () => {
        const q = Math.min(img.naturalWidth, img.naturalHeight), cv = document.createElement("canvas");
        cv.width = cv.height = Math.min(lado, q);
        cv.getContext("2d").drawImage(img, (img.naturalWidth - q) / 2, (img.naturalHeight - q) / 2, q, q, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        ok(cv.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); falha(new Error("Não consegui abrir essa imagem. Tente salvar como JPG e enviar de novo.")); };
      img.src = url;
    });
  }

  function formInfluencer(i) {
    const novo = !i;
    i = i || { nome: "", instagram: "", whatsapp: "", loja_id: "", sabado_id: D.sabados[0].id, lote: 100, meta: D.sabados[0].meta, prefixo: "", foto: "", ativo: true, etapa: "convidada", notas: "" };
    const travado = !novo && i.emitidos > 0;
    modal(`<h2>${novo ? "Nova influencer" : "Editar " + esc(U.primeiroNome(i.nome))}</h2>
      <form id="f-inf" class="grade" novalidate>
        <div class="campo"><label for="fi-nome">Nome completo</label><input id="fi-nome" value="${esc(i.nome)}" required></div>
        <div class="grade g2">
          <div class="campo"><label for="fi-pref">Prefixo do cupom</label><input id="fi-pref" value="${esc(i.prefixo)}" ${travado ? "readonly" : ""} style="text-transform:uppercase"><span class="dica">${travado ? "Fixo: já tem cupons emitidos." : "Primeiro nome. Repetido ganha a inicial do sobrenome."}</span></div>
          <div class="campo"><label for="fi-insta">Instagram</label><input id="fi-insta" value="${esc(i.instagram)}" placeholder="@perfil"></div>
        </div>
        <div class="grade g2">
          <div class="campo"><label for="fi-loja">Loja</label><select id="fi-loja"><option value="">Escolha</option>${D.lojas.map((l) => `<option value="${l.id}" ${l.id === +i.loja_id ? "selected" : ""}>${esc(l.nome)}</option>`).join("")}</select></div>
          <div class="campo"><label for="fi-sab">Sábado atual</label><select id="fi-sab">${D.sabados.map((s) => `<option value="${s.id}" ${s.id === +i.sabado_id ? "selected" : ""}>${s.n}º · ${U.dataBR(s.data)} · meta ${s.meta}</option>`).join("")}</select></div>
        </div>
        <div class="grade g2">
          <div class="campo"><label for="fi-lote">Lote de cupons</label><input id="fi-lote" type="number" min="1" value="${i.lote}"><span class="dica">Quantos cupons a página pode distribuir.</span></div>
          <div class="campo"><label for="fi-meta">Meta de cupons usados</label><input id="fi-meta" type="number" min="1" value="${i.meta}"></div>
        </div>
        <div class="grade g2">
          <div class="campo"><label for="fi-wpp">WhatsApp</label><input id="fi-wpp" value="${esc(U.fmtTel(i.whatsapp))}" inputmode="tel"></div>
          <div class="campo"><label for="fi-etapa">Etapa</label><select id="fi-etapa">${ETAPAS.map(([k, n]) => `<option value="${k}" ${k === i.etapa ? "selected" : ""}>${n}</option>`).join("")}</select></div>
        </div>
        <div class="campo"><label for="fi-foto-arq">Foto da página</label>
          <div class="foto-up">
            <div class="foto-prev" id="fi-foto-prev">${i.foto ? `<img src="${esc(i.foto)}" alt="">` : `<span>${esc((i.nome || "?")[0])}</span>`}</div>
            <div class="grade" style="gap:6px;min-width:0">
              <input id="fi-foto-arq" type="file" accept="image/jpeg,image/png,image/webp">
              <span class="dica">JPG, PNG ou WebP. A foto é recortada em quadrado e reduzida antes de salvar.</span>
              <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sec peq" id="fi-foto-link-b" type="button">Usar link</button><button class="btn sec peq" id="fi-foto-tirar" type="button" ${i.foto ? "" : "hidden"}>Remover foto</button></div>
              <input id="fi-foto-link" placeholder="https://…" value="${/^https?:/.test(i.foto || "") ? esc(i.foto) : ""}" hidden>
            </div>
          </div>
          <input type="hidden" id="fi-foto" value="${esc(i.foto)}"></div>
        <label class="check" for="fi-ativo"><input type="checkbox" id="fi-ativo" ${i.ativo ? "checked" : ""}><span>Página ativa (recebendo cadastros)</span></label>
        <div id="fi-msg"></div>
        <div class="rodape"><button class="btn sec" data-fechar type="button">Cancelar</button><button class="btn" type="submit">Salvar</button></div>
      </form>`, (m, fechar) => {
      const f = m.querySelector("#f-inf"), pref = m.querySelector("#fi-pref");
      if (novo) m.querySelector("#fi-nome").addEventListener("input", (e) => { pref.value = U.gerarPrefixo(e.target.value, D.influencers.map((x) => x.prefixo)); });
      m.querySelector("#fi-sab").onchange = (e) => { const s = sabado(e.target.value); if (s.meta) m.querySelector("#fi-meta").value = s.meta; };
      m.querySelector("#fi-wpp").addEventListener("input", (e) => (e.target.value = U.fmtTel(e.target.value)));
      const foto = m.querySelector("#fi-foto"), prev = m.querySelector("#fi-foto-prev"), tirar = m.querySelector("#fi-foto-tirar"), lk = m.querySelector("#fi-foto-link");
      let fotoMudou = false;
      // a lista não traz a imagem embutida (pesada): busca só desta influencer, para mostrar e manter
      if (!novo && i.tem_foto && !i.foto) A.fotoInfluencer(sess.get("adm"), i.id).then((r) => { if (!fotoMudou && r.foto) { foto.value = r.foto; prev.innerHTML = `<img src="${esc(r.foto)}" alt="">`; tirar.hidden = false; } }).catch(() => {});
      const mostrar = (v) => { fotoMudou = true; foto.value = v; prev.innerHTML = v ? `<img src="${esc(v)}" alt="">` : `<span>${esc((m.querySelector("#fi-nome").value || "?")[0])}</span>`; tirar.hidden = !v; };
      m.querySelector("#fi-foto-arq").onchange = async (e) => {
        const fl = e.target.files[0]; if (!fl) return;
        try { mostrar(await fotoQuadrada(fl)); lk.value = ""; }
        catch (err) { m.querySelector("#fi-msg").innerHTML = `<div class="aviso erro">${esc(err.message)}</div>`; }
      };
      m.querySelector("#fi-foto-link-b").onclick = () => { lk.hidden = !lk.hidden; if (!lk.hidden) lk.focus(); };
      lk.oninput = () => mostrar(lk.value.trim());
      tirar.onclick = () => { mostrar(""); lk.value = ""; m.querySelector("#fi-foto-arq").value = ""; };
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
          const salvo = await A.salvarInfluencer(sess.get("adm"), { id: i.id, nome: m.querySelector("#fi-nome").value, prefixo: pref.value, instagram: m.querySelector("#fi-insta").value, whatsapp: m.querySelector("#fi-wpp").value, loja_id: m.querySelector("#fi-loja").value, sabado_id: m.querySelector("#fi-sab").value, lote: m.querySelector("#fi-lote").value, meta: m.querySelector("#fi-meta").value, foto: (novo || fotoMudou) ? m.querySelector("#fi-foto").value : undefined, ativo: m.querySelector("#fi-ativo").checked, etapa: m.querySelector("#fi-etapa").value, notas: i.notas });
          fechar(); toast("Influencer salva"); ir("inf", salvo.slug);
        } catch (err) { m.querySelector("#fi-msg").innerHTML = `<div class="aviso erro">${esc(err.message)}</div>`; }
      });
    });
  }

  function importarLista() {
    const ex = "Ana Clara Ribeiro;@anaclara;Ceilândia Centro;1;100;50\nBruna Martins;@brunamartins;Taguatinga Centro;1;100;50";
    modal(`<h2>Importar influencers</h2>
      <p class="muted" style="margin:0">Uma por linha, separando por ponto e vírgula: <b>nome; instagram; loja; sábado (1, 2 ou 3); lote; meta; bandeira</b> (tesoura, magazine ou free). A loja pode ser parte do nome, mas se mais de uma loja servir a linha é recusada: use o nome completo ou a bandeira. Dá para colar direto da planilha.</p>
      <div class="campo"><label for="imp">Lista</label><textarea id="imp" placeholder="${esc(ex)}" style="min-height:180px"></textarea></div>
      <div id="imp-msg"></div>
      <div class="rodape"><button class="btn sec" data-fechar type="button">Fechar</button><button class="btn" id="imp-ok" type="button">Importar</button></div>`, (m) => {
      m.querySelector("#imp-ok").onclick = async () => {
        const linhas = m.querySelector("#imp").value.split(/\n/).map((l) => l.split(/[;\t]/).map((x) => x.trim())).filter((p) => p[0])
          .map(([nome, instagram, loja, sab, lote, meta, bandeira]) => ({ nome, instagram, loja, sabado: sab || 1, lote: +lote || 100, meta: +meta || 0, bandeira: (U.semAcento(bandeira || "").toLowerCase().match(/tesoura|magazine|free/) || [""])[0] }));
        if (!linhas.length) { m.querySelector("#imp-msg").innerHTML = `<div class="aviso erro">Cole pelo menos uma linha.</div>`; return; }
        const r = await A.importarInfluencers(sess.get("adm"), linhas);
        m.querySelector("#imp-msg").innerHTML = `<div class="aviso ${r.erros.length ? "alerta" : "ok"}">${r.criadas.length} criadas${r.criadas.length ? ": " + r.criadas.join(", ") : ""}.${r.erros.length ? "<br>" + r.erros.map(esc).join("<br>") : ""}</div>`;
        if (r.criadas.length) { toast("Lista importada"); await carregar(sabSel); secInfluencers(); }
      };
    });
  }

  // ---------- links e QR ----------
  function secLinks() {
    const el = casca("links", "Links e QR");
    const ativas = D.influencers.filter((i) => i.ativo);
    el.innerHTML = `
      <div class="titulo-pag"><div><h1>Links e QR</h1><p>O link e o QR de cada influencer, para a bio, os stories e os vídeos.</p></div>
        <div class="acoes-pag"><button class="btn sec" id="l-csv" type="button">Baixar planilha de links</button><button class="btn" id="l-todos" type="button">Copiar todos os links</button></div></div>
      ${!C.BASE_URL ? `<div class="aviso alerta">Ainda sem domínio: os links abaixo são os da demonstração. Quando o domínio entrar, eles mudam sozinhos.</div>` : ""}
      <div class="links-grade">${ativas.map((i) => `<div class="painel link-card"><div class="qrm" data-qr="${i.slug}"></div>
        <div style="min-width:0"><b>${esc(i.nome)}</b><div class="muted" style="font-size:12.5px">${esc(nomeLoja(i.loja_id))} · <code>${esc(i.prefixo)}</code></div>
        <div class="u" data-u="${i.slug}">${esc(linkPublico(i.slug))}</div>
        <div class="bts"><button class="btn peq" data-cp="${i.slug}" type="button">Copiar</button><button class="btn sec peq" data-qrs="${i.slug}" type="button">QR</button><button class="btn sec peq" data-msg="${i.slug}" type="button">Mensagem</button></div></div></div>`).join("")}</div>`;
    el.querySelectorAll("[data-qr]").forEach((q) => qr(q, urlQR(q.dataset.qr), 74));
    el.querySelectorAll("[data-cp]").forEach((b) => (b.onclick = () => copiar(linkPublico(b.dataset.cp), el.querySelector(`[data-u="${b.dataset.cp}"]`))));
    el.querySelectorAll("[data-qrs]").forEach((b) => (b.onclick = () => baixarQR(infPorSlug(b.dataset.qrs))));
    el.querySelectorAll("[data-msg]").forEach((b) => (b.onclick = () => mensagemKit(infPorSlug(b.dataset.msg))));
    const todos = ativas.map((i) => `${i.nome} (${i.prefixo}): ${linkPublico(i.slug)}`).join("\n");
    el.querySelector("#l-todos").onclick = () => copiar(todos);
    el.querySelector("#l-csv").onclick = () => salvarArquivo("links-sabado-premiado.csv", csvBlob(["influencer", "instagram", "prefixo", "loja", "link"], ativas.map((i) => [i.nome, i.instagram, i.prefixo, nomeLoja(i.loja_id), linkPublico(i.slug)])));
  }

  // ---------- clientes e cupons ----------
  function tabelaClientes(linhas, comInf = true) {
    return `<div class="tab"><table><thead><tr><th>Cupom</th><th>Cliente</th>${comInf ? "<th>Influencer</th>" : ""}<th>Emitido</th><th>Status</th><th class="n">Valor</th><th>Cliente novo?</th></tr></thead><tbody>
      ${linhas.map((c) => `<tr class="clicavel" data-cpf="${esc(c.cpf)}"><td><code>${esc(c.codigo)}</code></td><td>${esc(c.nome)}<span class="sub num">${U.fmtCPF(c.cpf)} · ${U.fmtTel(c.whatsapp)}</span></td>${comInf ? `<td>${esc(U.primeiroNome(c.influencer))}<span class="sub">${esc(c.loja_nome.replace(/^Tesoura de Ouro /, ""))}</span></td>` : ""}
        <td class="num">${U.horaBR(c.criado_em)}</td><td>${c.status === "usado" ? `<span class="pill ok">Usado</span><span class="sub num">${U.horaBR(c.usado_em)}${c.origem === "rock" ? " · via Rock" : c.origem === "pdv" ? " · PDV" : c.origem === "balcao" ? " · consulta" : ""}</span>` : `<span class="pill neutro">Emitido</span>`}</td>
        <td class="n">${c.valor ? U.brl2(c.valor) : ""}</td><td>${c.status !== "usado" ? "" : c.cliente_novo === null ? `<span class="pill neutro">a cruzar</span>` : c.cliente_novo ? `<span class="pill ouro">Novo</span>` : `<span class="pill neutro">Já cliente</span>`}</td></tr>`).join("") || `<tr><td colspan="7" class="muted">Nenhum cupom.</td></tr>`}
      </tbody></table></div>`;
  }
  async function fichaCliente(cpf) {
    const r = await A.cadastros(sess.get("adm"), { busca: cpf });
    const c = r.linhas[0]; if (!c) return;
    modal(`<h2>${esc(c.nome)}</h2>
      <dl class="dl"><dt>CPF</dt><dd class="num">${U.fmtCPF(c.cpf)}</dd><dt>WhatsApp</dt><dd class="num">${U.fmtTel(c.whatsapp)}</dd><dt>Cliente novo?</dt><dd>${c.cliente_novo === null ? "aguardando a Base GTO" : c.cliente_novo ? "Sim" : "Já era cliente"}</dd></dl>
      <h3 style="font-size:15px">Cupons deste CPF</h3>
      <div class="hist">${r.linhas.map((x) => `<div><span><code>${esc(x.codigo)}</code> · ${esc(U.primeiroNome(x.influencer))} · ${x.sabado_n}º sábado</span><span>${x.status === "usado" ? `<span class="pill ok">Usado</span> ${x.cupom_fiscal ? "CF " + esc(x.cupom_fiscal) : ""} ${x.valor ? U.brl2(x.valor) : ""}` : `<span class="pill neutro">Emitido</span>`}</span></div>`).join("")}</div>
      <div class="rodape"><button class="btn sec" id="cl-cp" type="button">Copiar WhatsApp</button><button class="btn" data-fechar type="button">Fechar</button></div>`, (m) => {
      m.querySelector("#cl-cp").onclick = () => copiar(U.so(c.whatsapp));
    });
  }

  let filtroCli = { busca: "", influencer_id: "", status: "" };
  async function secClientes() {
    const el = casca("clientes", "Clientes e cupons");
    el.innerHTML = `
      <div class="titulo-pag"><div><h1>Clientes e cupons</h1><p>Todos os cadastros das páginas. Clique em uma linha para ver o histórico do CPF.</p></div>
        <div class="acoes-pag"><button class="btn sec" id="cp-csv" type="button">Exportar CSV</button></div></div>
      <div class="filtros">
        <div class="campo" style="flex:1"><label for="cp-b">Buscar</label><input id="cp-b" placeholder="Cupom, nome ou CPF" value="${esc(filtroCli.busca)}"></div>
        ${seletorSabado("cp-sab")}
        <div class="campo"><label for="cp-i">Influencer</label><select id="cp-i"><option value="">Todas</option>${D.influencers.map((i) => `<option value="${i.id}" ${+filtroCli.influencer_id === i.id ? "selected" : ""}>${esc(i.nome)}</option>`).join("")}</select></div>
        <div class="campo"><label for="cp-s">Status</label><select id="cp-s"><option value="">Todos</option><option value="emitido" ${filtroCli.status === "emitido" ? "selected" : ""}>Emitido</option><option value="usado" ${filtroCli.status === "usado" ? "selected" : ""}>Usado</option></select></div>
      </div><p class="muted" id="cp-tot" style="margin:0"></p><div id="cp-l"></div>`;
    let ultimo = [];
    const buscar = async () => {
      const r = await A.cadastros(sess.get("adm"), { ...filtroCli, sabado_id: sabSel, bandeira: band }); ultimo = r.linhas;
      el.querySelector("#cp-tot").textContent = `${U.n(r.total)} cupons${r.total > r.linhas.length ? ` (mostrando ${r.linhas.length})` : ""}`;
      el.querySelector("#cp-l").innerHTML = tabelaClientes(r.linhas);
    };
    let t;
    el.querySelector("#cp-b").addEventListener("input", (e) => { filtroCli.busca = e.target.value; clearTimeout(t); t = setTimeout(buscar, 250); });
    el.querySelector("#cp-i").onchange = (e) => { filtroCli.influencer_id = e.target.value; buscar(); };
    el.querySelector("#cp-s").onchange = (e) => { filtroCli.status = e.target.value; buscar(); };
    ligarSeletor(el, "cp-sab");
    el.querySelector("#cp-csv").onclick = () => salvarArquivo(`cupons-sabado-premiado-${U.hojeISO()}.csv`, csvBlob(
      ["cupom", "nome", "cpf", "whatsapp", "influencer", "loja", "sabado", "emitido_em", "status", "usado_em", "cupom_fiscal", "valor", "cliente_novo"],
      ultimo.map((c) => [c.codigo, c.nome, c.cpf, c.whatsapp, c.influencer, c.loja_nome, c.sabado_data, c.criado_em, c.status, c.usado_em || "", c.cupom_fiscal || "", c.valor || "", c.cliente_novo === null ? "" : c.cliente_novo ? "sim" : "nao"])));
    buscar();
  }

  // ---------- lojas ----------
  function secLojas() {
    const el = casca("lojas", "Lojas");
    el.innerHTML = `
      <div class="titulo-pag"><div><h1>Lojas</h1><p>Cada loja tem a sua página com o PIN, a orientação do caixa e os cupons usados. Clique para abrir.</p></div><div class="acoes-pag"><button class="btn" id="b-loja" type="button">Nova loja</button></div></div>
      <div class="tab"><table><thead><tr><th>Loja</th>${band ? "" : "<th>Bandeira</th>"}<th>CNPJ</th><th>Horário</th><th>PIN do balcão</th><th>Influencer</th><th class="n">Usados</th><th></th></tr></thead><tbody>
      ${D.lojas.map((l) => { const infs = D.influencers.filter((i) => i.loja_id === l.id); return `<tr class="clicavel" data-loja="${l.id}"><td><b>${esc(l.nome)}</b><span class="sub">${esc(l.cidade || "")}</span></td>${band ? "" : `<td><span class="ponto" style="background:${PONTO[l.bandeira || "tesoura"]}"></span>${esc(bInfo(l.bandeira || "tesoura").CURTO)}</td>`}<td class="num">${l.cnpj ? U.fmtCNPJ(l.cnpj) : `<span class="pill alerta">falta</span>`}</td><td>${esc(l.horario || "")}</td><td><code>${esc(l.pin)}</code></td>
      <td>${infs.map((i) => esc(U.primeiroNome(i.nome))).join(", ") || `<span class="muted">nenhuma</span>`}</td><td class="n">${U.n(infs.reduce((a, i) => a + i.usados, 0))}</td>
      <td><button class="btn sec peq" data-l="${l.id}" type="button">Editar</button></td></tr>`; }).join("")}
      </tbody></table></div>`;
    el.querySelector("#b-loja").onclick = () => formLoja(null);
    el.querySelectorAll("[data-l]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); formLoja(D.lojas.find((l) => l.id === +b.dataset.l)); }));
  }
  function formLoja(l) {
    {
      l = l || { nome: bInfo(band || "tesoura").NOME + " ", cidade: "", endereco: "", horario: "9h às 18h", pin: "", cnpj: "", bandeira: band || "tesoura" };
      const aqui = D.influencers.filter((i) => l.id && i.loja_id === l.id);
      // primeiro as desta loja, depois as sem loja de destaque, em ordem alfabética
      const listaOrd = [...D.influencers].sort((a, b) => (b.loja_id === l.id) - (a.loja_id === l.id) || a.nome.localeCompare(b.nome));
      modal(`<h2>${l.id ? "Editar loja" : "Nova loja"}</h2><form id="f-loja" class="grade">
        <div class="grade g2"><div class="campo"><label for="l-band">Bandeira</label><select id="l-band">${BKEYS.map((k) => `<option value="${k}" ${k === (l.bandeira || "tesoura") ? "selected" : ""}>${esc(bInfo(k).NOME)}</option>`).join("")}</select></div>
        <div class="campo"><label for="l-nome">Nome</label><input id="l-nome" value="${esc(l.nome)}"></div></div>
        <div class="grade g2"><div class="campo"><label for="l-cid">Cidade ou bairro</label><input id="l-cid" value="${esc(l.cidade)}"></div><div class="campo"><label for="l-hor">Horário no sábado</label><input id="l-hor" value="${esc(l.horario)}"></div></div>
        <div class="campo"><label for="l-end">Endereço</label><input id="l-end" value="${esc(l.endereco)}"></div>
        <div class="grade g2"><div class="campo"><label for="l-pin">PIN do balcão (4 a 6 números)</label><input id="l-pin" value="${esc(l.pin)}" inputmode="numeric"></div>
        <div class="campo"><label for="l-cnpj">CNPJ da loja</label><input id="l-cnpj" value="${esc(U.fmtCNPJ(l.cnpj || ""))}" inputmode="numeric"><span class="dica">Confere se a nota fiscal é desta loja.</span></div></div>
        <div class="campo"><label for="l-inf-busca">Influencers desta loja</label>
          <div class="sel-inf" id="l-inf-sel">${aqui.length ? aqui.map((i) => `<span class="pill ok">${esc(i.nome)}</span>`).join("") : `<span class="muted" style="font-size:13px">Nenhuma selecionada</span>`}</div>
          <input id="l-inf-busca" placeholder="Buscar influencer pelo nome" autocomplete="off">
          <div class="lista-inf" id="l-inf-lista">${listaOrd.map((i) => { const outra = i.loja_id && i.loja_id !== l.id; return `<label class="check" data-nome="${esc(U.semAcento(i.nome).toLowerCase())}"><input type="checkbox" value="${i.id}" ${i.loja_id === l.id ? "checked disabled" : ""}><span><b style="color:var(--tinta)">${esc(i.nome)}</b> · ${esc(i.prefixo)}${outra ? ` · hoje em ${esc(nomeLoja(i.loja_id))}` : ""}${i.loja_id === l.id ? " · já está nesta loja" : ""}</span></label>`; }).join("") || `<span class="muted">Nenhuma influencer cadastrada.</span>`}</div>
          <span class="dica">Marque quem vai atender esta loja. Quem estava em outra loja muda para esta. Para tirar uma influencer daqui, marque ela em outra loja ou troque na ficha dela.</span>
          <div id="l-inf-aviso"></div></div>
        <div id="l-msg"></div><div class="rodape"><button class="btn sec" data-fechar type="button">Cancelar</button><button class="btn" type="submit">Salvar</button></div></form>`, (m, fechar) => {
        const marcadas = () => [...m.querySelectorAll("#l-inf-lista input:checked:not(:disabled)")].map((c) => D.influencers.find((i) => i.id === +c.value));
        m.querySelector("#l-inf-busca").oninput = (e) => { const b = U.semAcento(e.target.value).toLowerCase(); m.querySelectorAll("#l-inf-lista label").forEach((x) => (x.hidden = b && !x.dataset.nome.includes(b))); };
        m.querySelector("#l-inf-lista").addEventListener("change", () => {
          const sel = aqui.concat(marcadas());
          m.querySelector("#l-inf-sel").innerHTML = sel.map((i) => `<span class="pill ok">${esc(i.nome)}</span>`).join("") || `<span class="muted" style="font-size:13px">Nenhuma selecionada</span>`;
          const mudam = marcadas().filter((i) => i.loja_id && i.loja_id !== l.id);
          m.querySelector("#l-inf-aviso").innerHTML = mudam.length ? `<div class="aviso alerta">${mudam.map((i) => `${esc(U.primeiroNome(i.nome))} sai da ${esc(nomeLoja(i.loja_id))}${i.emitidos ? ` (os ${U.n(i.emitidos)} cupons já emitidos continuam valendo lá)` : ""}`).join("<br>")}.</div>` : "";
        });
        m.querySelector("form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const btn = m.querySelector("button[type=submit]"); btn.disabled = true;
          try {
            const loja = await A.salvarLoja(sess.get("adm"), { id: l.id, nome: m.querySelector("#l-nome").value, cidade: m.querySelector("#l-cid").value, horario: m.querySelector("#l-hor").value, endereco: m.querySelector("#l-end").value, pin: m.querySelector("#l-pin").value, cnpj: m.querySelector("#l-cnpj").value, bandeira: m.querySelector("#l-band").value });
            const novas = marcadas();
            for (const i of novas) await A.salvarInfluencer(sess.get("adm"), { id: i.id, nome: i.nome, prefixo: i.prefixo, instagram: i.instagram, whatsapp: i.whatsapp, loja_id: loja.id, sabado_id: i.sabado_id, lote: i.lote, meta: i.meta, ativo: i.ativo, etapa: i.etapa, notas: i.notas });
            fechar(); toast(novas.length ? `Loja salva · ${novas.length} influencer(s) ligada(s)` : "Loja salva"); render();
          } catch (err) { btn.disabled = false; m.querySelector("#l-msg").innerHTML = `<div class="aviso erro">${esc(err.message)}</div>`; }
        });
      });
    }
  }

  // ---------- página da loja ----------
  const linkBalcao = () => (C.BASE_URL ? C.BASE_URL.replace(/\/$/, "") + (C.ROTAS === "path" ? "/balcao" : "/#balcao") : link("balcao"));
  async function secLoja(r) {
    const l = D.lojas.find((x) => String(x.id) === String(r.slug));
    if (!l) { casca("lojas", "Lojas").innerHTML = `<p>Loja não encontrada. <a href="${link("lojas")}" data-ir>Voltar</a></p>`; return; }
    const el = casca("lojas", semMarca(l.nome));
    const infs = D.influencers.filter((i) => i.loja_id === l.id);
    const t = infs.reduce((a, i) => ({ em: a.em + i.emitidos, us: a.us + i.usados, meta: a.meta + i.meta, nov: a.nov + (i.novos || 0) }), { em: 0, us: 0, meta: 0, nov: 0 });
    const ub = linkBalcao();
    const msg = `Oi! Como funciona o ${C.CAMPANHA} no caixa da ${l.nome}:\n\n1. A cliente mostra o cupom dela (ex.: ${(infs[0] || {}).prefixo || "ANA"}013) e informa o CPF.\n2. O atendente digita o código no PDV e o vale entra na compra. CPF na nota é obrigatório.\n3. Cada código vale uma vez só.\n\nPara conferir um cupom antes de digitar: ${ub}\nPIN da loja: ${l.pin}`;
    el.innerHTML = `
      <a class="volta" href="${link("lojas")}" data-ir>‹ Lojas</a>
      <div class="painel ficha-topo"><span class="avatar" aria-hidden="true">${ico("loja")}</span>
        <div style="flex:1;min-width:220px"><h1 style="font-size:24px;font-weight:400">${esc(l.nome)}</h1>
          <p class="muted" style="margin:2px 0 0">${esc(l.endereco || "Endereço a preencher")} · ${esc(l.horario || "")}</p>
          <p style="margin:6px 0 0">CNPJ ${l.cnpj ? `<span class="num">${U.fmtCNPJ(l.cnpj)}</span>` : `<span class="pill alerta">falta: sem ele a nota fiscal não é conferida</span>`}</p></div>
        <div class="acoes-pag"><a class="btn sec" href="${link("balcao")}" data-ir>Consulta do cupom</a><button class="btn" id="lj-ed" type="button">Editar</button></div>
      </div>
      <div class="grade g4">
        <div class="painel kpi"><small>Influencers</small><b>${infs.length}</b><span>${infs.map((i) => esc(U.primeiroNome(i.nome))).join(", ") || "nenhuma ainda"}</span></div>
        <div class="painel kpi"><small>Cupons distribuídos</small><b>${U.n(t.em)}</b><span>para clientes desta loja</span></div>
        <div class="painel kpi"><small>Cupons usados</small><b>${U.n(t.us)}</b><span>meta ${U.n(t.meta)} · ${U.pct(t.us, t.meta)}%</span></div>
        <div class="painel kpi"><small>Vendas registradas</small><b id="lj-vendas">…</b><span>soma das vendas com cupom</span></div>
      </div>
      <div class="grade g2" style="align-items:start">
        <div class="painel grade"><h2 style="margin:0">Caixa desta loja</h2>
          <div class="link-card"><div class="qrm" id="lj-qr"></div><div style="min-width:0"><div class="u" id="lj-url">${esc(ub)}</div>
            <p style="margin:6px 0 0">PIN <code class="cod-inline" style="font-size:18px">${esc(l.pin)}</code></p>
            <div class="bts"><button class="btn peq" id="lj-msg" type="button">Mensagem para o gerente</button><button class="btn sec peq" id="lj-cp" type="button">Copiar link</button></div></div></div></div>
        <div class="painel"><h2>Influencers desta loja</h2>${infs.length ? listaRank(infs) : `<p class="muted">Nenhuma influencer nesta loja. Cadastre em Influencers.</p>`}</div>
      </div>
      <div class="painel"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px"><h2 style="margin:0">Cupons usados nesta loja</h2><span class="muted" id="lj-tot"></span></div><div id="lj-cli"><p class="muted">Carregando…</p></div></div>`;
    qr(el.querySelector("#lj-qr"), ub.startsWith("http") ? ub : location.href.split("#")[0] + ub, 74);
    el.querySelector("#lj-ed").onclick = () => formLoja(l);
    el.querySelector("#lj-cp").onclick = () => copiar(ub, el.querySelector("#lj-url"));
    el.querySelector("#lj-msg").onclick = () => modal(`<h2>Mensagem para o gerente</h2><div class="kit" id="lj-txt">${esc(msg)}</div><div class="rodape"><button class="btn sec" data-fechar type="button">Fechar</button><button class="btn" id="lj-c2" type="button">Copiar mensagem</button></div>`, (m) => { m.querySelector("#lj-c2").onclick = () => copiar(msg, m.querySelector("#lj-txt")); });
    const c = await A.cadastros(sess.get("adm"), { loja_id: l.id, status: "usado", sabado_id: sabSel });
    el.querySelector("#lj-tot").textContent = `${U.n(c.total)} cupons usados`;
    el.querySelector("#lj-vendas").textContent = U.brl(c.linhas.reduce((a, x) => a + (+x.valor || 0), 0));
    el.querySelector("#lj-cli").innerHTML = tabelaClientes(c.linhas);
  }

  // ---------- caixa (PDV) e Rock ----------
  function importador(el, pref, colunas, exemplo, chamar, rotulo) {
    const arq = el.querySelector(`#${pref}-arq`);
    arq.onchange = () => { const fl = arq.files[0]; if (!fl) return; lerArquivo(fl).then((t) => (el.querySelector(`#${pref}-txt`).value = t)).catch((e) => toast(e.message)); };
    el.querySelector(`#${pref}-ok`).onclick = async () => {
      const linhas = el.querySelector(`#${pref}-txt`).value.split(/\n/).map((x) => x.split(/[;\t]/).map((y) => y.trim())).filter((p) => p[0] && /\d/.test(p.join("")) && !/^cupom$|^cpf$/i.test(p[0]))
        .map((p) => Object.fromEntries(colunas.map((c, k) => [c, p[k] || ""])));
      const msg = el.querySelector(`#${pref}-msg`);
      if (!linhas.length) { msg.innerHTML = `<div class="aviso erro">Cole pelo menos uma linha.</div>`; return; }
      try {
        const r = await chamar(linhas);
        msg.innerHTML = `<div class="aviso ${r.recusadas || r.sem_cupom ? "alerta" : "ok"}">${r.usados} cupons com baixa · ${r.ja_usados} já estavam usados · ${r.sem_cupom} ${rotulo} · ${r.recusadas} recusadas${r.detalhes.length ? "<br>" + r.detalhes.slice(0, 12).map(esc).join("<br>") : ""}</div>`;
        if (r.usados) toast(`${r.usados} cupons com baixa`);
      } catch (err) { msg.innerHTML = `<div class="aviso erro">${esc(err.message)}</div>`; }
    };
  }
  function secIntegracoes() {
    const el = casca("integracoes", "Caixa (PDV)");
    el.innerHTML = `<p class="muted">Carregando os tokens…</p>`;
    A.tokens(sess.get("adm"), sabSel).then((T0) => {
      const ids = new Set(D.influencers.map((i) => i.id)), infsT = T0.influencers.filter((x) => ids.has(x.id));
      const T = { ...T0, influencers: infsT, total: infsT.reduce((a, x) => a + x.total, 0), livres: infsT.reduce((a, x) => a + x.livres, 0) };
      const ativas = D.influencers.filter((i) => i.ativo);
      const modoTokens = T.total > 0;
      const linhaInf = T.influencers.filter((x) => x.total || ativas.some((a) => a.id === x.id));
      el.innerHTML = `
      <div class="titulo-pag"><div><h1>Caixa (PDV) · ${esc(nomeBand())}</h1><p>A TI cria os tokens no PDV e manda a lista, com cada token ligado a uma influencer. A lista sobe aqui, e cada cadastro na página da influencer recebe o próximo token livre dela. No caixa, o atendente digita o token e o desconto entra.</p></div>
        <div class="acoes-pag"><span class="pill ${modoTokens ? "ok" : "alerta"}">${modoTokens ? `${U.n(T.livres)} tokens livres de ${U.n(T.total)}` : "Nenhum token do PDV importado"}</span></div></div>
      <div class="fluxo">
        <div class="passo"><span>1</span><b>TI cria os tokens</b><small>no PDV, uso único, com o desconto</small></div>
        <div class="passo"><span>2</span><b>Lista sobe aqui</b><small>cada token ligado a uma influencer</small></div>
        <div class="passo"><span>3</span><b>Cadastro na página</b><small>recebe o próximo token dela</small></div>
        <div class="passo"><span>4</span><b>Caixa</b><small>atendente digita o token</small></div>
        <div class="passo"><span>5</span><b>Vendas voltam</b><small>arquivo do PDV dá baixa</small></div>
      </div>
      ${modoTokens ? "" : `<div class="aviso alerta">Enquanto nenhum token desta bandeira for importado, a ferramenta gera os códigos sozinha (prefixo da influencer + número, ex.: ANA013). Ao importar a primeira lista, os próximos cadastros da bandeira passam a receber só os tokens do PDV.</div>`}
      <div class="grade g2" style="align-items:start">
        <div class="painel grade"><h2 style="margin:0">Subir tokens do PDV</h2>
          <p class="muted" style="margin:0">Todo token é de uma influencer. Marque de quem é a lista e cole os tokens, um por linha. Para subir várias influencers de uma vez, deixe "Várias" e use <b>token; influencer</b> em cada linha.</p>
          <div class="campo"><label for="tk-inf">De quem é esta lista</label><select id="tk-inf"><option value="">Escolha a influencer</option>${[...D.influencers].sort((a, b) => a.nome.localeCompare(b.nome)).map((i) => `<option value="${esc(i.prefixo)}">${esc(i.nome)} · ${esc(i.prefixo)} · ${esc(nomeLoja(i.loja_id))}</option>`).join("")}<option value="*">Várias (coluna influencer em cada linha)</option></select></div>

          <div class="campo"><label for="tk-sab">Para qual sábado</label><select id="tk-sab"><option value="">O sábado atual de cada influencer</option>${D.sabados.map((sb) => `<option value="${sb.id}">${sb.n}º · ${U.dataBR(sb.data)}${sb.label ? " · " + esc(sb.label) : ""}</option>`).join("")}</select><span class="dica">O lote de tokens vale para um sábado. No sábado seguinte, suba um lote novo.</span></div>
          <div class="campo"><label for="tk-txt">Tokens</label><textarea id="tk-txt" placeholder="TES7K2P9&#10;TES8M4Q1&#10;TES9R6T3"></textarea></div>
          <div class="campo"><label for="tk-arq">Ou envie o arquivo CSV da TI</label><input id="tk-arq" type="file" accept=".csv,.txt"></div>
          <label class="check" for="tk-sub"><input type="checkbox" id="tk-sub"><span>Substituir os tokens ainda livres das influencers desta lista (os já entregues ficam como estão)</span></label>
          <div id="tk-msg"></div><button class="btn" id="tk-ok" type="button" style="justify-self:start">Importar tokens</button></div>
        <div class="painel grade"><h2 style="margin:0">Estoque de tokens</h2>
          <div class="tab" style="border:0"><table><thead><tr><th>Influencer</th><th class="num">Tokens dela</th><th class="num">Livres</th><th class="num">Lote</th></tr></thead><tbody>
            ${linhaInf.map((x) => { const inf = D.influencers.find((i) => i.id === x.id) || {}; const pouco = modoTokens && inf.ativo && x.livres < 10; return `<tr><td><b>${esc(x.nome)}</b><span class="sub">${esc(x.prefixo)} · ${esc(nomeLoja(inf.loja_id))}</span></td><td class="num">${U.n(x.total)}</td><td class="num">${pouco ? `<span class="pill alerta">${U.n(x.livres)}</span>` : U.n(x.livres)}</td><td class="num">${U.n(inf.lote)}</td></tr>`; }).join("")}
          </tbody></table></div>
          <p class="muted" style="font-size:12.5px;margin:0">A página da influencer para de distribuir quando acaba o lote dela ou quando acabam os tokens dela. Em amarelo, quem tem menos de 10 tokens livres.</p></div>
      </div>
      <div class="grade g2" style="align-items:start">
        <div class="painel grade"><h2 style="margin:0">Importar vendas com token (PDV)</h2>
          <p class="muted" style="margin:0">Depois do sábado, uma por linha: <b>token; CPF; nota (chave ou número); data; valor</b>. A ferramenta confere se o token foi entregue na página, se o CPF é o do cadastro e se a nota é da loja, e só então conta para a meta.</p>
          <div class="campo"><label for="vd-txt">Vendas</label><textarea id="vd-txt" placeholder="TES7K2P9;123.456.789-09;12345;28/11/2026 14:32;189,90"></textarea></div>
          <div class="campo"><label for="vd-arq">Ou envie o arquivo CSV</label><input id="vd-arq" type="file" accept=".csv,.txt"></div>
          <div id="vd-msg"></div><button class="btn" id="vd-ok" type="button" style="justify-self:start">Importar e dar baixa</button></div>
        <div class="painel grade"><h2 style="margin:0">O que pedir para a TI da GTO</h2>
          <ol style="margin:0;padding-left:18px;display:grid;gap:6px;color:var(--muted)">
            <li>Criar os tokens no PDV como cupom de uso único, com o valor do desconto, e mandar a lista com cada token ligado a uma influencer (token; influencer), ou um arquivo por influencer.</li>
            <li>Quantidade: o lote de cada influencer (hoje ${U.n(ativas.reduce((a, i) => a + i.lote, 0))} tokens no total para ${ativas.length} influencers).</li>
            <li>Exportar as vendas que usaram token (token, CPF, nota, data, valor) no sábado à noite.</li>
            <li>Marketing: exportação dos cadastros da campanha de fim de ano, toda segunda e no fim da campanha.</li>
          </ol>
          ${modoTokens ? "" : `<button class="btn sec peq" id="pdv-csv" type="button" style="justify-self:start">Baixar códigos gerados pela ferramenta</button><span class="dica">Só para o caso de a TI preferir cadastrar no PDV os códigos que a ferramenta gera.</span>`}</div>
      </div>`;
      const b = el.querySelector("#pdv-csv");
      if (b) b.onclick = () => {
        const linhas = [];
        ativas.forEach((i) => { const l = D.lojas.find((x) => x.id === i.loja_id) || {}, sb = sabado(i.sabado_id); for (let k = 1; k <= i.lote; k++) linhas.push([U.codigo(i.prefixo, k), i.nome, l.nome || "", l.cnpj || "", sb.data || ""]); });
        salvarArquivo(`cupons-pdv-sabado-premiado-${U.hojeISO()}.csv`, csvBlob(["cupom", "influencer", "loja", "cnpj_loja", "valido_em"], linhas));
      };
      importador(el, "vd", ["cupom", "cpf", "nota", "data", "valor"], "", (l) => A.importarVendas(sess.get("adm"), l), "tokens sem cadastro na página");
      const arq = el.querySelector("#tk-arq");
      arq.onchange = () => { const fl = arq.files[0]; if (!fl) return; lerArquivo(fl).then((t) => (el.querySelector("#tk-txt").value = t)).catch((e) => toast(e.message)); };
      el.querySelector("#tk-ok").onclick = async () => {
        const msg = el.querySelector("#tk-msg");
        const linhas = el.querySelector("#tk-txt").value.split(/\r?\n/).map((x) => x.split(/[;,\t]/).map((y) => y.trim().replace(/^"|"$/g, "")))
          .filter((p) => p[0] && !/^(token|cupom|codigo|código)$/i.test(p[0])).map((p) => ({ token: p[0], influencer: el.querySelector("#tk-inf").value === "*" ? p[1] || "" : el.querySelector("#tk-inf").value }));
        if (!linhas.length) { msg.innerHTML = `<div class="aviso erro">Cole pelo menos um token.</div>`; return; }
        const dona = el.querySelector("#tk-inf").value;
        if (!dona) { msg.innerHTML = `<div class="aviso erro">Marque de quem é esta lista.</div>`; el.querySelector("#tk-inf").focus(); return; }
        try {
          const r = await A.importarTokens(sess.get("adm"), linhas, el.querySelector("#tk-sub").checked, el.querySelector("#tk-sab").value);
          toast(`${U.n(r.importados)} tokens importados`);
          await carregar(sabSel); secIntegracoes();
          setTimeout(() => { const m2 = document.getElementById("tk-msg"); if (m2) m2.innerHTML = `<div class="aviso ${r.recusados ? "alerta" : "ok"}">${U.n(r.importados)} novos · ${U.n(r.repetidos)} repetidos · ${U.n(r.recusados)} recusados. Estoque: ${U.n(r.livres)} livres de ${U.n(r.total)}.${r.detalhes.length ? "<br>" + r.detalhes.map(esc).join("<br>") : ""}</div>`; }, 300);
        } catch (err) { msg.innerHTML = `<div class="aviso erro">${esc(err.message)}</div>`; }
      };
    }).catch((err) => { el.innerHTML = `<div class="aviso erro">${esc(err.message)}</div>`; });
  }

  // ---------- comparativo: página da influencer x campanha de fim de ano ----------
  let buscaCmp = "";
  async function secComparativo() {
    const el = casca("comparativo", "Comparativo fim de ano");
    el.innerHTML = `<p class="muted">Cruzando os CPFs…</p>`;
    const R = await A.comparativo(sess.get("adm"), sabSel, band);
    const t = R.totais, s = sabado(sabSel);
    const media = (v, q) => (q ? v / q : 0);
    const medAmbos = media(t.ambos_valor, t.ambos), medSo = media(t.so_fa_valor, t.so_fa);
    const dif = medSo ? Math.round((medAmbos / medSo - 1) * 100) : 0;
    const semFA = !t.fa_cpfs;
    const fluxo = [["1", "Página da influencer", "cadastro com CPF"], ["2", "Cupom na hora", "gerado no cadastro"], ["3", "Caixa", "cupom dá o desconto"], ["4", "Fim de ano", "cadastra a nota no sorteio"], ["5", "Comparativo", "cruza o CPF e o gasto"]];
    const barra = (v, max) => `<div class="tr"><i style="width:${max ? Math.max(2, U.pct(v, max)) : 0}%"></i></div>`;
    const maxV = Math.max(t.lp, t.ambos, t.so_fa, 1);
    el.innerHTML = `
      <div class="titulo-pag"><div><h1>Comparativo fim de ano · ${esc(nomeBand())}</h1><p>Quem pegou o cupom na página da influencer e também cadastrou nota na campanha de fim de ano, e quanto essas pessoas gastaram. ${s.n ? `Recorte: ${s.n}º sábado (${U.dataBR(s.data)}).` : "Todos os sábados."}</p></div>
        <div class="acoes-pag">${seletorSabado("cp-sab")}<button class="btn sec" id="cp-csv" type="button">Baixar cruzamento</button></div></div>
      <div class="fluxo">${fluxo.map(([n, a, b]) => `<div class="passo"><span>${n}</span><b>${a}</b><small>${b}</small></div>`).join("")}</div>
      ${semFA ? `<div class="aviso alerta">Ainda não há cadastros da campanha de fim de ano. Importe o arquivo abaixo para ver o cruzamento.</div>` : ""}
      <div class="grade g4">
        <div class="painel kpi"><small>Cadastros na página</small><b>${U.n(t.lp)}</b><span>${U.n(t.lp_usaram)} usaram o cupom no caixa · ${U.brl(t.lp_valor_cupom)}</span></div>
        <div class="painel kpi"><small>Também no fim de ano</small><b>${U.n(t.ambos)}</b><span>${U.pct(t.ambos, t.lp)}% de quem pegou o cupom · ${U.n(t.ambos_notas)} notas</span></div>
        <div class="painel kpi"><small>Gasto delas no fim de ano</small><b>${U.brl(t.ambos_valor)}</b><span>${U.brl(t.ambos_pos_valor)} depois do cadastro na página</span></div>
        <div class="painel kpi"><small>Gasto médio por pessoa</small><b>${U.brl(medAmbos)}</b><span>${t.so_fa ? `${dif >= 0 ? "+" : ""}${dif}% vs quem só está no fim de ano (${U.brl(medSo)})` : "sem base de comparação"}</span></div>
      </div>
      <div class="grade g2" style="align-items:start">
        <div class="painel"><h2>Quem está em cada lugar</h2><div class="funil">
          <div class="et"><span>Só na página</span>${barra(t.lp - t.ambos, maxV)}<b>${U.n(t.lp - t.ambos)}</b></div>
          <div class="et"><span>Nos dois</span>${barra(t.ambos, maxV)}<b>${U.n(t.ambos)}</b></div>
          <div class="et"><span>Só no fim de ano</span>${barra(t.so_fa, maxV)}<b>${U.n(t.so_fa)}</b></div></div>
          <p class="muted" style="font-size:12.5px;margin:12px 0 0">Campanha de fim de ano carregada: ${U.n(t.fa_cpfs)} pessoas, ${U.n(t.fa_notas)} notas, ${U.brl(t.fa_valor)}. Quem veio pela página responde por ${U.pct(t.ambos_valor, t.fa_valor)}% desse valor.</p></div>
        <div class="painel grade"><h2 style="margin:0">Importar cadastros da campanha de fim de ano</h2>
          <p class="muted" style="margin:0">Arquivo exportado do hotsite ou do WhatsApp do sorteio. Uma nota por linha: <b>CPF; nome; nota (chave ou número); data; valor; loja</b>. Linha repetida é ignorada.</p>
          <div class="campo"><label for="fa-band">De qual campanha é o arquivo</label><select id="fa-band">${band ? "" : `<option value="">Escolha a bandeira</option>`}${BKEYS.filter((k) => !band || k === band).map((k) => `<option value="${k}" ${k === band ? "selected" : ""}>${esc(bInfo(k).NOME)} · ${esc(bInfo(k).CAMPANHA || "fim de ano")}</option>`).join("")}</select></div>
          <div class="campo"><label for="fa-txt">Notas</label><textarea id="fa-txt" placeholder="123.456.789-09;Maria Silva;53261107608112000005650010000123451123456780;28/11/2026 14:32;189,90;Tesoura Ceilândia"></textarea></div>
          <div class="campo"><label for="fa-arq">Ou envie o arquivo CSV</label><input id="fa-arq" type="file" accept=".csv,.txt"></div>
          <label class="check" for="fa-sub"><input type="checkbox" id="fa-sub"><span>Substituir o que já foi importado desta campanha (use quando o arquivo for o acumulado)</span></label>
          <div id="fa-msg"></div><button class="btn" id="fa-ok" type="button" style="justify-self:start">Importar</button></div>
      </div>
      <div class="painel"><h2>Por influencer</h2>
        <div class="tab"><table><thead><tr><th>Influencer</th><th class="num">Cadastros</th><th class="num">Usaram no caixa</th><th class="num">Valor no caixa</th><th class="num">No fim de ano</th><th class="num">Notas</th><th class="num">Gasto fim de ano</th><th class="num">Gasto médio</th></tr></thead><tbody>
          ${R.influencers.map((i) => `<tr class="clicavel" data-slug="${i.slug}"><td><b>${esc(i.nome)}</b><span class="sub">${esc(nomeLoja(i.loja_id))} · ${esc(i.prefixo)}</span></td><td class="num">${U.n(i.lp)}</td><td class="num">${U.n(i.usaram)}</td><td class="num">${U.brl(i.valor_cupom)}</td><td class="num">${U.n(i.ambos)} <span class="sub">${U.pct(i.ambos, i.lp)}%</span></td><td class="num">${U.n(i.fa_notas)}</td><td class="num"><b>${U.brl(i.fa_valor)}</b></td><td class="num">${U.brl(media(i.fa_valor, i.ambos))}</td></tr>`).join("") || `<tr><td colspan="8" class="muted">Sem cadastros no recorte.</td></tr>`}
        </tbody></table></div></div>
      <div class="painel"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:end;margin-bottom:10px"><h2 style="margin:0">Pessoas nos dois lugares</h2>
        <div class="campo" style="min-width:220px"><label for="cp-busca">Buscar nome, CPF ou cupom</label><input id="cp-busca" value="${esc(buscaCmp)}"></div></div>
        <div class="tab"><table><thead><tr><th>Cliente</th><th>Cupom</th><th>Influencer</th><th class="num">Caixa</th><th class="num">Notas fim de ano</th><th class="num">Gasto fim de ano</th></tr></thead><tbody id="cp-pessoas"></tbody></table></div>
        <p class="muted" style="font-size:12.5px;margin:10px 0 0" id="cp-rodape"></p></div>
      <p class="muted" style="font-size:12.5px;margin:0">O elo é o CPF: o mesmo CPF do cadastro na página aparece no cadastro da nota no sorteio. "Depois do cadastro" soma só as notas com data igual ou posterior ao cadastro na página.</p>`;
    ligarSeletor(el, "cp-sab");
    const ambos = R.pessoas.filter((p) => p.fa_notas > 0);
    const pintar = () => {
      const b = U.semAcento(buscaCmp).toLowerCase(), bd = U.so(buscaCmp);
      const l = ambos.filter((p) => !b || U.semAcento(p.nome).toLowerCase().includes(b) || p.codigo.toLowerCase().includes(b) || (bd.length >= 4 && p.cpf.includes(bd)));
      el.querySelector("#cp-pessoas").innerHTML = l.slice(0, 200).map((p) => `<tr class="clicavel" data-cpf="${p.cpf}"><td><b>${esc(p.nome)}</b><span class="sub">${U.mascaraCPF(p.cpf)}</span></td><td class="num">${esc(p.codigo)}</td><td>${esc(U.primeiroNome(p.influencer))}</td><td class="num">${p.status === "usado" ? U.brl(p.valor_cupom) : `<span class="pill neutro">não usou</span>`}</td><td class="num">${U.n(p.fa_notas)}</td><td class="num"><b>${U.brl(p.fa_valor)}</b></td></tr>`).join("") || `<tr><td colspan="6" class="muted">Ninguém encontrado.</td></tr>`;
      el.querySelector("#cp-rodape").textContent = l.length > 200 ? `Mostrando 200 de ${U.n(l.length)}. O arquivo do cruzamento traz todos.` : `${U.n(l.length)} pessoas.`;
    };
    pintar();
    el.querySelector("#cp-busca").oninput = (e) => { buscaCmp = e.target.value; pintar(); };
    el.querySelector("#cp-csv").onclick = async () => { let T; try { T = await A.comparativo(sess.get("adm"), sabSel, band, true); } catch (e) { toast(e.message); return; } salvarArquivo(`cruzamento-pagina-x-fim-de-ano-${U.hojeISO()}.csv`, csvBlob(
      ["cpf", "nome", "cupom", "influencer", "loja", "cadastro_pagina", "usou_cupom_no_caixa", "valor_no_caixa", "notas_fim_de_ano", "gasto_fim_de_ano", "gasto_depois_do_cadastro"],
      T.pessoas.map((p) => [p.cpf, p.nome, p.codigo, p.influencer, p.loja, U.horaBR(p.cadastro), p.status === "usado" ? "sim" : "não", p.valor_cupom ?? "", p.fa_notas, String(p.fa_valor).replace(".", ","), String(p.pos_valor).replace(".", ",")]))); };
    const arq = el.querySelector("#fa-arq");
    arq.onchange = () => { const fl = arq.files[0]; if (!fl) return; lerArquivo(fl).then((t) => (el.querySelector("#fa-txt").value = t)).catch((e) => toast(e.message)); };
    el.querySelector("#fa-ok").onclick = async () => {
      const msg = el.querySelector("#fa-msg");
      const linhas = el.querySelector("#fa-txt").value.split(/\r?\n/).map((x) => x.split(/[;\t]/).map((y) => y.trim().replace(/^"|"$/g, "")))
        .filter((p) => p[0] && U.so(p[0]).length >= 9 && U.so(p[0]).length <= 11).map((p) => ({ cpf: p[0], nome: p[1] || "", nota: p[2] || "", data: p[3] || "", valor: p[4] || "", loja: p[5] || "" }));
      if (!linhas.length) { msg.innerHTML = `<div class="aviso erro">Nenhuma linha com CPF encontrada.</div>`; return; }
      try {
        const qual = el.querySelector("#fa-band").value;
        if (!qual) { msg.innerHTML = `<div class="aviso erro">Escolha de qual bandeira é a campanha do arquivo.</div>`; return; }
        const r = await A.importarFimDeAno(sess.get("adm"), linhas, el.querySelector("#fa-sub").checked, qual);
        toast(`${U.n(r.importadas)} notas importadas`);
        await secComparativo();
        document.getElementById("fa-msg").innerHTML = `<div class="aviso ${r.recusadas ? "alerta" : "ok"}">${U.n(r.importadas)} notas novas · ${U.n(r.repetidas)} repetidas · ${U.n(r.recusadas)} recusadas. Total: ${U.n(r.total_notas)} notas de ${U.n(r.total_cpfs)} pessoas.${r.detalhes.length ? "<br>" + r.detalhes.map(esc).join("<br>") : ""}</div>`;
      } catch (err) { msg.innerHTML = `<div class="aviso erro">${esc(err.message)}</div>`; }
    };
  }

  // ---------- sábados ----------
  function secSabados() {
    const el = casca("sabados", "Sábados");
    el.innerHTML = `
      <div class="titulo-pag"><div><h1>Sábados</h1><p>Data, tema, meta sugerida e fixo de cada sábado. O fixo entra na comissão estimada (fixo + R$ ${COMISSAO_POR_NOVO} por cliente novo, até ${U.brl(TETO_COMISSAO)}).</p></div></div>
      <div class="grade g3">${D.sabados.map((s) => { const q = D.influencers.filter((i) => i.sabado_id === s.id).length; return `<form class="painel grade" data-s="${s.id}"><h2 style="margin:0;display:flex;justify-content:space-between;gap:8px;align-items:center">${s.n}º sábado <span class="pill neutro">${q} influencers</span></h2>
        <div class="campo"><label>Data</label><input name="data" type="date" value="${s.data}"></div>
        <div class="campo"><label>Tema</label><input name="label" value="${esc(s.label || "")}"></div>
        <div class="grade g2"><div class="campo"><label>Meta (cupons usados)</label><input name="meta" type="number" value="${s.meta}"></div><div class="campo"><label>Fixo (R$)</label><input name="fixo" type="number" value="${s.fixo}"></div></div>
        <button class="btn sec" type="submit">Salvar</button></form>`; }).join("")}</div>`;
    el.querySelectorAll("form[data-s]").forEach((f) => f.addEventListener("submit", async (e) => {
      e.preventDefault();
      try { await A.salvarSabado(sess.get("adm"), { id: +f.dataset.s, data: f.data.value, label: f.label.value, meta: f.meta.value, fixo: f.fixo.value }); toast("Sábado salvo"); }
      catch (err) { toast(err.message); }
    }));
  }

  // ---------- base GTO (clientes novos) ----------
  function secBase() {
    const el = casca("base", "Base GTO");
    el.innerHTML = `
      <div class="titulo-pag"><div><h1>Base GTO</h1><p>Quem usar o cupom e não estiver nesta base conta como cliente novo, para a meta e para a comissão.</p></div>
        <div class="acoes-pag"><span class="pill ${D.base_total ? "ok" : "alerta"}">${D.base_total ? U.n(D.base_total) + " CPFs na base" : "Base ainda não carregada"}</span></div></div>
      <div class="grade g2" style="align-items:start">
        <div class="painel grade"><h2 style="margin:0">Carregar CPFs</h2>
          <div class="campo"><label for="cz-txt">CPFs (um por linha, com ou sem pontuação)</label><textarea id="cz-txt"></textarea></div>
          <div class="campo"><label for="cz-arq">Ou envie o arquivo CSV exportado da Rock ou do PDV</label><input id="cz-arq" type="file" accept=".csv,.txt"></div>
          <label class="check" for="cz-sub"><input type="checkbox" id="cz-sub"><span>Substituir a base atual (em vez de somar)</span></label>
          <div id="cz-msg"></div><button class="btn" id="cz-ok" type="button" style="justify-self:start">Carregar base</button></div>
        <div class="painel grade"><h2 style="margin:0">Como funciona com a Rock</h2>
          <p class="muted" style="margin:0">Hoje: a GTO exporta os CPFs da base e a gente carrega aqui antes de cada apuração.</p>
          <p class="muted" style="margin:0">Com a API da Rock: a consulta passa a ser automática no momento do cadastro, e as compras do sábado voltam para conferir o cupom fiscal.</p></div>
      </div>`;
    const arq = el.querySelector("#cz-arq");
    arq.onchange = () => { const fl = arq.files[0]; if (!fl) return; lerArquivo(fl).then((t) => (el.querySelector("#cz-txt").value = t)).catch((e) => toast(e.message)); };
    el.querySelector("#cz-ok").onclick = async () => {
      const cpfs = (el.querySelector("#cz-txt").value.match(/\d[\d.\-]{7,13}\d/g) || []).map((c) => U.so(c).padStart(11, "0")).filter((c) => c.length === 11);
      if (!cpfs.length) { el.querySelector("#cz-msg").innerHTML = `<div class="aviso erro">Nenhum CPF encontrado no texto.</div>`; return; }
      const r = await A.baseCpfs(sess.get("adm"), cpfs, el.querySelector("#cz-sub").checked);
      toast(`${U.n(r.lidos)} CPFs lidos · base com ${U.n(r.total)}`); render();
    };
  }

  // ---------- API e relatórios (chaves) ----------
  const ESCOPOS = {
    grupo: ["Grupo GTO", "Tudo, todas as bandeiras, com nome e WhatsApp dos clientes e CPF mascarado. Uso interno."],
    diretoria: ["Diretoria", "Tudo, todas as bandeiras, só números e rankings. Sem dados de cliente."],
    influencer: ["Influencer", "Só os números da própria influencer. Sem dados de cliente."],
  };
  const TIPOS_REL = ["resumo", "influencers", "lojas", "diario", "cadastros", "comparativo"];
  function secChaves() {
    const el = casca("chaves", "API e relatórios");
    const base = A.modo === "demo" ? "https://DOMINIO/api" : (C.API_URL ? (C.BASE_URL || location.origin) + C.API_URL.replace(/\/$/, "") : String(C.SUPABASE_URL || "").replace(/\/$/, "") + "/rest/v1");
    const hoje = U.hojeISO();
    el.innerHTML = `
      <div class="titulo-pag"><div><h1>API e relatórios</h1><p>Chaves para puxar os dados da campanha em relatórios do Grupo GTO, da diretoria e de cada influencer (Looker Studio, Power BI, Sheets). Só leitura: a chave não abre o CRM e não altera nada.</p></div></div>
      ${A.modo === "demo" ? `<div class="aviso alerta" style="margin-bottom:14px">Demonstração: as chaves criadas aqui não consultam nada. No banco real elas funcionam.</div>` : ""}
      <div id="ch-novo"></div>
      <div class="grade g2" style="align-items:start">
        <div class="painel grade"><h2 style="margin:0">Nova chave</h2>
          <div class="campo"><label for="ch-nome">Quem vai usar</label><input id="ch-nome" placeholder="Ex.: Diretoria GTO, Ana Souza, Looker do Grupo" maxlength="80"></div>
          <div class="campo"><label for="ch-esc">O que a chave enxerga</label><select id="ch-esc">${Object.entries(ESCOPOS).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join("")}</select><span class="sub" id="ch-esc-t">${esc(ESCOPOS.grupo[1])}</span></div>
          <div class="campo" id="ch-inf-c" hidden><label for="ch-inf">Influencer</label><select id="ch-inf">${D.influencers.map((i) => `<option value="${i.id}">${esc(i.nome)}</option>`).join("")}</select></div>
          <div class="campo"><label for="ch-band">Bandeira</label><select id="ch-band"><option value="">Todas</option>${BKEYS.map((k) => `<option value="${k}">${esc(bInfo(k).NOME)}</option>`).join("")}</select></div>
          <div class="campo"><label for="ch-exp">Vence em (opcional)</label><input id="ch-exp" type="date" min="${hoje}"></div>
          <div id="ch-msg"></div><button class="btn" id="ch-criar" type="button" style="justify-self:start">Criar chave</button></div>
        <div class="painel grade"><h2 style="margin:0">Como consultar</h2>
          <p class="muted" style="margin:0">Chamada POST com a chave no cabeçalho <code>X-API-Key</code>. Tipos: ${TIPOS_REL.map((t) => `<code>${t}</code>`).join(", ")}. Filtros opcionais: <code>p_sabado</code>, <code>p_bandeira</code>, <code>p_de</code>, <code>p_ate</code>.</p>
          <div class="campo"><label for="ch-tipo">Tipo de relatório</label><select id="ch-tipo">${TIPOS_REL.map((t) => `<option>${t}</option>`).join("")}</select></div>
          <pre id="ch-curl" style="white-space:pre-wrap;word-break:break-all;margin:0;font-size:12px;background:var(--fundo2,#f4f4f6);padding:10px;border-radius:8px"></pre>
          <button class="btn sec peq" id="ch-copia" type="button" style="justify-self:start">Copiar exemplo</button></div>
      </div>
      <div class="painel" style="margin-top:14px"><h2>Chaves criadas</h2><div id="ch-lista"><p class="muted">Carregando…</p></div></div>`;
    const q = (s) => el.querySelector(s);
    const exemplo = () => `curl -s -X POST '${base}/rpc/api_relatorio' \\\n  -H 'Content-Type: application/json' -H 'X-API-Key: SUA_CHAVE' \\\n  -d '{"p_tipo":"${q("#ch-tipo").value}"}'`;
    const pinta = () => { q("#ch-curl").textContent = exemplo(); };
    q("#ch-tipo").onchange = pinta; pinta();
    q("#ch-copia").onclick = () => copiar(exemplo(), q("#ch-curl"));
    q("#ch-esc").onchange = (e) => { q("#ch-esc-t").textContent = ESCOPOS[e.target.value][1]; q("#ch-inf-c").hidden = e.target.value !== "influencer"; };
    const lista = async () => {
      let ls;
      try { ls = await A.chavesApi(sess.get("adm")); } catch (e) { q("#ch-lista").innerHTML = `<div class="aviso erro">${esc(e.message)}</div>`; return; }
      q("#ch-lista").innerHTML = ls.length ? `<div class="tab" style="border:0"><table><thead><tr><th>Nome</th><th>Acesso</th><th>Chave</th><th>Vence</th><th>Último uso</th><th class="num">Consultas</th><th></th></tr></thead><tbody>${ls.map((c) => {
        const venc = c.expira_em && c.expira_em < hoje;
        const st = !c.ativa ? `<span class="pill">Revogada</span>` : venc ? `<span class="pill alerta">Vencida</span>` : `<span class="pill ok">Ativa</span>`;
        return `<tr><td><b>${esc(c.nome)}</b><span class="sub">${st}</span></td>
          <td>${esc(ESCOPOS[c.escopo][0])}${c.influencer ? `<span class="sub">${esc(c.influencer)}</span>` : ""}${c.bandeira ? `<span class="sub">${esc(bInfo(c.bandeira).NOME)}</span>` : ""}</td>
          <td><code>${esc(c.inicio)}</code></td><td>${c.expira_em ? U.dataBR(c.expira_em) : "Sem prazo"}</td>
          <td>${c.ultimo_uso ? U.horaBR(c.ultimo_uso) : "Nunca"}</td><td class="num">${U.n(c.usos)}</td>
          <td>${c.ativa ? `<button class="btn perigo peq" data-rev="${c.id}" type="button">Revogar</button>` : ""}</td></tr>`;
      }).join("")}</tbody></table></div>` : `<p class="muted">Nenhuma chave criada ainda.</p>`;
      q("#ch-lista").querySelectorAll("[data-rev]").forEach((b) => (b.onclick = () => {
        if (b.dataset.sim) { A.revogarChaveApi(sess.get("adm"), b.dataset.rev).then(() => { toast("Chave revogada"); lista(); }).catch((e) => toast(e.message)); return; }
        b.dataset.sim = "1"; b.textContent = "Confirmar revogação";
      }));
    };
    q("#ch-criar").onclick = async () => {
      const msg = q("#ch-msg"); msg.innerHTML = "";
      const btn = q("#ch-criar"); btn.disabled = true;
      try {
        const r = await A.criarChaveApi(sess.get("adm"), { nome: q("#ch-nome").value, escopo: q("#ch-esc").value, influencer: q("#ch-inf").value, bandeira: q("#ch-band").value, expira_em: q("#ch-exp").value });
        q("#ch-novo").innerHTML = `<div class="painel grade" style="margin-bottom:14px;border:2px solid var(--ok,#1a7f4b)"><h2 style="margin:0">Chave criada: copie agora</h2>
          <p class="muted" style="margin:0">${esc(r.aviso)} Entregue por canal seguro, nunca em grupo de WhatsApp aberto.</p>
          <code id="ch-chave" style="display:block;word-break:break-all;font-size:15px;padding:10px;background:var(--fundo2,#f4f4f6);border-radius:8px">${esc(r.chave)}</code>
          <div style="display:flex;gap:8px"><button class="btn" id="ch-cp" type="button">Copiar chave</button><button class="btn sec" id="ch-ok" type="button">Já guardei, fechar</button></div></div>`;
        q("#ch-cp").onclick = () => copiar(r.chave, q("#ch-chave"));
        q("#ch-ok").onclick = () => { q("#ch-novo").innerHTML = ""; };
        q("#ch-nome").value = ""; scrollTo(0, 0); lista();
      } catch (e) { msg.innerHTML = `<div class="aviso erro" style="margin-bottom:8px">${esc(e.message)}</div>`; }
      btn.disabled = false;
    };
    lista();
  }

  // ---------- configurações ----------
  function secConfig() {
    const el = casca("config", "Configurações");
    el.innerHTML = `
      <div class="titulo-pag"><div><h1>Configurações</h1></div></div>
      <div class="grade g2" style="align-items:start">
        <div class="painel grade"><h2 style="margin:0">Conferência da data no balcão</h2>
          <label class="check" for="cf-teste"><input type="checkbox" id="cf-teste" ${D.teste ? "checked" : ""}><span><b>Modo teste:</b> o balcão aceita o cupom fora do sábado. Desligar antes do 1º sábado.</span></label></div>
        <div class="painel grade"><h2 style="margin:0">Ambiente</h2>
          <p style="margin:0">${A.modo === "demo" ? `<span class="pill ouro">Demonstração</span> Os dados ficam só neste navegador.` : `<span class="pill ok">Banco real</span> Conectado ao banco da GTO.`}</p>
          ${A.modo === "demo" ? `<div id="cf-zona"><button class="btn perigo" id="cf-reset" type="button">Restaurar dados de exemplo</button></div>` : ""}</div>
        <div class="painel grade"><h2 style="margin:0">Regras da promo</h2>
          <p class="muted" style="margin:0">${esc(C.REGRAS)}</p><p class="muted" style="margin:0">Autorização de dados (LGPD) da página: ${esc(C.LGPD)}</p></div>
      </div>`;
    el.querySelector("#cf-teste").onchange = async (e) => { await A.definirTeste(sess.get("adm"), e.target.checked); toast(e.target.checked ? "Modo teste ligado" : "Modo teste desligado"); render(); };
    const r = el.querySelector("#cf-reset");
    if (r) r.onclick = () => {
      el.querySelector("#cf-zona").innerHTML = `<div class="aviso alerta">Apaga tudo o que foi feito nesta demonstração e volta aos dados de exemplo.</div><div style="display:flex;gap:8px;margin-top:8px"><button class="btn sec peq" id="cf-nao" type="button">Cancelar</button><button class="btn perigo peq" id="cf-sim" type="button">Restaurar</button></div>`;
      el.querySelector("#cf-nao").onclick = () => render();
      el.querySelector("#cf-sim").onclick = async () => { await A.reiniciarDemo(sess.get("adm")); toast("Dados de exemplo restaurados"); render(); };
    };
  }

  // ---------- render ----------
  function render() {
    const r = rota();
    scrollTo(0, 0);
    if (r.v === "lp") return vLP(r.slug);
    if (r.v === "balcao") return vBalcao();
    return vCRM(r);
  }
  render();
})();
