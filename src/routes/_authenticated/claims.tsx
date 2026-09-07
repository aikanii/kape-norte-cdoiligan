import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { amIAdmin, decideClaim, listClaims, type ClaimRow } from "@/lib/owner.functions";

export const Route = createFileRoute("/_authenticated/claims")({
  head: () => ({
    meta: [
      { title: "Owner requests — Kape Norte" },
      { name: "description", content: "Review cafe owner access requests." },
      { property: "og:title", content: "Owner requests — Kape Norte" },
      { property: "og:description", content: "Approve or reject cafe owner access requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClaimsPage,
});

function ClaimsPage() {
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<ClaimRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const isAdmin = await amIAdmin();
      setAdmin(isAdmin);
      if (isAdmin) setRows(await listClaims());
    } catch {
      setAdmin(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (claimId: string, approve: boolean) => {
    setError(null);
    setBusy(claimId);
    try {
      await decideClaim({ data: { claimId, approve } });
      setRows(await listClaims());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update that request");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="font-serif text-3xl font-semibold text-foreground">Owner requests</h1>

        {admin === false && (
          <p className="mt-4 text-sm text-muted-foreground">
            This page is for site administrators.{" "}
            <Link to="/owner" className="text-primary hover:underline">
              Go to your owner dashboard
            </Link>
            .
          </p>
        )}

        {admin && rows.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">No requests yet.</p>
        )}

        {admin && (
          <ul className="mt-6 flex flex-col gap-3">
            {rows.map((row) => (
              <li key={row.id} className="glass-panel rounded-2xl p-5">
                <p className="font-medium text-foreground">{row.shop_name}</p>
                <p className="text-sm text-muted-foreground">
                  {row.shop_area}, {row.shop_city}
                </p>
                <p className="mt-3 text-sm text-foreground">
                  {row.contact_name} · {row.contact_email}
                  {row.phone && ` · ${row.phone}`}
                </p>
                {row.message && (
                  <p className="mt-2 text-sm text-muted-foreground">{row.message}</p>
                )}
                <div className="mt-4 flex items-center gap-3">
                  {row.status === "pending" ? (
                    <>
                      <button
                        disabled={busy === row.id}
                        onClick={() => void decide(row.id, true)}
                        className="rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        disabled={busy === row.id}
                        onClick={() => void decide(row.id, false)}
                        className="text-sm text-destructive hover:underline disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </>
                  ) : (
                    <span className="text-sm capitalize text-muted-foreground">{row.status}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </main>
    </div>
  );
}
