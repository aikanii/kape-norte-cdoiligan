import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

/**
 * The Lovable-managed OAuth helper only works on Lovable-hosted origins
 * (*.lovable.app / *.lovableproject.com). On a self-hosted deployment
 * (e.g. Cloudflare Workers) it 404s, so fall back to the standard
 * Supabase OAuth redirect flow.
 */
function isLovableHost() {
  const h = window.location.hostname;
  return (
    h.endsWith(".lovable.app") ||
    h.endsWith(".lovableproject.com") ||
    h === "localhost" ||
    h === "127.0.0.1"
  );
}

export async function signInWithGoogle(redirectTo?: string): Promise<{ error?: string }> {
  const target = redirectTo ?? window.location.origin;

  if (isLovableHost()) {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: target });
    if (result.error) return { error: "Google sign-in failed. Please try again." };
    return {};
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: target },
  });
  if (error) return { error: error.message };
  return {};
}
