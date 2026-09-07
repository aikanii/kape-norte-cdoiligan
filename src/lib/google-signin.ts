import { supabase } from "@/integrations/supabase/client";

export async function signInWithGoogle(redirectTo?: string): Promise<{ error?: string }> {
  const target = redirectTo ?? window.location.origin;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: target },
  });
  if (error) return { error: error.message };
  return {};
}
