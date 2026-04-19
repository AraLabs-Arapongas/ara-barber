-- supabase/migrations/0008_storage_buckets.sql
-- Bucket público 'tenant-assets' para logos, favicons e ícones PWA dos tenants.
-- Leitura pública (necessário para manifest.webmanifest e <Image>).
-- Escrita: platform admin em qualquer pasta + owner apenas na pasta do próprio tenant.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tenant-assets',
  'tenant-assets',
  true,
  5 * 1024 * 1024,
  array['image/png','image/jpeg','image/webp','image/svg+xml','image/x-icon']
)
on conflict (id) do nothing;

-- Leitura pública.
create policy "tenant_assets_public_read" on storage.objects
  for select
  using (bucket_id = 'tenant-assets');

-- Platform admin: CRUD em tudo.
create policy "tenant_assets_platform_admin_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'tenant-assets'
    and public.is_platform_admin()
  );

create policy "tenant_assets_platform_admin_update" on storage.objects
  for update
  using (
    bucket_id = 'tenant-assets'
    and public.is_platform_admin()
  );

create policy "tenant_assets_platform_admin_delete" on storage.objects
  for delete
  using (
    bucket_id = 'tenant-assets'
    and public.is_platform_admin()
  );

-- Owner do tenant: upload/update na pasta do próprio tenant.
-- Convenção de path: '{tenant_id}/{filename}'.
create policy "tenant_assets_owner_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'tenant-assets'
    and public.current_user_role() = 'SALON_OWNER'
    and (storage.foldername(name))[1]::uuid = public.current_tenant_id()
  );

create policy "tenant_assets_owner_update" on storage.objects
  for update
  using (
    bucket_id = 'tenant-assets'
    and public.current_user_role() = 'SALON_OWNER'
    and (storage.foldername(name))[1]::uuid = public.current_tenant_id()
  );

create policy "tenant_assets_owner_delete" on storage.objects
  for delete
  using (
    bucket_id = 'tenant-assets'
    and public.current_user_role() = 'SALON_OWNER'
    and (storage.foldername(name))[1]::uuid = public.current_tenant_id()
  );
