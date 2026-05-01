-- Imagem do hero para desktop (16:9). A `hero_image_url` original passa
-- a ser o slot mobile (9:16). Quando desktop não é setada, fallback usa
-- a mobile esticada via object-cover.
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS hero_image_url_desktop text;
