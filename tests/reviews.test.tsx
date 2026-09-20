// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Reviews } from "../src/components/Reviews";

const state = vi.hoisted(() => ({
  rows: [] as Array<{
    id: string;
    user_id: string;
    rating: number;
    comment: string;
    created_at: string;
  }>,
  loadError: null as { message: string } | null,
  writeError: null as { message: string } | null,
}));
vi.mock("@/hooks/useSession", () => ({ useSession: () => ({ user: { id: "me" } }) }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () =>
        table === "profiles"
          ? { in: async () => ({ data: [{ id: "me", display_name: "Tester" }] }) }
          : { eq: () => ({ order: async () => ({ data: state.rows, error: state.loadError }) }) },
      upsert: async () => ({ error: state.writeError }),
      delete: () => ({
        eq: () => ({
          select: () => ({
            single: async () => {
              if (!state.writeError) state.rows = [];
              return { error: state.writeError };
            },
          }),
        }),
      }),
    }),
  },
}));

function renderReviews() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Reviews shopId="shop" />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  state.rows = [
    { id: "review", user_id: "me", rating: 4, comment: "Good coffee", created_at: "2026-09-20" },
  ];
  state.loadError = null;
  state.writeError = null;
});
afterEach(cleanup);

describe("reviews", () => {
  it("keeps the review visible and reports a failed delete", async () => {
    state.writeError = { message: "Permission denied" };
    renderReviews();
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Permission denied")).toBeInTheDocument();
    expect(screen.queryByText("Review deleted.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Your review")).toHaveValue("Good coffee");
    expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled();
  });
  it("clears the form after a successful delete", async () => {
    renderReviews();
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.getByLabelText("Your review")).toHaveValue(""));
    expect(await screen.findByRole("button", { name: "Post review" })).toBeEnabled();
  });
  it("distinguishes an unavailable backend from an empty review list", async () => {
    state.rows = [];
    state.loadError = { message: "Network unavailable" };
    renderReviews();
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load reviews");
    expect(screen.queryByText("No reviews yet — be the first.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post review" })).toBeDisabled();
  });
});
