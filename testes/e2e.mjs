// Ponta a ponta: as telas REAIS (CRM, página da influencer, balcão) rodando contra a API e o banco REAIS.
import { JSDOM } from "jsdom";
import fs from "fs";
import pg from "pg";

import { WEB, API_BASE as API, PIN, dbCfg, exigirHomologacao } from "./config.mjs";
exigirHomologacao();
const BASE = "https://sabadopremiado.teste";
let falhas = 0;
const ok = (c, m) => { if (!c) { falhas++; console.log("  FALHOU:", m); } else console.log("  ok:", m); };
const esp = (ms) => new Promise((r) => setTimeout(r, ms));
const db = new pg.Client(dbCfg); await db.connect();
const q = async (s, p) => (await db.query(s, p)).rows;
const erros = [];

// ---- página montada como a publicação: scripts inline, config de produção ----
const cfg = fs.readFileSync(WEB + "config.js", "utf8").replace(/MODO: "\w+"/, 'MODO: "servidor"').replace(/ROTAS: "\w+"/, 'ROTAS: "path"').replace(/API_URL: "[^"]*"/, `API_URL: "${API}"`).replace(/BASE_URL: "[^"]*"/, `BASE_URL: "${BASE}"`);
const parts = ["<div id=\"app\"></div>"];
for (const n of ["logos.js", "config.js", "util.js", "api-demo.js", "api-supabase.js", "app.js"]) parts.push("<script>\n" + (n === "config.js" ? cfg : fs.readFileSync(WEB + n, "utf8")).replace(/<\/script/g, "<\\/script") + "\n</script>");
const HTML = parts.join("\n");

async function abrir(path, { storage = {}, sess = {}, hook } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body>${HTML}</body></html>`, {
    runScripts: "dangerously", url: BASE + path, pretendToBeVisual: true,
    beforeParse(w) {
      for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, v);
      for (const [k, v] of Object.entries(sess)) w.sessionStorage.setItem(k, v);
      w.fetch = hook ? hook(fetch) : fetch; w.AbortController = AbortController; w.TextDecoder = TextDecoder; w.URLSearchParams = URLSearchParams;
      w.QRCode = function () {}; w.QRCode.CorrectLevel = { M: 0 }; w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {};
      ["nome", "cpf", "whatsapp", "bairro", "aceite", "pin", "termo"].forEach((n) => Object.defineProperty(w.HTMLFormElement.prototype, n, { configurable: true, get() { return this.elements.namedItem(n) || this.querySelector("#" + n); } }));
      w.addEventListener("error", (e) => erros.push(e.message));
    },
  });
  await esp(500);
  return dom.window;
}
async function ate(w, cond, ms = 8000) { const t = Date.now(); while (Date.now() - t < ms) { try { if (cond(w.document)) return true; } catch {} await esp(100); } return false; }
const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
const ADM = { "sp-adm": PIN };
const cpfs = new Set();
let sem = 31337;
const rnd = () => ((sem = (sem * 1664525 + 1013904223) % 4294967296) / 4294967296);
function cpfNovo() { while (true) { const d = Array.from({ length: 9 }, () => Math.floor(rnd() * 10)); if (d.every((x) => x === d[0])) continue; for (let t = 9; t < 11; t++) { let s = 0; for (let i = 0; i < t; i++) s += d[i] * (t + 1 - i); d.push(((s * 10) % 11) % 10); } const c = d.join(""); if (!cpfs.has(c)) { cpfs.add(c); return c; } } }
const fmt = (c) => c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
function digitar(w, el, v) { el.value = v; el.dispatchEvent(new w.Event("input", { bubbles: true })); el.dispatchEvent(new w.Event("change", { bubbles: true })); }
async function cadastrarNaPagina(w, nome, cpf, { aceite = true } = {}) {
  const d = w.document; const f = d.getElementById("f-cad");
  digitar(w, f.querySelector("#c-nome"), nome); digitar(w, f.querySelector("#c-cpf"), fmt(cpf)); digitar(w, f.querySelector("#c-wpp"), "61998887766"); f.querySelector("#c-aceite").checked = aceite;
  f.dispatchEvent(new w.Event("submit", { cancelable: true }));
}
function arquivo(w, input, conteudoLatin1, nome = "x.csv") {
  const f = new w.File([Buffer.from(conteudoLatin1, "latin1")], nome, { type: "text/csv" });
  Object.defineProperty(input, "files", { configurable: true, value: [f] }); input.dispatchEvent(new w.Event("change", { bubbles: true }));
}
const T0 = Date.now();

// ---------------------------------------------------------------
console.log("== 1. Página de influencer que não existe ==");
let w = await abrir("/naoexiste");
ok(await ate(w, (d) => /não encontrada/i.test(txt(d.body))), "mostra 'Página não encontrada'");

console.log("\n== 2. Entrada no CRM: senha errada e senha certa ==");
w = await abrir("/crm");
ok(await ate(w, (d) => d.getElementById("f-login")), "pede a senha");
digitar(w, w.document.getElementById("pin"), "senha errada");
w.document.getElementById("f-login").dispatchEvent(new w.Event("submit", { cancelable: true }));
ok(await ate(w, (d) => /Sessão expirada|PIN|senha/i.test(txt(d.getElementById("login-msg")))), `senha errada é recusada (“${txt(w.document.getElementById("login-msg"))}”)`);
digitar(w, w.document.getElementById("pin"), PIN);
w.document.getElementById("f-login").dispatchEvent(new w.Event("submit", { cancelable: true }));
ok(await ate(w, (d) => /Visão geral/.test(txt(d.querySelector("h1"))), 10000), "senha certa abre a Visão geral");
ok(await ate(w, (d) => d.querySelectorAll("tr[data-trocar]").length === 3), "quadro 'Por bandeira' mostra as 3 bandeiras");

console.log("\n== 3. Cadastro de influencers pela lista (com loja ambígua e inexistente) ==");
w = await abrir("/crm/influencers", { sess: ADM });
ok(await ate(w, (d) => d.getElementById("b-import")), "tela de influencers abriu");
w.document.getElementById("b-import").click();
ok(await ate(w, (d) => d.getElementById("imp")), "abriu a janela de importar");
digitar(w, w.document.getElementById("imp"), [
  "UIE Marta Souza;@marta;Tesoura de Ouro Ceilândia 1;1;3;2",
  "UIE Paula Reis;@paula;Centro;1;100;50;tesoura",
  "UIE Lia Costa;@lia;Loja Que Nao Existe;1;100;50",
  "UIE Nina Dias;@nina;Magazine da Economia Brazlândia;1;100;50",
].join("\n"));
w.document.getElementById("imp-ok").click();
ok(await ate(w, (d) => /criadas/.test(txt(d.getElementById("imp-msg"))), 15000), "importação respondeu");
const msgImp = txt(w.document.getElementById("imp-msg"));
console.log("   ->", msgImp.slice(0, 300));
ok(/2 criadas/.test(msgImp), "criou as 2 influencers com loja certa");
ok(/serve para \d+ lojas/.test(msgImp), "recusou a loja ambígua ('Centro') sem escolher uma por conta própria");
ok(/não encontrada/.test(msgImp), "recusou a loja inexistente");
const marta = (await q("select i.*, l.nome loja_nome, l.bandeira from influencers i join lojas l on l.id = i.loja_id where i.nome = 'UIE Marta Souza'"))[0];
const nina = (await q("select i.*, l.bandeira from influencers i join lojas l on l.id = i.loja_id where i.nome = 'UIE Nina Dias'"))[0];
ok(marta && marta.bandeira === "tesoura" && marta.loja_nome === "Tesoura de Ouro Ceilândia 1", "Marta ficou na loja Tesoura de Ouro Ceilândia 1");
ok(nina && nina.bandeira === "magazine", "Nina ficou na Magazine");
const slugM = marta.slug, slugN = nina.slug;

console.log("\n== 4. A TI manda os tokens; a V4 sobe a lista no CRM (Windows-1252, com acento) ==");
w = await abrir("/crm/integracoes", { sess: ADM });
ok(await ate(w, (d) => d.getElementById("tk-ok")), "tela do Caixa abriu");
let d = w.document;
d.getElementById("tk-ok").click();
ok(await ate(w, (d2) => /pelo menos um token/i.test(txt(d2.getElementById("tk-msg")))), "lista vazia é recusada");
digitar(w, d.getElementById("tk-txt"), "UIE-X1\nUIE-X2");
d.getElementById("tk-ok").click();
ok(await ate(w, (d2) => /de quem é esta lista/i.test(txt(d2.getElementById("tk-msg")))), "sem escolher a influencer a lista é recusada");
d.getElementById("tk-txt").value = "";
d.getElementById("tk-inf").value = "*";
arquivo(w, d.getElementById("tk-arq"), "token;influencer\r\nUIE-T001;UIE\r\nUIE-T002;UIE\r\nUIE-T003;UIE\r\nQTK-N001;" + nina.prefixo + "\r\nQTK-N002;" + nina.prefixo + "\r\n");
ok(await ate(w, (d2) => /UIE-T001/.test(d2.getElementById("tk-txt").value)), "arquivo lido");
d.getElementById("tk-ok").click();
ok(await ate(w, (d2) => /novos/.test(txt(d2.getElementById("tk-msg"))), 15000), "importação de tokens respondeu: " + txt(w.document.getElementById("tk-msg") || w.document.body).slice(0, 140));
const nTok = (await q("select count(*)::int n from tokens where influencer_id in ($1, $2)", [marta.id, nina.id]))[0].n;
ok(nTok === 5, `5 tokens gravados, cada um na sua influencer (${nTok})`);

console.log("\n== 5. A cliente abre a página da influencer e pega o token ==");
w = await abrir("/" + slugM);
ok(await ate(w, (d2) => d2.getElementById("f-cad")), "página da Marta abriu com o formulário");
ok(/Tesoura de Ouro/.test(txt(w.document.querySelector(".lp-hero h1"))), "mostra a marca da bandeira (Tesoura de Ouro)");
const cpf1 = cpfNovo();
await cadastrarNaPagina(w, "Maria das Dores", cpf1);
ok(await ate(w, (d2) => d2.getElementById("cupom-cod"), 10000), "cadastro concluído");
const cod1 = txt(w.document.getElementById("cupom-cod"));
ok(cod1 === "UIE-T001", `recebeu o token da TI, na ordem: ${cod1}`);
const armazenado = w.localStorage.getItem("sp-cupom-" + slugM);
ok(armazenado && JSON.parse(armazenado).codigo === "UIE-T001", "o cupom ficou guardado no aparelho");
// reabre a página: mostra o cupom, sem pedir tudo de novo
const store = { ["sp-cupom-" + slugM]: armazenado };
w = await abrir("/" + slugM, { storage: store });
ok(await ate(w, (d2) => d2.getElementById("cupom-cod") && txt(d2.getElementById("cupom-cod")) === "UIE-T001"), "voltando à página, mostra o mesmo cupom");
// outro aparelho, mesmo CPF: recebe o mesmo token
w = await abrir("/" + slugM);
await ate(w, (d2) => d2.getElementById("f-cad"));
await cadastrarNaPagina(w, "Maria das Dores", cpf1);
ok(await ate(w, (d2) => d2.getElementById("cupom-cod"), 10000) && txt(w.document.getElementById("cupom-cod")) === "UIE-T001", "mesmo CPF em outro aparelho: o mesmo token (não gasta outro)");
// CPF inválido e sem aceite
w = await abrir("/" + slugM); await ate(w, (d2) => d2.getElementById("f-cad"));
await cadastrarNaPagina(w, "Fulano de Tal", "11111111111");
ok(await ate(w, (d2) => /CPF inválido/.test(txt(d2.getElementById("cad-msg")))), "CPF inválido é recusado com mensagem clara");
await cadastrarNaPagina(w, "Fulano de Tal", cpfNovo(), { aceite: false });
ok(await ate(w, (d2) => /autoriza/i.test(txt(d2.getElementById("cad-msg")))), "sem marcar a autorização, não cadastra");
// 2º e 3º clientes, 4º encontra tudo esgotado (lote 3 e 3 tokens)
for (let k = 2; k <= 3; k++) { w = await abrir("/" + slugM); await ate(w, (d2) => d2.getElementById("f-cad")); await cadastrarNaPagina(w, "Cliente " + k, cpfNovo()); ok(await ate(w, (d2) => d2.getElementById("cupom-cod"), 10000) && txt(w.document.getElementById("cupom-cod")) === "UIE-T00" + k, `cliente ${k} recebeu UIE-T00${k}`); }
w = await abrir("/" + slugM);
ok(await ate(w, (d2) => /acabaram/.test(txt(d2.getElementById("lp-corpo")))), "com o lote cheio a página avisa que acabou (sem formulário)");

console.log("\n== 6. O servidor cai no meio do cadastro: o aparelho guarda e reenvia sozinho ==");
// Nina tem 2 tokens. A API 'cai' (fetch falha) por 17 s: mais que as tentativas automáticas da página.
let caiu = true;
const hook = (f) => (url, opts) => { if (caiu && /cadastrar/.test(String(url))) return Promise.reject(new TypeError("fetch failed")); return f(url, opts); };
w = await abrir("/" + slugN, { hook });
ok(await ate(w, (d2) => d2.getElementById("f-cad")), "página da Nina abriu (a leitura ainda funciona)");
const cpf2 = cpfNovo();
const t6 = Date.now();
await cadastrarNaPagina(w, "Cliente Instável", cpf2);
ok(await ate(w, (d2) => /instabilidade/.test(txt(d2.getElementById("cad-msg"))), 30000), `a página avisa da instabilidade (${((Date.now() - t6) / 1000).toFixed(0)} s)`);
const pend = w.localStorage.getItem("sp-pend-" + slugN);
ok(!!pend && JSON.parse(pend).cpf.replace(/\D/g, "") === cpf2, "os dados do cliente ficaram guardados no aparelho");
ok((await q("select count(*)::int n from cadastros where cpf = $1", [cpf2]))[0].n === 0, "(e ainda não existe cadastro no banco)");
caiu = false;
ok(await ate(w, (d2) => d2.getElementById("cupom-cod"), 15000), "o serviço voltou: a página reenviou sozinha e mostrou o cupom");
ok(txt(w.document.getElementById("cupom-cod")) === "QTK-N001", `recebeu o token ${txt(w.document.getElementById("cupom-cod"))}`);
ok(w.localStorage.getItem("sp-pend-" + slugN) === null, "a pendência foi apagada depois de concluir");
// a pessoa fechou a aba durante a queda: ao reabrir, retoma
caiu = true;
w = await abrir("/" + slugN, { hook, storage: { ["sp-pend-" + slugN]: JSON.stringify({ nome: "Cliente Fechou Aba", cpf: cpfNovo(), whatsapp: "61998887766", bairro: "", aceite: true, ts: Date.now() }) } });
await ate(w, (d2) => /Retomando|instabilidade/.test(txt(d2.getElementById("cad-msg"))), 10000);
caiu = false;
ok(await ate(w, (d2) => d2.getElementById("cupom-cod"), 40000) && txt(w.document.getElementById("cupom-cod")) === "QTK-N002", "reabriu a página com cadastro pendente: retomou e entregou o token");

console.log("\n== 7. Balcão da loja ==");
const lojaN = (await q("select l.pin from lojas l where l.id = $1", [nina.loja_id]))[0].pin;
w = await abrir("/balcao");
await ate(w, (d2) => d2.getElementById("f-login"));
digitar(w, w.document.getElementById("pin"), "000000");
w.document.getElementById("f-login").dispatchEvent(new w.Event("submit", { cancelable: true }));
ok(await ate(w, (d2) => /não encontrado/i.test(txt(d2.getElementById("login-msg")))), "PIN de loja errado é recusado");
digitar(w, w.document.getElementById("pin"), lojaN);
w.document.getElementById("f-login").dispatchEvent(new w.Event("submit", { cancelable: true }));
ok(await ate(w, (d2) => d2.getElementById("f-busca"), 10000), "PIN certo abre a consulta");
await q("insert into config (chave, valor) values ('teste','1') on conflict (chave) do update set valor='1'");
digitar(w, w.document.getElementById("termo"), "qtk n001");
w.document.getElementById("f-busca").dispatchEvent(new w.Event("submit", { cancelable: true }));
ok(await ate(w, (d2) => d2.getElementById("f-val"), 10000), "achou o token digitado com espaço e minúsculas ('qtk n001')");
digitar(w, w.document.getElementById("v-fiscal"), "55001"); digitar(w, w.document.getElementById("v-valor"), "189.90");
w.document.getElementById("f-val").dispatchEvent(new w.Event("submit", { cancelable: true }));
ok(await ate(w, (d2) => /Vale liberado/.test(txt(d2.getElementById("res"))), 10000), "validou o cupom");
const vv = (await q("select status, valor from cadastros where codigo = 'QTK-N001'"))[0];
ok(vv.status === "usado" && Number(vv.valor) === 189.9, `valor "189.90" gravado como ${vv.valor} (não 18990)`);
digitar(w, w.document.getElementById("termo"), "QTK-N001");
w.document.getElementById("f-busca").dispatchEvent(new w.Event("submit", { cancelable: true }));
ok(await ate(w, (d2) => /já usado/i.test(txt(d2.getElementById("res")))), "consultar de novo mostra 'já usado'");

console.log("\n== 8. Importar as vendas do PDV (CSV do Excel, com acento, CPF sem zero e valor com ponto) ==");
const zero = (() => { while (true) { const c = cpfNovo(); if (c[0] === "0") return c; const d9 = [0, ...Array.from({ length: 8 }, () => Math.floor(rnd() * 10))]; for (let t = 9; t < 11; t++) { let s = 0; for (let i = 0; i < t; i++) s += d9[i] * (t + 1 - i); d9.push(((s * 10) % 11) % 10); } const z = d9.join(""); if (!cpfs.has(z)) { cpfs.add(z); return z; } } })();
const rz = await (await fetch(API + "/rpc/adm_salvar_influencer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_pin: PIN, p: { nome: "UIE Zé Acentuado", prefixo: "UIEZE", loja_id: marta.loja_id, sabado_id: 1, lote: 50, meta: 10 } }) })).json();
await fetch(API + "/rpc/adm_importar_tokens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_pin: PIN, p: [{ token: "UIEZE-001", influencer: "UIEZE" }] }) });
const cz = await (await fetch(API + "/rpc/cadastrar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_slug: "uieze", p_nome: "José Conceição", p_cpf: zero, p_whatsapp: "61998887766", p_bairro: "Ceilândia", p_aceite: true }) })).json();
w = await abrir("/crm/integracoes", { sess: ADM });
await ate(w, (d2) => d2.getElementById("vd-ok"));
arquivo(w, w.document.getElementById("vd-arq"), `cupom;cpf;nota;data;valor\r\n${cz.codigo.toLowerCase()};${zero.replace(/^0+/, "")};88001;28/11/2026 14:32;189.90\r\nNAOEXISTE1;;1;;10\r\nlinha quebrada sem sentido\r\n`);
await ate(w, (d2) => /88001/.test(d2.getElementById("vd-txt").value));
w.document.getElementById("vd-ok").click();
ok(await ate(w, (d2) => /com baixa/.test(txt(d2.getElementById("vd-msg"))), 15000), "importação respondeu: " + txt(w.document.getElementById("vd-msg")).slice(0, 160));
const v8 = (await q("select status, valor, to_char(usado_em at time zone 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') h from cadastros where cpf = $1", [zero]))[0];
ok(v8.status === "usado" && Number(v8.valor) === 189.9 && v8.h === "2026-11-28 14:32", `baixa com CPF de 10 dígitos, valor ${v8.valor}, hora ${v8.h} (Brasília)`);

console.log("\n== 9. Campanha de fim de ano (CSV com acento) e comparativo ==");
w = await abrir("/crm/comparativo", { sess: ADM });
ok(await ate(w, (d2) => d2.getElementById("fa-ok"), 15000), "tela do comparativo abriu");
w.document.getElementById("fa-band").value = "tesoura";
arquivo(w, w.document.getElementById("fa-arq"), `${fmt(zero.replace(/^0+/, "").padStart(11, "0"))};José Conceição;9900;01/12/2026 10:00;R$ 1.234,50;Tesoura Ceilândia\r\n${fmt(cpf1)};Maria das Dores;9901;02/12/2026;250,00;Tesoura Ceilândia\r\n`);
await ate(w, (d2) => /9900/.test(d2.getElementById("fa-txt").value));
w.document.getElementById("fa-ok").click();
ok(await ate(w, (d2) => /notas novas/.test(txt(d2.getElementById("fa-msg"))), 15000), "importou: " + txt(w.document.getElementById("fa-msg")).slice(0, 120));
const fa = await q("select nome, valor, bandeira from fimdeano_notas where nota = '9900'");
ok(fa.length === 1 && fa[0].nome === "José Conceição" && Number(fa[0].valor) === 1234.5, `acento preservado (“${fa[0] && fa[0].nome}”) e valor R$ 1.234,50 lido como ${fa[0] && fa[0].valor}`);
ok(await ate(w, (d2) => /José Conceição/.test(txt(d2.getElementById("cp-pessoas"))), 10000), "o comparativo mostra quem está nos dois lugares");

console.log("\n== 10. Foto da influencer (envio, lista leve, não apagar ao salvar) ==");
await fetch(API + "/rpc/adm_salvar_influencer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_pin: PIN, p: { id: marta.id, nome: marta.nome, prefixo: marta.prefixo, loja_id: marta.loja_id, sabado_id: 1, lote: 3, meta: 2, foto: "data:image/jpeg;base64," + "B".repeat(5000) } }) });
w = await abrir("/crm/inf/" + slugM, { sess: ADM });
await ate(w, (d2) => /UIE Marta/.test(txt(d2.body)), 15000);
const btnEd = [...w.document.querySelectorAll("button")].find((b) => /^Editar/.test(txt(b)));
btnEd.click();
await ate(w, (d2) => d2.getElementById("f-inf"));
ok(await ate(w, (d2) => d2.querySelector("#fi-foto-prev img"), 8000), "ao abrir a edição, a foto é buscada e aparece na prévia");
digitar(w, w.document.getElementById("fi-insta"), "@marta.nova");
w.document.getElementById("f-inf").dispatchEvent(new w.Event("submit", { cancelable: true }));
await esp(1500);
const fotoDepois = (await q("select foto, instagram from influencers where id = $1", [marta.id]))[0];
ok(fotoDepois.foto.length > 5000 && fotoDepois.instagram === "@marta.nova", "salvar a ficha SEM trocar a foto mantém a foto (e atualiza o resto)");

console.log("\n== 10b. Nome de cliente com código malicioso (XSS) em todas as telas ==");
await fetch(API + "/rpc/adm_salvar_influencer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_pin: PIN, p: { nome: "UIE <b>Xss</b>", prefixo: "UIEXSS", loja_id: marta.loja_id, sabado_id: 1, lote: 10, meta: 5, instagram: "<script>window.__xss=1</script>" } }) });
await fetch(API + "/rpc/adm_importar_tokens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_pin: PIN, p: [{ token: "XSSK-001", influencer: "UIEXSS" }] }) });
const evil = '<img src=x onerror="window.__xss=1">Zé';
w = await abrir("/uiexss"); await ate(w, (d2) => d2.getElementById("f-cad"));
const cpfX = cpfNovo();
{ const d2 = w.document; const f = d2.getElementById("f-cad"); digitar(w, f.querySelector("#c-nome"), evil); digitar(w, f.querySelector("#c-cpf"), fmt(cpfX)); digitar(w, f.querySelector("#c-wpp"), "61998887766"); f.querySelector("#c-aceite").checked = true; f.dispatchEvent(new w.Event("submit", { cancelable: true })); }
await ate(w, (d2) => d2.getElementById("cupom-cod"), 10000);
ok(!w.__xss && !w.document.querySelector('img[src="x"]') && !w.document.querySelector("#lp-corpo script"), "página da cliente: nome malicioso não executa nada");
const wx = await abrir("/crm/clientes", { sess: ADM });
await ate(wx, (d2) => d2.querySelector("tr[data-cpf]"), 15000);
const wxb = await abrir("/crm/influencers", { sess: ADM }); await ate(wxb, (d2) => d2.querySelector(".quadro, table, .lista"), 15000); await esp(800);
ok(!wx.__xss && !wx.document.querySelector('img[src="x"]') && !wxb.__xss && !wxb.document.querySelector("script:not([src])[data-x]") && !/__xss/.test(wxb.document.querySelector("main").innerHTML.replace(/&lt;[^&]*__xss[^&]*&gt;/g, "")), "CRM: clientes e influencers com texto malicioso não executam nada");
const wxc = await abrir("/crm/inf/uiexss", { sess: ADM }); await ate(wxc, (d2) => /UIE/.test(txt(d2.body)), 15000); await esp(500);
ok(!wxc.__xss && !wxc.document.querySelector("main script"), "ficha da influencer com nome e instagram maliciosos: nada executa");
const pinX = (await q("select l.pin from lojas l where l.id = $1", [marta.loja_id]))[0].pin;
const wb = await abrir("/balcao", { sess: { "sp-loja": pinX, "sp-loja-nome": "Loja" } });
await ate(wb, (d2) => d2.getElementById("f-busca"));
digitar(wb, wb.document.getElementById("termo"), "XSSK-001"); wb.document.getElementById("f-busca").dispatchEvent(new wb.Event("submit", { cancelable: true }));
await ate(wb, (d2) => d2.querySelector("#res .resultado"), 10000);
ok(!wb.__xss && !wb.document.querySelector('#res img[src="x"]') && /Zé/.test(txt(wb.document.getElementById("res"))), "balcão: o nome aparece como texto, sem executar");

console.log("\n== 10c. Limite de acessos (429 do nginx) é repetido sozinho ==");
{
  const { JSDOM: J2 } = await import("jsdom");
  const dom2 = new J2("<!doctype html><html><body></body></html>", { runScripts: "outside-only", url: BASE + "/" });
  const w2 = dom2.window; let chamadas = 0;
  w2.fetch = async () => { chamadas++; if (chamadas <= 3) return new Response('{"message":"Too Many Requests"}', { status: 429 }); return new Response("true", { status: 200 }); };
  w2.AbortController = AbortController; w2.URLSearchParams = URLSearchParams;
  w2.CONFIG = { MODO: "servidor", API_URL: "/api" };
  w2.eval(fs.readFileSync(WEB + "util.js", "utf8")); w2.eval(fs.readFileSync(WEB + "api-supabase.js", "utf8"));
  const t = Date.now();
  const r = await w2.API.salvarSabado("1234", { id: 1, data: "2026-11-28", label: "x", meta: 50, fixo: 1000 }).catch((e) => ({ erro: e.message }));
  ok(r === true && chamadas === 4, `chamada que muda dados foi repetida ${chamadas - 1} vezes após 429 e passou (${((Date.now() - t) / 1000).toFixed(1)} s)`);
}

console.log("\n== 11. Visão geral com a base cheia ==");
const tv = Date.now();
w = await abrir("/crm", { sess: ADM });
ok(await ate(w, (d2) => d2.querySelectorAll("tr[data-trocar]").length === 3, 20000), `abre em ${((Date.now() - tv) / 1000).toFixed(1)} s com ${(await q("select count(*)::int n from cadastros"))[0].n} cadastros`);

console.log(`\nerros de JavaScript nas telas: ${erros.length}`, erros.slice(0, 3));
ok(erros.length === 0, "nenhum erro de JavaScript durante todo o roteiro");
console.log(`\n== RESULTADO: ${falhas === 0 ? "TUDO OK" : falhas + " FALHA(S)"} · ${((Date.now() - T0) / 1000).toFixed(0)} s ==`);
await db.end();
process.exit(falhas ? 1 : 0);
