#!/bin/bash
# Gera o pacote para o time de desenvolvimento: ./empacotar.sh [saida.zip]
# Fica de fora: demo (artefato/), versões antigas (*.antes-crm.*), segredos e config de produção.
set -euo pipefail
cd "$(dirname "$0")"
VERSAO=$(head -1 VERSAO)
OUT="${1:-../../sabado-premiado-v${VERSAO}.zip}"
python3 montar.py >/dev/null
rm -f "$OUT"
zip -qr "$OUT" . -x "artefato/*" "*.antes-crm.*" "*/node_modules/*" "node_modules/*" "config.producao.js" "infra/.env" "*.DS_Store" "testes/package-lock.json"
echo "$OUT"
