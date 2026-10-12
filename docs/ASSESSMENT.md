# Implementation assessment: Cutroom → AI Creative Cloud

_12 Oct 2026, against the Master Build Prompt._

## Current state

One Next.js 15 app (TypeScript, Tailwind v4, shadcn/ui), Postgres via Drizzle (Neon in production), Better Auth,
deployed on Vercel at cutroom-cyan-eight.vercel.app, with storage on local disk or Vercel Blob.

| Area | What exists | Fit with the brief |
|---|---|---|
| Tenancy | Organization → members (owner/admin/editor/viewer) → projects → campaigns, every query scoped by org | Good. Roles need designer + marketer |
| Providers | `LlmProvider`, `ResearchProvider`, media, render and storage interfaces; Claude (Opus 5.5) implemented; local + Vercel Blob storage | Good shape, but agents call `claude.ts` directly instead of going through the interface |
| Jobs | `job` table + in-process runner (`after()`), polled by the UI | Works for MVP; no retries or queue |
| Research | Campaign research (web search + fetch), BrowserResearchAgent (Playwright → screenshots → Claude analysis → ranked references with section crops), Source Registry with reference/asset rights split | Matches §14–16 closely |
| Creative | CreativeDNA from approved references, Company Creative Library (approved decisions), asset sourcing with `AssetRights` | Matches §21 partially |
| Motion | 95 procedural presets (typed params, Remotion renderers, combos), natural-language animation search, 4 rendered reference reels | Matches §28–29 |
| Spec | `campaign.creative_spec` = list of chosen animations | **Not** a scene/element CreativeSpec |
| UI | Overview, Projects, Library, Creative library, Settings, ⌘K | Navigation differs from Home / Explore / Library / Create / Brain |

## Architecture gaps

1. **No Skill Registry or skill runtime.** Capabilities are hard-wired functions. Nothing to discover, validate, version,
   cache or observe. This is the core idea of the brief and the biggest gap.
2. **No observability.** We can't answer "which skill ran, with what, for how long, at what cost, on which provider".
3. **No CreativeSpec / storyboard / scene-element model** with stable IDs, so no editable preview and no targeted AI edits.
4. **No project journey** (Idea → Explore → Direction → Story → Design → Motion → Final) and **no Brain**.
5. **Provider abstraction is bypassed** by agents; there is no per-call usage or cost reporting.
6. **Video and audio understanding** (FFmpeg, scene detection, OCR, transcription) don't exist. These need a media worker, which is a later phase.
7. **Marketing-intelligence entities** (brands, external campaigns, posts, creative patterns, market map) don't exist.

## What can be reused

Auth, tenancy, services pattern, error/`ActionResult` model, job table and runner, Source Registry, BrowserResearchAgent,
research, asset providers and rights model, CreativeDNA, the animation library and renderers, Remotion setup, storage
adapters, the a11y-clean Notion-style UI and the Vercel deployment. Most of it moves *behind* skills rather than being rewritten.

## What should be removed or changed

- `campaign.creative_spec` (animation list) → superseded by the project-level `CreativeSpec` (kept readable for now, not extended).
- Agents calling Claude directly → they become skills that receive an `AIProvider`.
- Navigation and "Overview / Projects" language → Home / Explore / Library / Create / Brain.
- "Production pipeline" grid on campaigns → replaced by the project journey.

## What should be added (MVP)

- `skills/` at repo root: the GitHub source of truth. One folder per skill with `SKILL.md`, `skill.ts`, generated `schema.json`, examples and tests.
- Skill registry, discovery (lexical + typed I/O match: no LLM needed to *find* skills), runtime (validate → execute → validate → retry → cache → log).
- `skill_run` table plus an Activity view for observability (duration, provider, tokens, estimated cost, status, why it ran).
- `AIProvider` with `ClaudeProvider` reporting usage, which the runtime turns into cost.
- Agents (ordered skill plans) and workflows (ordered agents) as thin, typed composition layers.
- Project journey, Brain, CreativeSpec (scenes → elements with stable IDs), storyboard, Remotion preview driven by the spec, light editing, save to library.

## Decisions

- **No monorepo split yet.** One app with clear module boundaries (`skills/`, `src/server/skills`, `src/lib/creative-spec`,
  `src/lib/animations`) gives the same separation without build tooling overhead. Split into `packages/` when a second
  app (the media worker) exists.
- **No new queue yet.** The in-process runner stays until video/audio processing (Phase 4+) needs a worker; then adopt
  **Inngest** (works on Vercel, durable steps, retries). Hobby-plan functions cap at 300s.
- **No AWS yet.** Neon + Vercel Blob cover the MVP; S3/ECS arrive with the media worker.

## Recommended order

1. Skill runtime foundation: registry, discovery, runtime, provider usage, `skill_run`, Activity. Port existing capabilities to skills.
2. Vertical slice: Idea → Explore (research + references) → Direction (3 directions → CreativeDNA) → Story (storyboard → CreativeSpec)
   → Design / Motion (edit spec, presets) → Remotion preview → Save to library.
3. Brain (brainstorm collaborator feeding new projects).
4. Marketing intelligence entities + market creative map.
5. Media worker: FFmpeg / scene detection / OCR / transcription → VideoAnalysis, AudioAnalysis, MotionDNA.
6. AI editing on the spec (targeted element changes, regenerate scene, format adaptation).
7. Render jobs and exports.
