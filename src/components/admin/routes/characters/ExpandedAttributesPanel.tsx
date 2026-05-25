import { SparkleIcon, WarningIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { type AttributeApiValue } from './charactersHelpers'

export interface ExpandedCharacterData {
  definitions: Array<{ key: string; displayText: string }>
  attributes: Record<string, AttributeApiValue>
  evidence: Record<string, string | null>
  agreement: Record<string, { score: number | null; signals: number }>
}

export interface ValidationIssue {
  attributeKey: string
  type: 'contradiction' | 'suspicious-null' | 'recommended-fill'
  currentValue: boolean | null
  suggestedValue: boolean | null
  reason: string
}

interface ExpandedAttributesPanelProps {
  characterId: string
  expandedData: ExpandedCharacterData | null
  expandLoading: boolean
  validating: string | null
  validationIssues: ValidationIssue[] | undefined
  onValidate: () => void
  onPatchAttr: (attrKey: string, currentVal: AttributeApiValue) => void
}

export function ExpandedAttributesPanel({
  characterId,
  expandedData,
  expandLoading,
  validating,
  validationIssues,
  onValidate,
  onPatchAttr,
}: Readonly<ExpandedAttributesPanelProps>): React.JSX.Element | null {
  if (expandLoading) {
    return <p className="text-sm text-muted-foreground">Loading attributes…</p>
  }
  if (!expandedData) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Click an attribute to cycle: null → true → false → null
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={onValidate}
          disabled={validating === characterId}
          className="h-7 text-xs text-violet-400 border-violet-500/40 hover:bg-violet-500/10"
        >
          <SparkleIcon size={12} className={`mr-1.5 ${validating === characterId ? 'animate-pulse' : ''}`} />
          {validating === characterId ? 'Validating…' : 'Validate with AI'}
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {expandedData.definitions.map((def) => {
          const val = expandedData.attributes[def.key] ?? null
          const evidence = expandedData.evidence[def.key] ?? null
          const agreement = expandedData.agreement[def.key] ?? { score: null, signals: 0 }

          let valueLabel = 'unknown'
          if (val === 1) valueLabel = 'true'
          else if (val === 0) valueLabel = 'false'

          let agreementLine = 'Agreement: — (no signals yet)'
          if (agreement.score !== null) {
            const signalSuffix = agreement.signals === 1 ? '' : 's'
            agreementLine = `Agreement: ${(agreement.score * 100).toFixed(0)}% (${agreement.signals} signal${signalSuffix})`
          }

          const tooltip = evidence
            ? `${def.displayText}: ${valueLabel}\nEvidence: ${evidence}\n${agreementLine}\n(click to cycle)`
            : `${def.displayText}: ${valueLabel}\nEvidence: — (legacy row, no provenance)\n${agreementLine}\n(click to cycle)`
          const contested = agreement.score !== null && agreement.score < 0.6 && agreement.signals >= 3

          let valueClass = 'bg-muted text-muted-foreground border-border hover:text-foreground'
          if (val === 1) {
            valueClass = 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30'
          } else if (val === 0) {
            valueClass = 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'
          }

          return (
            <button
              key={def.key}
              onClick={() => onPatchAttr(def.key, val)}
              title={tooltip}
              className={`px-2 py-1 rounded text-xs font-mono border transition-colors ${valueClass} ${contested ? 'ring-2 ring-orange-500/60' : ''}`}
            >
              {def.key}
              {evidence ? <span className="ml-1 opacity-50">·</span> : null}
              {contested ? <span className="ml-1 text-orange-400" aria-label="contested">⚠</span> : null}
            </button>
          )
        })}
      </div>
      {validationIssues !== undefined && (
        <div className="space-y-1.5 pt-1 border-t border-border">
          {validationIssues.length === 0 ? (
            <p className="text-xs text-green-400">No issues found — attributes look clean!</p>
          ) : (
            validationIssues.map((issue) => {
              const issueKey = `${issue.attributeKey}-${issue.type}-${issue.reason}`
              let issueClass = 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
              if (issue.type === 'contradiction') {
                issueClass = 'bg-red-500/10 border-red-500/30 text-red-400'
              } else if (issue.type === 'recommended-fill') {
                issueClass = 'bg-violet-500/10 border-violet-500/30 text-violet-400'
              }

              return (
                <div
                  key={issueKey}
                  className={`flex items-start gap-2 text-xs px-2 py-1.5 rounded border ${issueClass}`}
                >
                  <WarningIcon size={12} className="mt-0.5 shrink-0" />
                  <span>
                    <code className="font-mono">{issue.attributeKey}</code>: {issue.reason}
                    {issue.suggestedValue !== null && (
                      <button
                        onClick={() => onPatchAttr(
                          issue.attributeKey,
                          expandedData.attributes[issue.attributeKey] ?? null
                        )}
                        className="ml-2 underline opacity-80 hover:opacity-100"
                      >
                        Set {String(issue.suggestedValue)}
                      </button>
                    )}
                  </span>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
