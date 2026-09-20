import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { preloadPublicQuery } from "../src/lib/public-query";

describe("public directory preloading", () => {
  it("keeps successful SSR data for hydration", async () => {
    const client = new QueryClient();
    const options = { queryKey: ["shops"], queryFn: async () => [{ id: "cafe" }], retry: false };
    expect(await preloadPublicQuery(client, options)).toEqual([{ id: "cafe" }]);
    expect(client.getQueryData(["shops"])).toEqual([{ id: "cafe" }]);
  });

  it("does not cache an empty directory or poison hydration when SSR cannot connect", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = new QueryClient();
    const options = {
      queryKey: ["shops"],
      queryFn: async () => {
        throw new Error("fetch failed");
      },
      retry: false,
    };
    expect(await preloadPublicQuery(client, options)).toBeUndefined();
    expect(client.getQueryState(["shops"])).toBeUndefined();
    warn.mockRestore();
  });
});
