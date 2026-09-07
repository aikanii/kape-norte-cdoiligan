import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { signInWithGoogle } from "@/lib/google-signin";
import { SiteHeader } from "@/components/SiteHeader";
import { useSession } from "@/hooks/useSession";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Use at least 6 characters").max(72),
});

export const Route = createFileRoute("/auth")({
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
  const { user } = useSession();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your details");
      return;
    }
    setBusy(true);
    if (mode === "signup") {
      const { error: err } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: { emailRedirectTo: window.location.origin },
      });
      setBusy(false);
      if (err) setError(err.message);
      else setNotice("Account created. Check your email if confirmation is required.");
      return;
    }
    const { error: err } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (err) setError(err.message);
  };

  const google = async () => {
    setError(null);
    const result = await signInWithGoogle();
    if (result.error) setError(result.error);
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            autoComplete="email"
            className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
          />
          <input
            type="password"
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

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        {notice && <p className="mt-3 text-sm text-muted-foreground">{notice}</p>}

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
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
