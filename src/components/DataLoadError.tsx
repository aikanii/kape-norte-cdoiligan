import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "./SiteHeader";

export function DataLoadError({
  reset,
  retry,
}: {
  reset?: () => void;
  retry?: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-5 py-20">
        <h1 className="font-serif text-3xl">We couldn't reach the coffee directory</h1>
        <p role="alert" className="mt-4 text-muted-foreground">
          Check your connection and try again. If the problem continues, the directory may be
          temporarily unavailable. Your saved listings have not been changed.
        </p>
        <button
          className="mt-6 rounded-xl bg-primary px-4 py-2 text-primary-foreground"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              if (retry) await retry();
              else {
                await router.invalidate();
                reset?.();
              }
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Trying again…" : "Try again"}
        </button>
      </main>
    </div>
  );
}
