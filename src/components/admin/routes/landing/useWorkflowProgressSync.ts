import { useEffect, useRef, useState } from 'react'

import {
  buildDefaultWorkflowProgress,
  parseWorkflowProgress,
  WORKFLOW_PLAYBOOKS,
  WORKFLOW_PROGRESS_API,
  WORKFLOW_PROGRESS_STORAGE_KEY,
  type WorkflowProgressMap,
  type WorkflowSyncStatus,
} from './landingHelpers'

export function useWorkflowProgressSync(): {
  workflowProgress: WorkflowProgressMap
  workflowSyncStatus: WorkflowSyncStatus
  completedPlaybooks: number
  setPlaybookActiveStep: (playbookId: string, to: string) => void
  togglePlaybookCompleted: (playbookId: string) => void
  resetPlaybook: (playbookId: string) => void
} {
  const [workflowProgress, setWorkflowProgress] = useState<WorkflowProgressMap>(buildDefaultWorkflowProgress())
  const [workflowProgressHydrated, setWorkflowProgressHydrated] = useState(false)
  const [workflowSyncStatus, setWorkflowSyncStatus] = useState<WorkflowSyncStatus>('hydrating')
  const lastSyncedWorkflowProgress = useRef<string>('')

  useEffect(() => {
    const stored = localStorage.getItem(WORKFLOW_PROGRESS_STORAGE_KEY)
    setWorkflowProgress(parseWorkflowProgress(stored))

    void fetch(WORKFLOW_PROGRESS_API)
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        const parsed = parseWorkflowProgress(
          json && typeof json === 'object' && 'progress' in (json as Record<string, unknown>)
            ? JSON.stringify((json as { progress: unknown }).progress)
            : null,
        )
        setWorkflowProgress(parsed)
        lastSyncedWorkflowProgress.current = JSON.stringify(parsed)
        setWorkflowSyncStatus('saved')
      })
      .catch(() => {
        setWorkflowSyncStatus('retry')
      })
      .finally(() => {
        setWorkflowProgressHydrated(true)
      })
  }, [])

  useEffect(() => {
    localStorage.setItem(WORKFLOW_PROGRESS_STORAGE_KEY, JSON.stringify(workflowProgress))
  }, [workflowProgress])

  useEffect(() => {
    if (!workflowProgressHydrated) return

    const serialized = JSON.stringify(workflowProgress)
    if (serialized === lastSyncedWorkflowProgress.current) return

    const timer = setTimeout(() => {
      setWorkflowSyncStatus('syncing')
      void fetch(WORKFLOW_PROGRESS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress: workflowProgress }),
      })
        .then((response) => {
          if (!response.ok) {
            setWorkflowSyncStatus('retry')
            return
          }
          lastSyncedWorkflowProgress.current = serialized
          setWorkflowSyncStatus('saved')
        })
        .catch(() => {
          setWorkflowSyncStatus('retry')
        })
    }, 250)

    return () => clearTimeout(timer)
  }, [workflowProgress, workflowProgressHydrated])

  const setPlaybookActiveStep = (playbookId: string, to: string): void => {
    setWorkflowProgress((prev) => ({
      ...prev,
      [playbookId]: {
        activeTo: to,
        completed: prev[playbookId]?.completed ?? false,
      },
    }))
  }

  const togglePlaybookCompleted = (playbookId: string): void => {
    setWorkflowProgress((prev) => ({
      ...prev,
      [playbookId]: {
        activeTo: prev[playbookId]?.activeTo ?? null,
        completed: !(prev[playbookId]?.completed ?? false),
      },
    }))
  }

  const resetPlaybook = (playbookId: string): void => {
    setWorkflowProgress((prev) => ({
      ...prev,
      [playbookId]: { activeTo: null, completed: false },
    }))
  }

  const completedPlaybooks = WORKFLOW_PLAYBOOKS.filter(
    (playbook) => workflowProgress[playbook.id]?.completed,
  ).length

  return {
    workflowProgress,
    workflowSyncStatus,
    completedPlaybooks,
    setPlaybookActiveStep,
    togglePlaybookCompleted,
    resetPlaybook,
  }
}
