import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createLocalStorage } from "@/server/providers/adapters/local-storage";

describe("local storage adapter", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "cutroom-storage-"));
  const storage = createLocalStorage(dir);
  afterAll(() => rm(dir, { recursive: true, force: true }));

  it("round-trips objects", async () => {
    const body = new TextEncoder().encode("frame");
    await storage.put({ key: "org_1/a.txt", body, contentType: "text/plain" });
    expect(new TextDecoder().decode((await storage.get("org_1/a.txt"))!)).toBe("frame");
    await storage.delete("org_1/a.txt");
    expect(await storage.get("org_1/a.txt")).toBeNull();
  });

  it("refuses keys that escape the root", async () => {
    await expect(storage.get("../../etc/passwd")).rejects.toThrow(/Invalid storage key/);
  });
});
