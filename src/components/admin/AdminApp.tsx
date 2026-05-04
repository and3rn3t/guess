import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminShell } from './AdminShell'
import { AdminDataProvider } from './AdminDataProvider'
import { ADMIN_ROUTE_MANIFEST } from './adminRouteManifest'

const LandingRoute = lazy(() => import('./routes/LandingRoute'))

const ADMIN_LAZY_ROUTES = ADMIN_ROUTE_MANIFEST.map((route) => ({
  ...route,
  Component: lazy(route.loader),
}))

function RouteWrapper({ children }: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

export function AdminApp(): React.JSX.Element {
  return (
    <AdminDataProvider>
      <BrowserRouter basename="/admin">
        <Routes>
          <Route path="/" element={<AdminShell />}>
            <Route index element={<RouteWrapper><LandingRoute /></RouteWrapper>} />
            {ADMIN_LAZY_ROUTES.map(({ path, Component }) => (
              <Route
                key={path}
                path={path}
                element={<RouteWrapper><Component /></RouteWrapper>}
              />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AdminDataProvider>
  )
}
