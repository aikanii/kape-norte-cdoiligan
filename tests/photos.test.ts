import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  uploadShopPhoto,
  validatePhoto,
  MAX_PHOTO_BYTES,
  deleteShopPhoto,
} from "../src/lib/photos";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  insert: vi.fn(),
  deleted: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) },
    from: () => ({
      insert: mocks.insert,
      delete: () => ({ eq: () => ({ select: () => ({ single: mocks.deleted }) }) }),
    }),
  },
}));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.insert.mockResolvedValue({ error: null });
  mocks.deleted.mockResolvedValue({ error: null });
});

describe("photo uploads", () => {
  it("rejects non-images, empty and oversized files before uploading", () => {
    expect(() => validatePhoto(new File(["bad"], "bad.html", { type: "text/html" }))).toThrow(
      "JPG",
    );
    expect(() => validatePhoto(new File([], "empty.png", { type: "image/png" }))).toThrow("empty");
    expect(() =>
      validatePhoto(
        new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], "big.png", { type: "image/png" }),
      ),
    ).toThrow("5 MB");
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("removes orphaned uploads when the photo record cannot be saved", async () => {
    mocks.insert.mockResolvedValue({ error: { message: "Insert failed" } });
    await expect(
      uploadShopPhoto("shop", "user", new File(["image"], "cafe.png", { type: "image/png" })),
    ).rejects.toThrow("Insert failed");
    expect(mocks.remove).toHaveBeenCalledWith([expect.stringMatching(/^user\/.+\.png$/)]);
  });
  it("does not delete storage when the record deletion was denied", async () => {
    mocks.deleted.mockResolvedValue({ error: { message: "Not allowed" } });
    await expect(
      deleteShopPhoto({
        id: "photo",
        shop_id: "shop",
        storage_path: "user/photo.png",
        caption: "",
        sort_order: 0,
        uploaded_by: "user",
        created_at: "",
      }),
    ).rejects.toThrow("Not allowed");
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
