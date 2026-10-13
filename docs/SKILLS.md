# Skills

One skill = one focused capability. The `skills/` folder is the source of truth (on GitHub), and
`pnpm skills:build` turns it into the registry the app uses. The build also runs automatically before
`dev`, `build` and Vercel deploys.

```
skills/<category>/<name>/
  SKILL.md      frontmatter = metadata (discovery); body = instructions (loaded only when the skill runs)
  skill.ts      typed contract: input/output zod schemas, cache, retries, timeout, run()
  schema.json   generated JSON Schema of input/output
  *.test.ts     optional tests (run by `pnpm test`)
```

## Frontmatter

| Field | Meaning |
|---|---|
| `id` | `<category>.<name>`, stable forever |
| `version` | bump on any behaviour change (shown in Activity) |
| `runtime` | `inline` (in the request), `job` (background), `worker` (needs the media worker; not deployed yet) |
| `executor` | `ai`, `deterministic`, `browser` or `hybrid`; AI skills refuse to run without a provider |
| `cost` | `free` / `low` / `medium` / `high` |
| `status` | `ready` (must ship skill.ts) or `planned` (must not) |
| `tags`, `consumes`, `produces` | what discovery matches on (`produces: [MotionDNA]`) |
| `dependencies`, `failures` | documentation for people and the orchestrator |

## Runtime contract

`runSkill(ctx, id, input, { reason })`:

1. validates input against the schema (`VALIDATION` with field errors)
2. returns a cached result for identical input if `cache` is set (logged as `cached`)
3. runs with retries on transient provider errors and an optional timeout
4. records token usage and estimated cost for every provider call
5. validates output against the schema
6. writes a `skill_run` row: why, input, output, logs, duration, provider, model, tokens, cost, status

Skills receive `ctx.ai` (an `AIProvider`), never a vendor SDK. Server-only code (database, Playwright)
is loaded inside `run()` with a dynamic `import()` so the registry can be built and tested in plain Node.

## Adding a skill

1. Create the folder and `SKILL.md` (copy a sibling).
2. Write `skill.ts` with `defineSkill({ id, input, output, run })`.
3. `pnpm skills:build`, then call it with `runSkill` from an action or another skill (`ctx.runSkill`).
4. Add a test; deterministic skills need no provider, AI skills can take a stand-in `ai` in `RunOptions`.

## Current skills

16 ready, 9 planned. The live list, with versions and status, is in **Settings → Activity → Skill library**.

### Library skills (no AI)

`library.harvest-polyhaven` and `library.harvest-noto-emoji` sync openly licensed sources into the shared
`library_item` catalog through their official endpoints. Both are incremental (unchanged items are skipped by source
version) and refuse an empty index rather than retire the catalog. `library.open-library-search` searches it.
Run a sync from **Settings → Sources → Open library**; browse in **Library → Open library**. Using an item copies the
file into workspace storage as an `asset` with its rights; CC BY credits travel onto the spec element and appear in QC
and the Final stage. LottieFiles is deliberately excluded: no public bulk API, and its licence forbids redistribution.
