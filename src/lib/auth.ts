import { z } from "zod";

export function safeRedirect(value: unknown, fallback = "/") {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !/[\\\r\n]/.test(value)
    ? value
    : fallback;
}

export function credentialsSchema(mode: "signin" | "signup") {
  return z.object({
    email: z.string().trim().email("Enter a valid email").max(255),
    // Existing accounts may have older passwords. Apply signup policy only to new accounts.
    password: z
      .string()
      .min(
        mode === "signup" ? 6 : 1,
        mode === "signup" ? "Use at least 6 characters" : "Enter your password",
      )
      .max(72),
  });
}
