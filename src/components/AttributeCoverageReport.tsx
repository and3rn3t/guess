import { useState, useMemo } from 'react'
import { ArrowLeft, Warning, CheckCircle, XCircle, Question as QuestionIcon, TrendUp, Funnel } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Character } from '@/lib/types'

interface AttributeCoverageReportProps {
  characters: Character[]
  onBack: () => void
}

interface AttributeStats {
  attribute: string
  totalCharacters: number
  trueCount: number
  falseCount: number
  nullCount: number
  missingCount: number
  coveragePercent: number
  diversityScore: number
  hasGap: boolean
}

type SortOption = 'coverage' | 'diversity' | 'missing' | 'alphabetical'
type FilterOption = 'all' | 'gaps' | 'complete' | 'partial'

export function AttributeCoverageReport({ characters, onBack }: AttributeCoverageReportProps) {
  const [sortBy, setSortBy] = useState<SortOption>('coverage')
  const [filterBy, setFilterBy] = useState<FilterOption>('all')

  const attributeStats = useMemo(() => {
    const allAttributes = new Set<string>()
    
    characters.forEach((char) => {
      Object.keys(char.attributes ?? {}).forEach((attr) => allAttributes.add(attr))
    })

    const stats: AttributeStats[] = Array.from(allAttributes).map((attribute) => {
      let trueCount = 0
      let falseCount = 0
      let nullCount = 0
      let missingCount = 0

      characters.forEach((char) => {
        const value = (char.attributes ?? {})[attribute]
        if (value === undefined) {
          missingCount++
        } else if (value === true) {
          trueCount++
        } else if (value === false) {
          falseCount++
        } else if (value === null) {
          nullCount++
        }
      })

      const definedCount = trueCount + falseCount + nullCount
      const coveragePercent = (definedCount / characters.length) * 100
      
      const diversityScore = definedCount > 0
        ? 1 - Math.abs((trueCount / definedCount) - 0.5) * 2
        : 0

      const hasGap = missingCount > 0 || coveragePercent < 100

      return {
        attribute,
        totalCharacters: characters.length,
        trueCount,
        falseCount,
        nullCount,
        missingCount,
        coveragePercent,
        diversityScore,
        hasGap,
      }
    })

    let filtered = stats

    if (filterBy === 'gaps') {
      filtered = stats.filter((s) => s.hasGap)
    } else if (filterBy === 'complete') {
      filtered = stats.filter((s) => s.coveragePercent === 100)
    } else if (filterBy === 'partial') {
      filtered = stats.filter((s) => s.coveragePercent > 0 && s.coveragePercent < 100)
    }

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'coverage') {
        return a.coveragePercent - b.coveragePercent
      } else if (sortBy === 'diversity') {
        return b.diversityScore - a.diversityScore
      } else if (sortBy === 'missing') {
        return b.missingCount - a.missingCount
      } else {
        return a.attribute.localeCompare(b.attribute)
      }
    })

    return sorted
  }, [characters, sortBy, filterBy])

  const summary = useMemo(() => {
    const totalAttributes = attributeStats.length
    const completeAttributes = attributeStats.filter((s) => s.coveragePercent === 100).length
    const partialAttributes = attributeStats.filter(
      (s) => s.coveragePercent > 0 && s.coveragePercent < 100
    ).length
    const averageCoverage =
      attributeStats.reduce((sum, s) => sum + s.coveragePercent, 0) / (totalAttributes || 1)
    const averageDiversity =
      attributeStats.reduce((sum, s) => sum + s.diversityScore, 0) / (totalAttributes || 1)
    const totalGaps = attributeStats.reduce((sum, s) => sum + s.missingCount, 0)

    return {
      totalAttributes,
      completeAttributes,
      partialAttributes,
      averageCoverage,
      averageDiversity,
      totalGaps,
    }
  }, [attributeStats])

  const getAttributeIssues = (stat: AttributeStats): string[] => {
    const issues: string[] = []
    
    if (stat.missingCount > 0) {
      issues.push(`${stat.missingCount} character${stat.missingCount > 1 ? 's' : ''} missing this attribute`)
    }
    
    if (stat.coveragePercent === 100 && (stat.trueCount === stat.totalCharacters || stat.falseCount === stat.totalCharacters)) {
      issues.push('No diversity - all characters have the same value')
    }
    
    if (stat.diversityScore < 0.2 && stat.coveragePercent === 100) {
      issues.push('Low diversity - highly skewed distribution')
    }

    return issues
  }

  const formatAttributeName = (attr: string): string => {
    return attr
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Attribute Coverage Report</h2>
          <p className="text-muted-foreground mt-1">
            Identify gaps and improve character data quality
          </p>
        </div>
        <Button onClick={onBack} variant="outline">
          <ArrowLeft size={20} className="mr-2" />
          Back
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="bg-card/50 backdrop-blur-sm border-accent/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Attributes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{summary.totalAttributes}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.completeAttributes} complete, {summary.partialAttributes} partial
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-accent/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Coverage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {summary.averageCoverage.toFixed(1)}%
            </div>
            <Progress value={summary.averageCoverage} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-accent/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Data Gaps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{summary.totalGaps}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Missing attribute values across all characters
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Attribute Details</CardTitle>
              <CardDescription>Analyze coverage and diversity for each attribute</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Funnel size={16} className="text-muted-foreground" />
                <Select value={filterBy} onValueChange={(v) => setFilterBy(v as FilterOption)}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Attributes</SelectItem>
                    <SelectItem value="gaps">Has Gaps</SelectItem>
                    <SelectItem value="complete">Complete</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <TrendUp size={16} className="text-muted-foreground" />
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coverage">By Coverage</SelectItem>
                    <SelectItem value="diversity">By Diversity</SelectItem>
                    <SelectItem value="missing">By Missing</SelectItem>
                    <SelectItem value="alphabetical">Alphabetical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {attributeStats.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No attributes found matching the current filter
              </div>
            ) : (
              attributeStats.map((stat) => {
                const issues = getAttributeIssues(stat)
                const isGood = stat.coveragePercent === 100 && stat.diversityScore >= 0.3

                return (
                  <Card
                    key={stat.attribute}
                    className={`transition-colors ${
                      isGood
                        ? 'border-green-500/30 bg-green-500/5'
                        : issues.length > 0
                        ? 'border-destructive/30 bg-destructive/5'
                        : 'border-accent/20'
                    }`}
                  >
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-foreground">
                              {formatAttributeName(stat.attribute)}
                            </h4>
                            {isGood ? (
                              <CheckCircle size={18} weight="fill" className="text-green-500" />
                            ) : issues.length > 0 ? (
                              <Warning size={18} weight="fill" className="text-destructive" />
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {stat.attribute}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={stat.coveragePercent === 100 ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {stat.coveragePercent.toFixed(0)}% coverage
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              stat.diversityScore >= 0.5
                                ? 'border-green-500/50 text-green-500'
                                : stat.diversityScore >= 0.3
                                ? 'border-accent/50 text-accent'
                                : 'border-destructive/50 text-destructive'
                            }`}
                          >
                            {(stat.diversityScore * 100).toFixed(0)}% diverse
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2 text-sm mb-3">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle size={14} className="text-green-500" />
                          <span className="text-muted-foreground">True:</span>
                          <span className="font-semibold text-foreground">{stat.trueCount}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <XCircle size={14} className="text-red-500" />
                          <span className="text-muted-foreground">False:</span>
                          <span className="font-semibold text-foreground">{stat.falseCount}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <QuestionIcon size={14} className="text-accent" />
                          <span className="text-muted-foreground">Null:</span>
                          <span className="font-semibold text-foreground">{stat.nullCount}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Warning size={14} className="text-destructive" />
                          <span className="text-muted-foreground">Missing:</span>
                          <span className="font-semibold text-destructive">
                            {stat.missingCount}
                          </span>
                        </div>
                      </div>

                      {issues.length > 0 && (
                        <div className="bg-background/50 rounded-lg p-3 space-y-1">
                          {issues.map((issue, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-2 text-xs text-muted-foreground"
                            >
                              <Warning size={12} className="text-destructive mt-0.5 shrink-0" />
                              <span>{issue}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-linear-to-br from-accent/10 to-primary/10 border-accent/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Warning size={24} className="text-accent" />
            Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {summary.totalGaps > 0 && (
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold">
                1
              </div>
              <div>
                <h4 className="font-semibold text-foreground">Fill Missing Attributes</h4>
                <p className="text-sm text-muted-foreground">
                  You have {summary.totalGaps} missing attribute values. Consider adding these to
                  improve question generation quality.
                </p>
              </div>
            </div>
          )}
          
          {attributeStats.filter((s) => s.diversityScore < 0.2 && s.coveragePercent === 100)
            .length > 0 && (
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold">
                2
              </div>
              <div>
                <h4 className="font-semibold text-foreground">Add Character Diversity</h4>
                <p className="text-sm text-muted-foreground">
                  {
                    attributeStats.filter((s) => s.diversityScore < 0.2 && s.coveragePercent === 100)
                      .length
                  }{' '}
                  attributes have low diversity. Add characters with different values for these
                  attributes.
                </p>
              </div>
            </div>
          )}

          {summary.completeAttributes === summary.totalAttributes && summary.totalGaps === 0 && (
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-6 h-6 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center">
                <CheckCircle size={16} weight="fill" />
              </div>
              <div>
                <h4 className="font-semibold text-green-500">Excellent Coverage!</h4>
                <p className="text-sm text-muted-foreground">
                  All attributes are fully populated across all characters. Your data quality is
                  excellent!
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
