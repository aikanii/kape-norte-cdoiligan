import { SiteHeader } from "./SiteHeader";

export function DirectoryLoading() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-16" aria-busy="true">
        <h1 className="font-serif text-3xl text-foreground">Finding your next coffee spot</h1>
        <p role="status" className="mt-3 text-muted-foreground">
          Loading the live coffee directory…
        </p>
        <div aria-hidden="true" className="mt-8 grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </main>
    </div>
  );
}
