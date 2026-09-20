import { expect, test } from "@playwright/test";

const styleUrl = "https://tiles.openfreemap.org/styles/positron";
// Deterministic browser fixture: still exercises the real renderer and bundled worker.
// It is never shipped or used by the production app.
const style = {
  version: 8,
  sources: {
    streets: {
      type: "geojson",
      data: {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [124.24, 8.24],
            [124.64, 8.47],
          ],
        },
        properties: {},
      },
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#e9ece8" } },
    {
      id: "street",
      type: "line",
      source: "streets",
      paint: { "line-color": "#b2b9ad", "line-width": 3 },
    },
  ],
};

test("replacement map renders, filters and selects cafe pins with attribution", async ({
  page,
}) => {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => requests.push(request.url()));
  await page.route(styleUrl, (route) => route.fulfill({ json: style }));
  await page.goto("/");
  const map = page.getByRole("region", { name: "Interactive cafe map" });
  await expect(map).toHaveAttribute("data-map-status", "ready", { timeout: 15_000 });
  await expect(map.locator("canvas")).toBeVisible();
  await expect(map.getByRole("button", { name: /^Test Iligan Cafe/ })).toBeVisible();
  await expect(map.getByRole("button", { name: /^Test CDO Cafe/ })).toBeVisible();
  await expect(map.getByRole("link", { name: "OpenFreeMap", exact: true })).toBeVisible();
  await expect(map.getByRole("link", { name: "OpenStreetMap", exact: true })).toBeVisible();
  await map.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByLabel("Filter by city").selectOption("Cagayan de Oro City");
  await expect(map.getByRole("button", { name: /^Test Iligan Cafe/ })).toHaveCount(0);
  const pin = map.getByRole("button", { name: /^Test CDO Cafe/ });
  await pin.click();
  await expect(pin).toHaveAttribute("aria-pressed", "true");
  await expect(map.locator(".maplibregl-popup")).toContainText("Test CDO Cafe");
  const bounds = await map.boundingBox();
  const pinBounds = await pin.boundingBox();
  expect(
    Math.abs(pinBounds!.x + pinBounds!.width / 2 - (bounds!.x + bounds!.width / 2)),
  ).toBeLessThan(4);
  expect(
    Math.abs(pinBounds!.y + pinBounds!.height / 2 - (bounds!.y + bounds!.height / 2)),
  ).toBeLessThan(4);
  expect(requests.some((url) => new URL(url).hostname.endsWith("tile.openstreetmap.org"))).toBe(
    false,
  );
  expect(requests).toContain(styleUrl);
  expect(errors).toEqual([]);
});

test("blocked basemap shows fallback and retry restores the map", async ({ page }) => {
  let blocked = true;
  await page.route(styleUrl, (route) =>
    blocked
      ? route.fulfill({ status: 403, body: "Access blocked" })
      : route.fulfill({ json: style }),
  );
  await page.goto("/");
  const map = page.getByRole("region", { name: "Interactive cafe map" });
  await expect(map.getByRole("alert")).toContainText("The map couldn't load");
  await expect(page.getByText("2 shops found")).toBeVisible();
  await expect(map.getByRole("link", { name: "Open in Google Maps" })).toHaveAttribute(
    "href",
    /^https:\/\/www.google.com\/maps\/search/,
  );
  blocked = false;
  await map.getByRole("button", { name: "Retry map" }).click();
  await expect(map).toHaveAttribute("data-map-status", "ready", { timeout: 15_000 });
  await expect(map.getByRole("alert")).toHaveCount(0);
  await expect(map.getByRole("button", { name: /^Test Iligan Cafe/ })).toBeVisible();
});

test("shop details use the replacement map and retain directions", async ({ page }) => {
  await page.route(styleUrl, (route) => route.fulfill({ json: style }));
  await page.goto("/shops/test-iligan-cafe");
  const map = page.getByRole("region", { name: "Interactive cafe map" });
  await expect(map).toHaveAttribute("data-map-status", "ready", { timeout: 15_000 });
  await expect(map.getByRole("button", { name: /^Test Iligan Cafe/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("link", { name: "Get directions" })).toHaveAttribute(
    "href",
    /destination=8.24,124.24/,
  );
});

test("no WebGL support does not crash the directory", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      value: function (this: HTMLCanvasElement, name: string, ...args: unknown[]) {
        if (name.includes("webgl")) return null;
        return Reflect.apply(original, this, [name, ...args]);
      },
    });
  });
  await page.goto("/");
  const map = page.getByRole("region", { name: "Interactive cafe map" });
  await expect(map.getByRole("alert")).toBeVisible();
  await expect(map.getByRole("link", { name: "Open in Google Maps" })).toBeVisible();
  await page.getByLabel("Filter by city").selectOption("Cagayan de Oro City");
  await expect(page.getByText("1 shop found")).toBeVisible();
});
