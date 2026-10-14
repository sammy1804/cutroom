# Current library audit

_14 Oct 2026. Step 0 of the Motion Library + Template System rebuild._

## Current categories

The Library page has tabs: **Animations · Templates · My assets · Open library · Free assets · References · Audio · Creative memory**.
Animations are grouped by technical type (text, image, object, transition, background, 3d, component), not by creative outcome.

## Current templates

**None built in.** "Templates" lists compositions a workspace saved from a project (one in the local database). There is no template
metadata: no category, editable fields, aspect variants, durations, tags, preview video, author, licence or quality status.

## Current animation primitives (99 presets)

| Category | Count | Assessment |
|---|---|---|
| Text | 22 | Solid core (mask, line, character, word, tracking, split, typewriter, stamp). Demo-ish: Neon Flicker, Glitch, Gradient Sweep, Wave, Bounce. |
| Image | 11 | Ken Burns, slow zoom, pan, parallax, reveal, depth shift and cutout pop are useful. RGB Split is an effect, not a treatment. |
| Object | 12 | Generic motion verbs (float, wiggle, pulse) with no design context. |
| Transition | 16 | Mask/shape wipe, camera push/pull, whip, iris, split doors are usable. Liquid, Pixel, Grain, Light Leak read as effects. |
| Background | 13 | Mostly decorative: noise, aurora, mesh, glow, particles, liquid, gradient flow, scanlines. Paper and grain are the only ones a designer would use as material. |
| 3D | 6 | Technically impressive cards and tunnels; not product-grade (no real product model or lighting). |
| Component | 18 | Captions, lower third, quote card, metric counter, end card are genuinely useful building blocks. |

Each preset is a procedural Remotion renderer plus a typed parameter schema. That foundation is good: the editor preview, the
library preview and the final render run the same code.

**Open library (harvested):** 881 animated emoji (Noto), 868 textures and 997 HDRIs (Poly Haven). Under the new quality bar the emoji do
not belong in the creative library, and the textures and HDRIs are raw materials (assets), not motion.

## Current board capabilities

Frames are scenes (edited in place: words, colour, media, motion, timing); arrows set the order and carry the transition; the final
video plays at the end of the chain. Notes, references and palettes are loose cards. Live collaboration, comments, Sous chef
(deterministic fixes) and board packs (export/import) exist.

Missing against the brief: video/GIF/link/typography/shape/template/animation cards, grouping, multi-select, save selection to library,
send a selection to AI ("make a direction from these"), and generating anything but text.

## Current rendering architecture

- **CreativeSpec** (scenes → elements with stable ids) is the source of truth; `SpecComposition` renders it with Remotion.
- Previews are live `@remotion/player` instances (thumbnail at rest, play on hover). `scripts/render-reels.ts` renders MP4 reels with
  `@remotion/renderer`; there is no per-template preview render, poster or quality gate.
- Layouts are five fixed regions (center, top, bottom, lower-left, fullbleed) and one font stack per spec. That is the main ceiling
  on design quality today: no grid, no type scale, no layered composition.

## Current data model

`animation_preset` (custom parameter sets on top of code presets), `composition` (saved spec + name), `project.spec`, `project.board`,
`asset` (with rights), `library_item` (harvested open media). No `template`, `scene` or `transition` entity; no taxonomy.

## Current weaknesses

1. Organised by effect type, not creative outcome; nothing says "product launch" or "paper-cut story".
2. Too many decorative effects and emoji; the library reads as an effects marketplace.
3. No templates: users always start from a blank or AI-drafted spec.
4. Spec layout system is too coarse for editorial typography and layered composition.
5. Previews are sample text on a dark stage, not art-directed demo content.
6. No editable-field contract, so "customise this template" has no defined surface.
7. No quality gate or review status.

## What is reusable

The renderer/preset contract, `SpecComposition`, Remotion pipeline, board (frames/arrows/final video), rights model, skill runtime,
search skill infrastructure, board packs (for moving templates between workspaces), stop-motion cadence and cutout/paper components.

## What needs replacing

The Library page structure; preset taxonomy and visibility; the fixed five-region layout; sample-content previews; "Templates =
saved specs" with no metadata.

## Recommended architecture

```
MotionPrimitive (transform · opacity · scale · rotation · position · blur · mask · path · crop · tracking · variable font · distortion · camera · 3D)
  ↓ composed by
Animation component  (curated, taxonomised, art-directed preview)
  ↓ placed in
Scene                (layout grid + layers + animations; a reusable building block: opening, reveal, feature, CTA…)
  ↓ sequenced into
Composition          (scenes + transitions + audio, per aspect ratio)
  ↓ published as
Template             (composition + editable fields + metadata + preview MP4 + quality score)
```

- **Built-in templates live in code** (`src/lib/library/templates/<id>/`): a Remotion-renderable builder `(fields, aspect, duration) →
  CreativeSpec`, metadata, curated demo content, and a rendered MP4/poster under `public/library/`. Code means review, versioning and
  diffs; the MP4 is only the preview.
- **Workspace templates live in the database** (saved compositions gain the same metadata), so teams can publish their own.
- **One registry** (`src/lib/library`) serves Templates, Animations, Scenes, Transitions, Assets and Audio with the same shape:
  id, kind, category/subcategory, tags (style, industry, mood), aspect ratios, durations, preview, version, author, licence, status.
- **Quality gate**: every template is scored 1–5 on composition, typography, motion, pacing, hierarchy, usefulness, editability,
  originality, responsiveness and preview quality. Only `published` entries (average ≥ 4, nothing below 3) appear in the Library.
- **Curation**: existing presets are mapped into the new taxonomy as `core` (shown) or `legacy` (kept so old specs still render,
  never shown). Emoji and decorative backgrounds are legacy.
- **Spec v2** (Step 3): a 12-column layout grid with safe areas, a type scale, layered elements with per-element timing, so templates
  can be genuinely editorial.

## Order of work

1. Library architecture: entry types, registry, quality gate. **(this change)**
2. Taxonomy and curation; Library rebuilt Templates-first. **(this change)**
3. Motion primitives and Spec v2 layout grid / type scale.
4. 20 excellent components (the quality bar).
5. 10 complete templates, rendered and reviewed: Minimal Product Launch, Cinematic Product Reveal, Editorial Campaign, Paper Cut
   Story, Stop Motion Collage, Kinetic Typography Film, App Launch, Architecture Film, Data Story, Brand Manifesto.
6. Preview renders. 7. Editable fields. 8. Board upgrades. 9. AI recommendations. 10. Scale, benchmarked against the first ten.
