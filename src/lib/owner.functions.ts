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

async function assertAdmin(context: { supabase: any; userId: string }) {
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
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
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
    return (data ?? []).map((row: any) => ({
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
  .inputValidator((input: { claimId: string; approve: boolean }) => {
    if (typeof input?.claimId !== "string" || input.claimId.length < 10) {
      throw new Error("Invalid claim");
    }
    return { claimId: input.claimId, approve: Boolean(input.approve) };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: claim, error } = await context.supabase
      .from("shop_claims")
      .select("id, shop_id, user_id, status")
      .eq("id", data.claimId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!claim) throw new Error("Claim not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.approve) {
      const { error: shopErr } = await supabaseAdmin
        .from("shops")
        .update({ submitted_by: claim.user_id })
        .eq("id", claim.shop_id);
      if (shopErr) throw new Error(shopErr.message);
    }

    const { error: claimErr } = await supabaseAdmin
      .from("shop_claims")
      .update({
        status: data.approve ? "approved" : "rejected",
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", claim.id);
    if (claimErr) throw new Error(claimErr.message);

    return { ok: true };
  });
