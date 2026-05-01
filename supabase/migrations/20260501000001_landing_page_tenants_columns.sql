-- Adiciona colunas pra landing page configurável.
-- hero_image_url: imagem fundo do bloco Hero (Storage tenant-assets).
-- hero_subheadline: texto curto sob o headline.
-- *_url: links de redes sociais.
-- differentials: array de até 6 cards [{icon, title, text}].

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS hero_image_url text,
  ADD COLUMN IF NOT EXISTS hero_subheadline text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS tiktok_url text,
  ADD COLUMN IF NOT EXISTS differentials jsonb;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_differentials_is_array;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_differentials_is_array
  CHECK (differentials IS NULL OR jsonb_typeof(differentials) = 'array');
