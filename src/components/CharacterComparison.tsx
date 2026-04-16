import { useState, useMemo } from 'react'
import { ArrowLeft, Users, MagnifyingGlass, CheckCircle, XCircle, MinusCircle } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import type { Character } from '@/lib/types'

interface CharacterComparisonProps {
  characters: Character[]
  onBack: () => void
  onOpenRecommender?: (character: Character) => void
}

interface AttributeAnalysis {
  attribute: string
  yesCount: number
  noCount: number
  maybeCount: number
  coverage: number
  discriminationPower: number
}

interface CharacterPair {
  char1: Character
  char2: Character
  sharedAttributes: number
  differentAttributes: number
  similarity: number
}

export function CharacterComparison({ characters, onBack }: CharacterComparisonProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)
  const [compareCharacter, setCompareCharacter] = useState<Character | null>(null)

  const filteredCharacters = useMemo(() => {
    if (!searchTerm) return characters
    return characters.filter((char) =>
      char.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [characters, searchTerm])

  const attributeAnalysis = useMemo((): AttributeAnalysis[] => {
    const allAttributes = new Set<string>()
    characters.forEach((char) => {
      Object.keys(char.attributes).forEach((attr) => allAttributes.add(attr))
    })

    const analysis: AttributeAnalysis[] = []

    allAttributes.forEach((attribute) => {
      let yesCount = 0
      let noCount = 0
      let maybeCount = 0

      characters.forEach((char) => {
        const value = char.attributes[attribute]
        if (value === true) yesCount++
        else if (value === false) noCount++
        else maybeCount++
      })

      const coverage = ((yesCount + noCount) / characters.length) * 100
      const distribution = [yesCount, noCount, maybeCount].filter((c) => c > 0).length
      const evenness = Math.min(yesCount, noCount) / Math.max(yesCount, noCount, 1)
      const discriminationPower = coverage * evenness * distribution

      analysis.push({
        attribute,
        yesCount,
        noCount,
        maybeCount,
        coverage,
        discriminationPower,
      })
    })

    return analysis.sort((a, b) => b.discriminationPower - a.discriminationPower)
  }, [characters])

  const mostSimilarPairs = useMemo((): CharacterPair[] => {
    const pairs: CharacterPair[] = []

    for (let i = 0; i < characters.length; i++) {
      for (let j = i + 1; j < characters.length; j++) {
        const char1 = characters[i]
        const char2 = characters[j]

        let shared = 0
        let different = 0

        const allAttrs = new Set([
          ...Object.keys(char1.attributes),
          ...Object.keys(char2.attributes),
        ])

        allAttrs.forEach((attr) => {
          const val1 = char1.attributes[attr]
          const val2 = char2.attributes[attr]

          if (val1 !== undefined && val2 !== undefined && val1 !== null && val2 !== null) {
            if (val1 === val2) {
              shared++
            } else {
              different++
            }
          }
        })

        const similarity = shared / (shared + different)

        pairs.push({
          char1,
          char2,
          sharedAttributes: shared,
          differentAttributes: different,
          similarity,
        })
      }
    }

    return pairs.sort((a, b) => b.similarity - a.similarity).slice(0, 10)
  }, [characters])

  const compareTwo = (char1: Character, char2: Character) => {
    const allAttrs = new Set([
      ...Object.keys(char1.attributes),
      ...Object.keys(char2.attributes),
    ])

    const shared: string[] = []
    const different: string[] = []
    const onlyChar1: string[] = []
    const onlyChar2: string[] = []

    allAttrs.forEach((attr) => {
      const val1 = char1.attributes[attr]
      const val2 = char2.attributes[attr]

      if (val1 === undefined && val2 !== undefined) {
        onlyChar2.push(attr)
      } else if (val2 === undefined && val1 !== undefined) {
        onlyChar1.push(attr)
      } else if (val1 !== null && val2 !== null && val1 === val2) {
        shared.push(attr)
      } else if (val1 !== null && val2 !== null && val1 !== val2) {
        different.push(attr)
      }
    })

    return { shared, different, onlyChar1, onlyChar2 }
  }

  const renderAttributeValue = (value: boolean | null) => {
    if (value === true) {
      return <CheckCircle size={20} weight="fill" className="text-green-500" />
    } else if (value === false) {
      return <XCircle size={20} weight="fill" className="text-red-500" />
    } else {
      return <MinusCircle size={20} weight="fill" className="text-muted-foreground" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users size={32} weight="bold" className="text-accent" />
          <div>
            <h2 className="text-3xl font-bold text-foreground">Character Comparison</h2>
            <p className="text-muted-foreground">Analyze attribute overlaps and similarities</p>
          </div>
        </div>
        <Button onClick={onBack} variant="outline">
          <ArrowLeft size={20} className="mr-2" />
          Back
        </Button>
      </div>

      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle>Database Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-background/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-accent">{characters.length}</div>
              <div className="text-sm text-muted-foreground">Total Characters</div>
            </div>
            <div className="bg-background/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-accent">{attributeAnalysis.length}</div>
              <div className="text-sm text-muted-foreground">Unique Attributes</div>
            </div>
            <div className="bg-background/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-accent">
                {Math.round(attributeAnalysis.reduce((sum, a) => sum + a.coverage, 0) / attributeAnalysis.length)}%
              </div>
              <div className="text-sm text-muted-foreground">Avg Coverage</div>
            </div>
            <div className="bg-background/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-accent">
                {(mostSimilarPairs[0]?.similarity * 100 || 0).toFixed(0)}%
              </div>
              <div className="text-sm text-muted-foreground">Max Similarity</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="attributes" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="attributes">Attribute Analysis</TabsTrigger>
          <TabsTrigger value="similar">Similar Pairs</TabsTrigger>
          <TabsTrigger value="compare">Compare Two</TabsTrigger>
        </TabsList>

        <TabsContent value="attributes" className="space-y-4">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle>Attribute Discrimination Power</CardTitle>
              <CardDescription>
                Attributes ranked by their ability to differentiate between characters
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {attributeAnalysis.map((attr, index) => (
                  <div
                    key={attr.attribute}
                    className="bg-background/50 rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          #{index + 1}
                        </Badge>
                        <span className="font-semibold text-foreground">
                          {attr.attribute}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Power: {attr.discriminationPower.toFixed(1)}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={16} weight="fill" className="text-green-500" />
                        <span className="text-muted-foreground">Yes: {attr.yesCount}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle size={16} weight="fill" className="text-red-500" />
                        <span className="text-muted-foreground">No: {attr.noCount}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MinusCircle size={16} weight="fill" className="text-muted-foreground" />
                        <span className="text-muted-foreground">Maybe: {attr.maybeCount}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Coverage</span>
                        <span>{attr.coverage.toFixed(1)}%</span>
                      </div>
                      <Progress value={attr.coverage} className="h-2" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="similar" className="space-y-4">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle>Most Similar Character Pairs</CardTitle>
              <CardDescription>
                Characters with the highest attribute overlap
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mostSimilarPairs.map((pair, index) => (
                  <div
                    key={`${pair.char1.id}-${pair.char2.id}`}
                    className="bg-background/50 rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs">
                          #{index + 1}
                        </Badge>
                        <div className="font-semibold text-foreground">
                          {pair.char1.name} & {pair.char2.name}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-accent">
                        {(pair.similarity * 100).toFixed(1)}% similar
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={16} weight="fill" className="text-green-500" />
                        <span className="text-muted-foreground">
                          {pair.sharedAttributes} shared
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle size={16} weight="fill" className="text-red-500" />
                        <span className="text-muted-foreground">
                          {pair.differentAttributes} different
                        </span>
                      </div>
                    </div>
                    <Progress value={pair.similarity * 100} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compare" className="space-y-4">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle>Compare Two Characters</CardTitle>
              <CardDescription>
                Select two characters to see their attribute differences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <MagnifyingGlass
                  size={20}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  placeholder="Search characters..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">
                    First Character
                  </label>
                  <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                    {filteredCharacters.map((char) => (
                      <Button
                        key={char.id}
                        variant={selectedCharacter?.id === char.id ? 'default' : 'ghost'}
                        className="w-full justify-start"
                        onClick={() => setSelectedCharacter(char)}
                      >
                        {char.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">
                    Second Character
                  </label>
                  <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                    {filteredCharacters
                      .filter((char) => char.id !== selectedCharacter?.id)
                      .map((char) => (
                        <Button
                          key={char.id}
                          variant={compareCharacter?.id === char.id ? 'default' : 'ghost'}
                          className="w-full justify-start"
                          onClick={() => setCompareCharacter(char)}
                        >
                          {char.name}
                        </Button>
                      ))}
                  </div>
                </div>
              </div>

              {selectedCharacter && compareCharacter && (() => {
                const comparison = compareTwo(selectedCharacter, compareCharacter)
                const total = comparison.shared.length + comparison.different.length
                const similarity = total > 0 ? (comparison.shared.length / total) * 100 : 0

                return (
                  <div className="space-y-4 mt-6">
                    <div className="bg-background/50 rounded-lg p-4">
                      <div className="text-center space-y-2">
                        <div className="text-3xl font-bold text-accent">
                          {similarity.toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground">Similarity Score</div>
                        <Progress value={similarity} className="h-2" />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-background/50 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2 text-green-500">
                          <CheckCircle size={20} weight="fill" />
                          <span className="font-semibold">
                            Shared Attributes ({comparison.shared.length})
                          </span>
                        </div>
                        <div className="space-y-1 max-h-64 overflow-y-auto">
                          {comparison.shared.map((attr) => (
                            <div
                              key={attr}
                              className="text-sm text-muted-foreground bg-green-500/10 rounded px-2 py-1"
                            >
                              {attr}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-background/50 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2 text-red-500">
                          <XCircle size={20} weight="fill" />
                          <span className="font-semibold">
                            Different Attributes ({comparison.different.length})
                          </span>
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {comparison.different.map((attr) => (
                            <div
                              key={attr}
                              className="text-sm bg-red-500/10 rounded px-2 py-1 space-y-1"
                            >
                              <div className="font-medium text-foreground">{attr}</div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {selectedCharacter.name}:
                                  </span>
                                  {renderAttributeValue(selectedCharacter.attributes[attr])}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {compareCharacter.name}:
                                  </span>
                                  {renderAttributeValue(compareCharacter.attributes[attr])}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
