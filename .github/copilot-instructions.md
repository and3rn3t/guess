# Copilot Instructions for Guess

## Project Overview
AI-powered guessing game deployed on **Cloudflare Pages**. The AI asks strategic yes/no questions to deduce what character the user is thinking of, using Bayesian probability scoring with full reasoning transparency.

> For full system design, data layer, API reference, and CI/CD details, see [ARCHITECTURE.md](../ARCHITECTURE.md).

## Tech Stack
- **Cloudflare Pages** static site + Workers API
- React 19 + TypeScript (strict null checks) + Vite 7
- Tailwind CSS v4 + shadcn/ui (new-york style, `components.json`)
- Framer Motion for animations
- Phosphor Icons (`@phosphor-icons/react`) for custom icons, Lucide for shadcn defaults
- Recharts + D3 for data visualization

## Key Conventions

### TypeScript
- Use explicit types for function signatures — avoid `any`
- Character attributes are `Record<string, boolean | null>` (null = unknown/not set)
- Game phases are a union type: `GamePhase` in App.tsx
- Prefer `const` over `let`; never use `var`
- Use early returns to reduce nesting

### Styling
- Use Tailwind utility classes with `cn()` helper from `@/lib/utils`
- `cva` (class-variance-authority) for component variants
- Theme uses cosmic purple/indigo palette — see `theme.json` and `src/styles/theme.css`
- Font: Space Grotesk
- Glassmorphism effects on cards (`backdrop-blur`)
- Respect `prefers-reduced-motion`

### File Organization
- Path alias: `@/` maps to `src/`
- Components: PascalCase, one per file, in `src/components/`
- UI primitives: `src/components/ui/` (shadcn/ui — do not manually edit)
- Business logic: `src/lib/`
- Hooks: `src/hooks/`

## Commands
```bash
pnpm dev            # Start dev server
pnpm build          # Type-check + build
pnpm lint           # ESLint
pnpm validate       # Type-check + lint + test (full check)
pnpm preview        # Preview build
pnpm deploy         # Build + deploy to Cloudflare Pages (production)
pnpm deploy:preview # Build + deploy to Cloudflare Pages (preview)
pnpm cf:login       # Authenticate with Cloudflare
pnpm cf:dev         # Dev server with Cloudflare bindings
```

## Important Warnings
- Do NOT manually edit files in `src/components/ui/` — use `npx shadcn@latest add <component>`
- Character IDs must be unique lowercase strings
- All attribute keys must be camelCase booleans
