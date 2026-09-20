-- Owners can edit details, but may not publish a pending listing or transfer ownership.
REVOKE UPDATE ON public.shops FROM authenticated;
GRANT UPDATE (name, city, area, address, blurb, price_level, tags, photo_path, lat, lng, hours)
  ON public.shops TO authenticated;

CREATE POLICY shops_admin_read ON public.shops FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY shop_photos_admin_read ON public.shop_photos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY shop_photos_listing_owner_read ON public.shop_photos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.submitted_by = auth.uid()));

-- Keep uploaded objects in the uploader's folder and prevent references to someone else's file.
DROP POLICY shop_photos_insert_own ON public.shop_photos;
CREATE POLICY shop_photos_insert_own ON public.shop_photos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploaded_by
    AND split_part(storage_path, '/', 1) = auth.uid()::text
    AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id
      AND (s.status = 'published' OR s.submitted_by = auth.uid())));
DROP POLICY shop_photos_update_own ON public.shop_photos;
CREATE POLICY shop_photos_update_own ON public.shop_photos FOR UPDATE TO authenticated
  USING (auth.uid() = uploaded_by)
  WITH CHECK (auth.uid() = uploaded_by AND split_part(storage_path, '/', 1) = auth.uid()::text);

-- Fresh installations previously never created the storage bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('shop-photos', 'shop-photos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.review_shop_claim(_claim_id uuid, _approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  claim public.shop_claims;
  owner_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT * INTO claim FROM public.shop_claims WHERE id = _claim_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim not found'; END IF;
  -- Serialize decisions for the same shop, then re-read the claim under lock.
  SELECT submitted_by INTO owner_id FROM public.shops WHERE id = claim.shop_id FOR UPDATE;
  SELECT * INTO claim FROM public.shop_claims WHERE id = _claim_id FOR UPDATE;
  IF claim.status <> 'pending' THEN RAISE EXCEPTION 'This claim has already been reviewed'; END IF;
  IF _approve AND owner_id IS NOT NULL AND owner_id <> claim.user_id THEN
    RAISE EXCEPTION 'This cafe already has an owner';
  END IF;
  IF _approve THEN
    UPDATE public.shops SET submitted_by = claim.user_id WHERE id = claim.shop_id;
    UPDATE public.shop_claims SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
      WHERE shop_id = claim.shop_id AND id <> claim.id AND status = 'pending';
  END IF;
  UPDATE public.shop_claims SET
    status = CASE WHEN _approve THEN 'approved'::public.claim_status ELSE 'rejected'::public.claim_status END,
    reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = claim.id;
END;
$$;
REVOKE ALL ON FUNCTION public.review_shop_claim(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_shop_claim(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.publish_shop(_shop_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.shops SET status = 'published' WHERE id = _shop_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Pending listing not found'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.publish_shop(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_shop(uuid) TO authenticated;
