import { z } from "zod";
import { contrast, saturation } from "@/lib/color";
import { getPreset } from "@/lib/animations/presets";
import { creativeSpecSchema, sceneId, type CreativeSpecDoc, type SpecElement } from "@/lib/creative-spec/schema";
import { defineSkill } from "@/server/skills/types";
import { shotSchema } from "../../creative/storyboard/skill";

const ok = (id: string | null | undefined, category: string) => (id && getPreset(id)?.category === category ? id : null);
const HEADLINE_SIZE = { "9:16": 64, "1:1": 72, "4:5": 68, "16:9": 76 } as const;

/** Picks background / foreground / accent from a palette so text stays readable (≥ 4.5:1 where possible). */
export function paletteToStyle(palette: string[]) {
  const colors = palette.filter((c) => /^#[0-9a-f]{6}$/i.test(c));
  const pool = colors.length >= 2 ? colors : ["#141210", "#f4ede3", "#1f6fd1"];
  // Prefer the palette's own colours; only fall back to white/near-black when nothing in it reaches 4.5:1.
  const pick = (candidates: string[]) => {
    let best = { bg: pool[0]!, fg: candidates[0]!, c: 0 };
    for (const bg of pool) for (const fg of candidates) {
      const c = contrast(bg, fg);
      if (fg !== bg && c > best.c) best = { bg, fg, c };
    }
    return best;
  };
  let best = pick(pool);
  if (best.c < 4.5) best = pick([...pool, "#ffffff", "#111111"]);
  const accent = [...pool].filter((c) => c !== best.bg && c !== best.fg).sort((a, b) => saturation(b) - saturation(a))[0] ?? best.fg;
  return { background: best.bg, foreground: best.fg, accent };
}

export default defineSkill({
  id: "production.spec-compile",
  input: z.object({
    title: z.string().max(120),
    aspect: z.enum(["9:16", "1:1", "4:5", "16:9"]).default("9:16"),
    palette: z.array(z.string()).default([]),
    font: z.enum(["sans", "serif", "mono"]).default("sans"),
    shots: z.array(shotSchema).min(1).max(24),
  }),
  output: creativeSpecSchema,
  async run(input) {
    const style = { ...paletteToStyle(input.palette), font: input.font };
    const spec: CreativeSpecDoc = {
      version: 1,
      title: input.title,
      aspect: input.aspect,
      fps: 30,
      style,
      scenes: input.shots.map((shot, i) => {
        const id = sceneId(i + 1);
        const elements: SpecElement[] = [];
        const words = shot.headline.split(/\s+/).length;
        elements.push({
          id: `${id}.headline`,
          type: "headline",
          text: shot.headline,
          layout: shot.layout === "fullbleed" ? "center" : shot.layout,
          size: Math.round(HEADLINE_SIZE[input.aspect] * (words > 6 ? 0.8 : 1)),
          animation: { presetId: ok(shot.animation, "text") ?? "text-mask-reveal", params: {} },
        });
        if (shot.subtitle) {
          elements.push({ id: `${id}.subtitle`, type: "subtitle", text: shot.subtitle, layout: shot.layout === "top" ? "top" : "bottom", size: 30, animation: { presetId: "text-word-stagger", params: { intensity: 30 } } });
        }
        const bgPreset = ok(shot.background, "background");
        return {
          id,
          purpose: shot.purpose,
          duration: Math.round(shot.duration * 10) / 10,
          notes: shot.visual !== "none" ? `Visual: ${shot.visual}` : undefined,
          camera: shot.camera,
          background: { color: /^#[0-9a-f]{6}$/i.test(shot.background) ? shot.background : style.background, preset: bgPreset ? { presetId: bgPreset, params: {} } : null },
          elements,
          transition: i < input.shots.length - 1 && ok(shot.transition, "transition") ? { presetId: shot.transition!, params: {} } : null,
          audio: shot.audio,
        };
      }),
    };
    return creativeSpecSchema.parse(spec);
  },
});
