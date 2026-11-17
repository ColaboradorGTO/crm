// Bateria de carga e integridade do Sábado Premiado, pelo mesmo caminho do site: HTTP -> PostgREST -> PostgreSQL.
// Uso: node carga.mjs [cadastros]   (padrão 12000)
import pg from "pg";

import { API_RPC as API, PIN, dbCfg, exigirHomologacao } from "./config.mjs";
exigirHomologacao();
const N = +process.argv[2] || 12000;
const db = new pg.Client(dbCfg);
await db.connect();

let falhas = 0;
const ok = (c, msg) => { if (!c) { falhas++; console.log("  FALHOU:", msg); } else console.log("  ok:", msg); };

async function rpc(fn, args) {
  const r = await fetch(API + fn, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(args || {}) });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch { j = { message: t }; }
  return { ok: r.ok, status: r.status, body: j };
}
async function pool(itens, conc, fn) {
  let i = 0; const out = new Array(itens.length);
  await Promise.all(Array.from({ length: conc }, async () => { while (true) { const k = i++; if (k >= itens.length) return; out[k] = await fn(itens[k], k); } }));
  return out;
}
const q = async (s, p) => (await db.query(s, p)).rows;

// CPF válido determinístico
let sem = 987654321;
const rnd = () => ((sem = (sem * 1664525 + 1013904223) % 4294967296) / 4294967296);
function cpfNovo() {
  const d = Array.from({ length: 9 }, () => Math.floor(rnd() * 10));
  if (d.every((x) => x === d[0])) d[0] = (d[0] + 1) % 10;
  for (let t = 9; t < 11; t++) { let s = 0; for (let i = 0; i < t; i++) s += d[i] * (t + 1 - i); d.push(((s * 10) % 11) % 10); }
  return d.join("");
}
const usados = new Set();
const cpfUnico = () => { let c; do c = cpfNovo(); while (usados.has(c)); usados.add(c); return c; };
const fmtCpf = (c) => c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
const NOMES = ["Maria", "José", "Ana", "Paulo", "Joana", "Marcos", "Luciana", "Rita", "Pedro", "Carla"];

console.log("== PREPARO ==");
const t0 = Date.now();
const lojas = await q("select id, bandeira from lojas order by id");
const porBand = { tesoura: [], magazine: [], free: [] };
lojas.forEach((l) => porBand[l.bandeira].push(l.id));
const infs = [];
const NOMES_INF = ["Ana Clara", "Bruna Lima", "Carla Dias", "Duda Rocha", "Elisa Prado", "Fabi Nunes", "Gabi Reis", "Helena Cruz", "Isa Moraes", "Jana Viana",
  "Karen Melo", "Lia Santos", "Mari Costa", "Nina Alves", "Olga Pires", "Paty Souza", "Quel Dias", "Rosa Lima", "Sol Ramos", "Tati Cunha",
  "Ula Faria", "Vivi Matos", "Wanda Luz", "Xuxa Reis", "Yara Pinto", "Zeze Cabral", "Alice Born", "Bela Mota", "Cris Veiga", "Dani Lopes"];
for (let i = 0; i < NOMES_INF.length; i++) {
  const b = ["tesoura", "tesoura", "magazine", "free", "tesoura"][i % 5];
  const loja = porBand[b][Math.floor(i / 5) % porBand[b].length];
  const r = await rpc("adm_salvar_influencer", { p_pin: PIN, p: { nome: NOMES_INF[i], prefixo: NOMES_INF[i].split(" ")[0].toUpperCase(), loja_id: loja, sabado_id: 1, lote: 100, meta: 50, instagram: "@x", whatsapp: "" } });
  if (!r.ok) { console.log("erro criando influencer", r.body); process.exit(1); }
  infs.push({ slug: r.body.slug, id: r.body.id, band: b, loja });
}
console.log(`  ${infs.length} influencers criadas (${Date.now() - t0} ms)`);

// ---------------------------------------------------------------
console.log(`\n== TESTE 1: ${N} cadastros simultâneos (50 em paralelo), lote 100 por influencer ==`);
const pedidos = Array.from({ length: N }, () => ({ inf: infs[Math.floor(rnd() * infs.length)], cpf: cpfUnico() }));
const lat = [];
const t1 = Date.now();
const res1 = await pool(pedidos, 50, async (p) => {
  const t = Date.now();
  const r = await rpc("cadastrar", { p_slug: p.inf.slug, p_nome: NOMES[Math.floor(rnd() * 10)] + " Teste", p_cpf: fmtCpf(p.cpf), p_whatsapp: "(61) 99999-0000", p_bairro: "", p_aceite: true });
  lat.push(Date.now() - t);
  return r;
});
const dur1 = (Date.now() - t1) / 1000;
lat.sort((a, b) => a - b);
const sucesso = res1.filter((r) => r.ok).length;
const esgotado = res1.filter((r) => !r.ok && /acabaram/.test(r.body?.message || "")).length;
const outrosErros = res1.filter((r) => !r.ok && !/acabaram/.test(r.body?.message || ""));
console.log(`  ${N} pedidos em ${dur1.toFixed(1)} s (${(N / dur1).toFixed(0)}/s) · latência p50 ${lat[Math.floor(lat.length * 0.5)]} ms, p95 ${lat[Math.floor(lat.length * 0.95)]} ms, p99 ${lat[Math.floor(lat.length * 0.99)]} ms, máx ${lat[lat.length - 1]} ms`);
console.log(`  sucesso ${sucesso} · lote esgotado ${esgotado} · outros erros ${outrosErros.length}`);
if (outrosErros.length) console.log("  amostra de erro:", outrosErros[0].status, JSON.stringify(outrosErros[0].body));
ok(outrosErros.length === 0, "nenhum erro inesperado (500, timeout, deadlock)");
const cont = await q("select count(*)::int n from cadastros");
ok(cont[0].n === sucesso, `cadastros no banco (${cont[0].n}) = respostas de sucesso (${sucesso})`);
const estouro = await q("select i.slug, count(*)::int n from cadastros c join influencers i on i.id = c.influencer_id group by i.slug, i.lote having count(*) > i.lote");
ok(estouro.length === 0, "nenhuma influencer passou do lote de 100");
const dupCod = await q("select codigo, count(*)::int from cadastros group by codigo having count(*) > 1");
ok(dupCod.length === 0, "nenhum código repetido");
const lacunas = await q("select i.slug, count(*)::int n, max(substr(c.codigo, length(i.prefixo)+1)::int) mx from cadastros c join influencers i on i.id = c.influencer_id group by i.slug having count(*) <> max(substr(c.codigo, length(i.prefixo)+1)::int)");
ok(lacunas.length === 0, "numeração sequencial, sem buracos (001, 002, 003…)");
const dupCpf = await q("select cpf, bandeira, count(*)::int from cadastros group by cpf, bandeira, sabado_id having count(*) > 1");
ok(dupCpf.length === 0, "nenhum CPF com dois cupons na mesma bandeira e sábado");
const esperadoEsgotado = await q("select count(*)::int n from influencers where lote <= (select count(*) from cadastros c where c.influencer_id = influencers.id)");
console.log(`  influencers com lote cheio: ${esperadoEsgotado[0].n} de ${infs.length}`);

// ---------------------------------------------------------------
console.log("\n== TESTE 2: o MESMO CPF em 8 páginas ao mesmo tempo (corrida) ==");
let corridasErradas = 0;
for (let rodada = 0; rodada < 25; rodada++) {
  const cpf = cpfUnico();
  const alvo = infs.filter((x) => x.band === "tesoura").slice(0, 8);
  // zera para que todas tenham vaga (usa influencers cheias? então pega as com vaga)
  const comVaga = await q("select i.slug from influencers i join lojas l on l.id = i.loja_id where l.bandeira='tesoura' and (select count(*) from cadastros c where c.influencer_id = i.id) < i.lote limit 8");
  if (comVaga.length < 2) break;
  const rs = await Promise.all(comVaga.map((x) => rpc("cadastrar", { p_slug: x.slug, p_nome: "Corrida Teste", p_cpf: cpf, p_whatsapp: "6199990000", p_bairro: "", p_aceite: true })));
  const codigos = new Set(rs.filter((r) => r.ok).map((r) => r.body.codigo));
  const erros = rs.filter((r) => !r.ok);
  const nCad = (await q("select count(*)::int n from cadastros where cpf = $1", [cpf]))[0].n;
  if (codigos.size !== 1 || nCad !== 1 || erros.length) { corridasErradas++; if (corridasErradas < 3) console.log("  rodada", rodada, "codigos", [...codigos], "no banco", nCad, "erros", erros.map((e) => e.body?.message)); }
}
ok(corridasErradas === 0, "25 corridas do mesmo CPF: sempre 1 cupom no banco e todas as respostas devolvem o mesmo código");

// ---------------------------------------------------------------
console.log("\n== TESTE 3: tokens do PDV, mais pedidos que tokens, em paralelo ==");
// pega uma influencer da Magazine sem cadastros ainda: cria nova
const nm = await rpc("adm_salvar_influencer", { p_pin: PIN, p: { nome: "Tokenzinha Silva", prefixo: "TOKEN", loja_id: porBand.magazine[0], sabado_id: 1, lote: 100, meta: 50 } });
const tk = Array.from({ length: 40 }, (_, i) => `MAG${String(1000 + i * 7).padStart(5, "X")}`);
const imp = await rpc("adm_importar_tokens", { p_pin: PIN, p: tk.map((t) => ({ token: t, influencer: "TOKEN" })), p_substituir: false });
ok(imp.ok && imp.body.importados === 40, `importou 40 tokens (resposta: ${JSON.stringify(imp.body).slice(0, 90)})`);
const rs3 = await pool(Array.from({ length: 120 }, () => cpfUnico()), 40, (cpf) => rpc("cadastrar", { p_slug: "token", p_nome: "Cliente Token", p_cpf: cpf, p_whatsapp: "6199990000", p_bairro: "", p_aceite: true }));
const s3 = rs3.filter((r) => r.ok), e3 = rs3.filter((r) => !r.ok);
ok(s3.length === 40, `exatamente 40 cadastros receberam token (recebeu ${s3.length})`);
ok(e3.every((r) => /acabaram/.test(r.body?.message || "")), "os outros 80 receberam 'acabaram' (sem erro estranho)");
ok(new Set(s3.map((r) => r.body.codigo)).size === 40, "40 tokens diferentes, nenhum entregue duas vezes");
ok(s3.every((r) => tk.includes(r.body.codigo)), "todos os tokens entregues são da lista da TI");
const livres = await q("select count(*)::int n from tokens where cadastro_id is null");
ok(livres[0].n === 0, "nenhum token sobrou livre");
const lp = await rpc("lp_info", { p_slug: "token" });
ok(lp.ok && lp.body.disponiveis === 0, "a página da influencer mostra 0 disponíveis");

// ---------------------------------------------------------------
console.log("\n== TESTE 4: o mesmo token validado 30 vezes ao mesmo tempo no balcão ==");
const um = (await q("select c.codigo, l.pin, l.id from cadastros c join lojas l on l.id = c.loja_id where c.status='emitido' limit 1"))[0];
await rpc("adm_teste", { p_pin: PIN, p_teste: true });
const rs4 = await Promise.all(Array.from({ length: 30 }, () => rpc("balcao_validar", { p_pin: um.pin, p_codigo: um.codigo, p_cupom_fiscal: "12345", p_valor: 100 })));
ok(rs4.filter((r) => r.ok).length === 1, `só 1 das 30 validações passa (passaram ${rs4.filter((r) => r.ok).length})`);

// ---------------------------------------------------------------
console.log("\n== TESTE 5: importar vendas do PDV em lote (5000 linhas) ==");
const cads = await q("select codigo, cpf, loja_id from cadastros where status = 'emitido' limit 5000");
const linhas = cads.map((c, i) => ({ cupom: c.codigo.toLowerCase().replace(/(\d+)$/, " $1"), cpf: fmtCpf(c.cpf), nota: String(100000 + i), data: "2026-11-28T14:00:00-03:00", valor: 100 + (i % 200) }));
linhas.push({ cupom: "NAOEXISTE9", cpf: "", nota: "1", data: "", valor: 10 });
linhas.push({ cupom: cads[0].codigo, cpf: "11144477735", nota: "1", data: "", valor: 10 });
linhas.push({ cupom: "", cpf: "", nota: "", data: "lixo", valor: "abc" });
const t5 = Date.now();
const r5 = await rpc("adm_importar_vendas", { p_pin: PIN, p: linhas });
console.log(`  ${linhas.length} linhas em ${((Date.now() - t5) / 1000).toFixed(1)} s ->`, r5.ok ? JSON.stringify({ ...r5.body, detalhes: r5.body.detalhes.length + " detalhes" }) : r5.body);
ok(r5.ok, "importação não caiu mesmo com linhas ruins no meio");
ok(r5.ok && r5.body.usados + r5.body.ja_usados + r5.body.sem_cupom + r5.body.recusadas === linhas.length, "usados + já usados + sem cupom + recusadas = total de linhas");
const us = await q("select count(*)::int n from cadastros where status = 'usado'");
ok(r5.ok && us[0].n >= r5.body.usados, "baixas gravadas no banco");

// ---------------------------------------------------------------
console.log("\n== TESTE 6: campanha de fim de ano (30 mil notas) e comparativo ==");
const cpfsLp = await q("select cpf, bandeira from cadastros order by random() limit 4000");
const notas = [];
cpfsLp.forEach((c, i) => { for (let k = 0; k < 2; k++) notas.push({ cpf: c.cpf, nome: "Cliente", nota: `LP${i}-${k}`, data: "2026-12-01T10:00:00-03:00", valor: 100 + k * 50, loja: "x", b: c.bandeira }); });
for (let i = 0; i < 22000; i++) notas.push({ cpf: cpfUnico(), nome: "So FA", nota: `FA${i}`, data: "2026-12-02T10:00:00-03:00", valor: 80 + (i % 300), loja: "y", b: ["tesoura", "magazine", "free"][i % 3] });
let t6 = Date.now(), imp6 = 0, rep6 = 0, rec6 = 0, falhaImp = 0;
for (const b of ["tesoura", "magazine", "free"]) {
  const lote = notas.filter((n) => n.b === b).map(({ b: _b, ...n }) => n);
  for (let i = 0; i < lote.length; i += 5000) {
    const r = await rpc("adm_importar_fimdeano", { p_pin: PIN, p: lote.slice(i, i + 5000), p_substituir: false, p_bandeira: b });
    if (!r.ok) { falhaImp++; console.log("  erro", r.body); } else { imp6 += r.body.importadas; rep6 += r.body.repetidas; rec6 += r.body.recusadas; }
  }
}
console.log(`  ${notas.length} notas em ${((Date.now() - t6) / 1000).toFixed(1)} s · importadas ${imp6} · repetidas ${rep6} · recusadas ${rec6}`);
ok(falhaImp === 0, "importação em blocos de 5 mil sem erro");
const reimp = await rpc("adm_importar_fimdeano", { p_pin: PIN, p: notas.filter((n) => n.b === "tesoura").slice(0, 3000).map(({ b, ...n }) => n), p_substituir: false, p_bandeira: "tesoura" });
ok(reimp.ok && reimp.body.importadas === 0 && reimp.body.repetidas === 3000, "reimportar o mesmo arquivo não duplica nada (3000 repetidas)");
const t6b = Date.now();
const cmp = await rpc("adm_comparativo", { p_pin: PIN, p_sabado: null, p_bandeira: null });
console.log(`  comparativo do grupo em ${Date.now() - t6b} ms, ${cmp.ok ? cmp.body.pessoas.length : "?"} pessoas`);
ok(cmp.ok, "comparativo do grupo responde");
ok(Date.now() - t6b < 5000, "comparativo em menos de 5 segundos com 12 mil cadastros e 30 mil notas");
for (const b of ["tesoura", "magazine", "free"]) {
  const c = await rpc("adm_comparativo", { p_pin: PIN, p_sabado: null, p_bandeira: b });
  const esperado = (await q("select count(distinct cpf)::int n from cadastros where bandeira = $1", [b]))[0].n;
  ok(c.ok && c.body.totais.lp === esperado, `comparativo ${b}: ${c.body?.totais?.lp} pessoas = ${esperado} CPFs distintos no banco`);
}

// ---------------------------------------------------------------
console.log("\n== TESTE 7: telas de gestão com a base cheia ==");
for (const [nome, fn, args] of [
  ["adm_dados (grupo)", "adm_dados", { p_pin: PIN, p_sabado: 1, p_bandeira: null }],
  ["adm_dados (magazine)", "adm_dados", { p_pin: PIN, p_sabado: 1, p_bandeira: "magazine" }],
  ["adm_cadastros (500 linhas)", "adm_cadastros", { p_pin: PIN, p_busca: "", p_sabado: 1, p_influencer: null, p_status: "", p_loja: null, p_bandeira: null }],
  ["adm_cadastros busca por CPF", "adm_cadastros", { p_pin: PIN, p_busca: "123", p_sabado: null, p_influencer: null, p_status: "", p_loja: null, p_bandeira: null }],
  ["adm_tokens", "adm_tokens", { p_pin: PIN, p_sabado: null }],
]) {
  const t = Date.now(); const r = await rpc(fn, args); const ms = Date.now() - t;
  ok(r.ok && ms < 3000, `${nome}: ${ms} ms`);
}
const tb = Date.now();
await db.query("insert into config (chave, valor) values ('backup_token_hash', extensions.crypt('tok-backup', extensions.gen_salt('bf'))) on conflict (chave) do update set valor = excluded.valor");
const bk = await rpc("backup_exportar", { p_token: "tok-backup" });
ok(bk.ok && bk.body.cadastros.length === cont[0].n + 25 + 40, `backup exporta ${bk.body?.cadastros?.length} cadastros e ${bk.body?.notas_fim_de_ano?.length} notas em ${Date.now() - tb} ms`);
const bkRuim = await rpc("backup_exportar", { p_token: "errado" });
ok(!bkRuim.ok, "backup com token errado é recusado");

// ---------------------------------------------------------------
console.log("\n== SEGURANÇA ==");
const dir = await fetch("http://127.0.0.1:3010/cadastros");
ok(dir.status === 401 || dir.status === 404, `leitura direta da tabela cadastros recusada (HTTP ${dir.status})`);
const dir2 = await fetch("http://127.0.0.1:3010/config");
ok(dir2.status === 401 || dir2.status === 404, `leitura direta da tabela config recusada (HTTP ${dir2.status})`);
const adm = await rpc("adm_dados", { p_pin: "0000", p_sabado: 1 });
ok(!adm.ok, "admin com senha errada é recusado");
const inj = await rpc("lp_info", { p_slug: "'; drop table cadastros; --" });
ok(!inj.ok && (await q("select count(*)::int n from cadastros"))[0].n > 0, "tentativa de injeção SQL não faz nada");

console.log(`\n== RESULTADO: ${falhas === 0 ? "TUDO OK" : falhas + " FALHA(S)"} · ${((Date.now() - t0) / 1000).toFixed(0)} s ==`);
await db.end();
process.exit(falhas ? 1 : 0);
