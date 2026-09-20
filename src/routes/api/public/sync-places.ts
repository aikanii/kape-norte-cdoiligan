import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/sync-places")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env["PLACES_SYNC_TOKEN"];
        const provided = request.headers.get("x-sync-token");
        if (!token || provided !== token) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { fetchCoffeeShops, fetchPlacePhotoCovers } = await import("@/lib/places.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let shops;
        try {
          shops = await fetchCoffeeShops();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          return new Response(`Places lookup failed: ${message}`, { status: 502 });
        }

        if (shops.length === 0) {
          return Response.json({ imported: 0, note: "No coffee shops returned." });
        }

        // A refresh must not overwrite owner edits or change already-published URLs.
        const { data: existingRows, error: existingError } = await supabaseAdmin
          .from("shops")
          .select(
            "place_id, slug, submitted_by, google_photo_url, google_photo_attribution, google_photo_refreshed_at",
          )
          .in(
            "place_id",
            shops.map((shop) => shop.place_id),
          );
        if (existingError)
          return new Response("Could not check existing listings", { status: 500 });
        const existing = new Map((existingRows ?? []).map((shop) => [shop.place_id, shop]));
        const updates = shops
          .filter((shop) => !existing.get(shop.place_id)?.submitted_by)
          .map((shop) => {
            const previous = existing.get(shop.place_id);
            return {
              ...shop,
              slug: previous?.slug ?? shop.slug,
              google_photo_url: shop.google_photo_url ?? previous?.google_photo_url ?? null,
              google_photo_attribution: shop.google_photo_url
                ? shop.google_photo_attribution
                : (previous?.google_photo_attribution ?? null),
              google_photo_refreshed_at:
                shop.google_photo_refreshed_at ?? previous?.google_photo_refreshed_at ?? null,
            };
          });
        const { error } = updates.length
          ? await supabaseAdmin.from("shops").upsert(updates, { onConflict: "place_id" })
          : { error: null };
        if (error) {
          console.error("Shop upsert failed", error);
          return new Response(`Save failed: ${error.message}`, { status: 500 });
        }

        const { data: missingRows, error: missingError } = await supabaseAdmin
          .from("shops")
          .select("place_id")
          .eq("status", "published")
          .is("google_photo_url", null)
          .not("place_id", "is", null)
          .limit(30);
        if (missingError) {
          console.error("Missing photo lookup failed", missingError);
          return new Response(`Photo lookup failed: ${missingError.message}`, { status: 500 });
        }

        const covers = await fetchPlacePhotoCovers(
          (missingRows ?? [])
            .map((row) => row.place_id)
            .filter((placeId): placeId is string => Boolean(placeId)),
        );
        for (const cover of covers) {
          const { error: coverError } = await supabaseAdmin
            .from("shops")
            .update({
              google_photo_url: cover.url,
              google_photo_attribution: cover.attribution,
              google_photo_refreshed_at: cover.refreshedAt,
            })
            .eq("place_id", cover.placeId);
          if (coverError) console.error("Cafe cover update failed", coverError);
        }

        return Response.json({
          imported: updates.length,
          preservedOwnerListings: shops.length - updates.length,
          photos: shops.filter((shop) => shop.google_photo_url).length + covers.length,
        });
      },
    },
  },
});
