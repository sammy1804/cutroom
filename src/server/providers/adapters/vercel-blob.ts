import { del, get, put } from "@vercel/blob";
import type { StorageProvider } from "../capabilities/storage";

/**
 * Vercel Blob storage (production). Blobs are private: the browser never gets a
 * blob URL; files are streamed through /api/assets, which checks membership.
 */
export function createVercelBlobStorage(): StorageProvider {
  return {
    info: { id: "vercel-blob", label: "Vercel Blob", capabilities: ["storage"] },
    async put({ key, body, contentType }) {
      await put(key, Buffer.from(body), { access: "private", contentType, addRandomSuffix: false, allowOverwrite: true });
      return { key, size: body.byteLength };
    },
    async get(key) {
      const result = await get(key, { access: "private" });
      if (!result || !("stream" in result) || !result.stream) return null;
      return new Uint8Array(await new Response(result.stream).arrayBuffer());
    },
    async delete(key) {
      await del(key).catch(() => {});
    },
    async url(key) {
      return `/api/assets/${key.split("/").map(encodeURIComponent).join("/")}`;
    },
  };
}
