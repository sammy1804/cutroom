# Brainstorm: what Riffle gets right, what to borrow, and a library that doesn't need AI

_13 Oct 2026. Research notes, not decisions._

## 1. Riffle in one paragraph

Riffle ("the intelligent canvas to make music with your people") is a browser-based, multiplayer music studio.
You open an **infinite canvas**, drop anything on it (audio, lyrics, images, embeds, notes), **stack sounds layer by
layer** from a **licensed sample library**, play built-in instruments and drum pads from the keyboard, record your own
takes, and edit together in real time. **Sous chef** is the AI co-producer: it finds sounds, generates a sample from a
description, suggests lyric edits and MIDI, and proposes next steps, but "you're always in control: keep, tweak, or cut
every suggestion". Public **drops** let people listen, comment and remix. It's free to start; a pro tier funds
generation credits, which are deliberately kept out of the user's face to protect flow. Launched Aug 2026 after early
access with ~7,000 musicians; 14,800+ artists on the site.

Sources: riffle.studio, Music Ally (12 Aug 2026), Next Up India #11, F4 Fund profile.

## 2. Why it works without AI for most tasks

| Riffle mechanic | Why no AI is needed | Cutroom equivalent |
|---|---|---|
| Licensed sample library | Curated, pre-cleared content beats generating it | Licence-checked asset + animation library |
| Instruments, drum pads | Deterministic tools that respond instantly | Animation presets, transitions, layout templates |
| Stacks (layer sounds) | Composition = arranging known parts | Scenes = stacking elements with presets |
| Canvas you drop anything on | Organising is a UI problem, not an AI problem | A project board (refs, assets, notes, palettes) |
| Real-time multiplayer | Infrastructure, not intelligence | Comments → live cursors later |
| Drops + remix | Reuse multiplies the library for free | Templates (saved compositions) + workspace "drops" |
| Sous chef at the edges | AI only for search, transformation and grunt work | Brain, directions, storyboard drafts, critique |
| Credits hidden | Cost doesn't interrupt creativity | Cache + cheap deterministic skills first |

**The lesson:** the *core loop* is browse → drop → stack → tweak → share, and every step is deterministic and instant.
AI is a collaborator you call when you want it, never the gate in front of every action. "Anti-slop" is a positioning
choice: control and taste over one-prompt generation (they explicitly contrast themselves with Suno).

## 3. Features worth borrowing

| From | Feature | In Cutroom | AI? |
|---|---|---|---|
| **Riffle** | Drop anything on an infinite canvas | **Project board**: references, assets, palettes, notes, scenes on one canvas | No |
| Riffle | Stacks | Scene = stack of elements; reorder by drag | No |
| Riffle | Drops + remix | Publish a composition to the workspace (later public); "Remix" = duplicate with lineage | No |
| Riffle | Sous chef, "keep / tweak / cut" | Every AI suggestion arrives as a diff on the CreativeSpec you accept or reject | Yes (edge) |
| **Notion** | `/` slash menu + blocks | `/` in the board and storyboard: add scene, headline, image, palette, reference | No |
| Notion | Databases with views (table / board / gallery) | Library and projects as one database: gallery, board-by-stage, table | No |
| Notion | Templates + buttons | One-click "Product launch Reel", "Testimonial", "Stat card" templates | No |
| Notion | Agent "Plan mode" (preview, then approve) | AI shows the plan of skill runs and cost before running | Yes |
| Notion | Triggers (schedule, property change) | "When a reference is approved → update CreativeDNA" | Mostly no |
| **Figma** | Components + variants + instances | Scenes and elements as components; change the master, every instance updates | No |
| Figma | Auto layout / Grid | Layout presets that reflow per format (9:16 ↔ 16:9) | No |
| Figma | Buzz: bulk assets from a spreadsheet | **Batch**: one template × CSV rows → 50 variants (products, prices, cities) | No |
| Figma | Motion on the canvas, code layers | Our Remotion presets on the board; spec as code | No |
| Figma | Comments pinned to objects, version history | Comments on `scene_03.headline`; spec versions you can restore | No |
| **Claude** | Projects with knowledge | Workspace brand kit + creative memory feeding every skill | — |
| Claude | Artifacts (live preview of output) | Every AI output is a live, editable preview (spec), never a static file | — |
| Claude | Skills | Already built: `skills/` registry | — |
| Claude | Citations | Research claims link to sources (have) | Yes |
| **Are.na** | Blocks connected to many channels | A reference can live in many boards; "connections" show where it's used | No |
| **Cosmos** | Visual similarity clusters | "More like this" by colour/composition features (deterministic first) | Optional |
| **Canva** | Brand kit, magic resize | Brand kit (logo, fonts, colours) + format adaptation rules | No |
| **Jitter / Rive** | Simple timeline, motion presets | Lightweight scene timeline with preset tracks | No |
| **Linear** | Keyboard-first, instant | ⌘K, `/`, single-key shortcuts, optimistic UI | No |

## 4. Engines that replace AI calls (deterministic first)

| Engine | How it works | Replaces |
|---|---|---|
| **Palette engine** | k-means/median-cut on images → 5 colours; harmony rules; WCAG contrast pairing (have `paletteToStyle`) | "Suggest colours" prompts |
| **Type pairing** | Curated pairing table (Google Fonts, OFL) × mood tags | "Pick fonts" prompts |
| **Layout engine** | Named layouts (hero, split, lower-third, grid) with safe zones per aspect | AI layout generation |
| **Format adaptation** | Rules: reflow regions, scale type to width, keep safe zones per platform | "Turn this into a Reel" |
| **Beat sync** | In-browser onset/tempo detection (Web Audio) → snap scene cuts to beats | AI pacing |
| **Caption timing** | Words-per-second or real word timings → per-word captions (have components) | AI captioning |
| **Smart crop** | Saliency/face-aware crop (smartcrop-style) per aspect | AI reframing |
| **Template remix** | Swap text/assets/colours in a saved composition; CSV batch | Regeneration |
| **Command grammar** | Parse "make scene 2 longer", "use liquid transition" directly; fall back to AI only if unparsed | AI routing for simple edits |
| **Quality control** | Have it: reading time, contrast, hook timing, placeholders | AI critique for basics |
| **Similarity** | Colour histograms, aspect, tags, palette distance; embeddings later if needed | AI search |

AI stays for: turning a vague idea into directions, research synthesis, storyboard drafts, critique of taste,
and anything the grammar can't parse. Rough target: **80% of actions run with zero AI calls.**

## 5. Growing the library without AI (open-licence sources)

Principle: ingest through **official APIs** with licence metadata, precompute features (palette, orientation,
duration, tags) deterministically, search locally. Inspiration sites stay **reference-only** (browser capture).

| Layer | Source | Licence | Access | Use as |
|---|---|---|---|---|
| Motion | LottieFiles free animations | Lottie Simple License (commercial OK; check per file; no standalone resale) | Site/API | Render with `@remotion/lottie` as editable motion elements |
| Motion | Our presets (95) | Ours | — | Core |
| Icons | Lucide (ISC), Phosphor (MIT), Tabler (MIT) | Permissive | npm | Animated icon elements (stroke draw, pop) |
| Fonts | Google Fonts | OFL | API | Type pairing engine |
| Textures / HDRIs | Poly Haven | CC0 (API asks for "Powered by Poly Haven") | API, no key | Backgrounds, grain, 3D scenes |
| Textures | ambientCG | CC0 | API (verify) | Backgrounds |
| Art & archival | Met, Art Institute of Chicago, Cleveland Museum of Art | CC0 (public-domain works) | APIs (Cleveland keyless; verify Met/AIC) | Editorial imagery, collage |
| Art & archival | Smithsonian Open Access | CC0 | API (free api.data.gov key) | Same |
| Photo/video | Openverse, Wikimedia (have); Pexels, Pixabay (have, need keys) | Per item / platform | API | Footage, photos |
| Audio | Freesound | Per sound (filter CC0/CC-BY) | API (key) | SFX: whoosh, hits, risers |
| Audio | Pixabay Music, Free Music Archive, Musopen | Platform licence / per-track CC / public domain | API or bulk | Music beds |
| References | Are.na | User content: reference only | Official API (token) | Moodboards |
| References | Awwwards, Godly, SiteInspire, Land-book… | Reference only | Browser capture (have) | Visual research |

**Not allowed as a foundation:** scraping Pinterest/Behance/Instagram into the asset library, or any source whose
terms forbid it. These stay reference-only, captured one page at a time for a project.

## 6. A Riffle-shaped Cutroom

1. **Board-first project.** Opening a project lands on a canvas: drop references, assets, notes, palettes, Lottie
   files; scenes are cards you stack and reorder. The journey stages become *views* of the same board, not pages.
2. **Library drawer** on the left of the board (like Riffle's Library panel): Animations, Lottie, Icons, Textures,
   Photos, Audio, Templates, all searchable instantly, all draggable.
3. **Sous chef panel** on the right: suggestions arrive as accept/reject diffs; shows the skills it will run and cost.
4. **Drops**: publish a composition to the workspace; others remix it. Later: public drops.
5. **Batch** (Figma Buzz): one template × spreadsheet → many variants, rendered together.
6. **Multiplayer** later: comments on element ids first, live cursors after.

## 7. Suggested next increments

1. **Library harvester**: one deterministic skill per source (Poly Haven, Cleveland/Met/AIC, Lottie, Freesound CC0,
   Google Fonts) writing to a unified `library_item` table with rights + features. Start with Poly Haven + Cleveland
   (keyless, CC0) and Lottie via `@remotion/lottie`.
2. **Palette + type + layout engines** wired into Design stage (no AI).
3. **Command grammar** for the ⌘K bar and spec edits; AI only as fallback.
4. **Board view** for projects with a library drawer and drag-to-scene.
5. **Batch from CSV** on templates.

## 8. Open questions

- Should the project *be* a canvas (Riffle/Figma), with the journey as a guide, or keep the stage pages and add a board?
- Workspace-only drops first, or public community from day one?
- Which three sources matter most to your clients: motion (Lottie), art/archival (museums), or music/SFX?
