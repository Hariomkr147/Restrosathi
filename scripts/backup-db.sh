#!/bin/sh
set -e

# Wait a random delay (up to 300 seconds) so backups don't happen exactly at 3:00 if scheduled precisely.
# Wait, let's keep it simple.
if [ -z "$POSTGRES_PASSWORD" ]; then
  echo "POSTGRES_PASSWORD is not set"
  exit 1
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
BACKUP_FILE="$BACKUP_DIR/db_$TIMESTAMP.sql.gz"

echo "Starting database backup to $BACKUP_FILE..."
export PGPASSWORD=$POSTGRES_PASSWORD
pg_dump -h postgres -U postgres restrosathi | gzip > "$BACKUP_FILE"

echo "Backup successful."

# Keep 14 files
echo "Pruning old backups..."
ls -tp $BACKUP_DIR/*.sql.gz | grep -v '/$' | tail -n +15 | xargs -I {} rm -- {} || true

echo "Done."
