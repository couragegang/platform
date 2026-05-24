#!/bin/bash
# Idempotent create for all BC databases (runs on first postgres init only).
# For existing volumes use deploy/vps/ensure-databases.sh on VPS.
set -euo pipefail

databases=(iam config mcp policy secrets audit knowledge ai)

for db in "${databases[@]}"; do
  exists="$(psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='${db}'")"
  if [[ "$exists" != "1" ]]; then
    echo "Creating database: $db"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" -d postgres -c "CREATE DATABASE ${db};"
  fi
done
