#!/bin/bash
# Roda a bateria completa em sequência, recriando a homologação (banco vazio) antes de cada teste que usa banco.
# Pré-requisitos: Docker, npm install nesta pasta e as variáveis do README (TESTE_EM_HOMOLOGACAO=sim, DB_PASSWORD, ADMIN_PIN, API_RPC).
set -e
cd "$(dirname "$0")"
: "${TESTE_EM_HOMOLOGACAO:?exporte TESTE_EM_HOMOLOGACAO=sim (banco de TESTE)}"
: "${API_RPC:?exporte API_RPC, ex.: http://127.0.0.1:3000/rpc/}"
COMP="docker compose -f docker-compose.yml -f docker-compose.homologacao.yml"
recriar() {
  echo ">> recriando a homologação (banco vazio)"
  (cd ../infra && $COMP down -v >/dev/null 2>&1 && $COMP up -d >/dev/null)
  for i in $(seq 1 60); do curl -s -o /dev/null -m 2 "${API_RPC}lp_info?p_slug=x" && break; sleep 2; done
  sleep 2
}
recriar; node carga.mjs 3000
recriar; node e2e.mjs
recriar; node carga2.mjs 25000
recriar; node soak.mjs 180 150
node demo.mjs
echo "BATERIA COMPLETA OK"
