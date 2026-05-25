# AGENTS.md

> Entry point for AI coding agents (Copilot, Claude, Cursor, etc.) working in this repo. Humans should read this too — it's the shortest path to "what should I work on?".

## Read these first, in order

1. **[ROADMAP.md](ROADMAP.md)** — the canonical source of truth for what's next (v1.9, full-product). Start at the [In Progress / Up Next](ROADMAP.md#in-progress--up-next) block, then scan [Wave Sequence](ROADMAP.md#wave-sequence).
2. **[ROADMAP.md → How To Pull Work](ROADMAP.md#how-to-pull-work)** + **[Definition Of Done](ROADMAP.md#definition-of-done-universal)** — pull-loop, status protocol, DoD, commit conventions. Non-optional before opening a PR.
3. **[.github/copilot-instructions.md](.github/copilot-instructions.md)** — project conventions (tech stack, TypeScript rules, styling, file organization, commands).
4. **[ARCHITECTURE.md](ARCHITECTURE.md)** — system design, data layer, API reference, CI/CD details.
5. **Archive (read only if working in shipped scope):** [docs/ROADMAP-archive-v1.8-mobile-may-2026.md](docs/ROADMAP-archive-v1.8-mobile-may-2026.md) for the mobile-only chapter (May 2026).

## The pull-loop (TL;DR)

1. Open ROADMAP.md → check the **In Progress / Up Next** callout.
2. If something is `🟡 in progress`, finish it before pulling new work.
3. Otherwise pull the topmost `⬜` row from the active wave. Don't skip ahead.
4. Mark the row `🟡 in progress` in ROADMAP.md **and** add it to the In Progress block — same commit as the first code change.
5. When shipped, mark `✅ YYYY-MM-DD`, remove from In Progress, promote the next `⬜` into Up Next — same commit as the merge / deploy.
6. Update CHANGELOG.md in the same commit.

## Definition of Done (universal)

An item is `✅` only when **all** of these are true:

- [ ] Code shipped to `main` and deployed (or, for non-code items: artifact committed, doc merged, dashboard live).
- [ ] `pnpm validate` passes locally (type-check + lint + test).
- [ ] Both builds green: `pnpm build && pnpm build:worker`.
- [ ] [CHANGELOG.md](CHANGELOG.md) updated under the next unreleased version (or current if patch).
- [ ] Roadmap row updated to `✅ YYYY-MM-DD` in the same commit as the work.
- [ ] Any new env var, binding, secret, or migration is documented in [ARCHITECTURE.md](ARCHITECTURE.md) **and** mirrored in `wrangler.toml` / `.dev.vars.example`.
- [ ] The wave row's "Done when" criterion is verifiably true.

## Commit conventions

- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- Roadmap-only edits: `docs(roadmap): <verb> <what>` — e.g. `docs(roadmap): mark DX.11 in progress`, `docs(roadmap): ship I.1 ✅`.
- Code commits that flip a roadmap row keep both in **the same commit** so status and reality never diverge.
- Decision Log entries belong with the commit that triggered the decision, not in a separate cleanup pass.

## Tooling guardrails (non-negotiable)

- Run `pnpm validate` before every push (also enforced via git hook once DX.11 ships).
- Never edit files in `src/components/ui/` directly — use `npx shadcn@latest add <component>`.
- Character IDs must be unique lowercase strings; attribute keys must be camelCase booleans.
- Path alias: `@/` → `src/`.
- For workflow changes, keep CI observability patterns consistent: `set -o pipefail`, `tee` logs into `.ci-artifacts/<workflow>/`, upload artifacts, and write a short `$GITHUB_STEP_SUMMARY` artifact list.
- If workflow artifact names/contents change, update `docs/ci-artifacts.md` in the same commit.
- Don't generate or guess URLs unless they're for programming help.

## When you're unsure

- Search the codebase before asking if something exists.
- Read existing patterns before creating new abstractions.
- Default to the simpler solution.
- If genuinely blocked, record why in [ROADMAP.md → Decision Log](ROADMAP.md#decision-log) before context-switching.

---

*This file is intentionally short. The roadmap is the source of truth; this is just the on-ramp.*
