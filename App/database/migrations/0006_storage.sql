-- ============================================================================
-- 0006 · Bucket de assets públicos (Supabase Storage)
-- ============================================================================
-- Migración idempotente: se puede correr varias veces sin fallar. Postgres no
-- soporta `CREATE POLICY IF NOT EXISTS`, así que hacemos DROP ... IF EXISTS antes
-- de cada CREATE.
-- ============================================================================

-- Bucket público (upsert por id).
insert into storage.buckets (id, name, public)
values ('public-assets', 'public-assets', true)
on conflict (id) do update set public = true;

-- Lectura pública.
drop policy if exists "Public Access" on storage.objects;
create policy "Public Access" on storage.objects
  for select
  using (bucket_id = 'public-assets');

-- Escritura solo para usuarios autenticados.
drop policy if exists "Authenticated users can upload" on storage.objects;
create policy "Authenticated users can upload" on storage.objects
  for insert
  with check (bucket_id = 'public-assets' and auth.role() = 'authenticated');

drop policy if exists "Authenticated users can update" on storage.objects;
create policy "Authenticated users can update" on storage.objects
  for update
  using (bucket_id = 'public-assets' and auth.role() = 'authenticated');

drop policy if exists "Authenticated users can delete" on storage.objects;
create policy "Authenticated users can delete" on storage.objects
  for delete
  using (bucket_id = 'public-assets' and auth.role() = 'authenticated');
