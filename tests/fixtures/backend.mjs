// Isolated browser-test backend. Never used by the app outside Playwright's webServer.
import { createServer } from "node:http";

const shops = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "test-iligan-cafe",
    name: "Test Iligan Cafe",
    city: "Iligan City",
    area: "Tibanga",
    address: "123 Test Street",
    blurb: "A test cafe",
    price_level: 2,
    tags: ["Wi-Fi"],
    photo_path: null,
    google_photo_url: null,
    google_photo_attribution: null,
    lat: 8.24,
    lng: 124.24,
    hours: { mon: ["08:00", "20:00"] },
    status: "published",
    submitted_by: null,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    slug: "test-cdo-cafe",
    name: "Test CDO Cafe",
    city: "Cagayan de Oro",
    area: "Nazareth",
    address: "456 Other Street",
    blurb: "Another test cafe",
    price_level: 4,
    tags: ["Outdoor seating"],
    photo_path: null,
    google_photo_url: null,
    google_photo_attribution: null,
    lat: 8.47,
    lng: 124.64,
    hours: {},
    status: "published",
    submitted_by: null,
  },
];
const user = {
  id: "33333333-3333-4333-8333-333333333333",
  aud: "authenticated",
  role: "authenticated",
  email: "test@example.com",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-09-20T00:00:00Z",
};
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.signature`;

let outage = "none";

createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    req.headers["access-control-request-headers"] ||
      "authorization,apikey,content-type,x-client-info,prefer,x-supabase-api-version",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") {
    res.end();
    return;
  }
  const url = new URL(req.url, "http://localhost");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
  const reply = (data, status = 200) => {
    res.statusCode = status;
    res.end(JSON.stringify(data));
  };
  if (url.pathname === "/__test/outage") {
    outage = body.mode ?? "none";
    return reply({ ok: true });
  }
  if (
    url.pathname.startsWith("/rest/v1/") &&
    (outage === "all" || (outage === "server" && !req.headers.origin))
  ) {
    return reply({ message: "Fixture: network unavailable" }, 503);
  }
  if (url.pathname === "/auth/v1/token") {
    if (body.password !== "correct-password")
      return reply({ error: "invalid_grant", error_description: "Invalid login credentials" }, 400);
    return reply({
      access_token: token,
      refresh_token: "test-refresh",
      token_type: "bearer",
      expires_in: 3600,
      user,
    });
  }
  if (url.pathname === "/auth/v1/user") return reply(user);
  if (url.pathname === "/rest/v1/rpc/has_role") return reply(false);
  if (url.pathname === "/rest/v1/shops") {
    if (req.method === "POST") {
      const row = {
        ...body,
        id: "44444444-4444-4444-8444-444444444444",
        photo_path: null,
        google_photo_url: null,
        google_photo_attribution: null,
      };
      shops.push(row);
      return reply(row, 201);
    }
    let rows = shops.filter((shop) =>
      ["id", "slug", "status", "submitted_by"].every((key) => {
        const filter = url.searchParams.get(key);
        return (
          !filter || filter === `eq.${shop[key]}` || (filter === "is.null" && shop[key] === null)
        );
      }),
    );
    if (req.headers.accept?.includes("vnd.pgrst.object")) rows = rows[0] ?? null;
    return reply(rows);
  }
  if (url.pathname === "/rest/v1/page_views") return reply(null, 201);
  if (url.pathname.startsWith("/rest/v1/")) return reply([]);
  reply({ ok: true });
}).listen(4100, "0.0.0.0");
