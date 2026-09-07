import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/owner")({
  head: () => ({
    meta: [
      { title: "Owner dashboard — Kape Norte" },
      {
        name: "description",
        content: "Update your cafe's details, hours and photos, or request access to your listing.",
      },
      { property: "og:title", content: "Owner dashboard — Kape Norte" },
      {
        property: "og:description",
        content: "Cafe owner tools for the Kape Norte coffee directory.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OwnerDashboard,
});

type MyShop = { id: string; name: string; city: string; area: string; status: string };
type MyClaim = {
  id: string;
  status: string;
  created_at: string;
  shops: { name: string; city: string } | null;
};
type Candidate = { id: string; name: string; city: string; area: string };

const claimSchema = z.object({
  contact_name: z.string().trim().min(2, "Enter your name").max(100),
  contact_email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().max(40),
  message: z.string().trim().max(500),
});

const field =
  "glass-field h-11 w-full rounded-xl border border-input px-3 text-sm text-foreground outline-none focus:border-primary";

function OwnerDashboard() {
  const { user } = useSession();
  const [shops, setShops] = useState<MyShop[]>([]);
  const [claims, setClaims] = useState<MyClaim[]>([]);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [picked, setPicked] = useState<Candidate | null>(null);
  const [form, setForm] = useState({ contact_name: "", contact_email: "", phone: "", message: "" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: shopRows }, { data: claimRows }] = await Promise.all([
      supabase
        .from("shops")
        .select("id, name, city, area, status")
        .eq("submitted_by", user.id)
        .order("name"),
      supabase
        .from("shop_claims")
        .select("id, status, created_at, shops(name, city)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);
    setShops((shopRows ?? []) as MyShop[]);
    setClaims((claimRows ?? []) as unknown as MyClaim[]);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setCandidates([]);
      return;
    }
    let active = true;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("shops")
        .select("id, name, city, area")
        .is("submitted_by", null)
        .ilike("name", `%${term}%`)
        .limit(8);
      if (active) setCandidates((data ?? []) as Candidate[]);
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query]);

  const submitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!user || !picked) {
      setError("Pick your cafe from the list first");
      return;
    }
    const parsed = claimSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.from("shop_claims").insert({
      ...parsed.data,
      shop_id: picked.id,
      user_id: user.id,
      status: "pending",
    });
    setBusy(false);
    if (err) {
      setError(
        err.code === "23505" ? "You already have a pending request for this cafe." : err.message,
      );
      return;
    }
    setNotice("Request sent. We'll review it and give you access once confirmed.");
    setPicked(null);
    setQuery("");
    setForm({ contact_name: "", contact_email: "", phone: "", message: "" });
    void load();
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="font-serif text-3xl font-semibold text-foreground">Your cafes</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Edit details, opening hours and photos for the cafes you manage.
        </p>

        <section className="mt-6 flex flex-col gap-3">
          {shops.length === 0 && (
            <p className="glass-panel rounded-2xl p-5 text-sm text-muted-foreground">
              You don't manage any cafe yet. Request access to an existing listing below, or{" "}
              <Link to="/submit" className="text-primary hover:underline">
                add a new cafe
              </Link>
              .
            </p>
          )}
          {shops.map((shop) => (
            <div
              key={shop.id}
              className="glass-panel flex items-center justify-between gap-4 rounded-2xl p-5"
            >
              <div>
                <p className="font-medium text-foreground">{shop.name}</p>
                <p className="text-sm text-muted-foreground">
                  {shop.area}, {shop.city}
                  {shop.status !== "published" && " · awaiting review"}
                </p>
              </div>
              <Link
                to="/manage/$shopId"
                params={{ shopId: shop.id }}
                className="rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Manage
              </Link>
            </div>
          ))}
        </section>

        <h2 className="mt-12 font-serif text-2xl font-semibold text-foreground">
          Claim your listing
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Find your cafe, tell us how to reach you, and we'll hand over the listing once we've
          confirmed you're the owner.
        </p>

        <form onSubmit={submitClaim} className="glass-panel mt-5 flex flex-col gap-4 rounded-3xl p-6">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-foreground">Search your cafe</span>
            <input
              value={picked ? picked.name : query}
              onChange={(e) => {
                setPicked(null);
                setQuery(e.target.value);
              }}
              placeholder="Start typing your cafe name"
              aria-label="Search for your cafe by name"
              className={field}
            />
          </label>

          {!picked && candidates.length > 0 && (
            <ul className="flex flex-col gap-1">
              {candidates.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setPicked(c)}
                    className="w-full rounded-xl border border-border px-3 py-2 text-left text-sm text-foreground hover:border-primary"
                  >
                    {c.name} <span className="text-muted-foreground">— {c.area}, {c.city}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-foreground">Your name</span>
              <input
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                maxLength={100}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-foreground">Contact email</span>
              <input
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                maxLength={255}
                className={field}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-foreground">Phone (optional)</span>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              maxLength={40}
              className={field}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-foreground">
              How can we confirm you own this cafe? (optional)
            </span>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              maxLength={500}
              rows={3}
              className="glass-field w-full rounded-xl border border-input p-3 text-sm text-foreground outline-none focus:border-primary"
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            className="h-11 rounded-xl bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Sending…" : "Request access"}
          </button>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
        </form>

        {claims.length > 0 && (
          <section className="mt-10">
            <h2 className="font-serif text-xl font-semibold text-foreground">Your requests</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {claims.map((claim) => (
                <li
                  key={claim.id}
                  className="glass-panel flex items-center justify-between rounded-2xl px-4 py-3 text-sm"
                >
                  <span className="text-foreground">{claim.shops?.name ?? "Cafe"}</span>
                  <span className="text-muted-foreground capitalize">{claim.status}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
