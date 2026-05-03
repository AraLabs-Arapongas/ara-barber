-- Garante que um custom_domain só pode ser usado por um tenant.
-- Index parcial: NULLs (a maioria dos tenants) não conflitam entre si.
CREATE UNIQUE INDEX IF NOT EXISTS tenants_custom_domain_key
  ON public.tenants (custom_domain)
  WHERE custom_domain IS NOT NULL;
