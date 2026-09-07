ALTER TABLE public.shops
  ADD COLUMN google_photo_url text,
  ADD COLUMN google_photo_attribution text,
  ADD COLUMN google_photo_refreshed_at timestamp with time zone;