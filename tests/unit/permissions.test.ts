import { describe, expect, it } from "vitest";
import { can, parseRoles, primaryRole } from "@/lib/permissions";

describe("permissions", () => {
  it("lets owners and admins manage members, but not editors or viewers", () => {
    expect(can("owner", { member: ["update"] })).toBe(true);
    expect(can("admin", { member: ["update"] })).toBe(true);
    expect(can("editor", { member: ["update"] })).toBe(false);
    expect(can("viewer", { member: ["update"] })).toBe(false);
  });

  it("lets editors create and archive projects but not delete them", () => {
    expect(can("editor", { project: ["create", "update", "archive"] })).toBe(true);
    expect(can("editor", { project: ["delete"] })).toBe(false);
  });

  it("gives viewers no write access", () => {
    expect(can("viewer", { project: ["create"] })).toBe(false);
    expect(can("viewer", { campaign: ["update"] })).toBe(false);
    expect(can("viewer", { job: ["create"] })).toBe(false);
  });

  it("only lets owners delete the workspace", () => {
    expect(can("owner", { organization: ["delete"] })).toBe(true);
    expect(can("admin", { organization: ["delete"] })).toBe(false);
  });

  it("handles multi-role strings and unknown roles", () => {
    expect(parseRoles("viewer, editor,bogus")).toEqual(["viewer", "editor"]);
    expect(can("viewer,editor", { project: ["create"] })).toBe(true);
    expect(can("bogus", { project: ["create"] })).toBe(false);
    expect(primaryRole("viewer,admin")).toBe("admin");
    expect(primaryRole("")).toBe("viewer");
  });
});
