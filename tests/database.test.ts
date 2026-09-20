import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PGlite();
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const admin = "33333333-3333-4333-8333-333333333333";
const shop = "44444444-4444-4444-8444-444444444444";
const unclaimed = "55555555-5555-4555-8555-555555555555";
const claim = "66666666-6666-4666-8666-666666666666";
const competitor = "77777777-7777-4777-8777-777777777777";

async function asUser(id: string) {
  await db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub', '${id}', false); SET ROLE authenticated;`,
  );
}

beforeAll(async () => {
  // Minimal Supabase-provided schemas; all application tables/policies come from real migrations.
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text);
    CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1, '/') $$;
    GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role;
  `);
  for (const file of readdirSync("supabase/migrations")
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  }
  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES ('${owner}', 'owner@test.test'), ('${other}', 'other@test.test'), ('${admin}', 'admin@test.test');
    INSERT INTO public.user_roles (user_id, role) VALUES ('${admin}', 'admin');
    INSERT INTO public.shops (id, slug, name, city, area, address, lat, lng, submitted_by)
      VALUES ('${shop}', 'owned', 'Owned Cafe', 'Iligan City', 'Tibanga', 'Street', 8, 124, '${owner}'),
             ('${unclaimed}', 'unclaimed', 'Unclaimed Cafe', 'Iligan City', 'Tibanga', 'Street', 8, 124, null);
    INSERT INTO public.shop_claims (id, shop_id, user_id, contact_name, contact_email)
      VALUES ('${claim}', '${unclaimed}', '${other}', 'Other Owner', 'other@test.test'),
             ('${competitor}', '${unclaimed}', '${owner}', 'Owner', 'owner@test.test');
  `);
});

afterAll(async () => {
  await db.close();
});

describe("database authorization and admin workflow", () => {
  it("creates the private photo bucket on a fresh database", async () => {
    const result = await db.query(
      "SELECT public, file_size_limit FROM storage.buckets WHERE id = 'shop-photos'",
    );
    expect(result.rows).toEqual([{ public: false, file_size_limit: 5242880 }]);
  });
  it("allows owners to edit details but not self-publish or change ownership", async () => {
    await asUser(owner);
    await db.query(`UPDATE shops SET name = 'Updated Cafe' WHERE id = '${shop}'`);
    await expect(
      db.query(`UPDATE shops SET status = 'published' WHERE id = '${shop}'`),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query(`UPDATE shops SET submitted_by = '${other}' WHERE id = '${shop}'`),
    ).rejects.toThrow(/permission denied/);
    await expect(db.query(`SELECT publish_shop('${shop}')`)).rejects.toThrow(/Forbidden/);
  });
  it("prevents another user from editing the listing", async () => {
    await asUser(other);
    const result = await db.query(
      `UPDATE shops SET name = 'Hijacked' WHERE id = '${shop}' RETURNING id`,
    );
    expect(result.rows).toEqual([]);
  });
  it("allows an admin to see and publish pending listings", async () => {
    await asUser(admin);
    expect((await db.query("SELECT id FROM shops WHERE status = 'pending'")).rows).toHaveLength(2);
    await db.query(`SELECT publish_shop('${shop}')`);
    expect((await db.query(`SELECT status FROM shops WHERE id = '${shop}'`)).rows).toEqual([
      { status: "published" },
    ]);
    await expect(db.query(`SELECT publish_shop('${shop}')`)).rejects.toThrow(/not found/);
  });
  it("rejects ownership decisions from non-admin users", async () => {
    await asUser(owner);
    await expect(db.query(`SELECT review_shop_claim('${claim}', true)`)).rejects.toThrow(
      /Forbidden/,
    );
  });
  it("atomically assigns an owner and rejects competing or repeated claims", async () => {
    await asUser(admin);
    await db.query(`SELECT review_shop_claim('${claim}', true)`);
    expect(
      (await db.query(`SELECT submitted_by FROM shops WHERE id = '${unclaimed}'`)).rows,
    ).toEqual([{ submitted_by: other }]);
    expect(
      (await db.query(`SELECT status FROM shop_claims WHERE id = '${competitor}'`)).rows,
    ).toEqual([{ status: "rejected" }]);
    await expect(db.query(`SELECT review_shop_claim('${competitor}', true)`)).rejects.toThrow(
      /already been reviewed/,
    );
    await expect(db.query(`SELECT review_shop_claim('${claim}', true)`)).rejects.toThrow(
      /already been reviewed/,
    );
  });
  it("requires photo references to point inside the uploader's folder", async () => {
    await asUser(owner);
    await expect(
      db.query(
        `INSERT INTO shop_photos (shop_id, uploaded_by, storage_path) VALUES ('${shop}', '${owner}', '${other}/stolen.png')`,
      ),
    ).rejects.toThrow(/row-level security/);
    await db.query(
      `INSERT INTO shop_photos (shop_id, uploaded_by, storage_path) VALUES ('${shop}', '${owner}', '${owner}/photo.png')`,
    );
  });
});
