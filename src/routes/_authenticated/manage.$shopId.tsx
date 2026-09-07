import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { ShopGallery } from "@/components/ShopGallery";
import {
  DAY_LABELS,
  WEEK_ORDER,
  defaultWeek,
  type DayHours,
  type DayKey,
  type WeekHours,
} from "@/lib/hours";

export const Route = createFileRoute("/_authenticated/manage/$shopId")({
  head: () => ({
    meta: [
      { title: "Edit your cafe — Kape Norte" },
      {
        name: "description",
        content: "Update your cafe's address, description, opening hours and photos.",
      },
      { property: "og:title", content: "Edit your cafe — Kape Norte" },
      { property: "og:description", content: "Cafe owner tools for Kape Norte." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManageShop,
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
  "glass-field h-11 w-full rounded-xl border border-input px-3 text-sm text-foreground outline-none focus:border-primary";

type ShopRow = {
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
  hours: WeekHours;
  status: string;
};

function ManageShop() {
  const { shopId } = useParams({ from: "/_authenticated/manage/$shopId" });
  const [shop, setShop] = useState<ShopRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    city: "Iligan City",
    area: "",
    address: "",
    blurb: "",
    lat: "",
    lng: "",
    price_level: "2",
    tags: "",
  });
  const [hours, setHours] = useState<Record<DayKey, DayHours>>(defaultWeek());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("shops")
      .select(
        "id, slug, name, city, area, address, blurb, price_level, tags, photo_path, google_photo_url, google_photo_attribution, lat, lng, hours, status",
      )
      .eq("id", shopId)
      .maybeSingle();
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (!data) return;
    const row = data as unknown as ShopRow;
    setShop(row);
    setForm({
      name: row.name,
      city: row.city,
      area: row.area,
      address: row.address,
      blurb: row.blurb ?? "",
      lat: String(row.lat),
      lng: String(row.lng),
      price_level: String(row.price_level),
      tags: (row.tags ?? []).join(", "),
    });
    setHours({ ...defaultWeek(), ...((row.hours ?? {}) as Record<DayKey, DayHours>) });
  }, [shopId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setDay = (day: DayKey, index: 0 | 1, value: string) =>
    setHours((h) => {
      const current = h[day] ?? ["08:00", "20:00"];
      const next: DayHours = index === 0 ? [value, current[1]] : [current[0], value];
      return { ...h, [day]: next };
    });

  const toggleClosed = (day: DayKey) =>
    setHours((h) => ({ ...h, [day]: h[day] ? null : ["08:00", "20:00"] }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
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
    setBusy(true);
    const { error: err } = await supabase
      .from("shops")
      .update({
        ...parsed.data,
        hours,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 8),
      })
      .eq("id", shopId);
    setBusy(false);
    if (err) setError(err.message);
    else setNotice("Saved. Your listing is updated.");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-5 py-16 text-sm text-muted-foreground">Loading…</main>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-5 py-16">
          <h1 className="font-serif text-2xl font-semibold text-foreground">
            You don't manage this cafe
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Request access to it from your{" "}
            <Link to="/owner" className="text-primary hover:underline">
              owner dashboard
            </Link>
            .
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-5 py-10">
        <Link to="/owner" className="text-sm text-primary hover:underline">
          ← Your cafes
        </Link>
        <h1 className="mt-3 font-serif text-3xl font-semibold text-foreground">{shop.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {shop.status === "published"
            ? "Live on the directory."
            : "Waiting for review before it appears publicly."}
        </p>

        <section className="mt-8">
          <h2 className="font-serif text-xl font-semibold text-foreground">Photos</h2>
          <ShopGallery
            shopId={shop.id}
            shopName={shop.name}
            legacyPath={shop.photo_path}
            googlePhotoUrl={shop.google_photo_url}
            googlePhotoAttribution={shop.google_photo_attribution}
          />
        </section>

        <form onSubmit={save} className="mt-10 flex flex-col gap-4">
          <h2 className="font-serif text-xl font-semibold text-foreground">Details</h2>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-foreground">Shop name</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={100}
              className={field}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-foreground">City</span>
              <select
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className={field}
              >
                <option>Iligan City</option>
                <option>Cagayan de Oro City</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-foreground">Barangay / area</span>
              <input
                value={form.area}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
                maxLength={80}
                className={field}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-foreground">Street address</span>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              maxLength={200}
              className={field}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-foreground">Short description</span>
            <textarea
              value={form.blurb}
              onChange={(e) => setForm({ ...form, blurb: e.target.value })}
              maxLength={400}
              rows={3}
              className="glass-field w-full rounded-xl border border-input p-3 text-sm text-foreground outline-none focus:border-primary"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-foreground">Latitude</span>
              <input
                value={form.lat}
                onChange={(e) => setForm({ ...form, lat: e.target.value })}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-foreground">Longitude</span>
              <input
                value={form.lng}
                onChange={(e) => setForm({ ...form, lng: e.target.value })}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-foreground">Price</span>
              <select
                value={form.price_level}
                onChange={(e) => setForm({ ...form, price_level: e.target.value })}
                className={field}
              >
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
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              maxLength={200}
              className={field}
            />
          </label>

          <fieldset className="glass-panel rounded-2xl p-4">
            <legend className="px-1 text-sm font-medium text-foreground">Opening hours</legend>
            <div className="mt-2 flex flex-col gap-2">
              {WEEK_ORDER.map((day) => {
                const value = hours[day];
                return (
                  <div key={day} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="w-24 text-foreground">{DAY_LABELS[day]}</span>
                    {value ? (
                      <>
                        <input
                          type="time"
                          value={value[0]}
                          onChange={(e) => setDay(day, 0, e.target.value)}
                          aria-label={`${DAY_LABELS[day]} opening time`}
                          className="h-9 rounded-lg border border-input bg-background/40 px-2 text-foreground"
                        />
                        <span className="text-muted-foreground">to</span>
                        <input
                          type="time"
                          value={value[1]}
                          onChange={(e) => setDay(day, 1, e.target.value)}
                          aria-label={`${DAY_LABELS[day]} closing time`}
                          className="h-9 rounded-lg border border-input bg-background/40 px-2 text-foreground"
                        />
                      </>
                    ) : (
                      <span className="text-muted-foreground">Closed</span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleClosed(day)}
                      className="text-primary hover:underline"
                    >
                      {value ? "Mark closed" : "Set hours"}
                    </button>
                  </div>
                );
              })}
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={busy}
            className="h-11 rounded-xl bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
        </form>
      </main>
    </div>
  );
}
