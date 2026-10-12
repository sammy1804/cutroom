import { describe, expect, it } from "vitest";
import { ccRights, stripHtml } from "@/server/providers/assets/types";
import { DEFAULT_SOURCES, isSameSite } from "@/lib/sources";

describe("licence parsing", () => {
  it("interprets Creative Commons and public-domain codes", () => {
    expect(ccRights("by")).toEqual({ attributionRequired: true, commercialUse: true, modificationAllowed: true });
    expect(ccRights("by-nc")).toMatchObject({ commercialUse: false });
    expect(ccRights("CC BY-ND 4.0")).toMatchObject({ modificationAllowed: false, commercialUse: true });
    expect(ccRights("cc0")).toMatchObject({ attributionRequired: false, commercialUse: true });
    expect(ccRights("pdm")).toMatchObject({ attributionRequired: false });
  });

  it("strips markup from provider metadata", () => {
    expect(stripHtml('<a href="x">Jane  Doe</a>')).toBe("Jane Doe");
    expect(stripHtml("")).toBeNull();
  });
});

describe("source registry", () => {
  it("keeps visual reference sites reference-only", () => {
    for (const key of ["pinterest", "cosmos", "behance", "arena", "dribbble", "awwwards", "godly", "siteinspire", "landbook", "refero"]) {
      const s = DEFAULT_SOURCES.find((d) => d.key === key)!;
      expect(s.role, key).toBe("reference");
      expect(s.rightsPolicy, key).toBe("reference_only");
    }
  });

  it("matches URLs to sources by domain, including subdomains", () => {
    expect(isSameSite("https://www.behance.net/gallery/1", "https://www.behance.net")).toBe(true);
    expect(isSameSite("https://uk.pinterest.com/pin/1", "https://www.pinterest.com")).toBe(true);
    expect(isSameSite("https://behance.net.evil.com", "https://www.behance.net")).toBe(false);
    expect(isSameSite("not a url", "https://x.com")).toBe(false);
  });
});
