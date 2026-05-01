DO $$ BEGIN
  CREATE TYPE public.landing_block_type AS ENUM (
    'HERO',
    'SERVICES',
    'DIFFERENTIALS',
    'PROFESSIONALS',
    'TESTIMONIALS',
    'CONTACT',
    'FINAL_CTA'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.landing_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  block_type public.landing_block_type NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  position integer NOT NULL,
  config jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, block_type)
);

CREATE INDEX IF NOT EXISTS landing_blocks_tenant_position_idx
  ON public.landing_blocks (tenant_id, position);

DROP TRIGGER IF EXISTS landing_blocks_touch_updated_at ON public.landing_blocks;
CREATE TRIGGER landing_blocks_touch_updated_at
  BEFORE UPDATE ON public.landing_blocks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.landing_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS landing_blocks_public_read ON public.landing_blocks;
CREATE POLICY landing_blocks_public_read
  ON public.landing_blocks FOR SELECT
  USING (true);

DROP POLICY IF EXISTS landing_blocks_staff_write ON public.landing_blocks;
CREATE POLICY landing_blocks_staff_write
  ON public.landing_blocks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.user_id = (SELECT auth.uid())
        AND (
          up.role = 'PLATFORM_ADMIN'
          OR (up.tenant_id = landing_blocks.tenant_id
              AND up.role IN ('BUSINESS_OWNER', 'RECEPTIONIST', 'PROFESSIONAL'))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.user_id = (SELECT auth.uid())
        AND (
          up.role = 'PLATFORM_ADMIN'
          OR (up.tenant_id = landing_blocks.tenant_id
              AND up.role IN ('BUSINESS_OWNER', 'RECEPTIONIST', 'PROFESSIONAL'))
        )
    )
  );

INSERT INTO public.landing_blocks (tenant_id, block_type, enabled, position)
SELECT t.id, bt.block_type::public.landing_block_type, bt.enabled, bt.position
FROM public.tenants t
CROSS JOIN (VALUES
  ('HERO', true, 1),
  ('SERVICES', true, 2),
  ('DIFFERENTIALS', true, 3),
  ('PROFESSIONALS', false, 4),
  ('TESTIMONIALS', true, 5),
  ('CONTACT', true, 6),
  ('FINAL_CTA', true, 7)
) AS bt(block_type, enabled, position)
ON CONFLICT (tenant_id, block_type) DO NOTHING;
