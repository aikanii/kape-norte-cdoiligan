CREATE POLICY shop_photos_owner_read ON public.shop_photos
  FOR SELECT TO authenticated USING (auth.uid() = uploaded_by);