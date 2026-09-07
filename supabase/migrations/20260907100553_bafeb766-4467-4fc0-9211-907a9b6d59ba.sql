CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_roles_read_own" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TYPE public.claim_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.shop_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  status public.claim_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX shop_claims_pending_unique
  ON public.shop_claims (shop_id, user_id)
  WHERE status = 'pending';

GRANT SELECT, INSERT ON public.shop_claims TO authenticated;
GRANT ALL ON public.shop_claims TO service_role;

ALTER TABLE public.shop_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_claims_insert_own" ON public.shop_claims
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "shop_claims_read_own" ON public.shop_claims
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "shop_claims_admin_read" ON public.shop_claims
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "shop_claims_admin_update" ON public.shop_claims
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT UPDATE ON public.shop_claims TO authenticated;

CREATE TRIGGER shop_claims_touch_updated_at
  BEFORE UPDATE ON public.shop_claims
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();