DROP INDEX IF EXISTS public.shops_place_id_key;
ALTER TABLE public.shops ADD CONSTRAINT shops_place_id_key UNIQUE (place_id);