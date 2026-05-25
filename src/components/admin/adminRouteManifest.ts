import type { ComponentType } from 'react'

export type AdminNavSection = 'mission' | 'curate' | 'expand' | 'govern' | 'monitor' | 'labs'

export type AdminNavIconKey =
  | 'chartBar'
  | 'flask'
  | 'users'
  | 'listChecks'
  | 'treeStructure'
  | 'arrowsClockwise'
  | 'queue'
  | 'usersThree'
  | 'lightning'
  | 'wrench'
  | 'chartLine'
  | 'warningOctagon'
  | 'gridFour'
  | 'dna'
  | 'target'
  | 'copySimple'
  | 'trash'
  | 'shieldCheck'

export interface AdminRouteDef {
  path: string
  section: AdminNavSection
  label: string
  iconKey: AdminNavIconKey
  loader: () => Promise<{ default: ComponentType }>
}

export const ADMIN_ROUTE_MANIFEST: AdminRouteDef[] = [
  { path: 'about', section: 'mission', label: 'About', iconKey: 'listChecks', loader: () => import('./routes/AboutRoute') },

  { path: 'characters', section: 'curate', label: 'Characters', iconKey: 'users', loader: () => import('./routes/CharactersRoute') },
  { path: 'data-quality', section: 'curate', label: 'Data Quality', iconKey: 'chartLine', loader: () => import('./routes/DataQualityRoute') },
  { path: 'hygiene', section: 'curate', label: 'Data Hygiene', iconKey: 'wrench', loader: () => import('./routes/HygieneRoute') },
  { path: 'questions', section: 'curate', label: 'Questions', iconKey: 'listChecks', loader: () => import('./routes/QuestionsRoute') },
  { path: 'coverage', section: 'curate', label: 'Attribute Coverage', iconKey: 'chartBar', loader: () => import('./routes/CoverageRoute') },
  { path: 'questions/retire', section: 'curate', label: 'Retirement Queue', iconKey: 'trash', loader: () => import('./routes/RetirementQueueRoute') },
  { path: 'questions/duplicates', section: 'curate', label: 'Duplicate Queue', iconKey: 'copySimple', loader: () => import('./routes/DuplicatesRoute') },

  { path: 'recommender', section: 'expand', label: 'Attribute Recommender', iconKey: 'lightning', loader: () => import('./routes/RecommenderRoute') },
  { path: 'category-recommender', section: 'expand', label: 'Category Recommender', iconKey: 'treeStructure', loader: () => import('./routes/CategoryRecommenderRoute') },
  { path: 'enrich', section: 'expand', label: 'Live Enrichment', iconKey: 'lightning', loader: () => import('./routes/EnrichDashboardRoute') },
  { path: 'enrichment', section: 'expand', label: 'Enrichment Status', iconKey: 'arrowsClockwise', loader: () => import('./routes/EnrichmentRoute') },
  { path: 'pipeline', section: 'expand', label: 'Pipeline Log', iconKey: 'treeStructure', loader: () => import('./routes/PipelineRoute') },
  { path: 'matrix', section: 'expand', label: 'DNA Matrix', iconKey: 'dna', loader: () => import('./routes/MatrixRoute') },

  { path: 'proposed-attrs', section: 'govern', label: 'Proposed Attrs', iconKey: 'queue', loader: () => import('./routes/ProposedAttrsRoute') },
  { path: 'disputes', section: 'govern', label: 'Attr Disputes', iconKey: 'warningOctagon', loader: () => import('./routes/DisputesRoute') },
  { path: 'community', section: 'govern', label: 'Community Queue', iconKey: 'usersThree', loader: () => import('./routes/CommunityRoute') },

  { path: 'analytics', section: 'monitor', label: 'Analytics', iconKey: 'chartBar', loader: () => import('./routes/AnalyticsRoute') },
  { path: 'funnel', section: 'monitor', label: 'Skip Funnel', iconKey: 'chartLine', loader: () => import('./routes/FunnelRoute') },
  { path: 'confusion', section: 'monitor', label: 'Confusion Matrix', iconKey: 'gridFour', loader: () => import('./routes/ConfusionRoute') },
  { path: 'experiments', section: 'monitor', label: 'Experiments (A/B)', iconKey: 'flask', loader: () => import('./routes/ExperimentsRoute') },
  { path: 'cost', section: 'monitor', label: 'Cost Dashboard', iconKey: 'chartLine', loader: () => import('./routes/CostRoute') },
  { path: 'error-logs', section: 'monitor', label: 'Error Logs', iconKey: 'warningOctagon', loader: () => import('./routes/ErrorLogsRoute') },
  { path: 'security', section: 'monitor', label: 'Security (CSP)', iconKey: 'shieldCheck', loader: () => import('./routes/SecurityRoute') },
  { path: 'triage', section: 'monitor', label: 'Failure Triage', iconKey: 'warningOctagon', loader: () => import('./routes/TriageRoute') },

  { path: 'api-docs', section: 'labs', label: 'API Docs', iconKey: 'listChecks', loader: () => import('./routes/ApiDocsRoute') },
  { path: 'stress-test', section: 'labs', label: 'Stress Test', iconKey: 'target', loader: () => import('./routes/StressTestRoute') },
  { path: 'env', section: 'labs', label: 'Environment Test', iconKey: 'flask', loader: () => import('./routes/EnvTestRoute') },
  { path: 'bulk-habitat', section: 'labs', label: 'Bulk Habitat', iconKey: 'arrowsClockwise', loader: () => import('./routes/BulkHabitatRoute') },
  { path: 'demo', section: 'labs', label: 'Question Gen Demo', iconKey: 'flask', loader: () => import('./routes/DemoRoute') },
]