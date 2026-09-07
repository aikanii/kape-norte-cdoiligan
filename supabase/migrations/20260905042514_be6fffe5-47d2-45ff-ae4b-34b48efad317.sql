ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS place_id text;
CREATE UNIQUE INDEX IF NOT EXISTS shops_place_id_key ON public.shops (place_id) WHERE place_id IS NOT NULL;
DELETE FROM public.reviews;
DELETE FROM public.shops WHERE place_id IS NULL;