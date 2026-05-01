# ESLint 10 Next React Plugin Failure

Date: 2026-05-01
Status: Open

## Symptoms

`npm run lint` fails before reporting file-level lint findings.

The failure occurs while loading the `react/display-name` rule for `web/app/components/brand_filter.tsx`.

## Root Cause Analysis

`web/package.json` allows `eslint@^10`, and `npm ci` installs `eslint@10.2.1`.
The React lint plugins bundled under `eslint-config-next@16.2.4` declare peer support through ESLint 9 and fail against ESLint 10 with `contextOrFilename.getFilename is not a function`.

## Changes Made

None. This was found during follow-up verification after the site build fix.

## Resolution

Open. Pin or downgrade ESLint to a version supported by `eslint-config-next@16.2.4`, then rerun `npm run lint`.
