import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSession } from "@/hooks/useSession";
import {
  deleteShopPhoto,
  fetchShopPhotos,
  signPaths,
  uploadShopPhoto,
  type ShopPhoto,
} from "@/lib/photos";

export function ShopGallery({
  shopId,
  shopName,
  legacyPath,
  googlePhotoUrl,
  googlePhotoAttribution,
}: {
  shopId: string;
  shopName: string;
  legacyPath?: string | null;
  googlePhotoUrl?: string | null;
  googlePhotoAttribution?: string | null;
}) {
  const { user } = useSession();
  const [photos, setPhotos] = useState<ShopPhoto[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [legacyUrl, setLegacyUrl] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await fetchShopPhotos(shopId);
      const signed = await signPaths([
        ...rows.map((r) => r.storage_path),
        ...(legacyPath ? [legacyPath] : []),
      ]);
      setPhotos(rows);
      setUrls(signed);
      setLegacyUrl(legacyPath ? (signed[legacyPath] ?? null) : null);
      setActive(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load photos");
    }
  }, [shopId, legacyPath]);

  useEffect(() => {
    void load();
  }, [load]);

  const onFiles = async (files: FileList | null) => {
    if (!files || !user) return;
    setError(null);
    setBusy(true);
    try {
      let order = photos.length;
      for (const file of Array.from(files).slice(0, 6)) {
        await uploadShopPhoto(shopId, user.id, file, order);
        order += 1;
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (photo: ShopPhoto) => {
    setError(null);
    setBusy(true);
    try {
      await deleteShopPhoto(photo);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete that photo");
    } finally {
      setBusy(false);
    }
  };

  const gallery = photos
    .map((p) => ({ photo: p, url: urls[p.storage_path] }))
    .filter((item): item is { photo: ShopPhoto; url: string } => Boolean(item.url));

  const hero = gallery[active] ?? null;

  return (
    <section className="mt-5">
      {hero ? (
        <figure>
          <img
            src={hero.url}
            alt={hero.photo.caption || `${shopName} photo`}
            loading="lazy"
            className="h-72 w-full rounded-2xl border border-border object-cover"
          />
          {hero.photo.caption && (
            <figcaption className="mt-2 text-xs text-muted-foreground">
              {hero.photo.caption}
            </figcaption>
          )}
        </figure>
      ) : legacyUrl ? (
        <img
          src={legacyUrl}
          alt={shopName}
          loading="lazy"
          className="h-72 w-full rounded-2xl border border-border object-cover"
        />
      ) : googlePhotoUrl ? (
        <figure>
          <img
            src={googlePhotoUrl}
            alt={`${shopName} cafe`}
            loading="eager"
            className="h-72 w-full rounded-2xl border border-border object-cover"
          />
          {googlePhotoAttribution && (
            <figcaption className="mt-2 text-xs text-muted-foreground">
              Photo by {googlePhotoAttribution}
            </figcaption>
          )}
        </figure>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
          No photos yet — be the first to add one.
        </div>
      )}

      {gallery.length > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {gallery.map((item, i) => (
            <li key={item.photo.id}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show photo ${i + 1}`}
                className={`h-16 w-24 overflow-hidden rounded-lg border ${
                  i === active ? "border-primary" : "border-border"
                }`}
              >
                <img
                  src={item.url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {user ? (
          <>
            <label className="cursor-pointer rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:border-primary">
              {busy ? "Uploading…" : "Add photos"}
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={busy}
                onChange={(e) => {
                  void onFiles(e.target.files);
                  e.target.value = "";
                }}
                className="hidden"
              />
            </label>
            {hero && hero.photo.uploaded_by === user.id && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove(hero.photo)}
                className="text-sm text-destructive hover:underline disabled:opacity-60"
              >
                Delete this photo
              </button>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            <Link to="/auth" className="text-primary hover:underline">
              Sign in
            </Link>{" "}
            to add photos of this cafe.
          </p>
        )}
        <span className="text-xs text-muted-foreground">JPG or PNG, up to 5 MB each.</span>
      </div>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </section>
  );
}
