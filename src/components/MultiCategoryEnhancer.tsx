import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowLeft, TreeStructure, Sparkle, Check, X, Lightning, Users, Brain, Planet, User, Backpack, Heart, ChartLineUp } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import type { Character } from '@/lib/types'
import {
  generateCategoryRecommendations,
  type AttributeRecommendation,
  type AttributeCategory,
  getCategoryInfo,
  getAvailableAttributesForCategory,
} from '@/lib/categoryRecommender'

interface MultiCategoryEnhancerProps {
  characters: Character[]
  onUpdateCharacters: (updatedCharacters: Character[]) => void
  onBack: () => void
}

interface CharacterEnhancement {
  character: Character
  recommendations: AttributeRecommendation[]
  isLoading: boolean
  isComplete: boolean
  acceptedCount: number
}

const CATEGORY_ICONS: Record<AttributeCategory, typeof TreeStructure> = {
  environment: TreeStructure,
  abilities: Lightning,
  equipment: Backpack,
  physical: User,
  personality: Brain,
  origins: Planet,
  relationships: Heart,
}

const CATEGORY_COLORS: Record<AttributeCategory, { bg: string; border: string; text: string }> = {
  environment: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/50', text: 'text-emerald-400' },
  abilities: { bg: 'bg-purple-500/10', border: 'border-purple-500/50', text: 'text-purple-400' },
  equipment: { bg: 'bg-amber-500/10', border: 'border-amber-500/50', text: 'text-amber-400' },
  physical: { bg: 'bg-blue-500/10', border: 'border-blue-500/50', text: 'text-blue-400' },
  personality: { bg: 'bg-pink-500/10', border: 'border-pink-500/50', text: 'text-pink-400' },
  origins: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/50', text: 'text-cyan-400' },
  relationships: { bg: 'bg-rose-500/10', border: 'border-rose-500/50', text: 'text-rose-400' },
}

export function MultiCategoryEnhancer({
  characters,
  onUpdateCharacters,
  onBack,
}: MultiCategoryEnhancerProps) {
  const [enhancements, setEnhancements] = useState<Map<string, CharacterEnhancement>>(new Map())
  const [currentCharacterIndex, setCurrentCharacterIndex] = useState(0)
  const [isGeneratingAll, setIsGeneratingAll] = useState(false)
  const [globalProgress, setGlobalProgress] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState<AttributeCategory>('personality')
  const [showDashboard, setShowDashboard] = useState(true)

  const currentCharacter = characters[currentCharacterIndex]
  const currentEnhancement = enhancements.get(currentCharacter?.id)

  useEffect(() => {
    if (currentCharacter && !enhancements.has(currentCharacter.id) && !showDashboard) {
      loadRecommendationsForCharacter(currentCharacter)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCharacter, selectedCategory, showDashboard])

  const loadRecommendationsForCharacter = async (character: Character) => {
    setEnhancements((prev) => {
      const newMap = new Map(prev)
      newMap.set(character.id, {
        character,
        recommendations: [],
        isLoading: true,
        isComplete: false,
        acceptedCount: 0,
      })
      return newMap
    })

    try {
      const recs = await generateCategoryRecommendations(
        character.name,
        character.attributes,
        selectedCategory
      )

      setEnhancements((prev) => {
        const newMap = new Map(prev)
        const existing = newMap.get(character.id)!
        newMap.set(character.id, {
          ...existing,
          recommendations: recs,
          isLoading: false,
        })
        return newMap
      })

      const categoryInfo = getCategoryInfo(selectedCategory)
      toast.success(`Generated ${recs.length} ${categoryInfo.name.toLowerCase()} recommendations for ${character.name}`)
    } catch (error) {
      toast.error(`Failed to generate recommendations for ${character.name}`)
      console.error(error)

      setEnhancements((prev) => {
        const newMap = new Map(prev)
        const existing = newMap.get(character.id)!
        newMap.set(character.id, {
          ...existing,
          isLoading: false,
        })
        return newMap
      })
    }
  }

  const handleGenerateAll = async () => {
    setIsGeneratingAll(true)
    let completed = 0

    for (const character of characters) {
      if (!enhancements.has(character.id)) {
        await loadRecommendationsForCharacter(character)
      }
      completed++
      setGlobalProgress((completed / characters.length) * 100)
    }

    setIsGeneratingAll(false)
    toast.success('Generated recommendations for all characters!')
  }

  const handleAccept = (rec: AttributeRecommendation, value: boolean | null) => {
    if (!currentCharacter || !currentEnhancement) return

    const updatedCharacter = {
      ...currentCharacter,
      attributes: {
        ...currentCharacter.attributes,
        [rec.attribute]: value,
      },
    }

    setEnhancements((prev) => {
      const newMap = new Map(prev)
      const existing = newMap.get(currentCharacter.id)!
      newMap.set(currentCharacter.id, {
        ...existing,
        character: updatedCharacter,
        recommendations: existing.recommendations.filter((r) => r.attribute !== rec.attribute),
        acceptedCount: existing.acceptedCount + 1,
      })
      return newMap
    })

    const allCharacters = characters.map((c) =>
      c.id === currentCharacter.id ? updatedCharacter : c
    )
    onUpdateCharacters(allCharacters)

    toast.success(`Added: ${rec.label}`)
  }

  const handleReject = (rec: AttributeRecommendation) => {
    if (!currentCharacter || !currentEnhancement) return

    setEnhancements((prev) => {
      const newMap = new Map(prev)
      const existing = newMap.get(currentCharacter.id)!
      newMap.set(currentCharacter.id, {
        ...existing,
        recommendations: existing.recommendations.filter((r) => r.attribute !== rec.attribute),
      })
      return newMap
    })

    toast.info(`Rejected: ${rec.label}`)
  }

  const handleAcceptAll = () => {
    if (!currentCharacter || !currentEnhancement) return

    let updatedCharacter = { ...currentCharacter }

    currentEnhancement.recommendations.forEach((rec) => {
      updatedCharacter = {
        ...updatedCharacter,
        attributes: {
          ...updatedCharacter.attributes,
          [rec.attribute]: true,
        },
      }
    })

    setEnhancements((prev) => {
      const newMap = new Map(prev)
      newMap.set(currentCharacter.id, {
        character: updatedCharacter,
        recommendations: [],
        isLoading: false,
        isComplete: true,
        acceptedCount: currentEnhancement.recommendations.length,
      })
      return newMap
    })

    const allCharacters = characters.map((c) =>
      c.id === currentCharacter.id ? updatedCharacter : c
    )
    onUpdateCharacters(allCharacters)

    toast.success(`Applied all ${currentEnhancement.recommendations.length} recommendations!`)
  }

  const handleNext = () => {
    if (currentCharacterIndex < characters.length - 1) {
      setCurrentCharacterIndex((prev) => prev + 1)
    }
  }

  const handlePrevious = () => {
    if (currentCharacterIndex > 0) {
      setCurrentCharacterIndex((prev) => prev - 1)
    }
  }

  const handleSkipToCharacter = (index: number) => {
    setCurrentCharacterIndex(index)
    setShowDashboard(false)
  }

  const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'medium':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      case 'low':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    }
  }

  const getCharacterStatus = (characterId: string) => {
    const enhancement = enhancements.get(characterId)
    if (!enhancement) return 'pending'
    if (enhancement.isLoading) return 'loading'
    if (enhancement.acceptedCount > 0) return 'enhanced'
    if (enhancement.recommendations.length === 0) return 'complete'
    return 'ready'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'enhanced':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'complete':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'loading':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'ready':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      default:
        return 'bg-muted/20 text-muted-foreground border-muted/30'
    }
  }

  const totalEnhancements = Array.from(enhancements.values()).reduce(
    (sum, e) => sum + e.acceptedCount,
    0
  )

  const categoryInfo = getCategoryInfo(selectedCategory)
  const CategoryIcon = CATEGORY_ICONS[selectedCategory]
  const getCategoryStats = (category: AttributeCategory) => {
    const categoryInfo = getCategoryInfo(category)
    let totalAvailable = 0
    let totalFilled = 0

    characters.forEach((char) => {
      const available = getAvailableAttributesForCategory(category, char.attributes)
      const categoryAttrs = Object.keys(char.attributes).filter(key => {
        const label = key
        return categoryInfo.attributeFilter(key, label)
      })
      totalAvailable += available.length + categoryAttrs.length
      totalFilled += categoryAttrs.length
    })

    const completionRate = totalAvailable > 0 ? (totalFilled / totalAvailable) * 100 : 0
    return { totalAvailable, totalFilled, completionRate }
  }

  const handleStartCategory = (category: AttributeCategory) => {
    setSelectedCategory(category)
    setShowDashboard(false)
    setEnhancements(new Map())
    setCurrentCharacterIndex(0)
  }

  if (showDashboard) {
    const allCategories: AttributeCategory[] = ['environment', 'abilities', 'equipment', 'physical', 'personality', 'origins', 'relationships']

    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button onClick={onBack} variant="outline" size="sm">
              <ArrowLeft size={20} />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <ChartLineUp size={32} weight="duotone" className="text-accent" />
                <h1 className="text-3xl font-bold text-foreground">Character Enrichment Hub</h1>
              </div>
              <p className="text-muted-foreground mt-1">
                Enhance all {characters.length} characters across different attribute categories
              </p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allCategories.map((category) => {
            const Icon = CATEGORY_ICONS[category]
            const colors = CATEGORY_COLORS[category]
            const info = getCategoryInfo(category)
            const stats = getCategoryStats(category)

            return (
              <Card key={category} className={`p-6 ${colors.bg} border-2 ${colors.border} hover:shadow-lg transition-all cursor-pointer group`}>
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Icon size={32} weight="duotone" className={colors.text} />
                      <div>
                        <h3 className="font-bold text-foreground">{info.name}</h3>
                        <p className="text-xs text-muted-foreground">{info.description}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Completion</span>
                      <span className={`font-semibold ${colors.text}`}>
                        {Math.round(stats.completionRate)}%
                      </span>
                    </div>
                    <Progress value={stats.completionRate} className="h-2" />
                    <div className="text-xs text-muted-foreground">
                      {stats.totalFilled} / {stats.totalAvailable} attributes filled
                    </div>
                  </div>

                  <Button
                    onClick={() => handleStartCategory(category)}
                    className={`w-full ${colors.bg} ${colors.border} ${colors.text} hover:opacity-80`}
                    variant="outline"
                  >
                    <Lightning size={16} className="mr-2" />
                    Enhance Category
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>

        <Card className="p-6 bg-card/30 border-primary/20">
          <h3 className="text-lg font-semibold text-foreground mb-4">Overall Progress</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-background/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-accent">{characters.length}</div>
              <div className="text-sm text-muted-foreground">Total Characters</div>
            </div>
            {allCategories.slice(0, 3).map((category) => {
              const info = getCategoryInfo(category)
              const stats = getCategoryStats(category)
              return (
                <div key={category} className="bg-background/50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-accent">{Math.round(stats.completionRate)}%</div>
                  <div className="text-sm text-muted-foreground">{info.name}</div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button onClick={() => setShowDashboard(true)} variant="outline" size="sm">
            <ArrowLeft size={20} />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <CategoryIcon size={32} weight="duotone" className="text-accent" />
              <h1 className="text-3xl font-bold text-foreground">{categoryInfo.name} Enhancement</h1>
            </div>
            <p className="text-muted-foreground mt-1">
              Add {categoryInfo.description} attributes to characters using AI suggestions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleGenerateAll}
            disabled={isGeneratingAll || enhancements.size === characters.length}
            variant="outline"
            className="flex items-center gap-2 bg-accent/10 hover:bg-accent/20 border-accent/30"
          >
            <Lightning size={20} />
            Generate All
          </Button>
          <Button
            onClick={() => setShowDashboard(true)}
            className="flex items-center gap-2 bg-accent hover:bg-accent/90"
          >
            <Check size={20} weight="bold" />
            Done ({totalEnhancements} added)
          </Button>
        </div>
      </div>

      {isGeneratingAll && (
        <Card className="p-6 bg-accent/5 border-accent/30">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                Generating {categoryInfo.name.toLowerCase()} recommendations for all characters...
              </span>
              <span className="text-sm text-muted-foreground">{Math.round(globalProgress)}%</span>
            </div>
            <Progress value={globalProgress} className="h-2" />
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-[300px,1fr] gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <Users size={20} className="text-accent" />
            <h3 className="font-semibold text-foreground">Characters</h3>
            <Badge variant="outline" className="ml-auto">
              {enhancements.size}/{characters.length}
            </Badge>
          </div>
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
            {characters.map((char, index) => {
              const status = getCharacterStatus(char.id)
              const enhancement = enhancements.get(char.id)
              const isActive = index === currentCharacterIndex

              return (
                <motion.div
                  key={char.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <button
                    onClick={() => handleSkipToCharacter(index)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isActive
                        ? 'bg-accent/10 border-accent/50 shadow-sm'
                        : 'bg-card/30 border-border/50 hover:bg-card/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-foreground truncate">
                          {char.name}
                        </div>
                        {enhancement && enhancement.acceptedCount > 0 && (
                          <div className="text-xs text-accent mt-1">
                            +{enhancement.acceptedCount} attributes
                          </div>
                        )}
                      </div>
                      <Badge className={`text-xs ${getStatusColor(status)}`}>
                        {status === 'loading' && 'Loading'}
                        {status === 'ready' && `${enhancement?.recommendations.length || 0}`}
                        {status === 'enhanced' && <Check size={14} weight="bold" />}
                        {status === 'complete' && <Check size={14} weight="bold" />}
                        {status === 'pending' && '...'}
                      </Badge>
                    </div>
                  </button>
                </motion.div>
              )
            })}
          </div>
        </div>

        <div className="space-y-6">
          {currentCharacter && (
            <>
              <Card className="p-6 bg-card/50 border-primary/20">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-2xl font-bold text-foreground">
                        {currentCharacter.name}
                      </h2>
                      <Badge className={getStatusColor(getCharacterStatus(currentCharacter.id))}>
                        {getCharacterStatus(currentCharacter.id)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        Character {currentCharacterIndex + 1} of {characters.length}
                      </span>
                      {currentEnhancement && currentEnhancement.acceptedCount > 0 && (
                        <span className="text-accent">
                          {currentEnhancement.acceptedCount} attributes added
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handlePrevious}
                      disabled={currentCharacterIndex === 0}
                      variant="outline"
                      size="sm"
                    >
                      Previous
                    </Button>
                    <Button
                      onClick={handleNext}
                      disabled={currentCharacterIndex === characters.length - 1}
                      variant="outline"
                      size="sm"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </Card>

              {currentEnhancement?.isLoading && (
                <Card className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Sparkle size={24} className="text-accent animate-pulse" />
                      <span className="text-sm font-medium text-foreground">
                        Analyzing {currentCharacter.name}'s {categoryInfo.description}...
                      </span>
                    </div>
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                </Card>
              )}

              {currentEnhancement &&
                !currentEnhancement.isLoading &&
                currentEnhancement.recommendations.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-foreground">
                        {categoryInfo.name} Recommendations ({currentEnhancement.recommendations.length})
                      </h3>
                      <Button
                        onClick={handleAcceptAll}
                        size="sm"
                        variant="outline"
                        className="bg-accent/10 hover:bg-accent/20 border-accent/30"
                      >
                        <Check size={16} className="mr-2" />
                        Accept All
                      </Button>
                    </div>

                    <AnimatePresence mode="popLayout">
                      {currentEnhancement.recommendations.map((rec, index) => (
                        <motion.div
                          key={rec.attribute}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -100 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <Card className="p-5 bg-card/50 hover:bg-card/70 transition-colors border-border/50">
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h4 className="font-semibold text-foreground">{rec.label}</h4>
                                    <Badge className={getPriorityColor(rec.priority)}>
                                      {rec.priority}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground leading-relaxed">
                                    {rec.reason}
                                  </p>
                                  <div className="mt-3 flex items-center gap-2">
                                    <Button
                                      onClick={() => handleAccept(rec, true)}
                                      size="sm"
                                      className="bg-accent/20 hover:bg-accent/30 text-accent border border-accent/40"
                                    >
                                      <Check size={16} className="mr-1" />
                                      Yes
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleAccept(rec, false)}
                                      className="border-border/50"
                                    >
                                      <X size={16} className="mr-1" />
                                      No
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleAccept(rec, null)}
                                      className="border-border/50"
                                    >
                                      Maybe
                                    </Button>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    onClick={() => handleAccept(rec, true)}
                                    size="sm"
                                    className="bg-accent hover:bg-accent/90"
                                  >
                                    <Check size={16} weight="bold" />
                                  </Button>
                                  <Button
                                    onClick={() => handleReject(rec)}
                                    size="sm"
                                    variant="outline"
                                    className="hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive"
                                  >
                                    <X size={16} weight="bold" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </Card>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}

              {currentEnhancement &&
                !currentEnhancement.isLoading &&
                currentEnhancement.recommendations.length === 0 && (
                  <Card className="p-12 text-center bg-card/30 border-dashed border-2">
                    <Check size={48} className="mx-auto mb-4 text-accent" weight="bold" />
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                      All Done with {currentCharacter.name}!
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      {currentEnhancement.acceptedCount > 0
                        ? `Added ${currentEnhancement.acceptedCount} ${categoryInfo.description} attributes`
                        : 'No more recommendations for this character'}
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      {currentCharacterIndex < characters.length - 1 && (
                        <Button onClick={handleNext} className="bg-accent hover:bg-accent/90">
                          Next Character
                        </Button>
                      )}
                      {currentCharacterIndex === characters.length - 1 && (
                        <Button onClick={() => setShowDashboard(true)} className="bg-accent hover:bg-accent/90">
                          Back to Dashboard
                        </Button>
                      )}
                    </div>
                  </Card>
                )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
