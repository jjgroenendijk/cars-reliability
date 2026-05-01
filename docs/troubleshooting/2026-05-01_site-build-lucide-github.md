# Site Build Lucide GitHub Icon Failure

Date: 2026-05-01
Status: Investigating

## Symptoms

The latest GitHub Actions site build failed during `npm run build` in the Next.js stage.
The prebuild data sync completed, then `next build` failed in `web/app/components/navigation.tsx`.

The reported error says `Github` does not exist in the resolved `lucide-react` ESM module.

## Root Cause Analysis

`web/app/components/navigation.tsx` imports `Github` from the main `lucide-react` barrel.
The installed package still contains a per-icon `github` module, but the build-resolved barrel used by Turbopack in the action does not expose `Github`.

The failure is isolated to the navigation source-code link icon. The rest of the build reaches Next.js compilation after `scripts/sync-data.js` successfully copies processed JSON into `web/public/data`.

## Changes Made

- Reproduced the failure locally after running `npm ci` in `web/`.
- Replaced the unsupported `Github` icon import and usage in `web/app/components/navigation.tsx` with `GitFork`, which is exported by `lucide-react@1.12.0`.

## Resolution

Resolved. `npm run build` now completes successfully in `web/` after replacing the removed `Github` icon with `GitFork`.
