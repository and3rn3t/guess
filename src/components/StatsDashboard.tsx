import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { 
  ChartBar, 
  Users, 
  Question, 
  Sparkle, 
  ArrowLeft,
  TrendUp,
  Database,
  Lightning
} from '@phosphor-icons/react'
import type { Character, Question as QuestionType, GameHistoryEntry } from '@/lib/types'

interface StatsDashboardProps {
  characters: Character[]
  questions: QuestionType[]
  gameHistory?: GameHistoryEntry[]
  onBack: () => void
}

interface QuestionStats {
  questionId: string
  questionText: string
  attribute: string
  timesAsked: number
  successRate: number
  averagePosition: number
}

interface AttributeStats {
  attribute: string
  questionCount: number
  characterCoverage: number
  yesCount: number
  noCount: number
  nullCount: number
  entropy: number
}

interface CharacterStats {
  totalCharacters: number
  userTaught: number
  default: number
  uniqueAttributes: number
  averageAttributesPerCharacter: number
  mostCommonAttributes: Array<{ attribute: string; count: number }>
  leastCommonAttributes: Array<{ attribute: string; count: number }>
}

export function StatsDashboard({ characters, questions, gameHistory = [], onBack }: StatsDashboardProps) {
  const [activeTab, setActiveTab] = useState('questions')

  // Only compute question stats when the "questions" tab is active
  const questionStats = useMemo<QuestionStats[]>(() => {
    if (activeTab !== 'questions') return []
    const statsMap = new Map<string, { timesAsked: number; positions: number[]; wins: number }>()

    gameHistory.forEach((game) => {
      game.steps.forEach((step, index) => {
        const qId = step.attribute
        const existing = statsMap.get(qId) || { timesAsked: 0, positions: [], wins: 0 }
        existing.timesAsked++
        existing.positions.push(index + 1)
        if (game.won) existing.wins++
        statsMap.set(qId, existing)
      })
    })

    return questions.map((q) => {
      const stats = statsMap.get(q.attribute) || { timesAsked: 0, positions: [], wins: 0 }
      const avgPosition = stats.positions.length > 0
        ? stats.positions.reduce((a, b) => a + b, 0) / stats.positions.length
        : 0
      const successRate = stats.timesAsked > 0 ? (stats.wins / stats.timesAsked) * 100 : 0

      return {
        questionId: q.id,
        questionText: q.text,
        attribute: q.attribute,
        timesAsked: stats.timesAsked,
        successRate,
        averagePosition: avgPosition,
      }
    }).sort((a, b) => b.timesAsked - a.timesAsked)
  }, [questions, gameHistory, activeTab])

  const attributeStats = useMemo<AttributeStats[]>(() => {
    const allAttributes = new Set<string>()
    characters.forEach((char) => {
      Object.keys(char.attributes).forEach((attr) => allAttributes.add(attr))
    })

    return Array.from(allAttributes).map((attribute) => {
      const questionCount = questions.filter((q) => q.attribute === attribute).length
      let yesCount = 0
      let noCount = 0
      let nullCount = 0

      characters.forEach((char) => {
        const value = char.attributes[attribute]
        if (value === true) yesCount++
        else if (value === false) noCount++
        else nullCount++
      })

      const total = characters.length
      const characterCoverage = ((total - nullCount) / total) * 100
      
      const p1 = yesCount / total
      const p2 = noCount / total
      const p3 = nullCount / total
      const entropy = -[p1, p2, p3]
        .filter((p) => p > 0)
        .reduce((sum, p) => sum + p * Math.log2(p), 0)

      return {
        attribute,
        questionCount,
        characterCoverage,
        yesCount,
        noCount,
        nullCount,
        entropy,
      }
    }).sort((a, b) => b.entropy - a.entropy)
  }, [characters, questions])

  const characterStats = useMemo<CharacterStats>(() => {
    const totalCharacters = characters.length
    const userTaught = characters.filter((c) => c.id.startsWith('char-')).length
    const defaultCharacters = totalCharacters - userTaught

    const allAttributes = new Set<string>()
    const attributeCounts = new Map<string, number>()

    let totalAttributeCount = 0

    characters.forEach((char) => {
      const charAttrCount = Object.keys(char.attributes).length
      totalAttributeCount += charAttrCount

      Object.entries(char.attributes).forEach(([attr, value]) => {
        allAttributes.add(attr)
        if (value !== null) {
          attributeCounts.set(attr, (attributeCounts.get(attr) || 0) + 1)
        }
      })
    })

    const sortedAttributes = Array.from(attributeCounts.entries())
      .map(([attribute, count]) => ({ attribute, count }))
      .sort((a, b) => b.count - a.count)

    return {
      totalCharacters,
      userTaught,
      default: defaultCharacters,
      uniqueAttributes: allAttributes.size,
      averageAttributesPerCharacter: totalCharacters > 0 ? totalAttributeCount / totalCharacters : 0,
      mostCommonAttributes: sortedAttributes.slice(0, 10),
      leastCommonAttributes: sortedAttributes.slice(-10).reverse(),
    }
  }, [characters])

  const diversityScore = useMemo(() => {
    const maxEntropy = Math.log2(3)
    const avgEntropy = attributeStats.length > 0
      ? attributeStats.reduce((sum, stat) => sum + stat.entropy, 0) / attributeStats.length
      : 0
    return (avgEntropy / maxEntropy) * 100
  }, [attributeStats])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <ChartBar size={32} weight="fill" className="text-accent" />
            Statistics Dashboard
          </h2>
          <p className="text-muted-foreground mt-1">
            Analyze question usage and character pool diversity
          </p>
        </div>
        <Button onClick={onBack} variant="outline" className="flex items-center gap-2">
          <ArrowLeft size={20} />
          Back
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users size={20} className="text-accent" />
              Total Characters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{characterStats.totalCharacters}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {characterStats.userTaught} user-taught, {characterStats.default} default
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Question size={20} className="text-accent" />
              Total Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{questions.length}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Covering {characterStats.uniqueAttributes} attributes
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Database size={20} className="text-accent" />
              Unique Attributes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{characterStats.uniqueAttributes}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Avg {characterStats.averageAttributesPerCharacter.toFixed(1)} per character
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Sparkle size={20} className="text-accent" />
              Diversity Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{diversityScore.toFixed(0)}%</div>
            <Progress value={diversityScore} className="h-2 mt-2" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="questions" onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="questions" className="text-xs sm:text-sm">Questions</TabsTrigger>
          <TabsTrigger value="attributes" className="text-xs sm:text-sm">Attributes</TabsTrigger>
          <TabsTrigger value="characters" className="text-xs sm:text-sm">Characters</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="space-y-4">
          <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightning size={24} className="text-accent" />
                Question Performance
              </CardTitle>
              <CardDescription>
                {gameHistory.length > 0 
                  ? `Based on ${gameHistory.length} game${gameHistory.length !== 1 ? 's' : ''} played`
                  : 'No game history yet - play games to see statistics'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100dvh-320px)] min-h-[300px] max-h-[500px] pr-4">
                {questionStats.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Question size={48} className="mx-auto mb-4 opacity-50" />
                    <p>Play some games to generate question usage statistics!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {questionStats.map((stat, index) => (
                      <div
                        key={stat.questionId}
                        className="bg-background/50 rounded-lg p-4 border border-border/50 hover:border-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                #{index + 1}
                              </Badge>
                              <span className="text-sm font-medium text-foreground">
                                {stat.questionText}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Attribute: <span className="text-accent">{stat.attribute}</span>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mt-3">
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Times Asked</div>
                            <div className="text-lg font-bold text-foreground">{stat.timesAsked}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Avg Position</div>
                            <div className="text-lg font-bold text-foreground">
                              {stat.averagePosition > 0 ? stat.averagePosition.toFixed(1) : 'N/A'}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Success Rate</div>
                            <div className="text-lg font-bold text-foreground">
                              {stat.successRate.toFixed(0)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attributes" className="space-y-4">
          <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendUp size={24} className="text-accent" />
                Attribute Information Entropy
              </CardTitle>
              <CardDescription>
                Higher entropy means better question discrimination power
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100dvh-320px)] min-h-[300px] max-h-[500px] pr-4">
                <div className="space-y-3">
                  {attributeStats.map((stat, index) => {
                    const maxEntropy = Math.log2(3)
                    const entropyPercent = (stat.entropy / maxEntropy) * 100
                    
                    return (
                      <div
                        key={stat.attribute}
                        className="bg-background/50 rounded-lg p-4 border border-border/50"
                      >
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                #{index + 1}
                              </Badge>
                              <span className="text-sm font-medium text-foreground">
                                {stat.attribute}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {stat.questionCount} question{stat.questionCount !== 1 ? 's' : ''} available
                            </div>
                          </div>
                          <Badge 
                            variant={entropyPercent > 70 ? 'default' : entropyPercent > 40 ? 'secondary' : 'outline'}
                            className="text-xs"
                          >
                            {entropyPercent.toFixed(0)}% Entropy
                          </Badge>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Distribution</span>
                            <span className="text-muted-foreground">
                              {stat.characterCoverage.toFixed(0)}% coverage
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="text-center">
                              <div className="text-xs text-muted-foreground mb-1">Yes</div>
                              <div className="text-sm font-bold text-green-500">{stat.yesCount}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-xs text-muted-foreground mb-1">No</div>
                              <div className="text-sm font-bold text-red-500">{stat.noCount}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-xs text-muted-foreground mb-1">Unknown</div>
                              <div className="text-sm font-bold text-muted-foreground">{stat.nullCount}</div>
                            </div>
                          </div>
                          <Progress value={entropyPercent} className="h-1.5" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="characters" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg">Most Common Attributes</CardTitle>
                <CardDescription>
                  Attributes present in most characters
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[calc(100dvh-400px)] min-h-[250px] max-h-[400px] pr-4">
                  <div className="space-y-2">
                    {characterStats.mostCommonAttributes.map((attr, index) => {
                      const percentage = (attr.count / characterStats.totalCharacters) * 100
                      return (
                        <div key={attr.attribute} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-foreground font-medium">
                              {index + 1}. {attr.attribute}
                            </span>
                            <span className="text-muted-foreground">
                              {attr.count} ({percentage.toFixed(0)}%)
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
                <CardTitle className="text-lg">Least Common Attributes</CardTitle>
                <CardDescription>
                  Rare attributes for unique differentiation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[calc(100dvh-400px)] min-h-[250px] max-h-[400px] pr-4">
                  <div className="space-y-2">
                    {characterStats.leastCommonAttributes.map((attr, index) => {
                      const percentage = (attr.count / characterStats.totalCharacters) * 100
                      return (
                        <div key={attr.attribute} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-foreground font-medium">
                              {index + 1}. {attr.attribute}
                            </span>
                            <span className="text-muted-foreground">
                              {attr.count} ({percentage.toFixed(0)}%)
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

          <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">Pool Composition</CardTitle>
              <CardDescription>
                Character breakdown by source
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Default Characters</div>
                  <div className="text-3xl font-bold text-foreground">{characterStats.default}</div>
                  <Progress 
                    value={(characterStats.default / characterStats.totalCharacters) * 100} 
                    className="h-2"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">User-Taught Characters</div>
                  <div className="text-3xl font-bold text-accent">{characterStats.userTaught}</div>
                  <Progress 
                    value={(characterStats.userTaught / characterStats.totalCharacters) * 100} 
                    className="h-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
