import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { lazy, useMemo, useState } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { SiteHeader } from "@/components/SiteHeader";
import { listShops } from "@/lib/shops.functions";
import { openState, type Shop } from "@/lib/hours";
import { useCoverPhotos } from "@/hooks/useCoverPhotos";
import { ArrowDown, MapPin, Search } from "lucide-react";
import heroImage from "@/assets/kape-norte-hero.jpg";

const ShopMap = lazy(() => import("@/components/ShopMap"));

const shopsQuery = queryOptions({
  queryKey: ["shops"],
  queryFn: () => listShops(),
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
});

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(shopsQuery),
  head: () => ({
    meta: [
      { title: "Kape Norte — Coffee Shops in Iligan & Cagayan de Oro" },
      {
        name: "description",
        content:
          "Find coffee shops in Iligan City and Cagayan de Oro. Browse the map, filter by city and area, and see which cafes are open right now.",
      },
      { property: "og:title", content: "Kape Norte — Coffee Shops in Iligan & Cagayan de Oro" },
      {
        property: "og:description",
        content:
          "A directory of coffee shops across Iligan City and Cagayan de Oro, with a live map, opening hours and reviews.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div role="alert" className="p-8 text-sm text-muted-foreground">
      Could not load the shop list: {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8">No shops yet.</div>,
  component: Directory,
});

const peso = (level: number) => "₱".repeat(Math.max(1, level));

function Directory() {
  const { data: shops } = useSuspenseQuery(shopsQuery);
  const [city, setCity] = useState<string>("All");
  const [area, setArea] = useState<string>("All");
  const [tag, setTag] = useState<string>("All");
  const [openOnly, setOpenOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const covers = useCoverPhotos(shops);

  const cities = useMemo(
    () => Array.from(new Set(shops.map((s) => s.city))).sort(),
    [shops],
  );
  const areas = useMemo(
    () =>
      Array.from(
        new Set(shops.filter((s) => city === "All" || s.city === city).map((s) => s.area)),
      ).sort(),
    [shops, city],
  );
  const tags = useMemo(
    () => Array.from(new Set(shops.flatMap((s) => s.tags))).sort(),
    [shops],
  );

  const results = useMemo(() => {
    return shops.filter((s: Shop) => {
      if (city !== "All" && s.city !== city) return false;
      if (area !== "All" && s.area !== area) return false;
      if (tag !== "All" && !s.tags.includes(tag)) return false;
      if (openOnly && !openState(s.hours).open) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        if (
          !s.name.toLowerCase().includes(q) &&
          !s.area.toLowerCase().includes(q) &&
          !s.address.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [shops, city, area, tag, openOnly, query]);

  const cityCenter = useMemo<[number, number]>(() => {
    const scope = city === "All" ? shops : shops.filter((s) => s.city === city);
    if (scope.length === 0) return [8.354, 124.443];
    const lat = scope.reduce((sum, s) => sum + s.lat, 0) / scope.length;
    const lng = scope.reduce((sum, s) => sum + s.lng, 0) / scope.length;
    return [lat, lng];
  }, [shops, city]);

  return (
    <div className="min-h-screen bg-background">
      <section className="relative flex min-h-[88vh] flex-col overflow-hidden">
        <img src={heroImage} alt="Latte on a warm specialty coffee bar" width={1920} height={1280} className="absolute inset-0 h-full w-full object-cover object-[64%_center]" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/15" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/45" />
        <SiteHeader />
        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pb-16 pt-16 sm:pb-20">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.28em] text-primary">The specialty coffee directory of the north</p>
          <h1 className="max-w-4xl font-serif text-4xl font-normal leading-[1.08] text-foreground sm:text-6xl lg:text-7xl">
            Specialty Coffee Shops in <span className="italic text-primary">Iligan & Cagayan de Oro</span>
          </h1>
          <p className="mt-6 max-w-xl text-base font-light leading-7 text-foreground/75 sm:text-lg">
            Discover independent cafes and neighborhood coffee spots across Iligan City and Cagayan de Oro.
          </p>

          <section aria-label="Find coffee shops" className="glass-panel mt-9 max-w-5xl rounded-[28px] p-3 sm:p-4">
            <div className="grid gap-2 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="ml-1 text-[11px] font-semibold uppercase tracking-wider text-foreground/70">Search</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                  <input value={query} maxLength={80} onChange={(e) => setQuery(e.target.value)} placeholder="Cafe, area, or street" aria-label="Search by cafe name, area, or street" className="glass-field h-12 w-full min-w-0 rounded-2xl pl-11 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary" />
                </div>
              </label>

              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="ml-1 text-[11px] font-semibold uppercase tracking-wider text-foreground/70">City</span>
                <select value={city} onChange={(e) => { setCity(e.target.value); setArea("All"); }} aria-label="Filter by city" className="glass-field h-12 w-full min-w-0 rounded-2xl px-4 text-sm text-foreground outline-none focus:border-primary">
                  <option value="All">All cities</option>{cities.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>

              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="ml-1 text-[11px] font-semibold uppercase tracking-wider text-foreground/70">Area</span>
                <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Filter by area or neighborhood" className="glass-field h-12 w-full min-w-0 rounded-2xl px-4 text-sm text-foreground outline-none focus:border-primary">
                  <option value="All">All areas</option>{areas.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>

              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="ml-1 text-[11px] font-semibold uppercase tracking-wider text-foreground/70">Vibe</span>
                <select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filter by vibe or atmosphere" className="glass-field h-12 w-full min-w-0 rounded-2xl px-4 text-sm text-foreground outline-none focus:border-primary">
                  <option value="All">Any vibe</option>{tags.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1">
              <label className="inline-flex items-center gap-2 text-sm text-foreground/80">
                <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
                Open now only
              </label>
              <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{shops.length}</span> cafes curated</p>
            </div>
          </section>
          <a href="#directory" className="mt-8 inline-flex w-fit items-center gap-2 text-xs uppercase tracking-[0.2em] text-foreground/55 transition-colors hover:text-primary">
            Explore the directory <ArrowDown className="h-4 w-4" />
          </a>
        </div>
      </section>

      <main id="directory" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-12 sm:py-16">
        <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Curated near you</p>
            <h2 className="mt-2 font-serif text-3xl text-foreground sm:text-4xl">Coffee worth finding</h2>
          </div>
          <p className="text-sm text-muted-foreground">{results.length} {results.length === 1 ? "shop" : "shops"} found</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
          <section aria-label="Coffee shop list" className="order-2 lg:order-1">
            <ul className="flex flex-col gap-3">
              {results.map((shop) => {
                const state = openState(shop.hours);
                return (
                  <li key={shop.id}>
                    <Link
                      to="/shops/$shopSlug"
                      params={{ shopSlug: shop.slug }}
                      onMouseEnter={() => setActiveId(shop.id)}
                      onFocus={() => setActiveId(shop.id)}
                      className={`glass-panel group block overflow-hidden rounded-[24px] p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/60 ${
                        activeId === shop.id ? "border-primary" : "border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        {covers[shop.id] && (
                          <img
                            src={covers[shop.id]}
                             alt={`${shop.name} cafe`}
                            loading="lazy"
                            className="h-24 w-28 shrink-0 rounded-[18px] object-cover transition-transform duration-500 group-hover:scale-[1.02] sm:h-28 sm:w-36"
                          />
                        )}
                        <div className="min-w-0 flex-1 py-1">
                          <h3 className="font-serif text-xl font-normal text-foreground">
                            {shop.name}
                          </h3>
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 text-primary" /> {shop.area} · {shop.city}
                          </p>
                          <p className="mt-2 line-clamp-2 text-sm font-light leading-5 text-foreground/70">{shop.blurb}</p>
                        </div>
                        <span className="shrink-0 text-sm font-medium text-primary">
                          {peso(shop.price_level)}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            state.open
                              ? "border border-primary/20 bg-primary/10 text-primary"
                              : "border border-border bg-muted/70 text-muted-foreground"
                          }`}
                        >
                          {state.open ? "Open now" : "Closed"} · {state.label}
                        </span>
                        {shop.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full border border-border bg-background/20 px-2.5 py-1 text-xs text-muted-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </Link>
                  </li>
                );
              })}
              {results.length === 0 && (
                <li className="glass-panel rounded-[24px] border-dashed p-8 text-center text-sm text-muted-foreground">
                  No shops match those filters yet.
                </li>
              )}
            </ul>
          </section>

          <section
            aria-label="Map"
            className="glass-panel order-1 h-[360px] overflow-hidden rounded-[28px] p-1.5 lg:sticky lg:top-24 lg:order-2 lg:h-[calc(100vh-8rem)]"
          >
            <ClientOnly
              fallback={
                 <div className="flex h-full items-center justify-center rounded-[22px] bg-muted text-sm text-muted-foreground">
                  Loading map…
                </div>
              }
            >
              <ShopMap
                shops={results}
                covers={covers}
                center={cityCenter}
                zoom={city === "All" ? 9 : 13}
                activeId={activeId}
                onSelect={setActiveId}
              />
            </ClientOnly>
          </section>
        </div>
      </main>

      <footer className="border-t border-border bg-background/40 py-10 text-center text-xs text-muted-foreground">
        Green pins are open right now. Own a cafe?{" "}
        <Link to="/submit" className="text-primary hover:underline">
          Add your listing
        </Link>
        .
      </footer>
    </div>
  );
}
