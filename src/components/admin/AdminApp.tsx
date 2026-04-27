import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminShell } from './AdminShell'
import { AdminDataProvider } from './AdminDataProvider'

const CoverageRoute = lazy(() => import('./routes/CoverageRoute'))
const HygieneRoute = lazy(() => import('./routes/HygieneRoute'))
const CostRoute = lazy(() => import('./routes/CostRoute'))
const RecommenderRoute = lazy(() => import('./routes/RecommenderRoute'))
const CategoryRecommenderRoute = lazy(() => import('./routes/CategoryRecommenderRoute'))
const EnvTestRoute = lazy(() => import('./routes/EnvTestRoute'))
const BulkHabitatRoute = lazy(() => import('./routes/BulkHabitatRoute'))
const DemoRoute = lazy(() => import('./routes/DemoRoute'))

const CharactersRoute = lazy(() => import('./routes/CharactersRoute'))
const QuestionsRoute = lazy(() => import('./routes/QuestionsRoute'))
const EnrichmentRoute = lazy(() => import('./routes/EnrichmentRoute'))
const PipelineRoute = lazy(() => import('./routes/PipelineRoute'))
const AnalyticsRoute = lazy(() => import('./routes/AnalyticsRoute'))
const EnrichDashboardRoute = lazy(() => import('./routes/EnrichDashboardRoute'))
const ProposedAttrsRoute = lazy(() => import('./routes/ProposedAttrsRoute'))
const DisputesRoute = lazy(() => import('./routes/DisputesRoute'))
const CommunityRoute = lazy(() => import('./routes/CommunityRoute'))
const ErrorLogsRoute = lazy(() => import('./routes/ErrorLogsRoute'))
const LandingRoute = lazy(() => import('./routes/LandingRoute'))
const ConfusionRoute = lazy(() => import('./routes/ConfusionRoute'))
const MatrixRoute = lazy(() => import('./routes/MatrixRoute'))
const StressTestRoute = lazy(() => import('./routes/StressTestRoute'))

function RouteWrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
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
            <Route path="coverage" element={<RouteWrapper><CoverageRoute /></RouteWrapper>} />
            <Route path="hygiene" element={<RouteWrapper><HygieneRoute /></RouteWrapper>} />
            <Route path="cost" element={<RouteWrapper><CostRoute /></RouteWrapper>} />
            <Route path="recommender" element={<RouteWrapper><RecommenderRoute /></RouteWrapper>} />
            <Route path="category-recommender" element={<RouteWrapper><CategoryRecommenderRoute /></RouteWrapper>} />
            <Route path="env" element={<RouteWrapper><EnvTestRoute /></RouteWrapper>} />
            <Route path="bulk-habitat" element={<RouteWrapper><BulkHabitatRoute /></RouteWrapper>} />
            <Route path="demo" element={<RouteWrapper><DemoRoute /></RouteWrapper>} />
            <Route path="characters" element={<RouteWrapper><CharactersRoute /></RouteWrapper>} />
            <Route path="questions" element={<RouteWrapper><QuestionsRoute /></RouteWrapper>} />
            <Route path="enrichment" element={<RouteWrapper><EnrichmentRoute /></RouteWrapper>} />
            <Route path="pipeline" element={<RouteWrapper><PipelineRoute /></RouteWrapper>} />
            <Route path="analytics" element={<RouteWrapper><AnalyticsRoute /></RouteWrapper>} />
            <Route path="confusion" element={<RouteWrapper><ConfusionRoute /></RouteWrapper>} />
            <Route path="matrix" element={<RouteWrapper><MatrixRoute /></RouteWrapper>} />
            <Route path="stress-test" element={<RouteWrapper><StressTestRoute /></RouteWrapper>} />
            <Route path="enrich" element={<RouteWrapper><EnrichDashboardRoute /></RouteWrapper>} />
            <Route path="proposed-attrs" element={<RouteWrapper><ProposedAttrsRoute /></RouteWrapper>} />
            <Route path="disputes" element={<RouteWrapper><DisputesRoute /></RouteWrapper>} />
            <Route path="community" element={<RouteWrapper><CommunityRoute /></RouteWrapper>} />
            <Route path="error-logs" element={<RouteWrapper><ErrorLogsRoute /></RouteWrapper>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AdminDataProvider>
  )
}
