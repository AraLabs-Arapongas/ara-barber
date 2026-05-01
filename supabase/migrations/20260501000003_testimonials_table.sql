CREATE TABLE IF NOT EXISTS public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  author_photo_url text,
  rating smallint NOT NULL DEFAULT 5,
  body text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT testimonials_rating_range CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT testimonials_body_nonempty CHECK (length(btrim(body)) > 0),
  CONSTRAINT testimonials_author_nonempty CHECK (length(btrim(author_name)) > 0)
);

CREATE INDEX IF NOT EXISTS testimonials_tenant_position_idx
  ON public.testimonials (tenant_id, position);

DROP TRIGGER IF EXISTS testimonials_touch_updated_at ON public.testimonials;
CREATE TRIGGER testimonials_touch_updated_at
  BEFORE UPDATE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS testimonials_public_read ON public.testimonials;
CREATE POLICY testimonials_public_read
  ON public.testimonials FOR SELECT
  USING (true);

DROP POLICY IF EXISTS testimonials_staff_write ON public.testimonials;
CREATE POLICY testimonials_staff_write
  ON public.testimonials FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.user_id = (SELECT auth.uid())
        AND (
          up.role = 'PLATFORM_ADMIN'
          OR (up.tenant_id = testimonials.tenant_id
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
          OR (up.tenant_id = testimonials.tenant_id
              AND up.role IN ('BUSINESS_OWNER', 'RECEPTIONIST', 'PROFESSIONAL'))
        )
    )
  );
