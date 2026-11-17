// Sábado Premiado · backup em planilha Google (Apps Script)
// Onde: planilha da GTO > Extensões > Apps Script. Colar este arquivo inteiro.
// Configurar: Configurações do projeto > Propriedades do script:
//   BACKUP_URL   = https://SUBDOMINIO/api/rpc/backup_exportar   (Supabase: https://XXXX.supabase.co/rest/v1/rpc/backup_exportar)
//   BACKUP_TOKEN = o mesmo token gravado no banco (backup_token_hash)
//   SUPABASE_ANON = só na opção Supabase (chave anon); deixar sem na opção de servidor próprio
// Depois rodar a função instalar() uma vez e autorizar. A cada 15 minutos as abas são regravadas com a foto completa do banco.

const ABAS = { cadastros: "Cadastros", notas_fim_de_ano: "Notas fim de ano", influencers: "Influencers" };
const TEXTO = ["cupom", "cpf", "whatsapp", "nota", "chave_nfce", "cupom_prefixo"]; // colunas que não podem virar número (zeros à esquerda)

function backup() {
  const p = PropertiesService.getScriptProperties();
  const url = p.getProperty("BACKUP_URL"), token = p.getProperty("BACKUP_TOKEN"), anon = p.getProperty("SUPABASE_ANON");
  if (!url || !token) throw new Error("Preencha BACKUP_URL e BACKUP_TOKEN nas propriedades do script.");
  const headers = anon ? { apikey: anon, Authorization: "Bearer " + anon } : {};
  const r = UrlFetchApp.fetch(url, { method: "post", contentType: "application/json", headers, payload: JSON.stringify({ p_token: token }), muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error("Backup falhou (" + r.getResponseCode() + "): " + r.getContentText().slice(0, 300));
  const d = JSON.parse(r.getContentText());
  const ss = SpreadsheetApp.getActive();
  const contagem = [];
  Object.keys(ABAS).forEach((k) => { const n = gravar(ss, ABAS[k], d[k] || []); contagem.push([ABAS[k], n]); });
  const st = ss.getSheetByName("Status") || ss.insertSheet("Status");
  st.clearContents();
  st.getRange(1, 1, 2 + contagem.length, 2).setValues([["Última cópia do banco", d.gerado_em], ["Aba", "Linhas"]].concat(contagem));
}

// regrava a aba só quando veio dado: resposta vazia nunca apaga o que já estava salvo
function gravar(ss, nome, linhas) {
  const aba = ss.getSheetByName(nome) || ss.insertSheet(nome);
  if (!linhas.length) return Math.max(0, aba.getLastRow() - 1);
  const cab = Object.keys(linhas[0]);
  const valores = [cab].concat(linhas.map((l) => cab.map((k) => (l[k] === null || l[k] === undefined ? "" : l[k]))));
  aba.clearContents();
  cab.forEach((k, i) => { if (TEXTO.indexOf(k) >= 0) aba.getRange(1, i + 1, valores.length, 1).setNumberFormat("@"); });
  aba.getRange(1, 1, valores.length, cab.length).setValues(valores);
  aba.setFrozenRows(1);
  return linhas.length;
}

// roda uma vez: cria o gatilho de 15 em 15 minutos e já faz a primeira cópia
function instalar() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("backup").timeBased().everyMinutes(15).create();
  backup();
}
