import { useEffect, useState } from "react";
import { fetchCoverPaths, signPaths } from "@/lib/photos";
import type { Shop } from "@/lib/hours";

/** Map of shop id -> signed cover photo URL, for the list and the map. */
export function useCoverPhotos(shops: Shop[]) {
  const [covers, setCovers] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      shops.filter((shop) => shop.google_photo_url).map((shop) => [shop.id, shop.google_photo_url]),
    ) as Record<string, string>,
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const googleCovers = Object.fromEntries(
        shops
          .filter((shop) => shop.google_photo_url)
          .map((shop) => [shop.id, shop.google_photo_url]),
      ) as Record<string, string>;
      try {
        const paths = await fetchCoverPaths();
        const urls = await signPaths(Object.values(paths));
        if (!active) return;
        const byShop: Record<string, string> = { ...googleCovers };
        for (const [shopId, path] of Object.entries(paths)) {
          const url = urls[path];
          if (url) byShop[shopId] = url;
        }
        setCovers(byShop);
      } catch {
        if (active) setCovers(googleCovers);
      }
    })();
    return () => {
      active = false;
    };
  }, [shops]);

  return covers;
}
