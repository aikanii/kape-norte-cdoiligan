import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { credentialsSchema, safeRedirect } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { signInWithGoogle } from "@/lib/google-signin";
import { SiteHeader } from "@/components/SiteHeader";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: safeRedirect(search["redirect"]),
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Kape Norte" },
      {
        name: "description",
        content:
          "Sign in to Kape Norte to review coffee shops in Iligan and Cagayan de Oro or list your own cafe.",
      },
      { property: "og:title", content: "Sign in — Kape Norte" },
      {
        property: "og:description",
        content: "Create an account to rate cafes and add your coffee shop to the directory.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const { user } = useSession();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) void navigate({ to: redirect, replace: true });
  }, [user, navigate, redirect]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const parsed = credentialsSchema(mode).safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your details");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          ...parsed.data,
          options: { emailRedirectTo: `${window.location.origin}${redirect}` },
        });
        if (err) throw new Error(err.message);
        setNotice("Account created. Check your email if confirmation is required.");
      } else {
        const { error: err } = await supabase.auth.signInWithPassword(parsed.data);
        if (err) throw new Error(err.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await signInWithGoogle(`${window.location.origin}${redirect}`);
      if (result.error) setError(result.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect to Google");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-md px-5 py-12">
        <h1 className="font-serif text-3xl font-semibold text-foreground">
          {mode === "signin" ? "Welcome back" : "Create an account"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Rate cafes, leave comments and list your own coffee shop.
        </p>

        <button
          onClick={google}
          disabled={busy}
          className="mt-6 w-full rounded-lg border border-input bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
        >
          Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="email"
            aria-label="Email address"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            autoComplete="email"
            className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
          />
          <input
            type="password"
            aria-label="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={busy}
            className="h-11 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {notice && <p className="mt-3 text-sm text-muted-foreground">{notice}</p>}

        <button
          disabled={busy}
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setNotice(null);
          }}
          className="mt-5 text-sm text-primary hover:underline"
        >
          {mode === "signin" ? "No account yet? Sign up" : "Already have an account? Sign in"}
        </button>

        <p className="mt-8 text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">
            ← Back to the directory
          </Link>
        </p>
      </main>
    </div>
  );
}
