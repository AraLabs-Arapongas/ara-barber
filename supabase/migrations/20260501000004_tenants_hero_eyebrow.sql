-- Texto da "tarja" (eyebrow) acima da headline do hero. Opcional —
-- quando NULL, o bloco renderiza só headline + subtítulo + CTA.
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS hero_eyebrow text;
