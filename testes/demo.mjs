// Regressão do modo demonstração (o artefato que o time abre): telas reais, dados no navegador.
import { JSDOM } from "jsdom";
import fs from "fs";

import { ARTEFATO as ART } from "./config.mjs";
const HTML = fs.readFileSync(ART, "utf8");
const BASE = "https://demo.teste";
let falhas = 0; const erros = [];
const ok = (c, m) => { if (!c) { falhas++; console.log("  FALHOU:", m); } else console.log("  ok:", m); };
const esp = (ms) => new Promise((r) => setTimeout(r, ms));
const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
async function ate(w, cond, ms = 8000) { const t = Date.now(); while (Date.now() - t < ms) { try { if (cond(w.document)) return true; } catch {} await esp(80); } return false; }
function digitar(w, el, v) { el.value = v; el.dispatchEvent(new w.Event("input", { bubbles: true })); el.dispatchEvent(new w.Event("change", { bubbles: true })); }

// uma "aba" que guarda o armazenamento entre navegações
const memoria = { local: {}, sess: {} };
async function abrir(hash, { adm = true } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body>${HTML}</body></html>`, {
    runScripts: "dangerously", url: BASE + "/" + hash, pretendToBeVisual: true,
    beforeParse(w) {
      for (const [k, v] of Object.entries(memoria.local)) w.localStorage.setItem(k, v);
      for (const [k, v] of Object.entries(memoria.sess)) w.sessionStorage.setItem(k, v);
      if (adm) w.sessionStorage.setItem("sp-adm", "1234");
      w.TextDecoder = TextDecoder; w.QRCode = function () {}; w.QRCode.CorrectLevel = { M: 0 }; w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {};
      ["nome", "cpf", "whatsapp", "bairro", "aceite", "pin", "termo"].forEach((n) => Object.defineProperty(w.HTMLFormElement.prototype, n, { configurable: true, get() { return this.elements.namedItem(n) || this.querySelector("#" + n); } }));
      w.addEventListener("error", (e) => erros.push(e.message));
    },
  });
  const w = dom.window; await esp(500);
  w.__salvar = () => { memoria.local = {}; for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); memoria.local[k] = w.localStorage.getItem(k); } memoria.sess = {}; for (let i = 0; i < w.sessionStorage.length; i++) { const k = w.sessionStorage.key(i); memoria.sess[k] = w.sessionStorage.getItem(k); } };
  return w;
}
const cpfs = new Set(); let sem = 99;
const rnd = () => ((sem = (sem * 1664525 + 1013904223) % 4294967296) / 4294967296);
function cpfNovo() { while (true) { const d = Array.from({ length: 9 }, () => Math.floor(rnd() * 10)); if (d.every((x) => x === d[0])) continue; for (let t = 9; t < 11; t++) { let s = 0; for (let i = 0; i < t; i++) s += d[i] * (t + 1 - i); d.push(((s * 10) % 11) % 10); } const c = d.join(""); if (!cpfs.has(c)) { cpfs.add(c); return c; } } }
const fmt = (c) => c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

console.log("== Visão geral e seletor de bandeira ==");
let w = await abrir("#visao");
ok(await ate(w, (d) => /Visão geral · Grupo GTO/.test(txt(d.querySelector("h1")))), "abre no Grupo GTO");
ok(await ate(w, (d) => d.querySelectorAll("tr[data-trocar]").length === 3), "quadro com as 3 bandeiras");
ok(!w.document.querySelector(".demo-faixa"), "sem a faixa de demonstração no topo");
w.document.querySelector('[data-band="magazine"]').click();
ok(await ate(w, (d) => /Magazine da Economia/.test(txt(d.querySelector("h1")))), "troca para Magazine");
ok(await ate(w, (d) => d.querySelectorAll(".menu a").length >= 8), "menu lateral completo");
const nMag = (await (async () => { w.location.hash = "lojas"; await ate(w, (d) => d.querySelector("tr[data-loja]")); return w.document.querySelectorAll("tr[data-loja]").length; })());
ok(nMag === 25, `Lojas da Magazine: ${nMag} (esperado 25 reais)`);
w.__salvar();

console.log("\n== Lojas reais e escolher influencers da loja ==");
w = await abrir("#lojas");
await ate(w, (d) => d.querySelector("tr[data-loja]"));
ok(w.document.querySelectorAll("tr[data-loja]").length === 25, "bandeira guardada na sessão: continua na Magazine");
w.document.querySelector('[data-band=""]').click();
await ate(w, (d) => d.querySelectorAll("tr[data-loja]").length === 101, 8000);
ok(w.document.querySelectorAll("tr[data-loja]").length === 101, "Geral: as 101 lojas reais");
w.document.querySelector("[data-l]").click();
ok(await ate(w, (d) => d.getElementById("l-inf-lista")), "janela da loja abriu com a lista de influencers");
const disp = [...w.document.querySelectorAll("#l-inf-lista input:not(:disabled)")][0];
disp.checked = true; disp.dispatchEvent(new w.Event("change", { bubbles: true }));
w.document.getElementById("f-loja").dispatchEvent(new w.Event("submit", { cancelable: true }));
ok(await ate(w, (d) => /ligada/.test(txt(d.querySelector(".toast")) || "")), "salvou a loja ligando a influencer");

console.log("\n== Caixa: tokens da TI por influencer ==");
w = await abrir("#integracoes");
ok(await ate(w, (d) => d.getElementById("tk-ok")), "tela do Caixa");
ok(!!w.document.getElementById("tk-sab"), "tem o seletor de sábado do lote");
const infOpt = [...w.document.querySelectorAll("#tk-inf option")].find((o) => o.value && o.value !== "*");
digitar(w, w.document.getElementById("tk-txt"), "DEMO-T1\nDEMO-T2");
w.document.getElementById("tk-ok").click();
ok(await ate(w, (d) => /de quem é esta lista/i.test(txt(d.getElementById("tk-msg")))), "sem marcar a influencer, recusa");
w.document.getElementById("tk-inf").value = infOpt.value; w.document.getElementById("tk-ok").click();
ok(await ate(w, (d) => /2 novos/.test(txt(d.getElementById("tk-msg"))), 8000), "importou 2 tokens para a influencer marcada");
const slugDemo = infOpt.value.toLowerCase();
w.__salvar();

console.log("\n== Página da influencer (demonstração) ==");
w = await abrir("#lp-" + slugDemo, { adm: false });
ok(await ate(w, (d) => d.getElementById("f-cad")), "página abre");
{ const f = w.document.getElementById("f-cad"); digitar(w, f.querySelector("#c-nome"), "Cliente Demonstração"); digitar(w, f.querySelector("#c-cpf"), fmt(cpfNovo())); digitar(w, f.querySelector("#c-wpp"), "61998887766"); f.querySelector("#c-aceite").checked = true; f.dispatchEvent(new w.Event("submit", { cancelable: true })); }
ok(await ate(w, (d) => d.getElementById("cupom-cod"), 8000), "cadastro entrega o token");
ok(/^DEMO-T1$/.test(txt(w.document.getElementById("cupom-cod"))), `token da lista da TI: ${txt(w.document.getElementById("cupom-cod"))}`);
const li4 = [...w.document.querySelectorAll(".lp-passos li")].pop();
ok(li4 && li4.children.length <= 1, "passo final da lista sem quebrar o layout (um único bloco)");
w.__salvar();

console.log("\n== Comparativo, foto e balcão ==");
w = await abrir("#comparativo");
ok(await ate(w, (d) => d.getElementById("fa-ok"), 10000), "comparativo abre");
w.document.getElementById("fa-band").value = [...w.document.querySelectorAll("#fa-band option")].find((o) => o.value).value;
digitar(w, w.document.getElementById("fa-txt"), "529.982.247-25;Maria;123;28/11/2026 14:00;R$ 1.234,50;Loja");
w.document.getElementById("fa-ok").click();
ok(await ate(w, (d) => /notas novas/.test(txt(d.getElementById("fa-msg"))), 8000), "importa linha do fim de ano: " + txt(w.document.getElementById("fa-msg")));
w = await abrir("#influencers");
await ate(w, (d) => d.querySelector("tr[data-slug], .card-inf, [data-slug]"));
w = await abrir("#inf-" + slugDemo);
await ate(w, (d) => /Editar/.test(txt(d.body)));
[...w.document.querySelectorAll("button")].find((b) => /^Editar/.test(txt(b))).click();
ok(await ate(w, (d) => d.getElementById("fi-foto-arq")), "formulário da influencer tem o envio de foto");
w.document.getElementById("f-inf").dispatchEvent(new w.Event("submit", { cancelable: true }));
ok(await ate(w, (d) => /Influencer salva|salva/i.test(txt(d.querySelector(".toast") || d.body)), 6000), "salvar a influencer funciona");
w = await abrir("#balcao", { adm: false });
await ate(w, (d) => d.getElementById("f-login"));
digitar(w, w.document.getElementById("pin"), "1001");
w.document.getElementById("f-login").dispatchEvent(new w.Event("submit", { cancelable: true }));
ok(await ate(w, (d) => d.getElementById("f-busca"), 8000), "balcão abre com o PIN de demonstração");

console.log(`\nerros de JavaScript: ${erros.length}`, erros.slice(0, 3));
ok(erros.length === 0, "nenhum erro de JavaScript");
console.log(`\n== RESULTADO DEMO: ${falhas === 0 ? "TUDO OK" : falhas + " FALHA(S)"} ==`);
process.exit(falhas ? 1 : 0);
