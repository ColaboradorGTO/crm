// Configuração comum dos testes. Tudo por variáveis de ambiente (veja o README.md desta pasta).
import { fileURLToPath } from "url";
import path from "path";
const aqui = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(aqui, "..");
export const API_RPC = process.env.API_RPC || "http://127.0.0.1:3000/rpc/";     // PostgREST (ou http://servidor/api/rpc/ passando pelo nginx)
export const API_BASE = API_RPC.replace(/\/rpc\/?$/, "");
export const PIN = process.env.ADMIN_PIN || "1234";                              // senha do CRM do ambiente de homologação
export const dbCfg = {
  host: process.env.DB_HOST || "127.0.0.1", port: +(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "sabado_admin", password: process.env.DB_PASSWORD || "", database: process.env.DB_NAME || "sabado",
};
export const WEB = path.join(RAIZ, "web") + "/";
export const ARTEFATO = path.join(RAIZ, "artefato", "sabado-premiado.html");
// trava: os testes de carga gravam milhares de cadastros falsos. Só rodam se a pessoa confirmar que o banco é de teste.
export function exigirHomologacao() {
  if (process.env.TESTE_EM_HOMOLOGACAO !== "sim") {
    console.log("PARADO: este teste cria milhares de cadastros falsos.\nRode só em banco de HOMOLOGAÇÃO (cópia vazia) e confirme com:  TESTE_EM_HOMOLOGACAO=sim node <teste>.mjs");
    process.exit(2);
  }
}
