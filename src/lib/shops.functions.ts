import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Shop, WeekHours } from "@/lib/hours";

const SHOP_COLUMNS =
  "id, slug, name, city, area, address, blurb, price_level, tags, photo_path, google_photo_url, google_photo_attribution, lat, lng, hours";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

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

const toShop = (row: Row): Shop => ({ ...row, hours: (row.hours ?? {}) as WeekHours });

export const listShops = createServerFn({ method: "GET" }).handler(async (): Promise<Shop[]> => {
  const { data, error } = await publicClient()
    .from("shops")
    .select(SHOP_COLUMNS)
    .eq("status", "published")
    .order("name");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Row[]).map(toShop);
});

export const listGuideShops = createServerFn({ method: "GET" }).handler(
  async (): Promise<GuideShop[]> => {
    const client = publicClient();
    const [{ data: shopRows, error: shopsError }, { data: reviews, error: reviewsError }] =
      await Promise.all([
        client.from("shops").select(SHOP_COLUMNS).eq("status", "published").order("name"),
        client.from("reviews").select("shop_id, rating"),
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
  },
);

export const getShopBySlug = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => ({ slug: String(data.slug).slice(0, 120) }))
  .handler(async ({ data }): Promise<Shop | null> => {
    const { data: row, error } = await publicClient()
      .from("shops")
      .select(SHOP_COLUMNS)
      .eq("status", "published")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ? toShop(row as unknown as Row) : null;
  });
