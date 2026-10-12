# Cutroom

Plan, produce and ship marketing video campaigns. **Phase 1 (Foundation)** covers auth, workspaces, roles, projects,
campaigns, settings and the provider/job interfaces for later phases. See [ARCHITECTURE.md](ARCHITECTURE.md).

## Setup

Requires Node 20+, pnpm and PostgreSQL 15+.

```bash
pnpm install
cp .env.example .env.local        # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
createdb cutroom && createdb cutroom_test
pnpm db:migrate
pnpm db:seed                      # optional demo account; credentials are in scripts/seed.ts
pnpm exec playwright install chromium   # for the browser research agent
pnpm dev
```

Set `ANTHROPIC_API_KEY` in `.env.local` to turn on research, reference analysis, CreativeDNA, asset ranking,
animation search and the ⌘K command bar. `PEXELS_API_KEY` / `PIXABAY_API_KEY` add stock video sources
(Openverse and Wikimedia work without keys).

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm typecheck` / `lint` / `test` | Checks; `pnpm check` runs all three |
| `pnpm db:generate` | Create a migration from schema changes in `src/server/db/schema` |
| `pnpm db:migrate` | Apply migrations to `DATABASE_URL` |
| `pnpm db:studio` | Browse the database |

Integration tests **drop and recreate** the schema of `TEST_DATABASE_URL`. Never point it at real data.

Invitation emails go to the server console (`EMAIL_PROVIDER=console`). Members → Copy link also gives you the invite URL.
