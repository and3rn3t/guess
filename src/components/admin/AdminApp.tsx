import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminShell } from './AdminShell'
import { AdminDataProvider } from './AdminDataProvider'

interface AdminRouteDef {
  path: string
  loader: () => Promise<{ default: React.ComponentType }>
}

const LandingRoute = lazy(() => import('./routes/LandingRoute'))

const ADMIN_ROUTES: AdminRouteDef[] = [
  { path: 'coverage', loader: () => import('./routes/CoverageRoute') },
  { path: 'hygiene', loader: () => import('./routes/HygieneRoute') },
  { path: 'cost', loader: () => import('./routes/CostRoute') },
  { path: 'recommender', loader: () => import('./routes/RecommenderRoute') },
  { path: 'category-recommender', loader: () => import('./routes/CategoryRecommenderRoute') },
  { path: 'env', loader: () => import('./routes/EnvTestRoute') },
  { path: 'bulk-habitat', loader: () => import('./routes/BulkHabitatRoute') },
  { path: 'demo', loader: () => import('./routes/DemoRoute') },
  { path: 'characters', loader: () => import('./routes/CharactersRoute') },
  { path: 'questions', loader: () => import('./routes/QuestionsRoute') },
  { path: 'questions/retire', loader: () => import('./routes/RetirementQueueRoute') },
  { path: 'questions/duplicates', loader: () => import('./routes/DuplicatesRoute') },
  { path: 'enrichment', loader: () => import('./routes/EnrichmentRoute') },
  { path: 'pipeline', loader: () => import('./routes/PipelineRoute') },
  { path: 'analytics', loader: () => import('./routes/AnalyticsRoute') },
  { path: 'funnel', loader: () => import('./routes/FunnelRoute') },
  { path: 'confusion', loader: () => import('./routes/ConfusionRoute') },
  { path: 'matrix', loader: () => import('./routes/MatrixRoute') },
  { path: 'stress-test', loader: () => import('./routes/StressTestRoute') },
  { path: 'experiments', loader: () => import('./routes/ExperimentsRoute') },
  { path: 'data-quality', loader: () => import('./routes/DataQualityRoute') },
  { path: 'enrich', loader: () => import('./routes/EnrichDashboardRoute') },
  { path: 'proposed-attrs', loader: () => import('./routes/ProposedAttrsRoute') },
  { path: 'disputes', loader: () => import('./routes/DisputesRoute') },
  { path: 'community', loader: () => import('./routes/CommunityRoute') },
  { path: 'error-logs', loader: () => import('./routes/ErrorLogsRoute') },
  { path: 'triage', loader: () => import('./routes/TriageRoute') },
  { path: 'api-docs', loader: () => import('./routes/ApiDocsRoute') },
  { path: 'about', loader: () => import('./routes/AboutRoute') },
]

const ADMIN_LAZY_ROUTES = ADMIN_ROUTES.map((route) => ({
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
