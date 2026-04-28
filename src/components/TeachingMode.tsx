import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { GraduationCap, Plus, ArrowRight, CheckCircle, ArrowLeft, SpinnerGap, House, Play, WarningCircle } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { Character, Answer, CharacterCategory, Question } from '@/lib/types'
import { CATEGORY_LABELS } from '@/lib/types'
import { llmWithMeta, LlmError } from '@/lib/llm'
import { attributeAutoFill_v1 } from '@/lib/prompts'
import { submitCharacter } from '@/lib/sync'
import { toast } from 'sonner'

interface TeachingModeProps {
  answers: Answer[]
  existingCharacters: Character[]
  onAddCharacter: (character: Character) => void
  onAddQuestions?: (questions: Question[]) => void
  onPlayAgain: () => void
  onGoHome: () => void
}

type TeachStep = 'name' | 'loading' | 'review' | 'success'

// Attribute groups for the review screen
const ATTRIBUTE_GROUPS: Record<string, string[]> = {
  Identity: ['isHuman', 'isAnimal', 'isRobot', 'isFictional', 'isAlive', 'isMale', 'isFemale'],
  Abilities: ['canFly', 'canTeleport', 'hasSuperpowers', 'hasMagicPowers', 'canShapeshift', 'canTimeTravel', 'hasSuperStrength', 'hasSuperSpeed', 'canBecomeInvisible', 'hasTelekinesis', 'canControlElements', 'canBreatheFire', 'canRegenerateOrHeal'],
  Physical: ['wearsHat', 'wearsCape', 'wearsMask', 'wearsGlasses', 'hasTail', 'hasWings', 'isSmall', 'isLarge', 'hasUnusualSkinColor'],
  Character: ['isVillain', 'isHero', 'isAntiHero', 'isLeader', 'isRoyalty', 'isScientist', 'isFunny', 'isSmart', 'isMentorFigure', 'isDarkOrBrooding', 'isChildOrYoung', 'hasRomanticStoryline', 'hasTragicBackstory', 'isMysterious'],
  Social: ['hasFamily', 'hasSidekick', 'hasRival', 'isPartOfTeam', 'canTalk'],
  Origins: ['fromSpace', 'fromVideoGame', 'fromMovie', 'fromBook', 'fromAnime', 'fromComics', 'fromCartoon', 'fromHistory', 'fromMythology', 'liveUnderwater', 'livesInForest', 'livesInCity'],
  Traits: ['usesWeapons', 'usesTechnology', 'transformsOrEvolves', 'hasSecretIdentity', 'hasSymbioticRelationship'],
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '')
}

function getAttributeLabel(attr: string): string {
  // Convert camelCase to Title Case with spaces
  return attr
    .replaceAll(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim()
}

function getAttributeColorClass(value: boolean | null | undefined): string {
  if (value === true) return 'bg-green-500/10 border-green-500/30 text-green-400'
  if (value === false) return 'bg-red-500/10 border-red-500/30 text-red-400'
  if (value === null) return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
  return 'bg-card border-border text-muted-foreground hover:border-accent/30'
}

function getAttributeSymbol(value: boolean | null | undefined): string {
  if (value === true) return '✓'
  if (value === false) return '✗'
  if (value === null) return '?'
  return '·'
}

export function TeachingMode({ answers, existingCharacters, onAddCharacter: _onAddCharacter, onAddQuestions: _onAddQuestions, onPlayAgain, onGoHome }: Readonly<TeachingModeProps>) {
  const [step, setStep] = useState<TeachStep>('name')
  const [characterName, setCharacterName] = useState('')
  const [category, setCategory] = useState<CharacterCategory>('movies')
  const [attributes, setAttributes] = useState<Record<string, boolean | null>>({})
  const [error, setError] = useState<string | null>(null)
  const [llmFilled, setLlmFilled] = useState(false)

  // Build initial attributes from gameplay answers
  // answer.questionId already stores the attribute name (e.g. "fromVideoGame")
  const gameplayAttributes = useMemo(() => {
    const attrs: Record<string, boolean | null> = {}
    for (const answer of answers) {
      if (answer.value === 'yes') attrs[answer.questionId] = true
      else if (answer.value === 'no') attrs[answer.questionId] = false
      else if (answer.value === 'maybe') attrs[answer.questionId] = null
      // 'unknown' → omitted (let LLM fill later)
    }
    return attrs
  }, [answers])

  const validateName = (name: string): string | null => {
    const trimmed = name.trim()
    if (!trimmed) return 'Please enter a character name.'
    if (trimmed.length < 2) return 'Name must be at least 2 characters.'
    const slug = slugify(trimmed)
    const duplicate = existingCharacters.find(
      (c) => slugify(c.name) === slug || c.name.toLowerCase() === trimmed.toLowerCase()
    )
    if (duplicate) return `I already know "${duplicate.name}"! Try a different character.`
    return null
  }

  const handleNameSubmit = async () => {
    const validationError = validateName(characterName)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setStep('loading')

    const allAttributes = Object.values(ATTRIBUTE_GROUPS).flat()
    const missingAttributes = allAttributes.filter(attr => !(attr in gameplayAttributes))

    try {
      const { system, user } = attributeAutoFill_v1(characterName.trim(), category, gameplayAttributes, missingAttributes)
      const result = await llmWithMeta({ prompt: user, model: 'gpt-4o-mini', jsonMode: true, systemPrompt: system })
      const parsed = JSON.parse(result.content) as { attributes: Record<string, boolean | null> }
      const llmAttributes = parsed.attributes ?? {}

      // Merge: gameplay answers ALWAYS override LLM
      const merged: Record<string, boolean | null> = {}
      for (const attr of allAttributes) {
        if (attr in gameplayAttributes) {
          merged[attr] = gameplayAttributes[attr]
        } else if (attr in llmAttributes) {
          merged[attr] = llmAttributes[attr]
        }
      }
      setAttributes(merged)
      setLlmFilled(true)
    } catch (e) {
      console.warn('LLM auto-fill failed:', e)
      setAttributes({ ...gameplayAttributes })
      setLlmFilled(false)
      const msg = e instanceof LlmError ? e.message : 'AI auto-fill unavailable'
      toast(msg, { description: 'You can set attributes manually below' })
    }

    setStep('review')
  }

  const toggleAttribute = (attr: string) => {
    setAttributes(prev => {
      const current = prev[attr]
      // Cycle: true → false → null → true
      let next: boolean | null = true
      if (current === true) next = false
      else if (current === false) next = null
      return { ...prev, [attr]: next }
    })
  }

  const handleSubmit = () => {
    const newCharacter: Character = {
      id: `char-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: characterName.trim(),
      category,
      attributes,
      isCustom: true,
      createdAt: Date.now(),
    }

    // Submit to server (D1 database)
    setStep('success')

    submitCharacter({
      name: newCharacter.name,
      category: newCharacter.category,
      attributes: newCharacter.attributes,
      isCustom: true,
    }).then((result) => {
      if (result.success) {
        toast.success(`${newCharacter.name} added to the server database!`)
      } else {
        toast.error(result.error || 'Failed to save to server — try again later')
      }
    }).catch(() => {
      toast.error('Network error — character was not saved to the server')
    })
  }

  const filledCount = Object.values(attributes).filter(v => v !== undefined && v !== null).length
  const totalCount = Object.values(ATTRIBUTE_GROUPS).flat().length

  return (
    <AnimatePresence mode="wait">
      {step === 'name' && (
        <motion.div
          key="name"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-8 bg-linear-to-br from-card/80 to-primary/5 backdrop-blur-sm border-2 border-primary/30 shadow-xl">
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-border/50">
                <GraduationCap size={40} weight="fill" className="text-accent" />
                <div>
                  <h2 className="text-3xl font-bold text-foreground">Teach Me</h2>
                  <p className="text-muted-foreground">Help me learn a new character</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-3">
                  <Label htmlFor="character-name" className="text-base font-semibold">
                    Who were you thinking of?
                  </Label>
                  <Input
                    id="character-name"
                    placeholder="Enter character name..."
                    value={characterName}
                    onChange={(e) => { setCharacterName(e.target.value); setError(null) }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && characterName.trim()) handleNameSubmit() }}
                    className={`h-12 text-lg ${error ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                  />
                  {error && <p className="text-sm text-red-500">{error}</p>}
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-semibold">Category</Label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.entries(CATEGORY_LABELS) as [CharacterCategory, string][]).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setCategory(key)}
                        className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                          category === key
                            ? 'bg-accent text-accent-foreground border-accent'
                            : 'bg-card border-border hover:bg-accent/10'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {answers.length > 0 && (
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold text-accent">{answers.length}</span> attributes from your gameplay will be pre-filled
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleNameSubmit}
                  disabled={!characterName.trim()}
                  size="lg"
                  className="flex-1 h-12 text-base bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20"
                >
                  <ArrowRight size={20} weight="bold" className="mr-2" />
                  Continue
                </Button>
                <Button
                  onClick={onGoHome}
                  variant="outline"
                  size="lg"
                  className="h-12 px-6"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {step === 'loading' && (
        <motion.div
          key="loading"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-5 sm:p-8 bg-linear-to-br from-card/80 to-primary/5 backdrop-blur-sm border-2 border-primary/30 shadow-xl">
            <div className="space-y-6 text-center py-8">
              <SpinnerGap size={64} className="mx-auto text-accent animate-spin" />
              <div>
                <h2 className="text-2xl font-bold text-foreground">Analyzing {characterName}...</h2>
                <p className="text-muted-foreground mt-2">Learning about this character's attributes</p>
              </div>
              <Progress value={50} className="max-w-xs mx-auto" />
            </div>
          </Card>
        </motion.div>
      )}

      {step === 'review' && (
        <motion.div
          key="review"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-6 md:p-8 bg-linear-to-br from-card/80 to-primary/5 backdrop-blur-sm border-2 border-primary/30 shadow-xl">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <button onClick={() => setStep('name')} className="text-muted-foreground hover:text-foreground" aria-label="Back to name step">
                    <ArrowLeft size={24} />
                  </button>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">Review: {characterName}</h2>
                    <p className="text-sm text-muted-foreground">{CATEGORY_LABELS[category]} · {filledCount} of {totalCount} attributes set</p>
                  </div>
                </div>
              </div>

              {!llmFilled && (
                <div className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-800 dark:text-yellow-200">
                  <WarningCircle size={20} className="mt-0.5 shrink-0 text-yellow-400" weight="fill" />
                  <span>AI auto-fill wasn't available — all attributes need to be set manually. Tap each one to cycle through <strong>Yes / No / Unknown</strong>.</span>
                </div>
              )}

              <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                {Object.entries(ATTRIBUTE_GROUPS).map(([group, attrs]) => (
                  <div key={group}>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{group}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {attrs.map((attr) => {
                        const value = attributes[attr]
                        const isFromGame = attr in gameplayAttributes
                        return (
                          <button
                            key={attr}
                            onClick={() => toggleAttribute(attr)}
                            className={`flex items-center gap-2 px-3 py-3 rounded-lg border text-sm transition-colors text-left ${getAttributeColorClass(value)}`}
                          >
                            <span className="flex-1 truncate">{getAttributeLabel(attr)}</span>
                            {isFromGame && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 border-accent/50 text-accent">
                                game
                              </Badge>
                            )}
                            {!isFromGame && llmFilled && value !== undefined && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 border-blue-500/50 text-blue-400">
                                AI
                              </Badge>
                            )}
                            <span className="text-xs font-mono w-4 text-right">
                              {getAttributeSymbol(value)}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-4 border-t border-border/50">
                <Button
                  onClick={handleSubmit}
                  size="lg"
                  className="flex-1 h-12 text-base bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20"
                >
                  <Plus size={20} weight="bold" className="mr-2" />
                  Teach This Character
                </Button>
                <Button
                  onClick={() => setStep('name')}
                  variant="outline"
                  size="lg"
                  className="h-12 px-6"
                >
                  <ArrowLeft size={20} className="mr-2" />
                  Back
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {step === 'success' && (
        <motion.div
          key="success"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-5 sm:p-8 bg-linear-to-br from-accent/20 to-primary/10 backdrop-blur-sm border-2 border-accent shadow-2xl">
            <div className="space-y-6 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                <CheckCircle size={80} weight="fill" className="mx-auto text-accent" />
              </motion.div>
              <div>
                <h2 className="text-4xl font-bold text-foreground mb-2">Thanks for Teaching Me!</h2>
                <p className="text-xl text-muted-foreground">
                  I've learned about <span className="text-accent font-semibold">{characterName}</span>
                </p>
              </div>
              <p className="text-foreground/80">
                Next time someone thinks of this character, I'll know the answer!
              </p>
              <div className="flex gap-3 justify-center pt-4">
                <Button
                  onClick={onPlayAgain}
                  size="lg"
                  className="h-14 px-8 text-lg bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20"
                >
                  <Play size={24} weight="fill" className="mr-2" />
                  Play Again
                </Button>
                <Button
                  onClick={onGoHome}
                  variant="outline"
                  size="lg"
                  className="h-14 px-8 text-lg"
                >
                  <House size={24} className="mr-2" />
                  Home
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
