import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  ArrowLeft,
  Sparkle,
  UserFocus,
  Lightning,
  Heart,
  MapPin,
  Users as UsersIcon,
  Check,
  X,
  Brain,
  Star,
  TrendUp,
  Lightbulb,
  TreeStructure,
  Sword,
} from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import type { Character } from '@/lib/types'
import {
  generateCategoryRecommendations,
  type AttributeRecommendation,
} from '@/lib/categoryRecommender'

interface CategoryRecommenderProps {
  character: Character
  onUpdateCharacter: (updatedCharacter: Character) => void
  onBack: () => void
}

type CategoryKey = 'physical' | 'abilities' | 'personality' | 'origins' | 'relationships' | 'environment' | 'equipment'

interface CategoryInfo {
  key: CategoryKey
  label: string
  icon: React.ElementType
  description: string
  color: string
}

const CATEGORIES: CategoryInfo[] = [
  {
    key: 'physical',
    label: 'Physical Traits',
    icon: UserFocus,
    description: 'Appearance, clothing, and physical characteristics',
    color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/40',
  },
  {
    key: 'abilities',
    label: 'Powers & Abilities',
    icon: Lightning,
    description: 'Special powers, skills, and what they can do',
    color: 'from-amber-500/20 to-yellow-500/20 border-amber-500/40',
  },
  {
    key: 'personality',
    label: 'Personality & Alignment',
    icon: Heart,
    description: 'Character traits, morality, and behavior',
    color: 'from-pink-500/20 to-rose-500/20 border-pink-500/40',
  },
  {
    key: 'origins',
    label: 'Origins & Background',
    icon: MapPin,
    description: 'Where they come from and their history',
    color: 'from-purple-500/20 to-violet-500/20 border-purple-500/40',
  },
  {
    key: 'relationships',
    label: 'Relationships',
    icon: UsersIcon,
    description: 'Companions, family, and social connections',
    color: 'from-green-500/20 to-emerald-500/20 border-green-500/40',
  },
  {
    key: 'environment',
    label: 'Environment & Habitat',
    icon: TreeStructure,
    description: 'Where they live, operate, or spend time',
    color: 'from-teal-500/20 to-cyan-500/20 border-teal-500/40',
  },
  {
    key: 'equipment',
    label: 'Equipment & Tools',
    icon: Sword,
    description: 'Weapons, vehicles, gadgets, and tools they use',
    color: 'from-orange-500/20 to-red-500/20 border-orange-500/40',
  },
]

export function CategoryRecommender({
  character,
  onUpdateCharacter,
  onBack,
}: CategoryRecommenderProps) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null)
  const [recommendations, setRecommendations] = useState<AttributeRecommendation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [localAttributes, setLocalAttributes] = useState(character.attributes)
  const [appliedAttributes, setAppliedAttributes] = useState<Set<string>>(new Set())

  const handleCategorySelect = async (categoryKey: CategoryKey) => {
    setSelectedCategory(categoryKey)
    setIsLoading(true)

    try {
      const recs = await generateCategoryRecommendations(
        character.name,
        localAttributes,
        categoryKey
      )
      setRecommendations(recs)
      toast.success(`Generated ${recs.length} ${categoryKey} recommendations`)
    } catch (error) {
      console.error('Failed to generate recommendations:', error)
      toast.error('Failed to generate recommendations')
      setRecommendations([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleApplyAttribute = (rec: AttributeRecommendation, value: boolean | null) => {
    const newAttributes = {
      ...localAttributes,
      [rec.attribute]: value,
    }
    setLocalAttributes(newAttributes)
    setAppliedAttributes((prev) => new Set([...prev, rec.attribute]))
    toast.success(`Applied: ${rec.label}`)
  }

  const handleSaveChanges = () => {
    onUpdateCharacter({
      ...character,
      attributes: localAttributes,
    })
    onBack()
  }

  const handleBackToCategories = () => {
    setSelectedCategory(null)
    setRecommendations([])
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
  const changesCount = appliedAttributes.size

  if (!selectedCategory) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Button onClick={onBack} variant="outline" size="sm">
                <ArrowLeft size={18} />
              </Button>
              <h2 className="text-3xl font-bold text-foreground">
                Enhance {character.name}
              </h2>
            </div>
            <p className="text-muted-foreground ml-14">
              Select a category to get AI-powered attribute recommendations
            </p>
          </div>
        </div>

        <Card className="bg-card/50 backdrop-blur-sm border-accent/20 p-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0 p-3 bg-accent/20 rounded-lg">
              <Brain size={32} className="text-accent" weight="duotone" />
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="text-xl font-semibold text-foreground">
                Category-Focused Recommendations
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Get targeted AI recommendations for specific aspects of {character.name}. 
                Each category focuses on a different dimension of the character, making it 
                easy to build a comprehensive and accurate profile.
              </p>
              <div className="flex items-center gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold text-accent">{attributeCount}</div>
                  <div className="text-sm text-muted-foreground">Current Attributes</div>
                </div>
                {changesCount > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold text-primary">{changesCount}</div>
                    <div className="text-sm text-muted-foreground">Changes Made</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATEGORIES.map((category) => {
            const Icon = category.icon
            return (
              <motion.div
                key={category.key}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card
                  className={`bg-linear-to-br ${category.color} p-5 cursor-pointer hover:shadow-lg transition-all group h-full`}
                  onClick={() => handleCategorySelect(category.key)}
                >
                  <div className="flex flex-col gap-3 h-full">
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 p-2.5 bg-background/50 rounded-lg group-hover:bg-background/70 transition-colors">
                        <Icon size={24} weight="duotone" className="text-foreground" />
                      </div>
                      <h3 className="text-base font-semibold text-foreground">
                        {category.label}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                      {category.description}
                    </p>
                    <div className="pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-foreground hover:text-accent -ml-2 text-xs"
                      >
                        Generate →
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>

        {changesCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between bg-accent/10 border border-accent/30 rounded-lg p-4"
          >
            <div className="flex items-center gap-3">
              <Star size={24} className="text-accent" weight="fill" />
              <div>
                <div className="font-semibold text-foreground">
                  {changesCount} attribute{changesCount !== 1 ? 's' : ''} modified
                </div>
                <div className="text-sm text-muted-foreground">
                  Save your changes to update {character.name}
                </div>
              </div>
            </div>
            <Button onClick={handleSaveChanges} className="bg-accent hover:bg-accent/90">
              Save Changes
            </Button>
          </motion.div>
        )}
      </div>
    )
  }

  const categoryInfo = CATEGORIES.find((c) => c.key === selectedCategory)!
  const Icon = categoryInfo.icon

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Button onClick={handleBackToCategories} variant="outline" size="sm">
              <ArrowLeft size={18} />
            </Button>
            <div className="flex items-center gap-3">
              <div className={`p-2 bg-linear-to-br ${categoryInfo.color} rounded-lg`}>
                <Icon size={24} weight="duotone" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  {categoryInfo.label}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {categoryInfo.description}
                </p>
              </div>
            </div>
          </div>
        </div>
        {changesCount > 0 && (
          <Button onClick={handleSaveChanges} className="bg-accent hover:bg-accent/90">
            <Check size={18} className="mr-2" />
            Save {changesCount} Change{changesCount !== 1 ? 's' : ''}
          </Button>
        )}
      </div>

      {isLoading ? (
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 p-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <Sparkle size={48} className="text-accent" weight="duotone" />
            </motion.div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-semibold text-foreground">
                Analyzing {character.name}...
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Generating AI-powered {categoryInfo.label.toLowerCase()} recommendations
              </p>
            </div>
            <Progress value={undefined} className="w-64 h-2" />
          </div>
        </Card>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {recommendations.length === 0 ? (
              <Card className="bg-card/50 backdrop-blur-sm border-border/50 p-12 text-center">
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <div className="p-4 bg-muted rounded-full">
                      <Icon size={48} className="text-muted-foreground" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">
                    All Set!
                  </h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    No new {categoryInfo.label.toLowerCase()} recommendations available. 
                    {character.name} already has comprehensive coverage in this category.
                  </p>
                  <Button onClick={handleBackToCategories} variant="outline" className="mt-4">
                    Try Another Category
                  </Button>
                </div>
              </Card>
            ) : (
              <>
                <div className="text-sm text-muted-foreground">
                  {recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''} found
                </div>

                <div className="grid gap-4">
                  {recommendations.map((rec, index) => (
                    <motion.div
                      key={rec.attribute}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="bg-card/50 backdrop-blur-sm border-border/50 p-4 hover:border-accent/30 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold text-foreground">
                                    {rec.label}
                                  </h4>
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${getPriorityColor(rec.priority)}`}
                                  >
                                    <span className="mr-1">{getPriorityIcon(rec.priority)}</span>
                                    {rec.priority}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                  {rec.reason}
                                </p>
                              </div>
                            </div>

                            {appliedAttributes.has(rec.attribute) ? (
                              <div className="flex items-center gap-2 text-accent text-sm">
                                <Check size={16} weight="bold" />
                                <span>Applied</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleApplyAttribute(rec, true)}
                                  className="bg-accent/20 hover:bg-accent/30 text-accent border border-accent/40"
                                >
                                  <Check size={16} className="mr-1" />
                                  Yes
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleApplyAttribute(rec, false)}
                                  className="border-border/50"
                                >
                                  <X size={16} className="mr-1" />
                                  No
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleApplyAttribute(rec, null)}
                                  className="border-border/50"
                                >
                                  Maybe
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}
