import { expect, test } from "@playwright/test";

test("directory search, city filters, detail navigation and map hydrate", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByText("2 shops found")).toBeVisible();
  await expect(page.getByRole("region", { name: "Interactive cafe map" })).toBeVisible();
  await page.getByRole("textbox", { name: "Search by cafe" }).fill("  Iligan  ");
  await expect(page.getByText("1 shop found")).toBeVisible();
  await page.getByRole("textbox", { name: "Search by cafe" }).fill("");
  await page.getByLabel("Filter by city").selectOption("Cagayan de Oro City");
  await expect(page.getByText("1 shop found")).toBeVisible();
  await page.getByRole("heading", { name: "Test CDO Cafe" }).click();
  await expect(page.getByRole("heading", { name: "Test CDO Cafe", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Get directions" })).toHaveAttribute(
    "href",
    /destination=8.47,124.64/,
  );
  await expect(page.getByText("No reviews yet — be the first.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("CDO guide includes listings imported with the older city name", async ({ page }) => {
  await page.goto("/guide");
  await page.waitForFunction(() => !("$_TSR" in window));
  await page.getByRole("button", { name: "Show Cagayan de Oro City coffee guide" }).click();
  await expect(page.getByRole("heading", { name: "Test CDO Cafe" }).first()).toBeVisible();
});

test("unknown shop returns a real not-found page", async ({ page }) => {
  const response = await page.goto("/shops/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("That shop isn't listed.")).toBeVisible();
});

test("login preserves the requested page and recovers after invalid credentials", async ({
  page,
}) => {
  await page.goto("/submit");
  await expect(page).toHaveURL(/auth\?redirect=%2Fsubmit/);
  await page.getByLabel("Email address").fill("test@example.com");
  await page.getByLabel("Password", { exact: true }).fill("incorrect");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Invalid login credentials");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
  await page.getByLabel("Password", { exact: true }).fill("correct-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Add your cafe" })).toBeVisible();
  await page.getByLabel("Shop name").fill("New test cafe");
  await page.getByLabel("Barangay / area").fill("Tibanga");
  await page.getByLabel("Street address").fill("123 New Street");
  await page.getByRole("button", { name: /Submit/ }).click();
  await expect(page.getByRole("heading", { name: "Thanks!" })).toBeVisible();
  await page.getByRole("button", { name: "Go to your owner dashboard" }).click();
  await expect(page.getByText("New test cafe")).toBeVisible();
});

test("mobile navigation exposes the guide and owner tools", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByText("Menu", { exact: true }).click();
  await expect(page.getByRole("link", { name: "Coffee guide" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cafe owners" }).last()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("SSR network failure recovers through direct browser reads", async ({ page, request }) => {
  await request.post("http://localhost:4100/__test/outage", { data: { mode: "server" } });
  try {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.getByText("2 shops found")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "We couldn't reach the coffee directory" }),
    ).toHaveCount(0);
    await page.goto("/guide");
    await expect(page.getByRole("heading", { name: "Test Iligan Cafe" }).first()).toBeVisible();
    await page.goto("/shops/test-cdo-cafe");
    await expect(page.getByRole("heading", { name: "Test CDO Cafe", level: 1 })).toBeVisible();
  } finally {
    await request.post("http://localhost:4100/__test/outage", { data: { mode: "none" } });
  }
});

test("a real outage shows an error, not an empty directory, and retry recovers", async ({
  page,
  request,
}) => {
  await request.post("http://localhost:4100/__test/outage", { data: { mode: "all" } });
  try {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "We couldn't reach the coffee directory" }),
    ).toBeVisible();
    await expect(page.getByText("0 shops found")).toHaveCount(0);
    await request.post("http://localhost:4100/__test/outage", { data: { mode: "none" } });
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("2 shops found")).toBeVisible();
  } finally {
    await request.post("http://localhost:4100/__test/outage", { data: { mode: "none" } });
  }
});
