# Changelog

Cada atualização que a V4 mandar para o time vem com o número aqui, os arquivos alterados e, se mexer no banco, uma migração nova em `supabase/migracoes/` (nunca editar uma migração já aplicada).

## 1.1.0 (16/11/2026)
- API de relatórios por chave (`migracoes/001-api-relatorios.sql`): escopos grupo, diretoria e influencer, com tela no CRM (API e relatórios) para criar, acompanhar e revogar chaves.
- Ajustes de conteúdo pela API sem subir código (`migracoes/002-config-remota.sql` + `web/config-remota.js`).
- `infra/aplicar-migracoes.sh`, `empacotar.sh`, `INSTRUCOES-TIME-TEK.md`.

## 1.0.0 (12/11/2026)
- Versão validada: página da influencer, balcão, CRM, tokens do PDV, comparativo de fim de ano, três bandeiras, backup em planilha.
