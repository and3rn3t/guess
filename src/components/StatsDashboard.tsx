import { useState } from 'react'
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
} from '@phosphor-icons/react'
import type { GlobalStats } from '@/hooks/useGlobalStats'

interface StatsDashboardProps {
  stats: GlobalStats | null
  loading: boolean
  onBack: () => void
}

export function StatsDashboard({ stats, loading, onBack }: StatsDashboardProps) {
  const [_activeTab, setActiveTab] = useState('games')

  const gs = stats?.gameStats

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
              <Users size={20} className="text-accent" />
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
              <GameController size={20} className="text-accent" />
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
              <Trophy size={20} className="text-accent" />
              Win Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{winRate}%</div>
            <div className="text-xs text-muted-foreground mt-1">
              {gs?.wins ?? 0} wins of {gs?.totalGames ?? 0} games
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Database size={20} className="text-accent" />
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="games" className="text-xs sm:text-sm">Games</TabsTrigger>
          <TabsTrigger value="categories" className="text-xs sm:text-sm">Categories</TabsTrigger>
          <TabsTrigger value="database" className="text-xs sm:text-sm">Database</TabsTrigger>
        </TabsList>

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
      </Tabs>
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
