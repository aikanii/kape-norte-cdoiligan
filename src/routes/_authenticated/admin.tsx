import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Eye,
  MessageSquareHeart,
  Store,
  Camera,
  ClipboardList,
  Users,
  Star,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { amIAdmin } from "@/lib/owner.functions";
import { getAdminStats, type AdminStats } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Site analytics — Kape Norte" },
      { name: "description", content: "Visitor, review and listing analytics for Kape Norte." },
      { property: "og:title", content: "Site analytics — Kape Norte" },
      { property: "og:description", content: "Visitor, review and listing analytics for Kape Norte." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Eye;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 font-serif text-3xl font-semibold text-foreground">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function AdminPage() {
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const isAdmin = await amIAdmin();
      setAdmin(isAdmin);
      if (isAdmin) setStats(await getAdminStats());
    } catch {
      setAdmin(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const maxDaily = stats ? Math.max(1, ...stats.dailyViews.map((d) => d.count)) : 1;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-foreground">Site analytics</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Visitors, reviews, listings and owner requests at a glance.
            </p>
          </div>
          <Link to="/claims" className="text-sm text-primary hover:underline">
            Owner requests →
          </Link>
        </div>

        {admin === false && (
          <p className="mt-4 text-sm text-muted-foreground">
            This page is for site administrators.{" "}
            <Link to="/" className="text-primary hover:underline">
              Back to the directory
            </Link>
            .
          </p>
        )}

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        {admin && !stats && !error && (
          <p className="mt-6 text-sm text-muted-foreground">Loading analytics…</p>
        )}

        {stats && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <StatCard
                icon={Eye}
                label="Visits · 30 days"
                value={stats.views.last30Days}
                sub={`${stats.views.today} today · ${stats.views.total} all time`}
              />
              <StatCard
                icon={Users}
                label="Signed-up users"
                value={stats.signups.total}
                sub={`${stats.signups.last30Days} in the last 30 days`}
              />
              <StatCard
                icon={MessageSquareHeart}
                label="Reviews"
                value={stats.reviews.total}
                sub={`${stats.reviews.last30Days} in the last 30 days`}
              />
              <StatCard
                icon={Star}
                label="Average rating"
                value={stats.reviews.averageRating || "—"}
                sub="across all reviews"
              />
              <StatCard
                icon={Store}
                label="Cafes listed"
                value={stats.shops.total}
                sub={`${stats.shops.published} live · ${stats.shops.pending} pending`}
              />
              <StatCard icon={Camera} label="Photos" value={stats.photos} />
              <StatCard
                icon={ClipboardList}
                label="Owner requests"
                value={stats.claims.pending}
                sub={`${stats.claims.approved} approved · ${stats.claims.rejected} rejected`}
              />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <section className="glass-panel rounded-3xl p-6">
                <h2 className="font-serif text-lg font-semibold text-foreground">
                  Visits, last 14 days
                </h2>
                <div className="mt-4 flex h-32 gap-1.5" role="img" aria-label="Bar chart of daily visits over the last 14 days">
                  {stats.dailyViews.map((d) => (
                    <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                      <div
                        className="w-full rounded-t-md bg-primary/80"
                        style={{ height: `${Math.max(3, (d.count / maxDaily) * 100)}%` }}
                        title={`${d.date}: ${d.count} visits`}
                      />
                      <span className="text-[9px] text-muted-foreground">
                        {d.date.slice(8)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="glass-panel rounded-3xl p-6">
                <h2 className="font-serif text-lg font-semibold text-foreground">
                  Most visited pages · 30 days
                </h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {stats.topPages.length === 0 && (
                    <li className="text-sm text-muted-foreground">No visits recorded yet.</li>
                  )}
                  {stats.topPages.map((p) => (
                    <li
                      key={p.path}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="truncate text-foreground">{p.path}</span>
                      <span className="shrink-0 text-muted-foreground">{p.count}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <section className="glass-panel mt-6 rounded-3xl p-6">
              <h2 className="font-serif text-lg font-semibold text-foreground">
                Most reviewed cafes
              </h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {stats.topReviewedShops.length === 0 && (
                  <li className="text-sm text-muted-foreground">No reviews yet.</li>
                )}
                {stats.topReviewedShops.map((s) => (
                  <li
                    key={s.name}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.city}</p>
                    </div>
                    <span className="shrink-0 text-muted-foreground">
                      {s.average}★ · {s.count}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
