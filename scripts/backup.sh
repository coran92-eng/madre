#!/usr/bin/env bash
# Backup diario de MADRE: base de datos (pg_dump) + documentos (STORAGE_DIR).
# Uso: DATABASE_URL=... BACKUP_DIR=./backups STORAGE_DIR=./storage ./scripts/backup.sh
# Retención por defecto: 30 días (spec §6). Programar con cron, p.ej.:
#   0 3 * * * cd /ruta/a/madre && ./scripts/backup.sh >> /var/log/madre-backup.log 2>&1
set -euo pipefail

: "${DATABASE_URL:?Falta DATABASE_URL}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
STORAGE_DIR="${STORAGE_DIR:-./storage}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$BACKUP_DIR/$STAMP"

mkdir -p "$DEST"

echo "[backup] Volcando base de datos..."
pg_dump "$DATABASE_URL" --format=custom --file="$DEST/database.dump"

if [ -d "$STORAGE_DIR" ]; then
  echo "[backup] Empaquetando documentos ($STORAGE_DIR)..."
  tar -czf "$DEST/storage.tar.gz" -C "$(dirname "$STORAGE_DIR")" "$(basename "$STORAGE_DIR")"
else
  echo "[backup] STORAGE_DIR no encontrado localmente (¿Netlify Blobs? no requiere backup manual aquí)."
fi

echo "[backup] Purgando copias con más de $RETENTION_DAYS días..."
find "$BACKUP_DIR" -maxdepth 1 -type d -mtime "+$RETENTION_DAYS" -exec rm -rf {} \;

echo "[backup] OK → $DEST"

# Prueba de restauración (recomendada mensualmente, spec §6):
#   pg_restore --clean --if-exists -d "$DATABASE_URL_STAGING" "$DEST/database.dump"
