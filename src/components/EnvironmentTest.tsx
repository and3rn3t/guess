import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, TreeStructure, Sparkle, Check, X } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import type { Character } from '@/lib/types'
import {
  generateCategoryRecommendations,
  type AttributeRecommendation,
} from '@/lib/categoryRecommender'

interface EnvironmentTestProps {
  character: Character
  onUpdateCharacter: (updatedCharacter: Character) => void
  onBack: () => void
}

export function EnvironmentTest({
  character,
  onUpdateCharacter,
  onBack,
}: EnvironmentTestProps) {
  const [recommendations, setRecommendations] = useState<AttributeRecommendation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [acceptedCount, setAcceptedCount] = useState(0)

  useEffect(() => {
    loadRecommendations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character])

  const loadRecommendations = async () => {
    setIsLoading(true)
    try {
      const recs = await generateCategoryRecommendations(
        character.name,
        character.attributes,
        'environment'
      )
      setRecommendations(recs)
      toast.success(`Generated ${recs.length} environment recommendations!`)
    } catch (error) {
      toast.error('Failed to generate recommendations')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAccept = (rec: AttributeRecommendation, value: boolean | null) => {
    const updatedCharacter = {
      ...character,
      attributes: {
        ...character.attributes,
        [rec.attribute]: value,
      },
    }
    onUpdateCharacter(updatedCharacter)
    setAcceptedCount((prev) => prev + 1)
    toast.success(`Added: ${rec.label}`)
  }

  const handleReject = (rec: AttributeRecommendation) => {
    setRecommendations((prev) => prev.filter((r) => r.attribute !== rec.attribute))
    toast.info(`Rejected: ${rec.label}`)
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

  const existingEnvironmentAttrs = Object.entries(character.attributes)
    .filter(([key]) => {
      const label = key.toLowerCase()
      return (
        key.startsWith('livesIn') ||
        label.includes('city') ||
        label.includes('space') ||
        label.includes('underwater') ||
        label.includes('forest') ||
        label.includes('mountain') ||
        label.includes('desert') ||
        label.includes('castle')
      )
    })
    .filter(([, value]) => value !== null)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button
            onClick={onBack}
            variant="ghost"
            size="sm"
            className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <TreeStructure size={40} weight="fill" className="text-teal-400" />
            <div>
              <h2 className="text-3xl font-bold text-foreground">
                Environment & Habitat Test
              </h2>
              <p className="text-muted-foreground mt-1">
                Testing environment recommendations for {character.name}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-card/50 backdrop-blur-sm border-teal-500/30 p-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-teal-400">{recommendations.length}</div>
            <div className="text-sm text-muted-foreground">Recommendations</div>
          </div>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-green-500/30 p-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-400">{acceptedCount}</div>
            <div className="text-sm text-muted-foreground">Accepted</div>
          </div>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-blue-500/30 p-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-400">
              {existingEnvironmentAttrs.length}
            </div>
            <div className="text-sm text-muted-foreground">Existing Attributes</div>
          </div>
        </Card>
      </div>

      {existingEnvironmentAttrs.length > 0 && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 p-6">
          <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <TreeStructure size={24} className="text-teal-400" />
            Current Environment Attributes
          </h3>
          <div className="flex flex-wrap gap-2">
            {existingEnvironmentAttrs.map(([key, value]) => (
              <Badge
                key={key}
                variant="outline"
                className={
                  value
                    ? 'bg-green-500/20 border-green-500/30 text-green-400'
                    : 'bg-red-500/20 border-red-500/30 text-red-400'
                }
              >
                {key.replace(/([A-Z])/g, ' $1').trim()}: {value ? 'Yes' : 'No'}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-foreground">
            AI-Generated Recommendations
          </h3>
          {!isLoading && recommendations.length > 0 && (
            <Button onClick={loadRecommendations} variant="outline" size="sm">
              <Sparkle size={16} className="mr-2" />
              Regenerate
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="p-6">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : recommendations.length === 0 ? (
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 p-12 text-center">
            <TreeStructure size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              All environment recommendations have been processed!
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec, idx) => (
              <motion.div
                key={rec.attribute}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="bg-card/50 backdrop-blur-sm border-teal-500/20 hover:border-teal-500/40 transition-colors p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center">
                        <TreeStructure size={20} weight="fill" className="text-teal-400" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-lg font-semibold text-foreground">
                          {rec.label}
                        </h4>
                        <Badge
                          variant="outline"
                          className={getPriorityColor(rec.priority)}
                        >
                          {rec.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{rec.reason}</p>

                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleAccept(rec, true)}
                          size="sm"
                          className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30"
                        >
                          <Check size={16} weight="bold" className="mr-2" />
                          Yes
                        </Button>
                        <Button
                          onClick={() => handleAccept(rec, false)}
                          size="sm"
                          className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
                        >
                          <X size={16} weight="bold" className="mr-2" />
                          No
                        </Button>
                        <Button
                          onClick={() => handleAccept(rec, null)}
                          size="sm"
                          variant="outline"
                        >
                          Unknown
                        </Button>
                        <Button
                          onClick={() => handleReject(rec)}
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground"
                        >
                          Skip
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {!isLoading && recommendations.length === 0 && acceptedCount > 0 && (
        <Card className="bg-gradient-to-br from-teal-500/20 to-green-500/20 border-teal-500/40 p-8 text-center">
          <Sparkle size={48} weight="fill" className="mx-auto text-teal-400 mb-4" />
          <h3 className="text-2xl font-bold text-foreground mb-2">
            Environment Testing Complete!
          </h3>
          <p className="text-muted-foreground mb-4">
            You've successfully added {acceptedCount} environment attributes to {character.name}
          </p>
          <Button onClick={onBack} size="lg" className="bg-accent hover:bg-accent/90">
            Return to Game
          </Button>
        </Card>
      )}
    </div>
  )
}
