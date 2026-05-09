# @guess/mobile

Fresh reset of the iOS/mobile app workspace.

## Commands
- `pnpm --filter @guess/mobile dev`
- `pnpm --filter @guess/mobile dev:tunnel`
- `pnpm --filter @guess/mobile dev:sim` (simulator-stable dev-client mode on localhost + local API base)
- `pnpm --filter @guess/mobile ios`
- `pnpm --filter @guess/mobile typecheck`
- `pnpm --filter @guess/mobile prebuild:ios`

## Notes
- Native iOS project files are generated with `prebuild:ios`.
- Start from `app/index.tsx` and build feature screens incrementally.
