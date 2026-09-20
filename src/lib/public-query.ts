import type { FetchQueryOptions, QueryClient, QueryKey } from "@tanstack/react-query";

/** Keep SSR where available, but let the browser recover from an SSR-only outage. */
export async function preloadPublicQuery<T, TKey extends QueryKey>(
  client: QueryClient,
  options: FetchQueryOptions<T, Error, T, TKey>,
): Promise<T | undefined> {
  try {
    return await client.ensureQueryData({ ...options, retry: false });
  } catch (error) {
    if (typeof window !== "undefined") throw error;
    // Do not hydrate a failed server request into the browser as a permanent error.
    client.removeQueries({ queryKey: options.queryKey, exact: true });
    console.warn(
      "Public directory SSR fetch failed; deferring to the browser.",
      error instanceof Error ? error.message : "Request failed",
    );
    return undefined;
  }
}
