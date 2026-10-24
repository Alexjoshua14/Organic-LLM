-- Migration: Add feature + path columns to threads for unified sidebar routing
-- Purpose:
-- - feature: stable identifier for which part of the app "owns" this thread (e.g. main, arcadia)
-- - path: canonical navigation path for this thread (e.g. /chat/<id>, /sandbox/arcadia/<id>)
--
-- Notes:
-- - Defaults keep existing behavior (main chat).
-- - `path` is nullable so older rows can be backfilled safely and so the app can derive href when absent.
-- - Thread list metadata is not encrypted; do not store sensitive information in these fields.

ALTER TABLE threads
ADD COLUMN IF NOT EXISTS feature text NOT NULL DEFAULT 'main';

ALTER TABLE threads
ADD COLUMN IF NOT EXISTS path text;

COMMENT ON COLUMN threads.feature IS 'Thread owner feature (e.g. main, arcadia). Used for sidebar filtering and UI variants.';
COMMENT ON COLUMN threads.path IS 'Canonical navigation path for this thread (e.g. /chat/<id>, /sandbox/arcadia/<id>).';

-- Backfill existing threads to main chat path when missing
UPDATE threads
SET feature = COALESCE(NULLIF(feature, ''), 'main')
WHERE feature IS NULL OR TRIM(feature) = '';

UPDATE threads
SET path = '/chat/' || id
WHERE (path IS NULL OR TRIM(path) = '') AND COALESCE(NULLIF(feature, ''), 'main') = 'main';

