CREATE TYPE public.shop_status AS ENUM ('pending', 'published');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Coffee lover',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name', ''), split_part(NEW.email, '@', 1), 'Coffee lover'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  city text NOT NULL,
  area text NOT NULL,
  address text NOT NULL,
  blurb text NOT NULL DEFAULT '',
  price_level smallint NOT NULL DEFAULT 2,
  tags text[] NOT NULL DEFAULT '{}',
  photo_path text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.shop_status NOT NULL DEFAULT 'pending',
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shops TO anon;
GRANT SELECT, INSERT, UPDATE ON public.shops TO authenticated;
GRANT ALL ON public.shops TO service_role;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shops_public_read" ON public.shops FOR SELECT USING (status = 'published');
CREATE POLICY "shops_owner_read" ON public.shops FOR SELECT TO authenticated USING (auth.uid() = submitted_by);
CREATE POLICY "shops_insert_own" ON public.shops FOR INSERT TO authenticated WITH CHECK (auth.uid() = submitted_by AND status = 'pending');
CREATE POLICY "shops_update_own" ON public.shops FOR UPDATE TO authenticated USING (auth.uid() = submitted_by) WITH CHECK (auth.uid() = submitted_by);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER shops_touch_updated_at BEFORE UPDATE ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, user_id)
);
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_public_read" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert_own" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_update_own" ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_delete_own" ON public.reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "shop_photos_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'shop-photos');
CREATE POLICY "shop_photos_auth_upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'shop-photos');

INSERT INTO public.shops (slug, name, city, area, address, blurb, price_level, tags, lat, lng, hours, status) VALUES
('bluewater-brew','Bluewater Brew','Iligan City','Pala-o','Roxas Ave, Pala-o, Iligan City','Quiet second-floor cafe with long tables and plenty of outlets.',2,'{"Wi-Fi","Study spot","Air-conditioned"}',8.2296,124.2452,'{"mon":["07:00","22:00"],"tue":["07:00","22:00"],"wed":["07:00","22:00"],"thu":["07:00","22:00"],"fri":["07:00","22:00"],"sat":["07:00","22:00"],"sun":["07:00","22:00"]}','published'),
('maria-cristina-coffee','Maria Cristina Coffee House','Iligan City','Poblacion','Quezon Ave, Poblacion, Iligan City','Single-origin pour-overs and warm butter croissants by the plaza.',2,'{"Pour-over","Pastries","Wi-Fi"}',8.2289,124.2404,'{"mon":["08:00","21:00"],"tue":["08:00","21:00"],"wed":["08:00","21:00"],"thu":["08:00","21:00"],"fri":["08:00","21:00"],"sat":["08:00","21:00"],"sun":null}','published'),
('tibanga-roasters','Tibanga Roasters','Iligan City','Tibanga','Andres Bonifacio Ave, Tibanga, Iligan City','In-house roastery near the university belt, busy with students.',2,'{"Roastery","Late night","Parking"}',8.2418,124.2461,'{"mon":["07:30","23:00"],"tue":["07:30","23:00"],"wed":["07:30","23:00"],"thu":["07:30","23:00"],"fri":["07:30","23:00"],"sat":["07:30","23:00"],"sun":["09:00","20:00"]}','published'),
('pala-o-pourover','Pala-o Pour Over Bar','Iligan City','Pala-o','Mahayahay Rd, Pala-o, Iligan City','Six-seat bar focused on manual brews and rotating local beans.',3,'{"Specialty","Small batch","Pet-friendly"}',8.2331,124.2408,'{"mon":null,"tue":["09:00","20:00"],"wed":["09:00","20:00"],"thu":["09:00","20:00"],"fri":["09:00","20:00"],"sat":["09:00","20:00"],"sun":["09:00","18:00"]}','published'),
('buhanginan-cafe','Buhanginan Cafe','Iligan City','Tibanga','Tibanga Highway, Iligan City','Open-air spot with cheap brewed coffee and garlic rice at midnight.',1,'{"Budget","Late night","Outdoor seating"}',8.2445,124.2385,'{"mon":["08:00","24:00"],"tue":["08:00","24:00"],"wed":["08:00","24:00"],"thu":["08:00","24:00"],"fri":["08:00","24:00"],"sat":["08:00","24:00"],"sun":["08:00","24:00"]}','published'),
('santiago-street-coffee','Santiago Street Coffee','Iligan City','Santiago','Santiago St, Iligan City','Tiny takeaway window doing solid iced lattes for the morning rush.',1,'{"Takeaway","Fast service"}',8.2258,124.2432,'{"mon":["07:00","19:00"],"tue":["07:00","19:00"],"wed":["07:00","19:00"],"thu":["07:00","19:00"],"fri":["07:00","19:00"],"sat":["07:00","19:00"],"sun":null}','published'),
('divisoria-daily','Divisoria Daily','Cagayan de Oro City','Divisoria','Divisoria, Cagayan de Oro City','Right at the plaza — reliable Wi-Fi and seating for big groups.',2,'{"Wi-Fi","Group tables","Air-conditioned"}',8.4791,124.6459,'{"mon":["07:00","23:00"],"tue":["07:00","23:00"],"wed":["07:00","23:00"],"thu":["07:00","23:00"],"fri":["07:00","23:00"],"sat":["07:00","23:00"],"sun":["07:00","23:00"]}','published'),
('limketkai-lab','Limketkai Coffee Lab','Cagayan de Oro City','Lapasan','Limketkai Drive, Lapasan, Cagayan de Oro City','Mall-side cafe with espresso flights and seasonal cold brews.',3,'{"Specialty","Desserts","Parking"}',8.4834,124.6552,'{"mon":["10:00","22:00"],"tue":["10:00","22:00"],"wed":["10:00","22:00"],"thu":["10:00","22:00"],"fri":["10:00","22:00"],"sat":["10:00","22:00"],"sun":["10:00","22:00"]}','published'),
('carmen-corner-brew','Carmen Corner Brew','Cagayan de Oro City','Carmen','Vamenta Blvd, Carmen, Cagayan de Oro City','Neighborhood corner shop that opens before sunrise.',1,'{"Budget","Breakfast","Takeaway"}',8.4805,124.6262,'{"mon":["06:30","21:00"],"tue":["06:30","21:00"],"wed":["06:30","21:00"],"thu":["06:30","21:00"],"fri":["06:30","21:00"],"sat":["06:30","21:00"],"sun":["06:30","18:00"]}','published'),
('nazareth-slow-bar','Nazareth Slow Bar','Cagayan de Oro City','Nazareth','Corrales Ext, Nazareth, Cagayan de Oro City','Slow bar service, house-roasted beans, no laptops after 5 PM.',3,'{"Pour-over","Quiet","Pet-friendly"}',8.4667,124.6446,'{"mon":null,"tue":["09:00","20:00"],"wed":["09:00","20:00"],"thu":["09:00","20:00"],"fri":["09:00","20:00"],"sat":["09:00","20:00"],"sun":["09:00","20:00"]}','published'),
('pueblo-highlands','Pueblo Highlands Coffee','Cagayan de Oro City','Pueblo de Oro','Pueblo de Oro, Cagayan de Oro City','Hillside patio with a city view, best at golden hour.',2,'{"View","Outdoor seating","Parking"}',8.4571,124.6707,'{"mon":["08:00","22:00"],"tue":["08:00","22:00"],"wed":["08:00","22:00"],"thu":["08:00","22:00"],"fri":["08:00","22:00"],"sat":["08:00","23:00"],"sun":["08:00","23:00"]}','published'),
('cogon-night-roast','Cogon Night Roast','Cagayan de Oro City','Cogon','Osmeña St, Cogon, Cagayan de Oro City','Opens in the afternoon and runs deep into the night.',1,'{"Late night","Budget","Wi-Fi"}',8.4744,124.6483,'{"mon":["16:00","27:00"],"tue":["16:00","27:00"],"wed":["16:00","27:00"],"thu":["16:00","27:00"],"fri":["16:00","27:00"],"sat":["16:00","27:00"],"sun":["16:00","27:00"]}','published');