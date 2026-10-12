import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "@/lib/slug";
import { campaignSchema, projectSchema, signUpSchema } from "@/lib/validation";

describe("slugify", () => {
  it("normalises names into url-safe slugs", () => {
    expect(slugify("Halden Coffee Roasters")).toBe("halden-coffee-roasters");
    expect(slugify("  Café — Spring '27!  ")).toBe("cafe-spring-27");
    expect(slugify("###")).toBe("");
  });

  it("finds the next free slug", async () => {
    const taken = new Set(["studio", "studio-2"]);
    expect(await uniqueSlug("Studio", async (s) => taken.has(s))).toBe("studio-3");
    expect(await uniqueSlug("!!!", async () => false)).toBe("untitled");
  });
});

describe("projectSchema", () => {
  it("adds a protocol to bare website domains and drops empty optionals", () => {
    const parsed = projectSchema.parse({ name: "Halden", websiteUrl: "haldencoffee.com", description: "  " });
    expect(parsed.websiteUrl).toBe("https://haldencoffee.com");
    expect(parsed.description).toBeUndefined();
    expect(parsed.color).toBe("#d4a373");
  });

  it("rejects short names and bad urls", () => {
    const result = projectSchema.safeParse({ name: "H", websiteUrl: "not a url" });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["name", "websiteUrl"]));
  });
});

describe("campaignSchema", () => {
  it("accepts a minimal campaign with defaults", () => {
    const parsed = campaignSchema.parse({ name: "Autumn drop" });
    expect(parsed).toMatchObject({ objective: "awareness", channels: [], aspectRatios: [] });
    expect(parsed.dueDate).toBeUndefined();
  });

  it("rejects unknown channels, ratios and malformed dates", () => {
    expect(campaignSchema.safeParse({ name: "Drop", channels: ["myspace"] }).success).toBe(false);
    expect(campaignSchema.safeParse({ name: "Drop", aspectRatios: ["21:9"] }).success).toBe(false);
    expect(campaignSchema.safeParse({ name: "Drop", dueDate: "12/01/2027" }).success).toBe(false);
  });
});

describe("signUpSchema", () => {
  it("lowercases email and enforces password length", () => {
    expect(signUpSchema.parse({ name: "Ines Varga", email: "Ines@Halden.COM ", password: "longenough" }).email).toBe("ines@halden.com");
    expect(signUpSchema.safeParse({ name: "Ines", email: "ines@halden.com", password: "short" }).success).toBe(false);
  });
});
