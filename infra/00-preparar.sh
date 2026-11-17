#!/bin/bash
# Roda uma vez, na primeira subida do banco (docker-entrypoint-initdb.d): cria os papéis da API com a senha do arquivo .env
# e prepara o que o Supabase já traz pronto. O texto do SQL vem de 00-preparar-postgres.sql (a mesma fonte do passo manual).
set -euo pipefail
: "${AUTHENTICATOR_PASSWORD:?defina AUTHENTICATOR_PASSWORD no arquivo .env}"
case "$AUTHENTICATOR_PASSWORD" in *[!A-Za-z0-9]*) echo "AUTHENTICATOR_PASSWORD deve ter só letras e números (use: openssl rand -hex 24)"; exit 1;; esac
sed "s/TROCAR_SENHA_AUTHENTICATOR/${AUTHENTICATOR_PASSWORD}/" /preparar.sql.tpl | psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"
