import { useEffect, useState } from 'react'

import { fetchAdminAutomationStatus, type AdminAutomationReport } from '@/lib/admin/adminApi'

import type { DashboardData } from './landingHelpers'

interface LandingDashboardState {
  data: DashboardData | null
  loading: boolean
  error: string | null
  lastFetchedAt: number | null
  automationReport: AdminAutomationReport | null
  automationFetchedAt: number | null
  refresh: () => Promise<void>
}

export function useLandingDashboard(): LandingDashboardState {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null)
  const [automationReport, setAutomationReport] = useState<AdminAutomationReport | null>(null)
  const [automationFetchedAt, setAutomationFetchedAt] = useState<number | null>(null)

  const refresh = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const [dashboardResponse, automation] = await Promise.all([
        fetch('/api/admin/dashboard'),
        fetchAdminAutomationStatus(),
      ])
      if (!dashboardResponse.ok) throw new Error(`${dashboardResponse.status}`)
      const json = (await dashboardResponse.json()) as DashboardData
      setData(json)
      setAutomationReport(automation?.report ?? null)
      setAutomationFetchedAt(automation?.fetchedAt ?? null)
      setLastFetchedAt(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  return {
    data,
    loading,
    error,
    lastFetchedAt,
    automationReport,
    automationFetchedAt,
    refresh,
  }
}
