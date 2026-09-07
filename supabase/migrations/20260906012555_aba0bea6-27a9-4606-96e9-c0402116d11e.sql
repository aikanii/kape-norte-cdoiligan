CREATE TABLE public.shop_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  caption text NOT NULL DEFAULT '',
  sort_order smallint NOT NULL DEFAULT 0,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shop_photos_shop_id_idx ON public.shop_photos (shop_id, sort_order, created_at);

GRANT SELECT ON public.shop_photos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_photos TO authenticated;
GRANT ALL ON public.shop_photos TO service_role;

ALTER TABLE public.shop_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY shop_photos_public_read ON public.shop_photos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.status = 'published')
  );

CREATE POLICY shop_photos_insert_own ON public.shop_photos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY shop_photos_update_own ON public.shop_photos
  FOR UPDATE TO authenticated USING (auth.uid() = uploaded_by) WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY shop_photos_delete_own ON public.shop_photos
  FOR DELETE TO authenticated USING (auth.uid() = uploaded_by);

CREATE TRIGGER shop_photos_touch_updated_at BEFORE UPDATE ON public.shop_photos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();