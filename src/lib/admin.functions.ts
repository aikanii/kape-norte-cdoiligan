import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const recordPageView = createServerFn({ method: "POST" })
  .inputValidator((input: { path: string }) => {
    const path = typeof input?.path === "string" ? input.path.slice(0, 200) : "/";
    return { path: path.startsWith("/") ? path : "/" };
  })
  .handler(async ({ data }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabasePublic = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
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
    await supabasePublic.from("page_views").insert({ path: data.path });
    return { ok: true };
  });

export type AdminStats = {
  views: { total: number; last7Days: number; last30Days: number; today: number };
  dailyViews: { date: string; count: number }[];
  topPages: { path: string; count: number }[];
  reviews: { total: number; last30Days: number; averageRating: number };
  topReviewedShops: { name: string; city: string; count: number; average: number }[];
  shops: { total: number; published: number; pending: number };
  photos: number;
  claims: { pending: number; approved: number; rejected: number };
  signups: { total: number; last30Days: number };
};

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminStats> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (isAdmin !== true) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const since30 = new Date(now - 30 * dayMs).toISOString();
    const since7 = new Date(now - 7 * dayMs).toISOString();

    const [
      viewsTotal,
      views30,
      viewRows30,
      reviewRows,
      reviews30,
      shopRows,
      photosTotal,
      claimRows,
      profileRows,
    ] = await Promise.all([
      supabaseAdmin.from("page_views").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("page_views")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since30),
      supabaseAdmin
        .from("page_views")
        .select("path, created_at")
        .gte("created_at", since30)
        .order("created_at", { ascending: false })
        .limit(5000),
      supabaseAdmin
        .from("reviews")
        .select("rating, created_at, shops(name, city)")
        .order("created_at", { ascending: false })
        .limit(5000),
      supabaseAdmin
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since30),
      supabaseAdmin.from("shops").select("id, status"),
      supabaseAdmin.from("shop_photos").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("shop_claims").select("id, status"),
      supabaseAdmin.from("profiles").select("id, created_at"),
    ]);

    const views = viewRows30.data ?? [];
    const todayKey = new Date(now).toISOString().slice(0, 10);

    // Daily views for the last 14 days
    const dailyMap = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      dailyMap.set(new Date(now - i * dayMs).toISOString().slice(0, 10), 0);
    }
    const pathMap = new Map<string, number>();
    let views7 = 0;
    let viewsToday = 0;
    for (const v of views) {
      const day = v.created_at.slice(0, 10);
      if (dailyMap.has(day)) dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
      if (v.created_at >= since7) views7++;
      if (day === todayKey) viewsToday++;
      pathMap.set(v.path, (pathMap.get(v.path) ?? 0) + 1);
    }

    const topPages = [...pathMap.entries()]
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const reviews = reviewRows.data ?? [];
    const ratingSum = reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0);
    const shopMap = new Map<string, { name: string; city: string; count: number; sum: number }>();
    for (const r of reviews) {
      const shop = (r as any).shops;
      const name = shop?.name ?? "Unknown cafe";
      const city = shop?.city ?? "";
      const entry = shopMap.get(name) ?? { name, city, count: 0, sum: 0 };
      entry.count++;
      entry.sum += r.rating ?? 0;
      shopMap.set(name, entry);
    }
    const topReviewedShops = [...shopMap.values()]
      .map((s) => ({ name: s.name, city: s.city, count: s.count, average: Math.round((s.sum / s.count) * 10) / 10 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const shops = shopRows.data ?? [];
    const claims = claimRows.data ?? [];
    const profiles = profileRows.data ?? [];

    return {
      views: {
        total: viewsTotal.count ?? 0,
        last7Days: views7,
        last30Days: views30.count ?? 0,
        today: viewsToday,
      },
      dailyViews: [...dailyMap.entries()].map(([date, count]) => ({ date, count })),
      topPages,
      reviews: {
        total: reviews.length,
        last30Days: reviews30.count ?? 0,
        averageRating: reviews.length ? Math.round((ratingSum / reviews.length) * 10) / 10 : 0,
      },
      topReviewedShops,
      shops: {
        total: shops.length,
        published: shops.filter((s) => s.status === "published").length,
        pending: shops.filter((s) => s.status === "pending").length,
      },
      photos: photosTotal.count ?? 0,
      claims: {
        pending: claims.filter((c) => c.status === "pending").length,
        approved: claims.filter((c) => c.status === "approved").length,
        rejected: claims.filter((c) => c.status === "rejected").length,
      },
      signups: {
        total: profiles.length,
        last30Days: profiles.filter((p) => p.created_at >= since30).length,
      },
    };
  });
