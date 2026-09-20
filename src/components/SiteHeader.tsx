import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { amIAdmin } from "@/lib/owner.functions";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Coffee } from "lucide-react";

export function SiteHeader() {
  const { user } = useSession();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const { data: isAdmin = false } = useQuery({
    queryKey: ["admin-role", user?.id],
    queryFn: () => amIAdmin(),
    enabled: Boolean(user),
    staleTime: 60_000,
    retry: false,
  });

  return (
    <div className="sticky top-0 z-[1000] px-3 pt-3 sm:px-5">
      <nav className="glass-panel mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-[22px] px-4 py-3 sm:px-5">
        <Link to="/" className="font-serif text-xl font-semibold text-foreground">
          Kape <span className="font-normal italic text-primary">Norte</span>
        </Link>
        <div className="flex items-center gap-2 text-sm sm:gap-4">
          <Link
            to="/guide"
            className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            Guide
          </Link>
          <Link
            to="/submit"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Add a cafe
          </Link>
          <Link
            to={user ? "/owner" : "/owners"}
            className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            Cafe owners
          </Link>
          {user && isAdmin && (
            <Link
              to="/claims"
              className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline"
            >
              Review listings
            </Link>
          )}
          {user && isAdmin && (
            <Link
              to="/admin"
              className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline"
            >
              Analytics
            </Link>
          )}
          <details className="relative sm:hidden">
            <summary className="cursor-pointer text-muted-foreground">Menu</summary>
            <div className="absolute right-0 top-8 flex w-44 flex-col gap-3 rounded-xl border border-border bg-background p-4 shadow-lg">
              <Link to="/guide">Coffee guide</Link>
              <Link to={user ? "/owner" : "/owners"}>Cafe owners</Link>
              {user && isAdmin && (
                <>
                  <Link to="/claims">Review listings</Link>
                  <Link to="/admin">Analytics</Link>
                </>
              )}
            </div>
          </details>
          <a
            href="https://buymeacoffee.com/aikanii"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 sm:px-3 sm:text-sm"
            aria-label="Buy me a coffee to support this project"
          >
            <Coffee className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Support</span>
          </a>
          {user ? (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const { error: err } = await supabase.auth.signOut();
                  if (err) throw new Error(err.message);
                  await navigate({ to: "/" });
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not sign out");
                }
              }}
              className="rounded-xl bg-background/30"
            >
              Sign out
            </Button>
          ) : (
            <Link
              to="/auth"
              search={{ redirect: typeof window !== "undefined" ? window.location.pathname : "/" }}
              className="rounded-xl bg-primary px-3 py-2 font-medium text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>
      {error && (
        <p
          role="alert"
          className="mx-auto max-w-6xl rounded-lg bg-background p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
