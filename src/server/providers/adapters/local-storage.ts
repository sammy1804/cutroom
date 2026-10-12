import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError } from "@/server/errors";
import type { StorageProvider } from "../capabilities/storage";

/** Filesystem storage for development. Keys are namespaced by organization by callers. */
export function createLocalStorage(rootDir: string): StorageProvider {
  const root = path.resolve(rootDir);

  const resolveKey = (key: string) => {
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) {
      throw new AppError("VALIDATION", "Invalid storage key.");
    }
    return full;
  };

  return {
    info: { id: "local", label: "Local filesystem", capabilities: ["storage"] },
    async put({ key, body }) {
      const full = resolveKey(key);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, body);
      return { key, size: body.byteLength };
    },
    async get(key) {
      try {
        return new Uint8Array(await readFile(resolveKey(key)));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    async delete(key) {
      await rm(resolveKey(key), { force: true });
    },
    async url(key) {
      return `/api/assets/${key.split("/").map(encodeURIComponent).join("/")}`;
    },
  };
}
