CREATE TABLE public.page_views (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, path TEXT NOT NULL DEFAULT '/', referrer TEXT NOT NULL DEFAULT '', created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now());
GRANT INSERT ON public.page_views TO anon;
GRANT INSERT, SELECT ON public.page_views TO authenticated;
GRANT ALL ON public.page_views TO service_role;
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "page_views_public_insert" ON public.page_views FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "page_views_admin_read" ON public.page_views FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX page_views_created_at_idx ON public.page_views (created_at);