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

export const Route = createFileRoute("/owners")({
  head: () => ({
    meta: [
      { title: "Cafe owner login — Kape Norte" },
      {
        name: "description",
        content:
          "Cafe owners in Iligan and Cagayan de Oro: sign in to update your shop details, opening hours and photos on Kape Norte.",
      },
      { property: "og:title", content: "Cafe owner login — Kape Norte" },
      {
        property: "og:description",
        content: "Manage your coffee shop listing: details, hours and photos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OwnersPage,
});

const field =
  "glass-field h-11 w-full rounded-xl border border-input px-3 text-sm text-foreground outline-none focus:border-primary";

function OwnersPage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/owner" });
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
        options: { emailRedirectTo: `${window.location.origin}/owner` },
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
    const result = await signInWithGoogle(`${window.location.origin}/owner`);
    if (result.error) setError(result.error);
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-xl px-5 py-12">
        <p className="text-xs uppercase tracking-[0.2em] text-primary">For cafe owners</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-foreground">
          Manage your coffee shop listing
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Sign in to update your cafe's address, description, opening hours and photos. If your
          cafe is already listed, you can request access to it after signing in — we'll confirm
          you're the owner before handing over the listing.
        </p>

        <div className="glass-panel mt-8 rounded-3xl p-6">
          <button
            onClick={google}
            className="w-full rounded-xl border border-input bg-background/40 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
          >
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-foreground">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourcafe.com"
                autoComplete="email"
                aria-label="Owner email address"
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-foreground">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                aria-label="Password"
                className={field}
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="h-11 rounded-xl bg-primary text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90 disabled:opacity-60"
            >
              {mode === "signin" ? "Sign in to owner tools" : "Create owner account"}
            </button>
          </form>

          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          {notice && <p className="mt-3 text-sm text-muted-foreground">{notice}</p>}

          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-5 text-sm text-primary hover:underline"
          >
            {mode === "signin"
              ? "New here? Create an owner account"
              : "Already have an account? Sign in"}
          </button>
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">
            ← Back to the directory
          </Link>
        </p>
      </main>
    </div>
  );
}
