-- Bucket pra logos, favicons e outros assets visuais do tenant.
-- Público pra leitura (home pública, login screen) — qualquer visitante
-- consegue ver o logo do estabelecimento.
--
-- Escrita só via secret client (server action `uploadTenantAsset`),
-- que valida staff role + tenant ownership antes do upload.
-- Não criamos policies de INSERT/UPDATE/DELETE em storage.objects
-- porque não há fluxo client-side direto pra escrita; secret client
-- bypassa RLS de qualquer forma.
--
-- Path convention: `tenants/{tenant_id}/{kind}-{timestamp}.{ext}`
-- onde kind ∈ {logo, favicon}. Timestamp evita cache stale quando
-- substituído.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tenant-assets',
  'tenant-assets',
  true,
  5242880, -- 5 MB. Logo de SVG/PNG cabe folgado; favicon ainda mais.
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon']
)
on conflict (id) do nothing;
