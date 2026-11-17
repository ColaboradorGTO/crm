#!/bin/bash
# Sábado Premiado · conferência rápida depois da instalação (só leitura: não grava nada no banco).
# Uso: ./verificar.sh https://sabadopremiado.tesouradeouro.com.br
URL="${1:?informe o endereço, ex.: ./verificar.sh https://sabadopremiado.tesouradeouro.com.br}"
URL="${URL%/}"
ok=0; falha=0
t() { if [ "$2" = "$3" ]; then echo "  ok     $1"; ok=$((ok+1)); else echo "  FALHOU $1 (esperado $3, veio $2)"; falha=$((falha+1)); fi; }
code() { curl -s -o /dev/null -m 15 -w '%{http_code}' "$@"; }
echo "Conferindo $URL"
case "$URL" in
  https://*) t "HTTPS com certificado válido" "$(curl -s -o /dev/null -m 15 -w '%{ssl_verify_result}' "$URL/")" 0 ;;
  *)         t "endereço usa HTTPS (começa com https://)" "http" "https" ;;
esac
t "site abre (/)"                          "$(code "$URL/")" 200
t "página de influencer cai no app (/ana)" "$(code "$URL/ana")" 200
t "API responde (influencer inexistente)"  "$(code "$URL/api/rpc/lp_info?p_slug=naoexiste")" 400
t "tabelas fechadas (/api/cadastros)"      "$(code "$URL/api/cadastros")" 404
t "senha errada é recusada"                "$(code -X POST "$URL/api/rpc/adm_entrar" -H 'Content-Type: application/json' -d '{"p_pin":"senha-errada-xyz"}')" 400
t "cabeçalho nosniff"                      "$(curl -sI -m 15 "$URL/" | tr -d '\r' | grep -ci '^x-content-type-options: nosniff' | sed 's/^[1-9].*/1/')" 1
echo "Resultado: $ok ok, $falha com problema"
[ "$falha" -eq 0 ]
