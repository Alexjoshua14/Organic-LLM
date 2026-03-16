-- Migration: Add flags column to threads for compact boolean state (e.g. has_title)
-- Each bit in the uint32 can represent a specific boolean; use lib/thread-flags.ts to read/write.

ALTER TABLE threads
ADD COLUMN IF NOT EXISTS flags integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN threads.flags IS 'Bitfield: bit 0 = has_title. Use centralized thread-flags module to read/write.';

-- Backfill: set HAS_TITLE bit (1) for threads that already have a title
UPDATE threads
SET flags = (COALESCE(flags, 0) | 1)
WHERE title IS NOT NULL AND TRIM(title) <> '';
