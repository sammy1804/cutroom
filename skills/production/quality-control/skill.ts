import { z } from "zod";
import { contrast } from "@/lib/color";
import { getPreset } from "@/lib/animations/presets";
import { creativeSpecSchema } from "@/lib/creative-spec/schema";
import { defineSkill } from "@/server/skills/types";

const issue = z.object({
  severity: z.enum(["error", "warning", "tip"]),
  target: z.string().describe("Scene or element id, or 'spec'"),
  message: z.string(),
  fix: z.string().optional(),
});
export const qualityReportSchema = z.object({ score: z.number(), issues: z.array(issue) });

export default defineSkill({
  id: "production.quality-control",
  input: z.object({ spec: creativeSpecSchema }),
  output: qualityReportSchema,
  async run({ spec }) {
    const issues: z.infer<typeof issue>[] = [];
    const total = spec.scenes.reduce((n, s) => n + s.duration, 0);
    if (spec.aspect !== "16:9" && (total < 5 || total > 45)) issues.push({ severity: "warning", target: "spec", message: `Runs ${total.toFixed(1)}s; social pieces work best between 6 and 30 seconds.` });
    if (spec.scenes[0] && spec.scenes[0].duration > 3) issues.push({ severity: "warning", target: spec.scenes[0].id, message: "The hook lasts over 3 seconds; viewers decide in the first 1–2.", fix: "Shorten the first scene or cut to a visual change sooner." });
    const ratio = contrast(spec.style.foreground, spec.style.background);
    if (ratio < 4.5) issues.push({ severity: "error", target: "spec", message: `Text contrast is ${ratio.toFixed(1)}:1; aim for at least 4.5:1.`, fix: "Pick a lighter text colour or darker background." });
    for (const s of spec.scenes) {
      if (!s.elements.length) issues.push({ severity: "warning", target: s.id, message: "This scene has nothing on it." });
      const words = s.elements.filter((e) => e.text).reduce((n, e) => n + e.text!.split(/\s+/).filter(Boolean).length, 0);
      const need = words * 0.3 + 0.5;
      if (words && need > s.duration + 0.05) issues.push({ severity: "warning", target: s.id, message: `${words} words need about ${need.toFixed(1)}s to read; the scene is ${s.duration}s.`, fix: `Lengthen to ${Math.ceil(need * 2) / 2}s or cut words.` });
      if (s.background.color && contrast(spec.style.foreground, s.background.color) < 4.5 && !s.elements.some((e) => e.type === "image"))
        issues.push({ severity: "warning", target: s.id, message: "Text may be hard to read on this background colour." });
      for (const e of s.elements) {
        if ((e.type === "image" || e.type === "logo") && !e.src) issues.push({ severity: "error", target: e.id, message: "Image element has no image yet.", fix: "Choose one from the asset library." });
        if (e.animation && !getPreset(e.animation.presetId)) issues.push({ severity: "error", target: e.id, message: `Unknown animation "${e.animation.presetId}".` });
        if (e.text && /^\[.*\]$/.test(e.text.trim())) issues.push({ severity: "error", target: e.id, message: `Placeholder text "${e.text.trim()}" is still in the piece.`, fix: "Write the real line in the Story stage." });
        if (e.type === "headline" && e.text && e.text.split(/\s+/).length > 9) issues.push({ severity: "tip", target: e.id, message: "Headline is long for motion; 3–8 words read best." });
      }
      if (s.transition && !getPreset(s.transition.presetId)) issues.push({ severity: "error", target: s.id, message: `Unknown transition "${s.transition.presetId}".` });
    }
    const score = Math.max(0, 100 - issues.reduce((n, i) => n + (i.severity === "error" ? 20 : i.severity === "warning" ? 8 : 2), 0));
    return { score, issues };
  },
});
