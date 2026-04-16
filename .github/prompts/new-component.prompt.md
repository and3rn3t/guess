---
description: "Create a new feature component following project conventions."
mode: "agent"
---

# New Component

Create a new React component in `src/components/` following project conventions.

## Conventions
- File name: PascalCase matching the component name (e.g., `MyFeature.tsx`)
- Use explicit TypeScript types for all props
- Import UI primitives from `@/components/ui/`
- Use `cn()` from `@/lib/utils` for conditional classes
- Use Framer Motion for animations (`AnimatePresence`, `motion`)
- Icons from `@phosphor-icons/react`
- Use Tailwind utility classes — follow the cosmic purple theme
- For persistent state, use `useKV` from `@github/spark/hooks`
- For ephemeral state, use React `useState`/`useEffect`

## Structure Template
```tsx
import { /* hooks */ } from 'react'
import { /* icons */ } from '@phosphor-icons/react'
import { /* ui components */ } from '@/components/ui/...'
import { cn } from '@/lib/utils'

interface MyComponentProps {
  // explicit typed props
}

export function MyComponent({ ...props }: MyComponentProps) {
  // early returns for edge cases
  // main render
}
```

## After Creating
- Add the component import and route/phase to `App.tsx` if it's a top-level view
- Run `pnpm build` to verify

Create component: {{input}}
