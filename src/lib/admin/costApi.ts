import { httpClient } from '@/lib/http'

export interface DailyCostUsage {
  date: string
  promptTokens: number
  completionTokens: number
  calls: number
}

export interface CostSummaryResponse {
  source: string
  windowDays: number
  today: DailyCostUsage
  totals: {
    promptTokens: number
    completionTokens: number
    calls: number
  }
  history: DailyCostUsage[]
}

export async function fetchAdminCosts(days = 7): Promise<CostSummaryResponse> {
  const safeDays = Math.min(Math.max(days, 1), 90)
  return httpClient.getJson<CostSummaryResponse>(`/api/admin/costs?days=${safeDays}`)
}