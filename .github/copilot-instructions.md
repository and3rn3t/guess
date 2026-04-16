# Copilot Instructions for Guess

## Project Overview
This is an AI-powered guessing game deployed on **Cloudflare Pages** using React 19, TypeScript, Vite 7, Tailwind CSS v4, and shadcn/ui. The AI asks strategic yes/no questions to deduce what character the user is thinking of, with full reasoning transparency.

## Tech Stack & Platform
- **Cloudflare Pages** static site deployment
- React 19 + TypeScript (strict null checks) + Vite 7
- Tailwind CSS v4 + shadcn/ui (new-york style, `components.json`)
- Framer Motion for animations
- Phosphor Icons (`@phosphor-icons/react`) for custom icons, Lucide for shadcn defaults
- Recharts + D3 for data visualization

## Key Conventions

### File Organization
- Path alias: `@/` maps to `src/`
- Components: PascalCase, one per file, in `src/components/`
- UI primitives: `src/components/ui/` (shadcn/ui — do not manually edit)
- Business logic: `src/lib/` (gameEngine, database, types, questionGenerator, etc.)
- Hooks: `src/hooks/`

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

### State Management
- localStorage persistence: `useKV<T>(key, default)` from `@/hooks/useKV`
- KV keys (prefixed `kv:` in storage): `characters`, `questions`, `game-history`
- Local React state for ephemeral game state (current question, answers, phase)

### Game Logic
- `gameEngine.ts`: probability calculation via Bayesian-style scoring, information gain for question selection
- `database.ts`: DEFAULT_CHARACTERS and DEFAULT_QUESTIONS with 57+ attributes
- Questions target character attributes; answers filter the possibility space
- Guess threshold: ~80% confidence or question limit reached
- Teaching mode: user can add new characters with all answered attributes

## Commands
```bash
pnpm dev            # Start dev server
pnpm build          # Type-check + build
pnpm lint           # ESLint
pnpm preview        # Preview build
pnpm deploy         # Build + deploy to Cloudflare Pages (production)
pnpm deploy:preview # Build + deploy to Cloudflare Pages (preview)
pnpm cf:login       # Authenticate with Cloudflare
pnpm cf:dev         # Dev server with Cloudflare bindings
```

## Deployment (Cloudflare Pages)
- Config: `wrangler.toml` (project name: `guess`, output: `dist/`)
- MCP: `.vscode/mcp.json` configures the Cloudflare MCP server for AI-assisted deployment

## Important Warnings
- Do NOT manually edit files in `src/components/ui/` — use `npx shadcn@latest add <component>`
- Character IDs must be unique lowercase strings
- All attribute keys must be camelCase booleans
