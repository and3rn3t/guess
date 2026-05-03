# OpenAPI Generation

This repo generates OpenAPI artifacts from `functions/api/**` handler exports.

## Commands

- `pnpm openapi:generate` — generate committed artifacts
- `pnpm openapi:validate` — validate structure, refs, operation IDs, auth declarations, and coverage vs inventory
- `pnpm openapi:check` — fail if committed artifacts drift from generated output

## Artifacts

- `docs/openapi.json`
- `docs/openapi.yaml`
- `docs/openapi-inventory.json`
- `public/openapi.yaml`

## Contributor workflow

1. Add or modify endpoint handlers under `functions/api/**`.
2. Run `pnpm openapi:generate`.
3. Run `pnpm openapi:validate`.
4. Commit handler changes and OpenAPI artifacts in the same PR.

## Notes

- `docs/openapi.yaml` currently stores JSON text (valid YAML) to keep deterministic serialization stable.
- Admin docs UI is exposed at `/admin/api-docs` and renders from `public/openapi.yaml`.
- Request schemas for core v2 routes are derived from Zod sources in `functions/api/_schemas.ts` (game endpoints + events, and daily POST body).
- Response schemas for core v2 game routes are now explicitly modeled (start, answer, skip, reject-guess, result, resume, feedback) instead of generic objects.
