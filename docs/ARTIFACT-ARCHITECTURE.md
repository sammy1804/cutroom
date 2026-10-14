# Architecture audit: Cutroom as an editable creative Artifact

_15 Oct 2026. Answers §41 of the "Editable Creative Artifact" brief before any rewrite._

## Current state

| Area | What exists | Verdict |
|---|---|---|
| Artifact structure | One personal artifact (Cutroom Studio): seven-stage planning desk with Claude assists and a Cutroom board-pack export. No motion runs inside it. | Keep as the planning surface; it is not the library. |
| Library | Next.js page; presets curated into a taxonomy (docs/LIBRARY-AUDIT.md); `TemplateDefinition` + quality gate exist with zero templates. Previews are sample text on a dark stage. | Taxonomy and gate stay. The page itself is replaced by the Artifact library. |
| Board | Frames = scenes, arrows = order + transition, final video node, live collaboration, comments, board packs. | Strong model; stays. Needs more object kinds and template ↔ board links. |
| Composition model | `CreativeSpec`: scenes → elements in five fixed layout regions, one font. | Too coarse for editorial work. Becomes one *source kind* among others, not the only one. |
| Animation model | 102 Remotion renderer presets with typed parameters (66 curated). Pure functions of frame. | The pattern (pure, time-addressable, typed params) is right; the presets are effects, not compositions. |
| Rendering | Remotion Player for preview; `@remotion/renderer` script for reels; no server render pipeline. | Keep for server-quality output later. |
| Preview | Live Player on hover in the Next app. | Right idea; the Artifact needs its own engine (no React/Remotion bundle inside it). |
| Editable state | Spec edits through the frame editor; template `editableFields` defined but unused. | Generalise into `editableProperties` that generate the editor. |
| Assets | Workspace assets with rights; uploads; board packs carry files. | Stays; Artifact uses the `assets` capability for its own uploads. |

## What works

Pure, seekable renderers; typed parameters; rights on every asset; frames-and-arrows board; board packs for moving work between places; the quality gate.

## What doesn't

There are no complete compositions, so nothing in the library is immediately useful. Layout and typography are too constrained for
editorial or product work. Editing is per-element, not per-property of a creative idea. The Next.js library can't be the "creative
archive" the brief describes without becoming a second app.

## Recommended architecture

```
ARTIFACT (artifact-first)
├── Engine        pure render(ctx, t, props, W, H) on <canvas>; seekable; aspect-aware; exports with MediaRecorder
├── Library       CreativeObjects: TEMPLATE · ANIMATION · TRANSITION (SCENE · 3D · AUDIO next)
├── Viewer        play / pause / scrub / frame step, scene markers, variants, aspect switch
├── Editor        controls generated from editableProperties; "edit with words" changes only named properties
├── Board         sequence of object instances + transitions + notes; plays and exports as one video
└── AI            Claude for semantic search and property-level edits (never regenerates a whole piece)
```

The same `render(t, props)` functions are the editable source and can be wrapped as Remotion compositions for server rendering;
the MP4/WebM is only the preview or the output.

## CreativeObject schema

See `src/lib/library/creative-object.ts` (Zod), mirrored by the Artifact's registry:

```
CreativeObject {
  id, name, type (TEMPLATE | ANIMATION | SCENE | TRANSITION | COMPOSITION | ASSET | 3D | AUDIO),
  category, tags, description,
  preview { posterTime },            // live render is the preview; rendered files are optional
  source { engine: "cutroom-canvas" | "remotion", entry },
  editableProperties [{ key, label, type, default, options|min|max, group }],
  variants [{ id, name, props }],     // shared implementation, different defaults
  scenes [{ id, name, start, end }],  // timeline markers in seconds
  aspectRatios, duration, style, difficulty, version
}
```

## Library architecture

Objects are code-defined renderers plus metadata, registered in one list. A factory script (next step) bundles reviewed objects into the
Artifact; user edits are saved as *instances* `{objectId, variant, aspect, props}` — never copies of code.

## Board architecture

v1 in the Artifact: an ordered sequence of instances with a transition between each pair, notes, one aspect ratio, play and export.
Next: free canvas placement (text, image, colour, type, reference cards), "turn selection into a video", and template → board explode.

## First 20 templates

Built in this pass (the quality bar): **Minimal Product Launch**, **Paper Cut Story**, **Stop Motion Collage**, **Kinetic Typography
Film**, **Magazine Opener**, **Data Story**, **Brand Manifesto**, **App Launch**. Next: Cinematic Product Reveal, Editorial Product Launch,
Architecture Film, Feature Announcement, Photo Essay, Founder Story, Product Feature Film, Editorial Campaign, Event Announcement,
Material Study, Documentary Opener, Experimental Motion Film.
