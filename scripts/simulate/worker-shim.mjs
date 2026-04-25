/**
 * Worker entry shim for Node.js worker_threads.
 *
 * Node's worker_threads do not inherit the parent's ESM hooks (tsx).
 * This shim uses tsx's programmatic ESM API to register the TypeScript
 * loader inside the worker process before importing run.ts.
 *
 * We must use createRequire to resolve the tsx/esm/api path because the
 * worker has no tsx loader yet when this shim runs — it's a plain .mjs file.
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
// Resolve to absolute path so the dynamic import below does not need tsx
const tsxEsmApiPath = require.resolve('tsx/esm/api')

const { register } = await import(tsxEsmApiPath)
register()

// Now that tsx hooks are registered, TypeScript imports resolve correctly.
// The !isMainThread branch in run.ts will execute and call process.exit(0).
await import('./run.ts')
