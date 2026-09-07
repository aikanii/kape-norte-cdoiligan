import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { useSession } from "@/hooks/useSession";
import {
  DAY_LABELS,
  WEEK_ORDER,
  defaultWeek,
  type DayHours,
  type DayKey,
} from "@/lib/hours";
import { PHOTO_BUCKET, photoStoragePath } from "@/lib/photos";

export const Route = createFileRoute("/_authenticated/submit")({
  head: () => ({
    meta: [
      { title: "Add your cafe — Kape Norte" },
      {
        name: "description",
        content:
          "Coffee shop owners in Iligan and Cagayan de Oro: add your cafe with photos, address and opening hours.",
      },
      { property: "og:title", content: "Add your cafe — Kape Norte" },
      {
        property: "og:description",
        content: "List your coffee shop on Kape Norte with photos and opening hours.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SubmitPage,
});

const schema = z.object({
  name: z.string().trim().min(2, "Enter the shop name").max(100),
  city: z.string().trim().min(2).max(80),
  area: z.string().trim().min(2, "Enter the barangay or area").max(80),
  address: z.string().trim().min(5, "Enter the street address").max(200),
  blurb: z.string().trim().max(400),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  price_level: z.number().int().min(1).max(3),
});

const field =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary";

function SubmitPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    city: "Iligan City",
    area: "",
    address: "",
    blurb: "",
    lat: "8.2289",
    lng: "124.2404",
    price_level: "2",
    tags: "",
  });
  const [hours, setHours] = useState<Record<DayKey, DayHours>>(defaultWeek());
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const setDay = (day: DayKey, index: 0 | 1, value: string) =>
    setHours((h) => {
      const current = h[day] ?? ["08:00", "20:00"];
      const next: DayHours = index === 0 ? [value, current[1]] : [current[0], value];
      return { ...h, [day]: next };
    });

  const toggleClosed = (day: DayKey) =>
    setHours((h) => ({ ...h, [day]: h[day] ? null : ["08:00", "20:00"] }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!user) return;

    const parsed = schema.safeParse({
      ...form,
      lat: Number(form.lat),
      lng: Number(form.lng),
      price_level: Number(form.price_level),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    if (photos.some((p) => p.size > 5 * 1024 * 1024)) {
      setError("Each photo must be smaller than 5 MB");
      return;
    }

    setBusy(true);
    const photoPaths: string[] = [];
    for (const photo of photos.slice(0, 8)) {
      const path = photoStoragePath(user.id, photo);
      const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, photo, {
        contentType: photo.type || "image/jpeg",
      });
      if (upErr) {
        setBusy(false);
        setError(`Photo upload failed: ${upErr.message}`);
        return;
      }
      photoPaths.push(path);
    }
    const photoPath = photoPaths[0] ?? null;

    const slug =
      parsed.data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60) + `-${Math.random().toString(36).slice(2, 6)}`;

    const { data: inserted, error: insErr } = await supabase.from("shops").insert({
      ...parsed.data,
      slug,
      photo_path: photoPath,
      hours,
      status: "pending",
      submitted_by: user.id,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 8),
    }).select("id").single();
    if (insErr) {
      setBusy(false);
      setError(insErr.message);
      return;
    }
    if (inserted && photoPaths.length > 0) {
      await supabase.from("shop_photos").insert(
        photoPaths.map((path, i) => ({
          shop_id: inserted.id,
          storage_path: path,
          uploaded_by: user.id,
          sort_order: i,
        })),
      );
    }
    setBusy(false);
    setDone(true);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-5 py-16 text-center">
          <h1 className="font-serif text-3xl font-semibold text-foreground">Thanks!</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your cafe was submitted and is waiting for review before it appears on the map.
          </p>
          <button
            onClick={() => navigate({ to: "/" })}
            className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Back to the directory
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-5 py-10">
        <h1 className="font-serif text-3xl font-semibold text-foreground">Add your cafe</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tell us where you are and when you're open. Listings appear once reviewed.
        </p>

        <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-foreground">Shop name</span>
            <input value={form.name} onChange={set("name")} maxLength={100} className={field} />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-foreground">City</span>
              <select value={form.city} onChange={set("city")} className={field}>
                <option>Iligan City</option>
                <option>Cagayan de Oro City</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-foreground">Barangay / area</span>
              <input value={form.area} onChange={set("area")} maxLength={80} className={field} />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-foreground">Street address</span>
            <input
              value={form.address}
              onChange={set("address")}
              maxLength={200}
              className={field}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-foreground">Short description</span>
            <textarea
              value={form.blurb}
              onChange={set("blurb")}
              maxLength={400}
              rows={3}
              className="w-full rounded-lg border border-input bg-background p-3 text-sm text-foreground outline-none focus:border-primary"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-foreground">Latitude</span>
              <input value={form.lat} onChange={set("lat")} className={field} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-foreground">Longitude</span>
              <input value={form.lng} onChange={set("lng")} className={field} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-foreground">Price</span>
              <select value={form.price_level} onChange={set("price_level")} className={field}>
                <option value="1">₱ budget</option>
                <option value="2">₱₱ mid</option>
                <option value="3">₱₱₱ premium</option>
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-foreground">Tags (comma separated)</span>
            <input
              value={form.tags}
              onChange={set("tags")}
              placeholder="Wi-Fi, Pastries, Outdoor seating"
              maxLength={200}
              className={field}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-foreground">Photos (optional, max 5 MB each)</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
              className="text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:text-foreground"
            />
          </label>

          <fieldset className="rounded-2xl border border-border bg-card p-4">
            <legend className="px-1 text-sm font-medium text-foreground">Opening hours</legend>
            <div className="mt-2 flex flex-col gap-2">
              {WEEK_ORDER.map((day) => {
                const value = hours[day];
                return (
                  <div key={day} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="w-24 text-muted-foreground">{DAY_LABELS[day]}</span>
                    <input
                      type="time"
                      value={value?.[0] ?? ""}
                      disabled={!value}
                      onChange={(e) => setDay(day, 0, e.target.value)}
                      className="h-9 rounded-lg border border-input bg-background px-2 text-sm text-foreground disabled:opacity-40"
                    />
                    <span className="text-muted-foreground">to</span>
                    <input
                      type="time"
                      value={value?.[1] ?? ""}
                      disabled={!value}
                      onChange={(e) => setDay(day, 1, e.target.value)}
                      className="h-9 rounded-lg border border-input bg-background px-2 text-sm text-foreground disabled:opacity-40"
                    />
                    <label className="ml-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={!value}
                        onChange={() => toggleClosed(day)}
                        className="h-3.5 w-3.5"
                      />
                      Closed
                    </label>
                  </div>
                );
              })}
            </div>
          </fieldset>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="h-11 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Submitting…" : "Submit listing"}
          </button>
        </form>
      </main>
    </div>
  );
}
