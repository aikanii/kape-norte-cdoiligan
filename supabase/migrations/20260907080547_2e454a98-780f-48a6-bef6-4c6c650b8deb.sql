DROP POLICY IF EXISTS shop_photos_auth_upload ON storage.objects;
DROP POLICY IF EXISTS shop_photos_owner_update ON storage.objects;
DROP POLICY IF EXISTS shop_photos_owner_delete ON storage.objects;

CREATE POLICY shop_photos_auth_upload ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'shop-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY shop_photos_owner_update ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'shop-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'shop-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY shop_photos_owner_delete ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'shop-photos' AND (storage.foldername(name))[1] = auth.uid()::text);