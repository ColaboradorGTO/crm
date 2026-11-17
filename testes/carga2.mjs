// Bateria 2: carga alta e casos de borda. Mesmo caminho do site: HTTP -> PostgREST -> PostgreSQL.
// Uso: node carga2.mjs [cadastros]   (padrão 25000)
import pg from "pg";

import { API_RPC as API, PIN, dbCfg, exigirHomologacao } from "./config.mjs";
exigirHomologacao();
const N = +process.argv[2] || 25000;
const db = new pg.Client(dbCfg);
await db.connect();
let falhas = 0;
const ok = (c, msg) => { if (!c) { falhas++; console.log("  FALHOU:", msg); } else console.log("  ok:", msg); };
async function rpc(fn, args, get) {
  let r;
  if (get) r = await fetch(API + fn + "?" + new URLSearchParams(args).toString());
  else r = await fetch(API + fn, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(args || {}) });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch { j = { message: t }; }
  return { ok: r.ok, status: r.status, body: j, bytes: t.length };
}
async function pool(itens, conc, fn) {
  let i = 0; const out = new Array(itens.length);
  await Promise.all(Array.from({ length: conc }, async () => { while (true) { const k = i++; if (k >= itens.length) return; out[k] = await fn(itens[k], k); } }));
  return out;
}
const q = async (s, p) => (await db.query(s, p)).rows;
let sem = 424242;
const rnd = () => ((sem = (sem * 1664525 + 1013904223) % 4294967296) / 4294967296);
function cpfNovo(prefixoZero) {
  const d = Array.from({ length: 9 }, () => Math.floor(rnd() * 10));
  if (prefixoZero) d[0] = 0;
  if (d.every((x) => x === d[0])) d[1] = (d[1] + 1) % 10;
  for (let t = 9; t < 11; t++) { let s = 0; for (let i = 0; i < t; i++) s += d[i] * (t + 1 - i); d.push(((s * 10) % 11) % 10); }
  return d.join("");
}
const usados = new Set();
const cpfUnico = (z) => { let c; do c = cpfNovo(z); while (usados.has(c)); usados.add(c); return c; };
const fmt = (c) => c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
const T0 = Date.now();

const lojas = await q("select id, bandeira from lojas order by id");
const porBand = { tesoura: [], magazine: [], free: [] };
lojas.forEach((l) => porBand[l.bandeira].push(l.id));
const novaInf = async (nome, band, lote, sab = 1, k = 0) => {
  const r = await rpc("adm_salvar_influencer", { p_pin: PIN, p: { nome, prefixo: nome.replace(/\W/g, "").slice(0, 8).toUpperCase(), loja_id: porBand[band][k % porBand[band].length], sabado_id: sab, lote, meta: 50 } });
  if (!r.ok) throw new Error("influencer: " + JSON.stringify(r.body));
  return r.body;
};

// ---------------------------------------------------------------
console.log(`== A: ${N} cadastros, 150 em paralelo, 30 influencers com lote de 1000 ==`);
const infs = [];
for (let i = 0; i < 30; i++) infs.push(await novaInf("Influ" + String.fromCharCode(65 + (i % 26)) + (i >= 26 ? i : ""), ["tesoura", "tesoura", "magazine", "free", "tesoura"][i % 5], 1000, 1, i));
const lat = [];
const t1 = Date.now();
const res = await pool(Array.from({ length: N }, () => ({ inf: infs[Math.floor(rnd() * infs.length)], cpf: cpfUnico() })), 150, async (p) => {
  const t = Date.now();
  const r = await rpc("cadastrar", { p_slug: p.inf.slug, p_nome: "Cliente Carga", p_cpf: fmt(p.cpf), p_whatsapp: "(61) 98888-0000", p_bairro: "Centro", p_aceite: true });
  lat.push(Date.now() - t); return r;
});
const dur = (Date.now() - t1) / 1000; lat.sort((a, b) => a - b);
const suc = res.filter((r) => r.ok).length, bad = res.filter((r) => !r.ok);
console.log(`  ${N} em ${dur.toFixed(1)} s (${(N / dur).toFixed(0)}/s) · p50 ${pct(lat, .5)} ms · p95 ${pct(lat, .95)} ms · p99 ${pct(lat, .99)} ms · máx ${lat[lat.length - 1]} ms`);
if (bad.length) console.log("  amostra de erro:", bad[0].status, JSON.stringify(bad[0].body));
ok(bad.length === 0, `nenhum erro nos ${N} pedidos (${suc} sucessos)`);
ok((await q("select count(*)::int n from cadastros"))[0].n === suc, "cadastros no banco = respostas de sucesso");
ok((await q("select count(*)::int n from (select codigo from cadastros group by codigo having count(*) > 1) x"))[0].n === 0, "nenhum código repetido");
ok((await q("select count(*)::int n from (select cpf, bandeira, sabado_id from cadastros group by 1,2,3 having count(*) > 1) x"))[0].n === 0, "nenhum CPF repetido por bandeira e sábado");
ok((await q("select count(*)::int n from (select i.id from cadastros c join influencers i on i.id = c.influencer_id group by i.id, i.lote having count(*) > i.lote) x"))[0].n === 0, "nenhum lote estourado");
const buracos = await q(`select i.prefixo, count(*)::int n, max(case when length(substr(c.codigo, length(i.prefixo)+1)) >= 3 then substr(c.codigo, length(i.prefixo)+1)::int end) mx from cadastros c join influencers i on i.id = c.influencer_id group by i.prefixo having count(*) <> max(substr(c.codigo, length(i.prefixo)+1)::int)`);
ok(buracos.length === 0, "numeração sem buracos até passar de 999 (ANA1000, ANA1001…)");
const passou = await q("select count(*)::int n from cadastros where codigo ~ '[0-9]{4}$'");
console.log(`  códigos com 4 dígitos emitidos: ${passou[0].n}`);

// ---------------------------------------------------------------
console.log("\n== B: ponto quente, 1 influencer, 4000 pedidos em 150 paralelos (vídeo viral) ==");
const hot = await novaInf("Hotspot Viral", "magazine", 6000);
const latB = []; const tB = Date.now();
const rB = await pool(Array.from({ length: 4000 }, () => cpfUnico()), 150, async (c) => { const t = Date.now(); const r = await rpc("cadastrar", { p_slug: hot.slug, p_nome: "Viral Teste", p_cpf: c, p_whatsapp: "61988880000", p_bairro: "", p_aceite: true }); latB.push(Date.now() - t); return r; });
const dB = (Date.now() - tB) / 1000; latB.sort((a, b) => a - b);
console.log(`  4000 em ${dB.toFixed(1)} s (${(4000 / dB).toFixed(0)}/s) · p50 ${pct(latB, .5)} ms · p95 ${pct(latB, .95)} ms · p99 ${pct(latB, .99)} ms · máx ${latB[latB.length - 1]} ms`);
const eB = rB.filter((r) => !r.ok); if (eB.length) console.log("  erros no ponto quente:", eB.length, JSON.stringify(eB[0].body), "status", eB[0].status, "| status distintos:", [...new Set(eB.map((r) => r.status))]);
ok(rB.every((r) => r.ok), "4000 pedidos na mesma página, todos ok");
const cb = await q("select count(*)::int n, count(distinct codigo)::int d from cadastros where influencer_id = $1", [hot.id]);
ok(cb[0].n === 4000 && cb[0].d === 4000, "4000 cupons distintos, sem repetir");

// ---------------------------------------------------------------
console.log("\n== C: CPF que o Excel deixou sem o zero à esquerda ==");
const cz = cpfUnico(true); const cz10 = cz.replace(/^0+/, "");
const inf0 = await novaInf("Zero Teste", "tesoura", 100, 1, 9);
const rz = await rpc("cadastrar", { p_slug: inf0.slug, p_nome: "Zero Teste", p_cpf: cz, p_whatsapp: "61999990000", p_bairro: "", p_aceite: true });
ok(rz.ok && cz10.length === 10, `cadastrou o CPF ${cz} (que no Excel vira ${cz10})`);
const vz = await rpc("adm_importar_vendas", { p_pin: PIN, p: [{ cupom: rz.body.codigo, cpf: cz10, nota: "9001", data: "2026-11-28 14:30:00", valor: 99.9 }] });
ok(vz.ok && vz.body.usados === 1, `venda com CPF de 10 dígitos deu baixa (${JSON.stringify(vz.body)})`);
const uz = (await q("select to_char(usado_em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI') as sp, status from cadastros where cpf = $1", [cz]))[0];
ok(uz.status === "usado" && uz.sp === "2026-11-28 14:30", `hora sem fuso lida como Brasília (${uz.sp})`);
const fz = await rpc("adm_importar_fimdeano", { p_pin: PIN, p: [{ cpf: cz10, nome: "Zero", nota: "FZ1", data: "2026-12-01", valor: 150, loja: "x" }], p_substituir: false, p_bandeira: "tesoura" });
ok(fz.ok && fz.body.importadas === 1, "nota do fim de ano com CPF de 10 dígitos entrou");
const cm = await rpc("adm_comparativo", { p_pin: PIN, p_sabado: null, p_bandeira: "tesoura" });
ok(cm.ok && cm.body.pessoas.some((p) => p.cpf === cz && p.fa_notas === 1), "comparativo ligou o CPF da página ao CPF da nota");
const bz = await rpc("adm_base_cpfs", { p_pin: PIN, p_cpfs: [cz10, "123"], p_substituir: false });
ok(bz.ok && bz.body.lidos === 1, "base de CPFs aceitou o de 10 dígitos e ignorou o lixo");

// ---------------------------------------------------------------
console.log("\n== D: tokens por sábado ==");
const infT = await novaInf("Token Sabado", "free", 100, 1, 3);
const tk2 = Array.from({ length: 10 }, (_, i) => `SAB2-${i + 1}`);
const i2 = await rpc("adm_importar_tokens", { p_pin: PIN, p: tk2.map((t) => ({ token: t, influencer: infT.prefixo })), p_substituir: false, p_sabado: 2 });
ok(i2.ok && i2.body.importados === 10, "importou 10 tokens para o 2º sábado");
const lpA = await rpc("lp_info", { p_slug: infT.slug });
ok(lpA.ok && lpA.body.disponiveis === 0, "no 1º sábado a página mostra 0 disponíveis (os tokens são do 2º)");
const rA = await rpc("cadastrar", { p_slug: infT.slug, p_nome: "Cliente Sab", p_cpf: cpfUnico(), p_whatsapp: "61999990000", p_bairro: "", p_aceite: true });
ok(!rA.ok && /ainda não foram liberados/.test(rA.body.message), `cadastro no 1º sábado recusa: "${rA.body.message}"`);
ok(lpA.ok && lpA.body.liberado === false, "a página recebe liberado=false e mostra a mensagem certa");
await rpc("adm_salvar_influencer", { p_pin: PIN, p: { id: infT.id, nome: infT.nome, prefixo: infT.prefixo, loja_id: infT.loja_id, sabado_id: 2, lote: 100, meta: 50 } });
const rB2 = await rpc("cadastrar", { p_slug: infT.slug, p_nome: "Cliente Sab2", p_cpf: cpfUnico(), p_whatsapp: "61999990000", p_bairro: "", p_aceite: true });
ok(rB2.ok && tk2.includes(rB2.body.codigo), `virou o sábado da influencer: entregou o token ${rB2.body.codigo}`);

// ---------------------------------------------------------------
console.log("\n== E: token exatamente como a TI mandou ==");
const infE = await novaInf("Token Forma", "tesoura", 100, 1, 11);
await rpc("adm_importar_tokens", { p_pin: PIN, p: [{ token: " Tes-ab12 ", influencer: infE.prefixo }, { token: "TES.AB12", influencer: infE.prefixo }, { token: "tes_cd34", influencer: infE.prefixo }] });
const rE = await rpc("cadastrar", { p_slug: infE.slug, p_nome: "Cliente Forma", p_cpf: cpfUnico(), p_whatsapp: "61999990000", p_bairro: "", p_aceite: true });
ok(rE.ok && rE.body.codigo === "Tes-ab12", `entrega o token do jeito que a TI cadastrou: "${rE.body.codigo}"`);
const tt = (await q("select count(*)::int n from tokens where norm_cod(codigo) = 'TESAB12'"))[0].n;
ok(tt === 1, "'Tes-ab12' e 'TES.AB12' são o mesmo token: não entrou duplicado");
const lojaE = (await q("select l.pin, l.id from influencers i join lojas l on l.id = i.loja_id where i.id = $1", [infE.id]))[0];
await rpc("adm_teste", { p_pin: PIN, p_teste: true });
const bE = await rpc("balcao_buscar", { p_pin: lojaE.pin, p_termo: "tes ab12" });
ok(bE.ok && bE.body.cupom.codigo === "Tes-ab12", "balcão acha o token digitado em outra forma (tes ab12)");
const vE = await rpc("adm_importar_vendas", { p_pin: PIN, p: [{ cupom: "TESAB12", cpf: "", nota: "77", data: "", valor: "R$ 1.234,56" }] });
ok(vE.ok && vE.body.usados === 1, "importação de vendas acha o token em qualquer grafia");

// ---------------------------------------------------------------
console.log("\n== F: balcão e importação dando baixa nos MESMOS cupons ao mesmo tempo ==");
const lojaPin = {}; (await q("select id, pin from lojas")).forEach((l) => (lojaPin[l.id] = l.pin));
const alvo = await q("select codigo, cpf, loja_id from cadastros where status = 'emitido' and influencer_id = $1 limit 600", [hot.id]);
const vendas = alvo.map((c, i) => ({ cupom: c.codigo, cpf: c.cpf, nota: String(5000 + i), data: "2026-11-28T15:00:00-03:00", valor: 100 }));
const [rBal, rImp] = await Promise.all([
  pool(alvo, 40, (c) => rpc("balcao_validar", { p_pin: lojaPin[c.loja_id], p_codigo: c.codigo, p_cupom_fiscal: "123", p_valor: 100 })),
  rpc("adm_importar_vendas", { p_pin: PIN, p: vendas }),
]);
const balOk = rBal.filter((r) => r.ok).length;
const usadosAgora = (await q("select count(*)::int n from cadastros where codigo = any($1) and status = 'usado'", [alvo.map((c) => c.codigo)]))[0].n;
console.log(`  balcão deu baixa em ${balOk}, importação em ${rImp.body.usados} (já usados ${rImp.body.ja_usados}), total usado ${usadosAgora} de ${alvo.length}`);
ok(rImp.ok, "importação respondeu ok");
ok(usadosAgora === alvo.length, "todos os 600 cupons terminaram usados");
ok(balOk + rImp.body.usados === alvo.length, "cada cupom foi contado por UM dos dois (nenhum contado duas vezes, nenhum perdido)");

// ---------------------------------------------------------------
console.log("\n== G: fotos pesadas nas influencers ==");
const foto = "data:image/jpeg;base64," + "A".repeat(70000);
for (const i of infs.slice(0, 20)) await rpc("adm_salvar_influencer", { p_pin: PIN, p: { id: i.id, nome: i.nome, prefixo: i.prefixo, loja_id: i.loja_id, sabado_id: 1, lote: 1000, meta: 50, foto } });
const dd = await rpc("adm_dados", { p_pin: PIN, p_sabado: 1, p_bandeira: null });
console.log(`  adm_dados com 20 fotos de 70 KB: ${(dd.bytes / 1024).toFixed(0)} KB`);
ok(dd.ok && dd.bytes < 250 * 1024, "a lista do CRM não carrega as fotos embutidas (resposta pequena)");
ok(dd.body.influencers.find((x) => x.id === infs[0].id).tem_foto === true, "a lista avisa que a influencer TEM foto");
const ff = await rpc("adm_influencer_foto", { p_pin: PIN, p_id: infs[0].id });
ok(ff.ok && ff.body.foto === foto, "a foto vem inteira quando a ficha abre");
await rpc("adm_salvar_influencer", { p_pin: PIN, p: { id: infs[0].id, nome: infs[0].nome, prefixo: infs[0].prefixo, loja_id: infs[0].loja_id, sabado_id: 1, lote: 1000, meta: 50, instagram: "@novo" } });
ok((await rpc("adm_influencer_foto", { p_pin: PIN, p_id: infs[0].id })).body.foto === foto, "salvar sem mexer na foto NÃO apaga a foto");
const lpF = await rpc("lp_info", { p_slug: infs[0].slug }, true);
ok(lpF.ok && lpF.body.influencer.foto === foto, "lp_info por GET (cache do nginx) devolve a foto para a página pública");

// ---------------------------------------------------------------
console.log("\n== H: lote de 100 mil tokens e importações enormes ==");
const infH = await novaInf("Mega Lote", "tesoura", 100000, 1, 13);
const toks = Array.from({ length: 30000 }, (_, i) => ({ token: "MEGA" + String(i).padStart(6, "0"), influencer: infH.prefixo }));
const tH = Date.now();
const rH = await rpc("adm_importar_tokens", { p_pin: PIN, p: toks, p_substituir: false });
console.log(`  30 mil tokens em ${((Date.now() - tH) / 1000).toFixed(1)} s`);
ok(rH.ok && rH.body.importados === 30000, "30 mil tokens importados de uma vez");
const rH2 = await rpc("adm_importar_tokens", { p_pin: PIN, p: toks.slice(0, 1000), p_substituir: false });
ok(rH2.ok && rH2.body.repetidos === 1000 && rH2.body.importados === 0, "reimportar a mesma lista: tudo repetido, nada duplicado");
const rH3 = await rpc("adm_importar_tokens", { p_pin: PIN, p: [{ token: "X", influencer: infH.prefixo }, { token: "SEMDONO1", influencer: "" }, { token: "OUTRO99", influencer: "naoexiste" }, { token: "BOM00001", influencer: infH.prefixo }], p_substituir: false });
ok(rH3.ok && rH3.body.importados === 1 && rH3.body.recusados === 3, `linhas ruins são recusadas uma a uma (${JSON.stringify(rH3.body.detalhes).slice(0, 120)}…)`);
const tL = Date.now(); const rr = await rpc("lp_info", { p_slug: infH.slug });
ok(rr.ok && Date.now() - tL < 1500, `lp_info com 30 mil tokens livres: ${Date.now() - tL} ms`);
const tC = Date.now(); const rc = await rpc("cadastrar", { p_slug: infH.slug, p_nome: "Mega Cliente", p_cpf: cpfUnico(), p_whatsapp: "61999990000", p_bairro: "", p_aceite: true });
ok(rc.ok && rc.body.codigo === "MEGA000000" && Date.now() - tC < 1500, `cadastro com 30 mil tokens livres: ${Date.now() - tC} ms, token ${rc.body.codigo}`);

// ---------------------------------------------------------------
console.log("\n== I: telas do CRM com a base cheia ==");
const tot = (await q("select count(*)::int n from cadastros"))[0].n;
console.log(`  cadastros no banco: ${tot}`);
for (const [nome, fn, args] of [
  ["adm_dados grupo", "adm_dados", { p_pin: PIN, p_sabado: 1, p_bandeira: null }],
  ["adm_dados free", "adm_dados", { p_pin: PIN, p_sabado: 1, p_bandeira: "free" }],
  ["adm_cadastros (500 mais recentes)", "adm_cadastros", { p_pin: PIN, p_busca: "", p_sabado: 1, p_influencer: null, p_status: "", p_loja: null, p_bandeira: null }],
  ["adm_cadastros busca por nome", "adm_cadastros", { p_pin: PIN, p_busca: "carga", p_sabado: null, p_influencer: null, p_status: "", p_loja: null, p_bandeira: null }],
  ["adm_comparativo grupo (tela)", "adm_comparativo", { p_pin: PIN, p_sabado: null, p_bandeira: null }],
  ["adm_comparativo grupo (exportar todos)", "adm_comparativo", { p_pin: PIN, p_sabado: null, p_bandeira: null, p_todos: true }],
  ["adm_tokens", "adm_tokens", { p_pin: PIN, p_sabado: null }],
]) { const t = Date.now(); const r = await rpc(fn, args); const ms = Date.now() - t; ok(r.ok && ms < 4000, `${nome}: ${ms} ms (${(r.bytes / 1024).toFixed(0)} KB)`); }
await db.query("insert into config (chave, valor) values ('backup_token_hash', extensions.crypt('tok-backup', extensions.gen_salt('bf'))) on conflict (chave) do update set valor = excluded.valor");
const tBk = Date.now(); const bk = await rpc("backup_exportar", { p_token: "tok-backup" });
console.log(`  backup: ${bk.body?.cadastros?.length} cadastros em ${((Date.now() - tBk) / 1000).toFixed(1)} s, ${(bk.bytes / 1048576).toFixed(1)} MB`);
ok(bk.ok && bk.body.cadastros.length === tot, "backup traz TODOS os cadastros");
ok(bk.ok && (Date.now() - tBk) < 60000, "backup em menos de 60 s (limite do Apps Script é 6 min)");

// ---------------------------------------------------------------
console.log("\n== J: lote esgotado, 3000 pedidos de 150 em paralelo (saída rápida) ==");
const infJ = await novaInf("Lote Curto", "magazine", 50, 1, 5);
const tJ = Date.now();
const rJ = await pool(Array.from({ length: 3000 }, () => cpfUnico()), 150, (c) => rpc("cadastrar", { p_slug: infJ.slug, p_nome: "Quem Chegou", p_cpf: c, p_whatsapp: "61999990000", p_bairro: "", p_aceite: true }));
const dJ = (Date.now() - tJ) / 1000;
console.log(`  3000 pedidos em ${dJ.toFixed(1)} s (${(3000 / dJ).toFixed(0)}/s)`);
ok(rJ.filter((r) => r.ok).length === 50, "exatamente 50 receberam cupom");
const eJ = rJ.filter((r) => !r.ok && !/acabaram/.test(r.body.message)); if (eJ.length) console.log("  respostas inesperadas:", eJ.length, JSON.stringify(eJ[0].body), eJ[0].status);
ok(rJ.filter((r) => !r.ok).every((r) => /acabaram/.test(r.body.message)), "os outros 2950 receberam 'acabaram' e mais nada");
ok((await q("select count(*)::int n from cadastros where influencer_id = $1", [infJ.id]))[0].n === 50, "o banco tem 50, nem 49 nem 51");
const jaTem = await rpc("cadastrar", { p_slug: infJ.slug, p_nome: "Quem Chegou", p_cpf: rJ.find((r) => r.ok) && (await q("select cpf from cadastros where influencer_id = $1 limit 1", [infJ.id]))[0].cpf, p_whatsapp: "61999990000", p_bairro: "", p_aceite: true });
ok(jaTem.ok && jaTem.body.ja_existia === true, "quem já tinha cupom recebe o mesmo cupom de volta mesmo com o lote esgotado");

console.log(`\n== RESULTADO: ${falhas === 0 ? "TUDO OK" : falhas + " FALHA(S)"} · ${((Date.now() - T0) / 1000).toFixed(0)} s ==`);
await db.end();
process.exit(falhas ? 1 : 0);
