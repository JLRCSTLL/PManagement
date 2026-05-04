-- Harden KV storage table exposure in PostgREST/public API.
-- This table is intended for backend/edge-function access, not direct client access.

CREATE TABLE IF NOT EXISTS public.kv_store_ce3c3227 (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

ALTER TABLE public.kv_store_ce3c3227 ENABLE ROW LEVEL SECURITY;

-- Remove direct table privileges for client-facing roles.
REVOKE ALL ON TABLE public.kv_store_ce3c3227 FROM anon;
REVOKE ALL ON TABLE public.kv_store_ce3c3227 FROM authenticated;

-- Explicit deny policies for clarity/auditing.
DROP POLICY IF EXISTS kv_store_deny_anon ON public.kv_store_ce3c3227;
DROP POLICY IF EXISTS kv_store_deny_authenticated ON public.kv_store_ce3c3227;

CREATE POLICY kv_store_deny_anon
  ON public.kv_store_ce3c3227
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY kv_store_deny_authenticated
  ON public.kv_store_ce3c3227
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

