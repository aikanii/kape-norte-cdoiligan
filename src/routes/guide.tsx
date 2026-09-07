import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Clock3, Coffee, MapPin, Star } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { useCoverPhotos } from "@/hooks/useCoverPhotos";
import { DAY_KEYS, formatRange, manilaNow, openState } from "@/lib/hours";
import { listGuideShops, type GuideShop } from "@/lib/shops.functions";

const guideQuery = queryOptions({
  queryKey: ["guide-shops"],
  queryFn: () => listGuideShops(),
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
});

export const Route = createFileRoute("/guide")({
  loader: ({ context }) => context.queryClient.ensureQueryData(guideQuery),
  head: () => ({
    meta: [
      { title: "Iligan & CDO Coffee Guide — Kape Norte" },
      {
        name: "description",
        content:
          "Compare top coffee shops in Iligan and Cagayan de Oro by price, atmosphere and opening hours, plus drinks worth looking for.",
      },
      { property: "og:title", content: "Iligan & CDO Coffee Guide — Kape Norte" },
      {
        property: "og:description",
        content:
          "Local cafe picks, coffee drinks to try, and an easy price, vibe and hours comparison for Iligan and CDO.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div role="alert" className="p-8 text-sm text-muted-foreground">
      Could not load the coffee guide: {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8">The coffee guide is unavailable.</div>,
  component: CoffeeGuide,
});

const CITIES = ["Iligan City", "Cagayan de Oro"] as const;
type City = (typeof CITIES)[number];

const drinks: Record<City, Array<{ name: string; note: string }>> = {
  "Iligan City": [
    { name: "Spanish latte", note: "Sweet, creamy and a reliable first order at modern neighborhood cafes." },
    { name: "Iced tablea mocha", note: "Look for local cacao paired with espresso for a richer chocolate finish." },
    { name: "Pour-over", note: "Best for tasting the brighter notes of Philippine single-origin beans." },
  ],
  "Cagayan de Oro": [
    { name: "Cold brew", note: "A smooth choice for CDO afternoons and cafes with long opening hours." },
    { name: "Sea salt latte", note: "A sweet-salty specialty drink found across many contemporary coffee bars." },
    { name: "Local robusta espresso", note: "Ask which Mindanao-grown beans are on bar for a distinctly regional cup." },
  ],
};

function score(shop: GuideShop) {
  const reviewScore = shop.average_rating ? shop.average_rating * 12 + Math.min(shop.review_count, 10) * 2 : 0;
  const detailScore = (shop.google_photo_url ? 8 : 0) + shop.tags.length + Object.values(shop.hours).filter(Boolean).length;
  return reviewScore + detailScore;
}

function peso(level: number) {
  return "₱".repeat(Math.max(1, level));
}

function todayHours(shop: GuideShop) {
  const { dayIndex } = manilaNow();
  const day = DAY_KEYS[dayIndex] ?? "sun";
  return formatRange(shop.hours[day] ?? null);
}

function CoffeeGuide() {
  const { data: shops } = useSuspenseQuery(guideQuery);
  const [city, setCity] = useState<City>("Iligan City");
  const covers = useCoverPhotos(shops);
  const picks = useMemo(
    () => shops.filter((shop) => shop.city === city).sort((a, b) => score(b) - score(a)).slice(0, 6),
    [shops, city],
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <header className="border-b border-border bg-card">
          <div className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">The local edit</p>
            <h1 className="mt-3 max-w-3xl font-serif text-4xl font-semibold text-foreground sm:text-6xl">
              Iligan & CDO Coffee Guide
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              A practical guide to standout coffee stops in Iligan and CDO, ranked from live reviews and listing details.
            </p>
            <div className="mt-7 inline-flex rounded-lg border border-border bg-background p-1" role="group" aria-label="Choose a city">
              {CITIES.map((item) => (
                <Button
                  key={item}
                  type="button"
                  size="sm"
                  variant={city === item ? "default" : "ghost"}
                  onClick={() => setCity(item)}
                  aria-pressed={city === item}
                  aria-label={`Show ${item} coffee guide`}
                >
                  {item === "Cagayan de Oro" ? "CDO" : "Iligan"}
                </Button>
              ))}
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-5 py-10">
          <section aria-labelledby="top-picks">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Where to start</p>
                <h2 id="top-picks" className="mt-2 font-serif text-3xl font-semibold text-foreground">Top picks in {city === "Cagayan de Oro" ? "CDO" : "Iligan"}</h2>
              </div>
              <span className="hidden text-sm text-muted-foreground sm:block">Updated from community reviews</span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {picks.map((shop, index) => {
                const state = openState(shop.hours);
                return (
                  <article key={shop.id} className="overflow-hidden rounded-lg border border-border bg-card">
                    <Link to="/shops/$shopSlug" params={{ shopSlug: shop.slug }} className="group block">
                      <div className="relative aspect-[16/10] bg-muted">
                        {covers[shop.id] ? (
                          <img src={covers[shop.id]} alt={`${shop.name} cafe`} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted-foreground"><Coffee className="size-8" aria-hidden="true" /></div>
                        )}
                        <span className="absolute left-3 top-3 flex size-8 items-center justify-center rounded-full bg-card text-sm font-semibold text-foreground shadow-sm">{index + 1}</span>
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-serif text-xl font-semibold text-foreground">{shop.name}</h3>
                          <span className="text-sm font-medium text-primary">{peso(shop.price_level)}</span>
                        </div>
                        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-3.5" aria-hidden="true" />{shop.area}</p>
                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3 text-xs">
                          <span className={state.open ? "font-medium text-primary" : "text-muted-foreground"}>{state.open ? "Open now" : "Closed"} · {state.label}</span>
                          <span className="flex items-center gap-1 text-foreground"><Star className="size-3.5 fill-current text-primary" aria-hidden="true" />{shop.average_rating ? `${shop.average_rating} (${shop.review_count})` : "New"}</span>
                        </div>
                      </div>
                    </Link>
                  </article>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="drinks" className="mt-14 border-y border-border py-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Order inspiration</p>
            <h2 id="drinks" className="mt-2 font-serif text-3xl font-semibold text-foreground">Must-try drinks</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Menus change, so treat these as drinks to look or ask for around {city === "Cagayan de Oro" ? "CDO" : "Iligan"}.</p>
            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              {drinks[city].map((drink, index) => (
                <div key={drink.name} className="border-l-2 border-primary pl-4">
                  <span className="text-xs font-semibold text-primary">0{index + 1}</span>
                  <h3 className="mt-2 font-serif text-xl font-semibold text-foreground">{drink.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{drink.note}</p>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="compare" className="mt-14">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">At a glance</p>
            <h2 id="compare" className="mt-2 font-serif text-3xl font-semibold text-foreground">Compare the shortlist</h2>
            <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
              <div className="hidden grid-cols-[1.5fr_.5fr_1fr_1fr] gap-4 border-b border-border bg-muted px-4 py-3 text-xs font-semibold uppercase text-muted-foreground md:grid">
                <span>Cafe</span><span>Price</span><span>Vibe</span><span>Today</span>
              </div>
              {picks.map((shop) => (
                <Link key={shop.id} to="/shops/$shopSlug" params={{ shopSlug: shop.slug }} className="grid gap-3 border-b border-border p-4 last:border-b-0 hover:bg-muted/60 md:grid-cols-[1.5fr_.5fr_1fr_1fr] md:items-center md:gap-4">
                  <div><h3 className="font-serif text-lg font-semibold text-foreground">{shop.name}</h3><p className="text-xs text-muted-foreground">{shop.area}</p></div>
                  <div><span className="mr-2 text-xs text-muted-foreground md:hidden">Price</span><span className="font-medium text-primary">{peso(shop.price_level)}</span></div>
                  <div className="flex flex-wrap gap-1.5"><span className="mr-1 text-xs text-muted-foreground md:hidden">Vibe</span>{shop.tags.slice(0, 2).map((tag) => <span key={tag} className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">{tag}</span>)}{shop.tags.length === 0 && <span className="text-sm text-muted-foreground">Coffee stop</span>}</div>
                  <div className="flex items-start gap-2 text-sm text-foreground"><Clock3 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /><span>{todayHours(shop)}</span></div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}