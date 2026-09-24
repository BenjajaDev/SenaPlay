#!/usr/bin/env bash
# Aplica el SQL de supabase/ (tablas base + migrations/) sobre un Postgres
# local con stubs de Supabase y corre las pruebas de RLS.
#
# Uso: PGHOST=/var/tmp PGPORT=5499 PGUSER=postgres scripts/testMigrations.sh
# Requiere un Postgres 15+ local (no toca tu proyecto real de Supabase).
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${TEST_DB:-senaplay_migrations_test}"
PSQL="psql -v ON_ERROR_STOP=1 -q"

$PSQL -c "drop database if exists $DB" -c "create database $DB"
$PSQL -d "$DB" -f supabase/tests/00_supabase_stubs.sql
for file in supabase/catalog.sql supabase/dictionary.sql supabase/signs.sql supabase/dynamic_signs_capture.sql supabase/migrations/*.sql; do
  echo "→ $file"
  $PSQL -d "$DB" -f "$file" >/dev/null 2>&1 || { echo "Error aplicando $file"; $PSQL -d "$DB" -f "$file"; exit 1; }
done
echo "→ segunda pasada (idempotencia)"
for file in supabase/migrations/*.sql; do $PSQL -d "$DB" -f "$file" >/dev/null 2>&1; done

OUTPUT=$(psql -q -tA -d "$DB" -f supabase/tests/10_rls_policies.sql 2>&1 || true)
echo "$OUTPUT"
if echo "$OUTPUT" | grep -q "FALLA"; then
  echo "✗ Hay políticas que no se comportan como se espera"
  exit 1
fi
echo "✓ Migraciones y políticas OK"
