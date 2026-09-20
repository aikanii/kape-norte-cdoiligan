import { createIsomorphicFn } from "@tanstack/react-start";
import type { Shop, WeekHours } from "@/lib/hours";

// Public reads do not need an RPC through the app server. The browser can reach
// Supabase even when the SSR host has restricted outbound networking.
const readClient = createIsomorphicFn()
  .server(async () => {
    const { publicClient } = await import("@/integrations/supabase/public.server");
    return publicClient();
  })
  .client(async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    return supabase;
  });

const SHOP_COLUMNS =
  "id, slug, name, city, area, address, blurb, price_level, tags, photo_path, google_photo_url, google_photo_attribution, lat, lng, hours";

type Row = {
  id: string;
  slug: string;
  name: string;
  city: string;
  area: string;
  address: string;
  blurb: string;
  price_level: number;
  tags: string[];
  photo_path: string | null;
  google_photo_url: string | null;
  google_photo_attribution: string | null;
  lat: number;
  lng: number;
  hours: unknown;
};

export type GuideShop = Shop & {
  average_rating: number | null;
  review_count: number;
};

const toShop = (row: Row): Shop => ({
  ...row,
  city: row.city === "Cagayan de Oro" ? "Cagayan de Oro City" : row.city,
  hours: (row.hours ?? {}) as WeekHours,
});

export async function listShops(): Promise<Shop[]> {
  const client = await readClient();
  const { data, error } = await client
    .from("shops")
    .select(SHOP_COLUMNS)
    .eq("status", "published")
    .order("name")
    .retry(false)
    .abortSignal(AbortSignal.timeout(8_000));
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Row[]).map(toShop);
}

export async function listGuideShops(): Promise<GuideShop[]> {
  const client = await readClient();
  const [{ data: shopRows, error: shopsError }, { data: reviews, error: reviewsError }] =
    await Promise.all([
      client
        .from("shops")
        .select(SHOP_COLUMNS)
        .eq("status", "published")
        .order("name")
        .retry(false)
        .abortSignal(AbortSignal.timeout(8_000)),
      client
        .from("reviews")
        .select("shop_id, rating")
        .retry(false)
        .abortSignal(AbortSignal.timeout(8_000)),
    ]);
  if (shopsError) throw new Error(shopsError.message);
  if (reviewsError) throw new Error(reviewsError.message);

  const ratings = new Map<string, { total: number; count: number }>();
  for (const review of reviews ?? []) {
    const current = ratings.get(review.shop_id) ?? { total: 0, count: 0 };
    ratings.set(review.shop_id, {
      total: current.total + review.rating,
      count: current.count + 1,
    });
  }

  return ((shopRows ?? []) as unknown as Row[]).map((row) => {
    const shop = toShop(row);
    const rating = ratings.get(shop.id);
    return {
      ...shop,
      average_rating: rating ? Math.round((rating.total / rating.count) * 10) / 10 : null,
      review_count: rating?.count ?? 0,
    };
  });
}

export async function getShopBySlug({ data }: { data: { slug: string } }): Promise<Shop | null> {
  const client = await readClient();
  const { data: row, error } = await client
    .from("shops")
    .select(SHOP_COLUMNS)
    .eq("status", "published")
    .eq("slug", String(data.slug).slice(0, 120))
    .abortSignal(AbortSignal.timeout(8_000))
    .maybeSingle()
    .retry(false);
  if (error) throw new Error(error.message);
  return row ? toShop(row as unknown as Row) : null;
}
