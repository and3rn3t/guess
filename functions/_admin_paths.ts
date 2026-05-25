/**
 * Centralized predicate for the admin auth gate enforced by `_middleware.ts`.
 *
 * Exported as a standalone module so it can be unit-tested and so the SE.2
 * RBAC coverage audit (functions/api/admin/__tests__/rbac-coverage.test.ts)
 * can prove every admin route file falls under the gated prefix.
 *
 * Two prefixes are gated:
 *   - `/admin*`       — the SPA admin shell
 *   - `/api/admin*`   — the admin JSON API
 *
 * Static assets under `/assets/*` are NOT under either prefix and are
 * therefore unaffected.
 */
export function isAdminPath(path: string): boolean {
  return (
    path === '/admin' ||
    path.startsWith('/admin/') ||
    path === '/api/admin' ||
    path.startsWith('/api/admin/')
  )
}
