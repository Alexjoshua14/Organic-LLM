-- Apply before deploying token analytics. Existing cache zeros remain uncertain.
BEGIN;
ALTER TABLE public.llm_usage_events
  ADD COLUMN IF NOT EXISTS surface text CHECK (surface IN ('chat','stage','arcadia','rabbit_holes','speak','remy','background','other','unknown')),
  ADD COLUMN IF NOT EXISTS cache_reported boolean,
  ADD COLUMN IF NOT EXISTS audio_input_tokens integer NOT NULL DEFAULT 0 CHECK (audio_input_tokens >= 0),
  ADD COLUMN IF NOT EXISTS audio_output_tokens integer NOT NULL DEFAULT 0 CHECK (audio_output_tokens >= 0);

-- Service-role only: owner comes from the authenticated admin endpoint.
CREATE OR REPLACE FUNCTION public.admin_token_analytics(p_owner uuid, p_since timestamptz, p_until timestamptz)
RETURNS TABLE(day text, surface text, model text, operation text, input bigint, cached bigint, uncached bigint, unknown bigint, output bigint, calls bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
 SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
   coalesce(e.surface, 'unknown'), model_id, coalesce(e.operation, 'unclassified'),
   sum(input_tokens::bigint + audio_input_tokens)::bigint,
   sum(CASE WHEN cache_reported IS TRUE AND cached_input_tokens <= input_tokens AND audio_input_tokens = 0 THEN cached_input_tokens ELSE 0 END)::bigint,
   sum(CASE WHEN cache_reported IS TRUE AND cached_input_tokens <= input_tokens AND audio_input_tokens = 0 THEN input_tokens - cached_input_tokens ELSE 0 END)::bigint,
   sum(CASE WHEN cache_reported IS TRUE AND cached_input_tokens <= input_tokens AND audio_input_tokens = 0 THEN 0 ELSE input_tokens::bigint + audio_input_tokens END)::bigint,
   sum(output_tokens::bigint + audio_output_tokens)::bigint, count(*)
 FROM public.llm_usage_events e
 WHERE owner_id = p_owner AND created_at >= p_since AND created_at < p_until
 GROUP BY 1,2,3,4 ORDER BY 1,2,3,4;
$$;
REVOKE ALL ON FUNCTION public.admin_token_analytics(uuid,timestamptz,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_token_analytics(uuid,timestamptz,timestamptz) TO service_role;
COMMIT;
