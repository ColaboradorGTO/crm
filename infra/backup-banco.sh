#!/bin/bash
# Sábado Premiado · cópia diária do banco (pg_dump compactado), guarda 30 dias.
# Agendar no servidor (crontab -e):   0 3 * * * /CAMINHO/gto-sabado-premiado/infra/backup-banco.sh >> /var/log/sabado-backup.log 2>&1
# Para guardar fora do servidor, aponte BACKUP_DIR para um disco ou pasta sincronizada.
# Restaurar uma cópia (banco vazio):  gunzip -c ARQUIVO.sql.gz | docker compose exec -T db psql -U sabado_admin -d sabado
set -euo pipefail
cd "$(dirname "$0")"
DEST="${BACKUP_DIR:-/var/backups/sabado-premiado}"
mkdir -p "$DEST"
ARQ="$DEST/sabado-$(date +%Y-%m-%d_%H%M).sql.gz"
docker compose exec -T db pg_dump -U sabado_admin -d sabado --no-owner | gzip > "$ARQ"
if [ ! -s "$ARQ" ]; then echo "ERRO: cópia vazia"; rm -f "$ARQ"; exit 1; fi
gzip -t "$ARQ"
find "$DEST" -name 'sabado-*.sql.gz' -mtime +30 -delete
echo "$(date '+%F %T') ok $ARQ ($(du -h "$ARQ" | cut -f1))"
