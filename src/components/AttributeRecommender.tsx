import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lightbulb,
  Check,
  X,
  Sparkle,
  ArrowLeft,
  Robot,
  Brain,
  TrendUp,
} from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { Character } from '@/lib/types'
import {
  getAttributeRecommendations,
  generateAttributeRecommendationsWithAI,
  detectCharacterType,
  type AttributeRecommendation,
} from '@/lib/attributeRecommender'

interface AttributeRecommenderProps {
  character: Character
  onUpdateCharacter: (updatedCharacter: Character) => void
  onBack: () => void
}

export function AttributeRecommender({
  character,
  onUpdateCharacter,
  onBack,
}: AttributeRecommenderProps) {
  const [ruleBasedRecs, setRuleBasedRecs] = useState<AttributeRecommendation[]>([])
  const [aiRecs, setAiRecs] = useState<AttributeRecommendation[]>([])
  const [isLoadingAI, setIsLoadingAI] = useState(false)
  const [appliedAttributes, setAppliedAttributes] = useState<Set<string>>(new Set())
  const [localAttributes, setLocalAttributes] = useState(character.attributes)
  const [activeTab, setActiveTab] = useState<'rule-based' | 'ai'>('rule-based')

  const detectedType = detectCharacterType(character.name)

  useEffect(() => {
    const recs = getAttributeRecommendations(character.name, character.attributes)
    setRuleBasedRecs(recs)
  }, [character.name, character.attributes])

  const handleGenerateAIRecommendations = async () => {
    setIsLoadingAI(true)
    try {
      const recs = await generateAttributeRecommendationsWithAI(
        character.name,
        localAttributes
      )
      setAiRecs(recs)
      setActiveTab('ai')
    } catch (error) {
      console.error('Failed to generate AI recommendations:', error)
    } finally {
      setIsLoadingAI(false)
    }
  }

  const handleApplyAttribute = (rec: AttributeRecommendation, value: boolean | null) => {
    const newAttributes = {
      ...localAttributes,
      [rec.attribute]: value,
    }
    setLocalAttributes(newAttributes)
    setAppliedAttributes((prev) => new Set([...prev, rec.attribute]))

    const updatedRecs = getAttributeRecommendations(character.name, newAttributes)
    setRuleBasedRecs(updatedRecs)
  }

  const handleSaveChanges = () => {
    onUpdateCharacter({
      ...character,
      attributes: localAttributes,
    })
    onBack()
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-accent/20 text-accent border-accent/40'
      case 'medium':
        return 'bg-primary/20 text-primary border-primary/40'
      case 'low':
        return 'bg-muted text-muted-foreground border-border'
      default:
        return 'bg-muted text-muted-foreground border-border'
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <TrendUp size={14} weight="bold" />
      case 'medium':
        return <Lightbulb size={14} weight="fill" />
      default:
        return <Lightbulb size={14} />
    }
  }

  const attributeCount = Object.keys(localAttributes).length
  const appliedCount = appliedAttributes.size

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button onClick={onBack} variant="outline" size="sm">
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              Attribute Recommendations
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Character: <span className="text-foreground font-semibold">{character.name}</span>
              {detectedType && (
                <span className="ml-2 text-accent">
                  • Detected as {detectedType.type}
                </span>
              )}
            </p>
          </div>
        </div>
        {appliedCount > 0 && (
          <Button
            onClick={handleSaveChanges}
            size="lg"
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            <Check size={20} weight="bold" className="mr-2" />
            Save {appliedCount} Change{appliedCount !== 1 ? 's' : ''}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 bg-card/50 backdrop-blur-sm border-border/50">
          <div className="text-3xl font-bold text-accent">{attributeCount}</div>
          <div className="text-sm text-muted-foreground">Total Attributes</div>
        </Card>
        <Card className="p-6 bg-card/50 backdrop-blur-sm border-border/50">
          <div className="text-3xl font-bold text-primary">{ruleBasedRecs.length}</div>
          <div className="text-sm text-muted-foreground">Rule-Based Suggestions</div>
        </Card>
        <Card className="p-6 bg-card/50 backdrop-blur-sm border-border/50">
          <div className="text-3xl font-bold text-accent">{appliedCount}</div>
          <div className="text-sm text-muted-foreground">Applied This Session</div>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'rule-based' | 'ai')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="rule-based" className="flex items-center gap-2">
            <Brain size={18} />
            Rule-Based ({ruleBasedRecs.length})
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Robot size={18} />
            AI-Powered ({aiRecs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rule-based" className="space-y-4 mt-6">
          {detectedType && (
            <Card className="p-6 bg-gradient-to-br from-accent/10 to-primary/10 backdrop-blur-sm border-2 border-accent/30">
              <div className="flex items-start gap-4">
                <Sparkle size={32} weight="fill" className="text-accent flex-shrink-0" />
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Character Type Detected: {detectedType.type}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Based on the character name, we've categorized this as a{' '}
                    <span className="text-accent font-semibold">{detectedType.type}</span>{' '}
                    character. The recommendations below are tailored to this type.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {ruleBasedRecs.length === 0 ? (
            <Card className="p-12 text-center bg-card/50 backdrop-blur-sm border-border/50">
              <Check size={64} weight="bold" className="mx-auto text-accent mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                All Set!
              </h3>
              <p className="text-muted-foreground">
                No additional recommendations at this time. The character has comprehensive
                attribute coverage.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {ruleBasedRecs.map((rec, index) => (
                <RecommendationCard
                  key={rec.attribute}
                  rec={rec}
                  index={index}
                  isApplied={appliedAttributes.has(rec.attribute)}
                  onApply={handleApplyAttribute}
                  getPriorityColor={getPriorityColor}
                  getPriorityIcon={getPriorityIcon}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ai" className="space-y-4 mt-6">
          {aiRecs.length === 0 ? (
            <Card className="p-12 text-center bg-card/50 backdrop-blur-sm border-border/50">
              <Robot size={64} weight="fill" className="mx-auto text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                AI-Powered Recommendations
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Get intelligent attribute suggestions powered by AI. The system will analyze{' '}
                <span className="font-semibold text-foreground">{character.name}</span> and
                recommend the most relevant attributes.
              </p>
              <Button
                onClick={handleGenerateAIRecommendations}
                disabled={isLoadingAI}
                size="lg"
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {isLoadingAI ? (
                  <>
                    <div className="animate-spin mr-2">
                      <Sparkle size={20} />
                    </div>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkle size={20} weight="fill" className="mr-2" />
                    Generate AI Recommendations
                  </>
                )}
              </Button>
              {isLoadingAI && (
                <div className="mt-6">
                  <Progress value={undefined} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-2">
                    AI is analyzing character traits...
                  </p>
                </div>
              )}
            </Card>
          ) : (
            <div className="space-y-3">
              {aiRecs.map((rec, index) => (
                <RecommendationCard
                  key={rec.attribute}
                  rec={rec}
                  index={index}
                  isApplied={appliedAttributes.has(rec.attribute)}
                  onApply={handleApplyAttribute}
                  getPriorityColor={getPriorityColor}
                  getPriorityIcon={getPriorityIcon}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface RecommendationCardProps {
  rec: AttributeRecommendation
  index: number
  isApplied: boolean
  onApply: (rec: AttributeRecommendation, value: boolean | null) => void
  getPriorityColor: (priority: string) => string
  getPriorityIcon: (priority: string) => React.ReactElement
}

function RecommendationCard({
  rec,
  index,
  isApplied,
  onApply,
  getPriorityColor,
  getPriorityIcon,
}: RecommendationCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card
        className={`p-4 transition-all ${
          isApplied
            ? 'bg-accent/10 border-accent/50'
            : 'bg-card/50 backdrop-blur-sm border-border/50 hover:border-accent/30'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-semibold text-foreground">{rec.label}</h3>
              <Badge
                variant="outline"
                className={`text-xs flex items-center gap-1 ${getPriorityColor(rec.priority)}`}
              >
                {getPriorityIcon(rec.priority)}
                {rec.priority}
              </Badge>
              {isApplied && (
                <Badge variant="outline" className="text-xs bg-accent/20 text-accent border-accent/40">
                  <Check size={12} weight="bold" className="mr-1" />
                  Applied
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{rec.reason}</p>
            <div className="text-xs text-muted-foreground font-mono">
              Attribute: {rec.attribute}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => onApply(rec, true)}
              disabled={isApplied}
              size="sm"
              variant="outline"
              className="bg-accent/10 hover:bg-accent/20 border-accent/30 text-accent"
            >
              <Check size={16} weight="bold" className="mr-1" />
              Yes
            </Button>
            <Button
              onClick={() => onApply(rec, false)}
              disabled={isApplied}
              size="sm"
              variant="outline"
              className="hover:bg-muted"
            >
              <X size={16} weight="bold" className="mr-1" />
              No
            </Button>
            <Button
              onClick={() => onApply(rec, null)}
              disabled={isApplied}
              size="sm"
              variant="outline"
              className="hover:bg-muted text-xs"
            >
              Maybe
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
