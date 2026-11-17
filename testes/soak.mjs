// Carga mista contínua: um "sábado" comprimido. Tudo ao mesmo tempo, em taxa constante (não espera resposta para mandar o próximo).
// Uso: node soak.mjs [segundos] [cadastros_por_segundo]
import pg from "pg";

import { API_RPC as API, PIN, dbCfg, exigirHomologacao } from "./config.mjs";
exigirHomologacao();
const DUR = +process.argv[2] || 150;
const TAXA = +process.argv[3] || 150;
const db = new pg.Client(dbCfg);
await db.connect();
const q = async (s, p) => (await db.query(s, p)).rows;
let falhas = 0;
const ok = (c, m) => { if (!c) { falhas++; console.log("  FALHOU:", m); } else console.log("  ok:", m); };
const esp = (ms) => new Promise((r) => setTimeout(r, ms));

const met = {}; // tipo -> { n, erros: {status: n}, lat: [] }
function reg(tipo, ms, status) { const m = (met[tipo] ||= { n: 0, ok: 0, erros: {}, lat: [] }); m.n++; m.lat.push(ms); if (status >= 200 && status < 300) m.ok++; else m.erros[status] = (m.erros[status] || 0) + 1; }
let emVoo = 0, maxVoo = 0;
async function chamar(tipo, fn, args, { get = false } = {}) {
  const t = Date.now(); emVoo++; maxVoo = Math.max(maxVoo, emVoo);
  try {
    const r = get ? await fetch(API + fn + "?" + new URLSearchParams(args)) : await fetch(API + fn, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(args) });
    const txt = await r.text(); let body = null; try { body = JSON.parse(txt); } catch {}
    reg(tipo, Date.now() - t, r.status);
    return { status: r.status, body };
  } catch (e) { reg(tipo, Date.now() - t, 0); return { status: 0, body: null }; }
  finally { emVoo--; }
}
let sem = 20261128;
const rnd = () => ((sem = (sem * 1664525 + 1013904223) % 4294967296) / 4294967296);
const usados = new Set();
function cpfUnico() { while (true) { const d = Array.from({ length: 9 }, () => Math.floor(rnd() * 10)); if (d.every((x) => x === d[0])) continue; for (let t = 9; t < 11; t++) { let s = 0; for (let i = 0; i < t; i++) s += d[i] * (t + 1 - i); d.push(((s * 10) % 11) % 10); } const c = d.join(""); if (!usados.has(c)) { usados.add(c); return c; } } }

console.log(`== PREPARO: 40 influencers (14 Tesoura, 13 Magazine, 13 Free; Free com tokens da TI) ==`);
const lojas = await q("select id, bandeira, pin from lojas order by id");
const por = { tesoura: [], magazine: [], free: [] }; lojas.forEach((l) => por[l.bandeira].push(l));
const infs = [];
for (let i = 0; i < 40; i++) {
  const b = i < 14 ? "tesoura" : i < 27 ? "magazine" : "free";
  const loja = por[b][i % por[b].length];
  const r = await chamar("prep", "adm_salvar_influencer", { p_pin: PIN, p: { nome: "Soak " + String.fromCharCode(65 + (i % 26)) + Math.floor(i / 26), prefixo: "SK" + i, loja_id: loja.id, sabado_id: 1, lote: 8000, meta: 50 } });
  infs.push({ ...r.body, band: b, pin: loja.pin });
}
const free = infs.filter((i) => i.band === "free");
for (const f of free) await chamar("prep", "adm_importar_tokens", { p_pin: PIN, p: Array.from({ length: 4000 }, (_, k) => ({ token: `${f.prefixo}-F${String(k).padStart(5, "0")}`, influencer: f.prefixo })), p_substituir: false });
console.log(`  pronto. Free com ${free.length * 4000} tokens livres.`);
// cupons já emitidos para o balcão validar durante o teste
const prontos = [];
for (let i = 0; i < 1500; i++) { const inf = infs[i % 27]; const c = cpfUnico(); const r = await chamar("prep", "cadastrar", { p_slug: inf.slug, p_nome: "Pre Cliente", p_cpf: c, p_whatsapp: "61999990000", p_bairro: "", p_aceite: true }); if (r.status === 200) prontos.push({ codigo: r.body.codigo, cpf: c, pin: inf.pin }); }
await chamar("prep", "adm_teste", { p_pin: PIN, p_teste: true });
console.log(`  ${prontos.length} cupons prontos para o balcão.`);

for (const k of Object.keys(met)) delete met[k];
const confirmados = new Map(); // cpf -> codigo (o que o cliente recebeu)
let parar = false;
const T0 = Date.now();
const alvoFim = T0 + DUR * 1000;
console.log(`\n== CARGA: ${DUR} s · ${TAXA} cadastros/s · ${TAXA} páginas/s · 20 telas do CRM a cada 5 s · 15 validações/s no balcão · importação a cada 30 s · backup a cada 45 s ==`);

// geradores em taxa constante
const ticker = (porSeg, fn) => { const passo = 1000 / porSeg; let prox = Date.now(); const h = setInterval(() => { if (parar) return clearInterval(h); const agora = Date.now(); let n = 0; while (prox <= agora && n < 400) { fn(); prox += passo; n++; } }, 20); return h; };
ticker(TAXA, () => {
  const inf = infs[Math.floor(rnd() * infs.length)]; const cpf = cpfUnico();
  chamar("cadastrar", "cadastrar", { p_slug: inf.slug, p_nome: "Cliente Soak", p_cpf: cpf, p_whatsapp: "(61) 98888-7777", p_bairro: "Centro", p_aceite: true }).then((r) => { if (r.status === 200) confirmados.set(cpf, r.body.codigo); });
});
ticker(TAXA, () => { const inf = infs[Math.floor(rnd() * infs.length)]; chamar("pagina (GET)", "lp_info", { p_slug: inf.slug }, { get: true }); });
const crm = setInterval(() => { if (parar) return clearInterval(crm); for (let i = 0; i < 20; i++) chamar("CRM visão geral", "adm_dados", { p_pin: PIN, p_sabado: 1, p_bandeira: i % 4 === 0 ? null : ["tesoura", "magazine", "free"][i % 3] }); }, 5000);
let idxBal = 0;
ticker(15, () => { const c = prontos[idxBal++ % prontos.length]; if (!c) return; chamar("balcão validar", "balcao_validar", { p_pin: c.pin, p_codigo: c.codigo, p_cupom_fiscal: String(100000 + idxBal), p_valor: 120 }); });
const imp = setInterval(() => { if (parar) return clearInterval(imp); const l = prontos.slice(0, 3000).map((c, i) => ({ cupom: c.codigo, cpf: c.cpf, nota: String(900000 + i), data: "2026-11-28T14:00:00-03:00", valor: 99.9 })); chamar("importar vendas (1500 linhas)", "adm_importar_vendas", { p_pin: PIN, p: l }); }, 30000);
const bk = setInterval(() => { if (parar) return clearInterval(bk); chamar("backup (planilha)", "backup_exportar", { p_token: "tok-soak" }); }, 45000);
await db.query("insert into config (chave, valor) values ('backup_token_hash', extensions.crypt('tok-soak', extensions.gen_salt('bf', 10))) on conflict (chave) do update set valor = excluded.valor");
const cmp = setInterval(() => { if (parar) return clearInterval(cmp); chamar("comparativo", "adm_comparativo", { p_pin: PIN, p_sabado: null, p_bandeira: null }); }, 20000);

// progresso
const prog = setInterval(() => { const m = met.cadastrar; if (m) process.stdout.write(`  ${Math.round((Date.now() - T0) / 1000)} s · cadastros ${m.n} (ok ${m.ok}) · em voo ${emVoo}\n`); }, 20000);
while (Date.now() < alvoFim) await esp(500);
parar = true; clearInterval(prog);
// espera as últimas respostas
for (let k = 0; k < 120 && emVoo > 0; k++) await esp(500);

const pct = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : 0;
console.log("\n== RESULTADO POR TIPO ==");
console.log("  tipo".padEnd(38), "total".padStart(7), "ok".padStart(7), "p50".padStart(7), "p95".padStart(7), "p99".padStart(7), "máx".padStart(7), " erros");
for (const [tipo, m] of Object.entries(met)) { m.lat.sort((a, b) => a - b); console.log("  " + tipo.padEnd(36), String(m.n).padStart(7), String(m.ok).padStart(7), String(pct(m.lat, .5)).padStart(7), String(pct(m.lat, .95)).padStart(7), String(pct(m.lat, .99)).padStart(7), String(m.lat[m.lat.length - 1]).padStart(7), " ", JSON.stringify(m.erros)); }
console.log(`  pico de requisições ao mesmo tempo: ${maxVoo}`);

console.log("\n== CONFERÊNCIA ==");
const c = met.cadastrar;
const erros5xx = Object.entries(c.erros).filter(([s]) => s === "0" || +s >= 500);
ok(erros5xx.length === 0, "nenhum cadastro com erro de servidor ou de conexão");
const semRespostaOk = Object.entries(c.erros).filter(([s]) => +s === 400).reduce((a, [, n]) => a + n, 0);
console.log(`  (cadastros recusados por regra, ex.: lote cheio: ${semRespostaOk})`);
for (const t of ["pagina (GET)", "CRM visão geral", "balcão validar", "importar vendas (1500 linhas)", "backup (planilha)", "comparativo"]) { const m = met[t]; if (!m) continue; const e5 = Object.entries(m.erros).filter(([s]) => s === "0" || +s >= 500); ok(e5.length === 0, `${t}: sem erro de servidor (${m.n} chamadas)`); }
const noBanco = await q("select cpf, codigo from cadastros");
const mapa = new Map(noBanco.map((r) => [r.cpf, r.codigo]));
const perdidos = [...confirmados].filter(([cpf, cod]) => mapa.get(cpf) !== cod);
ok(perdidos.length === 0, `todos os ${confirmados.size} cadastros confirmados estão no banco com o mesmo código (${perdidos.length} divergentes)`);
ok(new Set(noBanco.map((r) => r.codigo)).size === noBanco.length, "nenhum código repetido");
ok((await q("select count(*)::int n from (select cpf, bandeira, sabado_id from cadastros group by 1,2,3 having count(*) > 1) x"))[0].n === 0, "nenhum CPF repetido");
ok((await q("select count(*)::int n from tokens t where t.cadastro_id is not null and not exists (select 1 from cadastros c where c.id = t.cadastro_id and c.codigo = t.codigo)"))[0].n === 0, "cada token usado aponta para o cadastro certo");
ok((await q("select count(*)::int n from (select cadastro_id from tokens where cadastro_id is not null group by 1 having count(*) > 1) x"))[0].n === 0, "nenhum token entregue para dois cadastros");
ok((await q("select count(*)::int n from cadastros c join tokens t on t.cadastro_id = c.id and t.codigo <> c.codigo"))[0].n === 0, "token e cupom coincidem");
const usadosN = (await q("select count(*)::int n from cadastros where status = 'usado'"))[0].n;
console.log(`  cadastros no banco: ${noBanco.length} · usados no caixa: ${usadosN}`);
const finalMs = Math.round((Date.now() - T0) / 1000);
console.log(`\n== RESULTADO: ${falhas === 0 ? "TUDO OK" : falhas + " FALHA(S)"} · ${finalMs} s ==`);
await db.end();
process.exit(falhas ? 1 : 0);
