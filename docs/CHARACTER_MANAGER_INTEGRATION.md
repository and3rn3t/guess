# Character Manager Enhancements Integration

This doc tracks the integration work for the Character Manager enhancement set.

## Delivered

1. Added quick filters and batch action UI wiring in [src/components/admin/routes/CharactersRoute.tsx](src/components/admin/routes/CharactersRoute.tsx).
2. Added enhancement components in [src/components/admin/CharacterManagerEnhancements.tsx](src/components/admin/CharacterManagerEnhancements.tsx).
3. Added helper utilities in [src/lib/admin/characterFilters.ts](src/lib/admin/characterFilters.ts).
4. Extended sort support in [functions/api/admin/characters.ts](functions/api/admin/characters.ts):
	- `needsWork`
	- `recentlyAdded`
5. Added category PATCH support in [functions/api/admin/characters/[id]/index.ts](functions/api/admin/characters/[id]/index.ts).

## Behavior Notes

1. `needsWork` uses a server-side score combining popularity and coverage gap.
2. `recentlyAdded` sorts by `created_at DESC`.
3. Max coverage filtering is SQL-side for accurate pagination.
4. Batch delete uses two-step confirmation in the UI.
5. Recent searches are stored in localStorage under `admin:recent-searches`.

## Validation

Run:

```bash
pnpm validate
```

Current status: passing.
