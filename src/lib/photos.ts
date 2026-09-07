import { supabase } from "@/integrations/supabase/client";

export const PHOTO_BUCKET = "shop-photos";
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const SIGN_SECONDS = 60 * 60;

export type ShopPhoto = {
  id: string;
  shop_id: string;
  storage_path: string;
  caption: string;
  sort_order: number;
  uploaded_by: string | null;
  created_at: string;
};

export async function fetchShopPhotos(shopId: string): Promise<ShopPhoto[]> {
  const { data, error } = await supabase
    .from("shop_photos")
    .select("id, shop_id, storage_path, caption, sort_order, uploaded_by, created_at")
    .eq("shop_id", shopId)
    .order("sort_order")
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as ShopPhoto[];
}

/** One cover photo path per shop that has photos. */
export async function fetchCoverPaths(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("shop_photos")
    .select("shop_id, storage_path, sort_order, created_at")
    .order("sort_order")
    .order("created_at");
  if (error) throw new Error(error.message);
  const covers: Record<string, string> = {};
  for (const row of data ?? []) {
    if (!covers[row.shop_id]) covers[row.shop_id] = row.storage_path;
  }
  return covers;
}

export async function signPaths(paths: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return {};
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(unique, SIGN_SECONDS);
  if (error) throw new Error(error.message);
  const urls: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  }
  return urls;
}

export function photoStoragePath(userId: string, file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  return `${userId}/${crypto.randomUUID()}.${ext}`;
}

export async function uploadShopPhoto(shopId: string, userId: string, file: File, sortOrder = 0) {
  if (file.size > MAX_PHOTO_BYTES) throw new Error("Each photo must be smaller than 5 MB");
  const path = photoStoragePath(userId, file);
  const { error: upErr } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type || "image/jpeg" });
  if (upErr) throw new Error(upErr.message);
  const { error } = await supabase
    .from("shop_photos")
    .insert({ shop_id: shopId, storage_path: path, uploaded_by: userId, sort_order: sortOrder });
  if (error) throw new Error(error.message);
  return path;
}

export async function deleteShopPhoto(photo: ShopPhoto) {
  const { error } = await supabase.from("shop_photos").delete().eq("id", photo.id);
  if (error) throw new Error(error.message);
  await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);
}
