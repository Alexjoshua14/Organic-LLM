-- Run only in the disposable fixture database created by test-memory-feedback-db.sh.
-- Exercises actual grants, RLS, upsert/trigger behavior and compare-and-swap updates.
BEGIN;
CREATE FUNCTION pg_temp.assert_true(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %', message; END IF; END;
$$;
CREATE FUNCTION pg_temp.expect_rejected(statement text, expected_state text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE rejected boolean := false;
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> expected_state THEN RAISE; END IF;
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Expected rejection: %', statement; END IF;
END;
$$;

SET LOCAL ROLE authenticated;
SET LOCAL test.profile_id = '00000000-0000-4000-8000-000000000001';
INSERT INTO public.memory_feedback(user_id, memory_id, signal, source)
VALUES ('00000000-0000-4000-8000-000000000001', 'memory-a', 'up', 'memory_lens');
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM public.memory_feedback), 'owner can read vote');
SELECT pg_temp.assert_true((SELECT memory_ciphertext IS NULL AND memory_shared_at IS NULL FROM public.memory_feedback), 'voting does not share a memory');

SELECT pg_temp.expect_rejected($q$
  INSERT INTO public.memory_feedback(user_id, memory_id, signal, source)
  VALUES ('00000000-0000-4000-8000-000000000002', 'other-memory', 'up', 'memory_lens')
$q$, '42501');
SELECT pg_temp.expect_rejected($q$
  UPDATE public.memory_feedback SET note_ciphertext = 'private unencrypted text'
$q$, '23514');
SELECT pg_temp.expect_rejected($q$
  UPDATE public.memory_feedback SET revision = 100
$q$, '42501');

-- A syntactically encrypted fixture; real cryptographic integrity is tested in Bun.
UPDATE public.memory_feedback SET note_ciphertext = 'enc:v1:k1:aXY=:dGFn:Y2lwaGVy'
WHERE user_id = '00000000-0000-4000-8000-000000000001' AND memory_id = 'memory-a' AND revision = 1;
SELECT pg_temp.assert_true((SELECT revision = 2 AND note_approved_at IS NOT NULL FROM public.memory_feedback), 'approval updates revision and timestamp');

-- Same vote, same row, preserved note.
INSERT INTO public.memory_feedback(user_id, memory_id, signal, source)
VALUES ('00000000-0000-4000-8000-000000000001', 'memory-a', 'up', 'memory_lens')
ON CONFLICT(user_id, memory_id) DO UPDATE SET
  user_id = EXCLUDED.user_id, memory_id = EXCLUDED.memory_id,
  signal = EXCLUDED.signal, source = EXCLUDED.source;
SELECT pg_temp.assert_true((SELECT count(*) = 1 AND min(revision) = 3 AND min(note_ciphertext) IS NOT NULL FROM public.memory_feedback), 'repeat vote preserves one row and its note');

-- Flipping the vote clears the note within the same database statement.
INSERT INTO public.memory_feedback(user_id, memory_id, signal, source)
VALUES ('00000000-0000-4000-8000-000000000001', 'memory-a', 'down', 'memory_lens')
ON CONFLICT(user_id, memory_id) DO UPDATE SET signal = EXCLUDED.signal, source = EXCLUDED.source;
SELECT pg_temp.assert_true((SELECT signal = 'down' AND note_ciphertext IS NULL AND note_approved_at IS NULL AND revision = 4 FROM public.memory_feedback), 'flip clears note');
WITH stale AS (
  UPDATE public.memory_feedback SET note_ciphertext = 'enc:v1:k1:aXY=:dGFn:Y2lwaGVy'
  WHERE user_id = '00000000-0000-4000-8000-000000000001' AND memory_id = 'memory-a' AND revision = 3 RETURNING id
) SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM stale), 'stale approval cannot restore note');

SELECT pg_temp.expect_rejected($q$
  UPDATE public.memory_feedback SET memory_id = 'different-memory'
$q$, 'P0001');

SET LOCAL test.profile_id = '00000000-0000-4000-8000-000000000002';
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.memory_feedback), 'other user cannot read');
WITH changed AS (UPDATE public.memory_feedback SET signal = 'up' RETURNING id)
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM changed), 'other user cannot update');
WITH removed AS (DELETE FROM public.memory_feedback RETURNING id)
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM removed), 'other user cannot delete');

SET LOCAL ROLE anon;
SELECT pg_temp.expect_rejected('SELECT * FROM public.memory_feedback', '42501');
SELECT pg_temp.expect_rejected($q$INSERT INTO public.memory_feedback(user_id, memory_id, signal, source) VALUES ('00000000-0000-4000-8000-000000000001', 'anon-memory', 'up', 'memory_lens')$q$, '42501');
SELECT pg_temp.expect_rejected('DELETE FROM public.memory_feedback', '42501');

SET LOCAL ROLE service_role;
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM public.memory_feedback), 'service can read for authorized app admin');
SELECT pg_temp.expect_rejected('DELETE FROM public.memory_feedback', '42501');

SET LOCAL ROLE authenticated;
SET LOCAL test.profile_id = '00000000-0000-4000-8000-000000000001';
INSERT INTO public.memory_quality_events(user_id,event,source,metadata)
VALUES ('00000000-0000-4000-8000-000000000001','ingest','auto_ingest','{"infer": true}');
SELECT pg_temp.expect_rejected($q$INSERT INTO public.memory_quality_events(user_id,event,source,metadata) VALUES ('00000000-0000-4000-8000-000000000001','ingest','auto_ingest','{"topic":"private"}')$q$, '23514');
SELECT pg_temp.expect_rejected($q$INSERT INTO public.memory_quality_events(user_id,event,source,metadata) VALUES ('00000000-0000-4000-8000-000000000001','ingest','auto_ingest','{"infer":{"note":"private"}}')$q$, '23514');

-- Notes can be edited and removed without deleting the vote.
SELECT pg_temp.expect_rejected($q$UPDATE public.memory_feedback SET memory_ciphertext = 'unencrypted memory'$q$, '23514');
SELECT pg_temp.expect_rejected($q$UPDATE public.memory_feedback SET memory_shared_at = now()$q$, '42501');
SELECT pg_temp.expect_rejected($q$INSERT INTO public.memory_feedback(user_id, memory_id, signal, source, memory_ciphertext) VALUES ('00000000-0000-4000-8000-000000000001', 'automatic-copy', 'up', 'memory_lens', 'enc:v1:k1:aXY=:dGFn:bmV3')$q$, '42501');
UPDATE public.memory_feedback SET memory_ciphertext = 'enc:v1:k1:aXY=:dGFn:bWVtb3J5';
SELECT pg_temp.assert_true((SELECT memory_shared_at IS NOT NULL FROM public.memory_feedback), 'sharing updates its own timestamp even when note is unchanged');
CREATE TEMP TABLE shared_timestamp AS SELECT memory_shared_at FROM public.memory_feedback;
UPDATE public.memory_feedback SET note_ciphertext = 'enc:v1:k1:aXY=:dGFn:bmV3';
SELECT pg_temp.assert_true((SELECT f.memory_shared_at = t.memory_shared_at FROM public.memory_feedback f, shared_timestamp t), 'editing a note preserves sharing consent');
UPDATE public.memory_feedback SET note_ciphertext = NULL;
SELECT pg_temp.assert_true((SELECT signal = 'down' AND note_ciphertext IS NULL AND note_approved_at IS NULL FROM public.memory_feedback), 'remove note preserves vote');
UPDATE public.memory_feedback SET signal = 'up';
SELECT pg_temp.assert_true((SELECT signal = 'up' AND memory_ciphertext IS NOT NULL AND memory_shared_at = (SELECT memory_shared_at FROM shared_timestamp) FROM public.memory_feedback), 'vote flip preserves independently shared copy');
SET LOCAL test.profile_id = '00000000-0000-4000-8000-000000000002';
WITH changed AS (UPDATE public.memory_feedback SET memory_ciphertext = NULL RETURNING id)
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM changed), 'other user cannot remove a shared copy');
SET LOCAL test.profile_id = '00000000-0000-4000-8000-000000000001';
WITH stale AS (UPDATE public.memory_feedback SET memory_ciphertext = NULL WHERE revision = 1 RETURNING id)
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM stale), 'stale shared copy edits are rejected');
UPDATE public.memory_feedback SET memory_ciphertext = NULL;
SELECT pg_temp.assert_true((SELECT signal = 'up' AND memory_ciphertext IS NULL AND memory_shared_at IS NULL FROM public.memory_feedback), 'remove shared copy preserves vote');
DELETE FROM public.memory_feedback;
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.memory_feedback), 'owner can remove feedback');
ROLLBACK;
