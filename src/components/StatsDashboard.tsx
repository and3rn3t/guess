import { useState } from 'react'
import { useQuestionCoverage } from '@/hooks/useQuestionCoverage'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChartBar,
  Users,
  Trophy,
  ArrowLeft,
  TrendUp,
  Database,
  Lightning,
  GameController,
  Globe,
  Question,
  Crosshair,
  ArrowsLeftRight,
} from '@phosphor-icons/react'
import type { GlobalStats } from '@/hooks/useGlobalStats'

interface StatsDashboardProps {
  stats: GlobalStats | null
  loading: boolean
  onBack: () => void
}

export function StatsDashboard({ stats, loading, onBack }: StatsDashboardProps) {
  const [_activeTab, setActiveTab] = useState('games')

  // AN.3 / AN.6: lazy-load question coverage when those tabs are visited
  const coverageEnabled = _activeTab === 'questions' || _activeTab === 'coverage'
  const { data: questionData, loading: questionLoading } = useQuestionCoverage(coverageEnabled)

  const gs = stats?.gameStats
  const readiness = gs?.readiness

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Button onClick={onBack} variant="outline" className="flex items-center gap-2">
            <ArrowLeft size={20} />
            Back
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-foreground">Statistics Dashboard</h2>
          <Button onClick={onBack} variant="outline" className="flex items-center gap-2">
            <ArrowLeft size={20} />
            Back
          </Button>
        </div>
        <Card className="p-8 text-center bg-card/50 backdrop-blur-sm border-primary/20">
          <Globe size={48} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Unable to load global statistics. Check your connection and try again.</p>
        </Card>
      </div>
    )
  }

  const winRate = gs?.winRate ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <ChartBar size={32} weight="fill" className="text-accent" />
            Global Statistics
          </h2>
          <p className="text-muted-foreground mt-1">
            Live data from the global database
          </p>
        </div>
        <Button onClick={onBack} variant="outline" className="flex items-center gap-2">
          <ArrowLeft size={20} />
          Back
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <span className="w-7 h-7 rounded-md bg-accent/15 flex items-center justify-center">
                <Users size={16} className="text-accent" />
              </span>
              Characters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{stats.characters}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.attributes} attributes · {stats.questions} questions
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <span className="w-7 h-7 rounded-md bg-accent/15 flex items-center justify-center">
                <GameController size={16} className="text-accent" />
              </span>
              Games Played
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{gs?.totalGames ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Across all players globally
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <span className="w-7 h-7 rounded-md bg-emerald-500/15 flex items-center justify-center">
                <Trophy size={16} className="text-emerald-400" />
              </span>
              Win Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gradient-win">{winRate}%</div>
            <div className="text-xs text-muted-foreground mt-1">
              {gs?.wins ?? 0} wins of {gs?.totalGames ?? 0} games
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <span className="w-7 h-7 rounded-md bg-accent/15 flex items-center justify-center">
                <Database size={16} className="text-accent" />
              </span>
              Attribute Fill Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{stats.characterAttributes.fillRate}%</div>
            <Progress value={stats.characterAttributes.fillRate} className="h-2 mt-2" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="games" onValueChange={setActiveTab} className="space-y-4">
        <ScrollArea className="w-full" type="scroll">
          <TabsList className="flex w-max min-w-full h-auto gap-1 p-1">
            <TabsTrigger value="games" className="text-xs sm:text-sm">Games</TabsTrigger>
            <TabsTrigger value="readiness" className="text-xs sm:text-sm">Readiness</TabsTrigger>
            <TabsTrigger value="categories" className="text-xs sm:text-sm">Categories</TabsTrigger>
            <TabsTrigger value="database" className="text-xs sm:text-sm">Database</TabsTrigger>
            <TabsTrigger value="questions" className="text-xs sm:text-sm">Questions</TabsTrigger>
            <TabsTrigger value="coverage" className="text-xs sm:text-sm">Coverage</TabsTrigger>
            <TabsTrigger value="confusion" className="text-xs sm:text-sm">Confusion</TabsTrigger>
            <TabsTrigger value="calibration" className="text-xs sm:text-sm">Calibration</TabsTrigger>
          </TabsList>
        </ScrollArea>

        {/* Games tab */}
        <TabsContent value="games" className="space-y-4">
          {/* Difficulty breakdown */}
          {gs && gs.byDifficulty.length > 0 && (
            <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightning size={24} className="text-accent" />
                  Performance by Difficulty
                </CardTitle>
                <CardDescription>
                  Global game results across all difficulty levels
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {gs.byDifficulty.map((d) => (
                    <div key={d.difficulty} className="bg-background/50 rounded-lg p-4 border border-border/50">
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant="outline" className="capitalize">{d.difficulty}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {d.games} game{d.games !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Win Rate</div>
                          <div className="text-lg font-bold text-foreground">{d.winRate}%</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Wins</div>
                          <div className="text-lg font-bold text-green-500">{d.wins}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Avg Questions</div>
                          <div className="text-lg font-bold text-foreground">{d.avgQuestions}</div>
                        </div>
                      </div>
                      <Progress value={d.winRate} className="h-1.5 mt-3" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent games */}
          {gs && gs.recentGames.length > 0 && (
            <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendUp size={24} className="text-accent" />
                  Recent Games
                </CardTitle>
                <CardDescription>
                  Last {gs.recentGames.length} games played globally
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[calc(100dvh-400px)] min-h-[200px] max-h-[400px] pr-4">
                  <div className="space-y-2">
                    {gs.recentGames.map((game, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-background/50 rounded-lg p-3 border border-border/50"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant={game.won ? 'default' : 'secondary'} className="text-xs">
                            {game.won ? 'Won' : 'Lost'}
                          </Badge>
                          <span className="text-sm text-foreground capitalize">{game.difficulty}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{game.questionsAsked} Qs</span>
                          <span>{game.poolSize} characters</span>
                          <span>{formatTimeAgo(game.timestamp)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {(!gs || gs.totalGames === 0) && (
            <Card className="p-8 text-center bg-card/50 backdrop-blur-sm border-primary/20">
              <GameController size={48} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No games played yet. Start a game to see global statistics!</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="readiness" className="space-y-4">
          {readiness ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Instrumented Games</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-foreground">{readiness.instrumentedGames}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {readiness.recentInstrumentedGames} in the last 14 days
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Avg Confidence</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-foreground">{Math.round(readiness.avgConfidence * 100)}%</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {readiness.avgQuestionsAtGuess} questions on average
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Forced Guess Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-foreground">{readiness.forcedGuessRate}%</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Target below 8%
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Max-Question Guess Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-foreground">{readiness.maxQuestionGuessRate}%</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Target below 15%
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightning size={24} className="text-accent" />
                    Guess Readiness KPIs
                  </CardTitle>
                  <CardDescription>
                    Server-side calibration metrics from instrumented guesses
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    <ReadinessMetric
                      label="Strict readiness win rate"
                      value={readiness.strictReadinessWinRate}
                      target="75%+ target"
                    />
                    <ReadinessMetric
                      label="High-certainty win rate"
                      value={readiness.highCertaintyWinRate}
                      target="90%+ target"
                    />
                    <ReadinessMetric
                      label="Forced guess win rate"
                      value={readiness.forcedGuessWinRate}
                      target="Within 15 points of overall win rate"
                    />
                    <ReadinessMetric
                      label="Early guess win rate"
                      value={readiness.earlyGuessWinRate}
                      target="Healthy, but should stay rare"
                    />
                    <ReadinessMetric
                      label="Low-ambiguity win rate"
                      value={readiness.lowAmbiguityWinRate}
                      target="Above overall win rate"
                    />
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="p-8 text-center bg-card/50 backdrop-blur-sm border-primary/20">
              <Lightning size={48} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Not enough instrumented guess data yet to show readiness KPIs.</p>
            </Card>
          )}
        </TabsContent>

        {/* Categories tab */}
        <TabsContent value="categories" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg">By Category</CardTitle>
                <CardDescription>
                  Character distribution across categories
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[calc(100dvh-400px)] min-h-[250px] max-h-[400px] pr-4">
                  <div className="space-y-2">
                    {stats.byCategory.map((cat, index) => {
                      const percentage = stats.characters > 0
                        ? (cat.count / stats.characters) * 100
                        : 0
                      return (
                        <div key={cat.category} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-foreground font-medium">
                              {index + 1}. {cat.category}
                            </span>
                            <span className="text-muted-foreground">
                              {cat.count} ({percentage.toFixed(0)}%)
                            </span>
                          </div>
                          <Progress value={percentage} className="h-1.5" />
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg">By Source</CardTitle>
                <CardDescription>
                  How characters entered the database
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[calc(100dvh-400px)] min-h-[250px] max-h-[400px] pr-4">
                  <div className="space-y-2">
                    {stats.bySource.map((src, index) => {
                      const percentage = stats.characters > 0
                        ? (src.count / stats.characters) * 100
                        : 0
                      return (
                        <div key={src.source} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-foreground font-medium">
                              {index + 1}. {src.source}
                            </span>
                            <span className="text-muted-foreground">
                              {src.count} ({percentage.toFixed(0)}%)
                            </span>
                          </div>
                          <Progress value={percentage} className="h-1.5" />
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Database tab */}
        <TabsContent value="database" className="space-y-4">
          <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database size={24} className="text-accent" />
                Database Overview
              </CardTitle>
              <CardDescription>
                Global character database health and coverage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Characters</div>
                  <div className="text-3xl font-bold text-foreground">{stats.characters}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Attributes</div>
                  <div className="text-3xl font-bold text-foreground">{stats.attributes}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Questions</div>
                  <div className="text-3xl font-bold text-foreground">{stats.questions}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Avg Questions/Game</div>
                  <div className="text-3xl font-bold text-accent">{gs?.avgQuestions ?? '—'}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">Attribute Coverage</CardTitle>
              <CardDescription>
                How completely character attributes are filled in
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Fill Rate</span>
                  <span className="text-sm font-medium text-foreground">
                    {stats.characterAttributes.fillRate}%
                  </span>
                </div>
                <Progress value={stats.characterAttributes.fillRate} className="h-3" />
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total Attribute Slots</span>
                    <div className="text-lg font-bold text-foreground mt-1">
                      {stats.characterAttributes.total.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Filled</span>
                    <div className="text-lg font-bold text-accent mt-1">
                      {stats.characterAttributes.filled.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AN.3: Questions tab — coverage per question attribute */}
        <TabsContent value="questions" className="space-y-4">
          <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Question size={24} className="text-accent" />
                Question Coverage
              </CardTitle>
              <CardDescription>
                How many characters have each attribute filled in (determines question quality)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {questionLoading && (
                <div className="space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              )}
              {!questionLoading && questionData !== null && questionData.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No question data available.</p>
              )}
              {!questionLoading && questionData && questionData.length > 0 && (
                <ScrollArea className="h-[calc(100dvh-380px)] min-h-[300px] max-h-[500px] pr-4">
                  <div className="space-y-2">
                    {[...questionData].sort((a, b) => b.coverage_pct - a.coverage_pct).map((q) => (
                      <div key={q.id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-foreground font-medium truncate max-w-[70%]">{q.text}</span>
                          <span className="text-muted-foreground shrink-0 ml-2">
                            {q.filled_count}/{q.total_characters} ({q.coverage_pct.toFixed(0)}%)
                          </span>
                        </div>
                        <Progress value={q.coverage_pct} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AN.6: Coverage tab — questions grouped by fill bucket */}
        <TabsContent value="coverage" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {questionLoading && (
              <div className="col-span-2 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            )}
            {!questionLoading && questionData !== null && (() => {
              const buckets = [
                { label: 'Excellent (≥90%)', min: 90, color: 'text-emerald-400' },
                { label: 'Good (70–89%)', min: 70, color: 'text-accent' },
                { label: 'Fair (50–69%)', min: 50, color: 'text-yellow-400' },
                { label: 'Poor (<50%)', min: 0, color: 'text-red-400' },
              ]
              return buckets.map(({ label, min, color }, bi) => {
                const maxPct = bi === 0 ? 101 : [90, 70, 50][bi - 1]!
                const items = questionData.filter(
                  (q) => q.coverage_pct >= min && q.coverage_pct < maxPct
                )
                return (
                  <Card key={label} className="bg-card/50 backdrop-blur-sm border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className={`text-base ${color}`}>{label}</CardTitle>
                      <CardDescription>{items.length} question{items.length !== 1 ? 's' : ''}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[180px] pr-2">
                        <div className="space-y-1.5">
                          {items.sort((a, b) => b.coverage_pct - a.coverage_pct).map((q) => (
                            <div key={q.id} className="flex items-center justify-between text-xs gap-2">
                              <span className="truncate text-foreground">{q.text}</span>
                              <span className={`shrink-0 font-medium ${color}`}>{q.coverage_pct.toFixed(0)}%</span>
                            </div>
                          ))}
                          {items.length === 0 && (
                            <p className="text-muted-foreground text-xs">None in this range</p>
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )
              })
            })()}
          </div>
        </TabsContent>

        {/* AN.7: Confusion tab — character pairs from sim analysis */}
        <TabsContent value="confusion" className="space-y-4">
          <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crosshair size={24} className="text-accent" />
                Character Confusion Pairs
              </CardTitle>
              <CardDescription>
                Characters most frequently confused with each other in simulations (second-best analysis)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!stats.confusion || stats.confusion.length === 0 ? (
                <div className="py-12 text-center">
                  <Crosshair size={40} className="mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No confusion data yet. Run simulations with <code className="text-xs bg-muted px-1 rounded">pnpm simulate --all</code> first.</p>
                </div>
              ) : (
                <ScrollArea className="h-[calc(100dvh-380px)] min-h-[300px] max-h-[500px] pr-4">
                  <div className="space-y-2">
                    {stats.confusion.map((pair, i) => (
                      <div key={i} className="flex items-center gap-3 bg-background/50 rounded-lg p-3 border border-border/50">
                        <span className="text-muted-foreground text-sm w-6 shrink-0">{i + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-sm font-medium flex-wrap">
                            <span className="text-foreground">{pair.targetName}</span>
                            <ArrowsLeftRight size={14} className="text-muted-foreground shrink-0" />
                            <span className="text-accent">{pair.secondBestName}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-medium text-foreground">{pair.count}×</div>
                          <div className="text-xs text-red-400">{pair.lossRate.toFixed(0)}% loss</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AN.8: Calibration tab — real vs sim overlay */}
        <TabsContent value="calibration" className="space-y-4">
          <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowsLeftRight size={24} className="text-accent" />
                Real vs. Simulation Calibration
              </CardTitle>
              <CardDescription>
                Compares live game metrics against the latest simulator run — validates engine accuracy
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!stats.calibration || stats.calibration.length === 0 ? (
                <div className="py-12 text-center">
                  <ArrowsLeftRight size={40} className="mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No calibration data yet. Run <code className="text-xs bg-muted px-1 rounded">pnpm simulate --all --write-db</code> to populate sim data.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {stats.calibration.sort((a, b) => a.difficulty.localeCompare(b.difficulty)).map((row) => (
                    <div key={row.difficulty} className="bg-background/50 rounded-lg p-4 border border-border/50">
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant="outline" className="capitalize">{row.difficulty}</Badge>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>{row.realGames} real games</span>
                          <span>{row.simGames} sim games</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <CalibrationMetric label="Win Rate" real={row.realWinRate} sim={row.simWinRate} unit="%" />
                        <CalibrationMetric label="Avg Questions" real={row.realAvgQ} sim={row.simAvgQ} unit="q" lowerIsBetter />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function CalibrationMetric({
  label,
  real,
  sim,
  unit,
  lowerIsBetter = false,
}: {
  label: string
  real: number
  sim: number
  unit: string
  lowerIsBetter?: boolean
}) {
  const delta = sim - real
  const good = lowerIsBetter ? delta <= 0 : delta >= 0
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-bold text-foreground">{real.toFixed(1)}{unit}</span>
        <span className="text-xs text-muted-foreground">real</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-medium text-accent">{sim.toFixed(1)}{unit}</span>
        <span className="text-xs text-muted-foreground">sim</span>
        <span className={`text-xs font-medium ${good ? 'text-emerald-400' : 'text-red-400'}`}>
          {delta >= 0 ? '+' : ''}{delta.toFixed(1)}{unit}
        </span>
      </div>
    </div>
  )
}

function ReadinessMetric({
  label,
  value,
  target,
}: {
  label: string
  value: number | null
  target: string
}) {
  return (
    <div className="bg-background/50 rounded-lg p-4 border border-border/50 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-foreground font-medium">{label}</span>
        <Badge variant="outline">{value == null ? '—' : `${value}%`}</Badge>
      </div>
      <div className="text-xs text-muted-foreground">{target}</div>
    </div>
  )
}

function formatTimeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return new Date(timestamp).toLocaleDateString()
}
