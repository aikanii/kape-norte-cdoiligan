import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ClaimRow = {
  id: string;
  shop_id: string;
  user_id: string;
  contact_name: string;
  contact_email: string;
  phone: string;
  message: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  shop_name: string;
  shop_city: string;
  shop_area: string;
};

export async function assertAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("Forbidden");
}

export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<boolean> => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) throw new Error(error.message);
    return data === true;
  });

export const listClaims = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ClaimRow[]> => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("shop_claims")
      .select(
        "id, shop_id, user_id, contact_name, contact_email, phone, message, status, created_at, shops(name, city, area)",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id,
      shop_id: row.shop_id,
      user_id: row.user_id,
      contact_name: row.contact_name,
      contact_email: row.contact_email,
      phone: row.phone,
      message: row.message,
      status: row.status,
      created_at: row.created_at,
      shop_name: row.shops?.name ?? "Unknown cafe",
      shop_city: row.shops?.city ?? "",
      shop_area: row.shops?.area ?? "",
    }));
  });

export const decideClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ claimId: z.string().uuid(), approve: z.boolean() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.rpc("review_shop_claim", {
      _claim_id: data.claimId,
      _approve: data.approve,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPendingShops = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("shops")
      .select("id, name, city, area, address, blurb")
      .eq("status", "pending")
      .order("created_at");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const publishShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ shopId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.rpc("publish_shop", { _shop_id: data.shopId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
