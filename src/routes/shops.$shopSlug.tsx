import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { lazy } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { SiteHeader } from "@/components/SiteHeader";
import { Reviews } from "@/components/Reviews";
import { ShopGallery } from "@/components/ShopGallery";
import { getShopBySlug } from "@/lib/shops.functions";
import { DAY_LABELS, WEEK_ORDER, formatRange, openState, type Shop } from "@/lib/hours";

const ShopMap = lazy(() => import("@/components/ShopMap"));

export const Route = createFileRoute("/shops/$shopSlug")({
  loader: async ({ params, context }) => {
    let shop: Shop | null = null;
    try {
      shop = await getShopBySlug({ data: { slug: params.shopSlug } });
    } catch {
      shop = null;
    }
    if (!shop) {
      const cached = context.queryClient.getQueryData<Shop[]>(["shops"]);
      shop = cached?.find((s) => s.slug === params.shopSlug) ?? null;
    }
    if (!shop) throw notFound();
    return shop;
  },
  head: ({ loaderData }) => {
    const name = loaderData?.name ?? "Coffee shop";
    const desc = loaderData
      ? `${loaderData.name} in ${loaderData.area}, ${loaderData.city}. ${loaderData.blurb}`.slice(
          0,
          155,
        )
      : "Coffee shop details, opening hours and reviews.";
    return {
      meta: [
        { title: `${name} — Kape Norte` },
        { name: "description", content: desc },
        { property: "og:title", content: `${name} — Kape Norte` },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: ({ error }) => (
    <div role="alert" className="p-8 text-sm text-muted-foreground">
      Could not load this shop: {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-sm text-muted-foreground">
      That shop isn't listed.{" "}
      <Link to="/" className="text-primary hover:underline">
        Back to the directory
      </Link>
    </div>
  ),
  component: ShopDetail,
});

function ShopDetail() {
  const shop = Route.useLoaderData();
  const state = openState(shop.hours);
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}`;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-8">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← All shops
        </Link>

        <h1 className="mt-4 font-serif text-4xl font-semibold text-foreground">{shop.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {shop.area} · {shop.city}
        </p>
        <span
          className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-medium ${
            state.open ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
          }`}
        >
          {state.open ? "Open now" : "Closed"} · {state.label}
        </span>

        <ShopGallery
          shopId={shop.id}
          shopName={shop.name}
          legacyPath={shop.photo_path}
          googlePhotoUrl={shop.google_photo_url}
          googlePhotoAttribution={shop.google_photo_attribution}
        />

        <p className="mt-5 text-base text-foreground/85">{shop.blurb}</p>

        <div className="mt-6 flex flex-wrap gap-1.5">
          {shop.tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="font-serif text-lg font-semibold text-foreground">Opening hours</h2>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm">
              {WEEK_ORDER.map((day) => (
                <li key={day} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{DAY_LABELS[day]}</span>
                  <span className="text-foreground">{formatRange(shop.hours[day] ?? null)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="font-serif text-lg font-semibold text-foreground">Find it</h2>
            <p className="mt-3 text-sm text-foreground/85">{shop.address}</p>
            <a
              href={directions}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Get directions
            </a>
          </section>
        </div>

        <div className="mt-6 h-72 overflow-hidden rounded-2xl border border-border">
          <ClientOnly
            fallback={
              <div className="flex h-full items-center justify-center bg-muted text-sm text-muted-foreground">
                Loading map…
              </div>
            }
          >
            <ShopMap shops={[shop]} center={[shop.lat, shop.lng]} zoom={16} activeId={shop.id} />
          </ClientOnly>
        </div>

        <Reviews shopId={shop.id} />
      </main>
    </div>
  );
}
