#!/bin/bash
# Sábado Premiado · aplica as migrações de supabase/migracoes/*.sql que ainda não rodaram (em ordem, uma vez cada).
# Registro em public.migracoes_aplicadas. Cada arquivo roda numa transação; erro para tudo.
#
# Uso fora do Docker:  DATABASE_URL=postgres://sabado_admin:SENHA@host:5432/sabado ./aplicar-migracoes.sh
# Dentro do Docker: roda sozinho na primeira subida (montado em docker-entrypoint-initdb.d); depois, para atualizações:
#   docker compose exec -T db sh -c 'bash /docker-entrypoint-initdb.d/03-migracoes.sh'
set -euo pipefail
if [ -d /migracoes ]; then DIR=/migracoes; else DIR="${MIGRACOES_DIR:-$(cd "$(dirname "$0")/../supabase/migracoes" && pwd)}"; fi
if [ -n "${DATABASE_URL:-}" ]; then P() { psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }
else P() { psql -U "${POSTGRES_USER:-sabado_admin}" -d "${POSTGRES_DB:-sabado}" -X -q -v ON_ERROR_STOP=1 "$@"; }; fi
P -c "create table if not exists public.migracoes_aplicadas (arquivo text primary key, aplicada_em timestamptz not null default now())"
for f in "$DIR"/*.sql; do
  n=$(basename "$f")
  if [ "$(P -tAc "select count(*) from public.migracoes_aplicadas where arquivo = '$n'")" = "0" ]; then
    echo "aplicando $n"
    { echo "begin;"; cat "$f"; echo "insert into public.migracoes_aplicadas (arquivo) values ('$n');"; echo "commit;"; } | P
  else echo "já aplicada: $n"; fi
done
