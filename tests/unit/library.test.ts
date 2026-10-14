import { describe, expect, it } from "vitest";
import { getPreset } from "@/lib/animations/presets";
import { CURATED_ANIMATIONS, CURATED_PRESETS, CURATED_TRANSITIONS, isCore } from "@/lib/library/curation";
import { publishedTemplates, TEMPLATES, validateTemplate } from "@/lib/library/registry";
import { ANIMATION_GROUPS, TRANSITION_GROUPS } from "@/lib/library/taxonomy";
import { passesQualityGate, QUALITY_CRITERIA, resolveFields, type QualityScore } from "@/lib/library/types";

const score = (v: number, over: Partial<QualityScore> = {}): QualityScore => ({ ...(Object.fromEntries(QUALITY_CRITERIA.map((c) => [c, v])) as Record<(typeof QUALITY_CRITERIA)[number], number>), reviewer: "t", reviewedAt: "2026-10-14", ...over });

describe("library curation", () => {
  it("only curates presets that exist, each in a real taxonomy slot", () => {
    for (const c of CURATED_PRESETS) {
      expect(getPreset(c.preset.id)).toBeTruthy();
      if (c.group === "transition") expect(TRANSITION_GROUPS as readonly string[]).toContain(c.subgroup);
      else expect(ANIMATION_GROUPS.find((g) => g.id === c.group)?.subgroups as readonly string[]).toContain(c.subgroup);
    }
    expect(CURATED_ANIMATIONS.length + CURATED_TRANSITIONS.length).toBe(CURATED_PRESETS.length);
  });

  it("keeps decorative effects out of the library", () => {
    for (const id of ["background-particle-field", "background-aurora", "background-mesh", "background-gradient-flow", "background-liquid", "background-glow", "text-flicker", "text-glitch", "image-rgb-split", "3d-depth-tunnel", "transition-liquid", "transition-pixel"]) {
      expect(isCore(id)).toBe(false);
    }
    // Legacy presets still render so older work keeps working.
    expect(getPreset("background-aurora")).toBeTruthy();
  });
});

describe("template quality gate", () => {
  it("publishes only reviewed templates averaging 4 with nothing below 3", () => {
    expect(passesQualityGate(undefined).ok).toBe(false);
    expect(passesQualityGate(score(4)).ok).toBe(true);
    expect(passesQualityGate(score(5, { originality: 2 }))).toMatchObject({ ok: false, weakest: "originality" });
    expect(passesQualityGate(score(3.8)).ok).toBe(false);
  });

  it("validates every registered template and resolves editable fields", () => {
    for (const t of TEMPLATES) validateTemplate(t);
    expect(publishedTemplates().every((t) => passesQualityGate(t.meta.quality).ok)).toBe(true);
    const fields = [{ key: "headline", label: "Headline", type: "text" as const, default: "FORM 01" }];
    expect(resolveFields(fields, { headline: "Mark II", stray: "x" })).toEqual({ headline: "Mark II" });
    expect(resolveFields(fields)).toEqual({ headline: "FORM 01" });
  });
});
