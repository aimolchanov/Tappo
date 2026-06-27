# AGENTS.md

## Cursor Cloud specific instructions

This is a pnpm + TypeScript monorepo (Replit `PNPM_WORKSPACE` stack). Runtime is Node.js
22 (`/exec-daemon/node`, first in `PATH`) with `pnpm` 10.33.3 (provided by nvm). The `.replit`
file pins `nodejs-24`, but the codebase has no `engines` constraint and runs fine on Node 22;
`node` always resolves to the `/exec-daemon` binary regardless of the nvm default.

Dependencies are installed by the startup update script (`pnpm install`). The standard
commands (typecheck/build/codegen/db push) are documented in `replit.md` under "Run & Operate".

### Services and how to run them

- **`@workspace/api-server`** (Express, the backend) — port 5000.
  - Requires a running PostgreSQL and `DATABASE_URL`, and **requires `PORT`** (it throws if `PORT`
    is unset). Run: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app PORT=5000 pnpm --filter @workspace/api-server run dev`.
  - Only route is `GET /api/healthz` → `{"status":"ok"}`. Importing `@workspace/db` constructs a
    pg `Pool` at startup, so `DATABASE_URL` must be set even though the schema is an empty scaffold.
- **`@workspace/kids-app` ("Tappo")** — the main product, an Expo / React Native app (Russian UI,
  landscape). For local web preview run Expo directly: `pnpm --filter @workspace/kids-app exec expo start --web --port 8081`.
  - Do NOT use the package `dev` script for local web: it depends on Replit-only env vars
    (`REPLIT_EXPO_DEV_DOMAIN`, `REPL_ID`, `$PORT`, etc.) for device/tunnel testing.
  - The app is fully offline and does NOT call the api-server.
  - Gotcha: the **Drawing** (Рисование) activity uses `@shopify/react-native-skia`, which is not
    available in react-native-web, so it shows a "Skia unavailable in browser" fallback. This is
    expected — test interactive activities like **Coloring** (Раскраски) in the browser; the full
    drawing canvas only works in native Expo Go (iPad).
- **`@workspace/mockup-sandbox`** (optional, Vite UI design sandbox) — port 5173.
  - Its `vite.config.ts` **requires both `PORT` and `BASE_PATH`** env vars (it throws otherwise).
    Run: `PORT=5173 BASE_PATH=/ pnpm --filter @workspace/mockup-sandbox run dev`.

### PostgreSQL

PostgreSQL 16 is installed locally but is not a managed service. Start it before running the
api-server: `sudo pg_ctlcluster 16 main start`. The dev database/user used above is
`app` / `postgres:postgres`. Sync schema with `DATABASE_URL=... pnpm --filter @workspace/db run push`.

### Checks

- There is no dedicated lint script; `pnpm run typecheck` is the project-wide check.
- Note: `@workspace/kids-app`'s typecheck currently fails with pre-existing TS errors
  (`expo-file-system` `documentDirectory`, and a `settings.tsx` translation literal mismatch).
  These are pre-existing code issues, not environment problems; the other packages typecheck cleanly.
