# Cutroom architecture

Working name **Cutroom**: a workspace for planning, producing and shipping marketing video campaigns.
This records the foundation (Phase 1) and the seams later phases plug into.

## Stack

| Concern | Choice |
|---|---|
| App | Next.js 15 (App Router, RSC, server actions), React 19, TypeScript strict |
| UI | Tailwind v4, shadcn/ui (Radix), Geist + Geist Mono, dark-first tokens in `src/app/globals.css` |
| Database | PostgreSQL via Drizzle ORM (`node-postgres`), SQL migrations in `drizzle/` |
| Auth | Better Auth: email + password, sessions in Postgres, organization plugin |
| Validation | Zod schemas shared by forms and server (`src/lib/validation.ts`) |
| Tests | Vitest: unit tests plus integration tests against a real Postgres (`TEST_DATABASE_URL`) |

## Domain model

```
user ──< member >── organization (workspace)
                        │
                        ├──< project ──< campaign
                        │        └──< asset          (Phase 2+: uploads, generated media, renders)
                        └──< job                     (Phase 2+: research / generation / render work)
```

- **Workspace** = Better Auth `organization`. URLs are scoped by slug: `/w/[slug]/…`.
- **Roles**: `owner`, `admin`, `editor`, `viewer`, defined once in `src/lib/permissions.ts` with Better Auth's
  access control. Better Auth enforces them on its own member and invitation endpoints; app services
  enforce them with `assertCan()`.
- **Project**: a brand or product. **Campaign**: one brief plus deliverables (channels × aspect ratios)
  and a status (`draft → in_production → in_review → approved`, or `archived`).
- `asset` and `job` tables exist now, so later phases add rows rather than rewriting the schema.

## Layers

```
app/ (routes, RSC pages)  ──►  server/actions (validate, authorize, revalidate)  ──►  server/services (business rules, tenant-scoped queries)  ──►  db
                                        │
                                        └── returns ActionResult { ok | code, message, fieldErrors }
```

- **Tenant isolation**: every service query filters by `ctx.organization.id`. `WorkspaceContext` is built
  per request from the slug plus a membership lookup (`getWorkspace` for pages, `actionWorkspace` for actions).
- **Errors**: services throw `AppError(code)`. `runAction` turns these, Zod errors and unique-key violations into
  safe results; anything else is logged and reported to the user as a generic `INTERNAL` error.
- **Middleware** only redirects requests that have no session cookie. Real authorization happens in layouts and services.

## Provider abstraction (`src/server/providers`)

Capabilities: `llm`, `research`, `image`, `video`, `voice`, `render`, `storage`. Each has a typed interface in
`capabilities/`. Adapters live in `adapters/`, the catalog lists the known providers, and `registry.getProvider(capability)`
resolves the provider configured in env (e.g. `LLM_PROVIDER=anthropic`). Media generation and rendering use an async
`submit` / `status` / `cancel` contract. Rendering consumes a renderer-agnostic `Composition` (tracks and clips), which is
what the Phase 3 timeline editor will produce. Settings → Providers shows each capability's status.

Phase 1 implements only `storage/local`. Every other capability reports `unconfigured` or `planned`.

## Jobs (`src/server/jobs/queue.ts`)

`JobQueue` (enqueue/cancel) and `JobHandler` contracts, keyed by `job.kind`. The backend (Postgres SKIP LOCKED,
Inngest, Trigger.dev…) is chosen in Phase 2; callers won't change.

## Creative systems (Phase 2)

The flow is one connected pipeline, not separate features:

```
brief → Research Brain → Reference Library → CreativeDNA (brand brain) → Asset Brain → Animation Library → Creative Spec → Remotion editor → final video
```

All Claude calls go through `src/server/ai/claude.ts` (`claude-opus-5-5`, beta Messages with `fallbacks: "default"`
for refusal fallback, typed JSON via `betaZodOutputFormat`, web search/fetch server tools for research).
Long work runs as jobs (`src/server/jobs/runner.ts`, Next `after()`), and the UI polls `jobStatusAction`.

| System | Code | What it does |
|---|---|---|
| Research Brain | `agents/research.ts` | Web research for a campaign → audience, competitors, trends, hooks, reference leads, sources |
| Source Registry | `lib/sources.ts`, `services/sources.ts`, `source` table | Approved sites per workspace. `role` = `reference` or `asset`; custom sources are always reference-only |
| BrowserResearchAgent | `agents/browser-research.ts` | Playwright opens an approved URL, scrolls, captures screenshots, Claude analyses composition/colour/type/motion, relevant sections are cropped, saved and ranked |
| Reference vs asset | `reference` table vs `asset` table | References never become production assets. Every asset carries `AssetRights`; non-commercial licences cannot be approved |
| AssetSourcingAgent | `agents/asset-sourcing.ts`, `providers/assets/*` | Requirement → visual search concepts → Openverse / Wikimedia / Pexels / Pixabay → Claude ranks thumbnails against the intended composition |
| CreativeDNA | `agents/creative-dna.ts`, `creative_dna` table | Approved references (+ company memory) → direction per dimension and *what each reference taught us* |
| Animation Library | `lib/animations/*` | 54 procedural presets: data (`presets.ts`) + typed parameters + renderer (`renderers.tsx`). Pure functions of the frame, rendered with Remotion. Text presets combine by merging channels (`composition.tsx`) |
| Animation search | `agents/animation-search.ts` | Natural language → presets, tuned params and combinations, with the catalog prompt-cached |
| Creative Spec | `campaign.creative_spec` | Animations chosen per role (headline, transition, background…) and assets: what the editor builds from |
| AI command bar | `agents/command.ts`, `components/shell/command-bar.tsx` | ⌘K routes to animations, assets, references, research or CreativeDNA |
| Company Creative Library | `creative_memory` table | Every approval (reference, animation, asset, direction) is remembered and fed back into DNA and animation search |

Library items set a drag payload (`lib/drag.ts`, `application/x-cutroom-item`) that the Phase 3 editor's canvas and timeline will accept.

## Roadmap seams

| Phase | Adds | Plugs into |
|---|---|---|
| 2 | Research, scripts | `llm` / `research` providers, `job` kinds `research` / `script` |
| 3 | Image/video/voice generation, timeline editor | media providers, `asset.source = generated`, `Composition` |
| 4 | Rendering and exports | `render` provider, `asset.source = render` |
