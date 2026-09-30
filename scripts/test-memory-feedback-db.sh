#!/usr/bin/env bash
# Requires Docker. Uses an isolated container with no network or host mounts.
set -euo pipefail
cd "$(dirname "$0")/.."
feedback_container="organic-feedback-test-$$"
feedback_image="public.ecr.aws/supabase/postgres:15.8.1.085"
trap 'docker rm -f "$feedback_container" >/dev/null 2>&1 || true' EXIT
docker run --rm -d --name "$feedback_container" --network none \
  -e POSTGRES_PASSWORD=feedback-local-test -e POSTGRES_DB=feedback_test "$feedback_image" >/dev/null
for attempt in {1..30}; do
  # initdb briefly starts a temporary server; wait for the final PID 1 server.
  if docker exec "$feedback_container" sh -c 'case "$(tr "\0" " " </proc/1/cmdline)" in "/usr/bin/postgres "*) pg_isready -U postgres -d feedback_test ;; *) exit 1 ;; esac' >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec -e PGPASSWORD=feedback-local-test -i "$feedback_container" psql -U supabase_admin -d feedback_test -v ON_ERROR_STOP=1 <<'SQL'
GRANT ALL ON SCHEMA public TO postgres;
SQL
docker exec -i "$feedback_container" psql -U postgres -d feedback_test -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE public.profiles(id uuid PRIMARY KEY);
CREATE FUNCTION public.current_profile_id() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('test.profile_id', true), '')::uuid $$;
INSERT INTO public.profiles VALUES
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002');
SQL
docker cp docs/migrations/memory_quality_tables.sql "$feedback_container":/tmp/migration.sql
docker cp docs/migrations/memory_feedback_shared_memory.sql "$feedback_container":/tmp/shared-memory.sql
docker cp tests/sql/memory-feedback.sql "$feedback_container":/tmp/test.sql
docker exec "$feedback_container" psql -U postgres -d feedback_test -v ON_ERROR_STOP=1 -f /tmp/migration.sql
docker exec "$feedback_container" psql -U postgres -d feedback_test -v ON_ERROR_STOP=1 -f /tmp/shared-memory.sql
docker exec "$feedback_container" psql -U postgres -d feedback_test -v ON_ERROR_STOP=1 -f /tmp/test.sql
echo 'Memory feedback database tests passed.'
