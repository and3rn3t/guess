import { useState } from 'react'
import { motion } from 'framer-motion'
import { GraduationCap, Plus, ArrowRight, CheckCircle } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { Character, Answer } from '@/lib/types'

interface TeachingModeProps {
  answers: Answer[]
  onAddCharacter: (character: Character) => void
  onSkip: () => void
}

export function TeachingMode({ answers, onAddCharacter, onSkip }: TeachingModeProps) {
  const [characterName, setCharacterName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const handleSubmit = async () => {
    if (!characterName.trim()) return

    setIsSubmitting(true)

    const attributes: Record<string, boolean | null> = {}
    answers.forEach((answer) => {
      if (answer.value === 'yes') {
        attributes[answer.questionId] = true
      } else if (answer.value === 'no') {
        attributes[answer.questionId] = false
      } else {
        attributes[answer.questionId] = null
      }
    })

    const newCharacter: Character = {
      id: `char-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: characterName.trim(),
      attributes,
    }

    setTimeout(() => {
      onAddCharacter(newCharacter)
      setShowSuccess(true)
      setTimeout(() => {
        setIsSubmitting(false)
      }, 1500)
    }, 500)
  }

  const getAnswerBadgeVariant = (value: string) => {
    switch (value) {
      case 'yes':
        return 'default'
      case 'no':
        return 'secondary'
      case 'maybe':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const getAttributeLabel = (questionId: string): string => {
    const labels: Record<string, string> = {
      fromVideoGame: 'From Video Game',
      isVillain: 'Villain',
      hasSuperpowers: 'Has Superpowers',
      isAnimal: 'Animal/Creature',
      canFly: 'Can Fly',
      wearsHat: 'Wears Hat',
      hasMagicPowers: 'Has Magic',
      fromMovie: 'From Movie',
      fromBook: 'From Book',
      isHuman: 'Human',
      isHero: 'Hero',
      canTalk: 'Can Talk',
    }
    return labels[questionId] || questionId
  }

  if (showSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="p-8 bg-gradient-to-br from-accent/20 to-primary/10 backdrop-blur-sm border-2 border-accent shadow-2xl">
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
          </div>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="p-8 bg-gradient-to-br from-card/80 to-primary/5 backdrop-blur-sm border-2 border-primary/30 shadow-xl">
        <div className="space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border/50">
            <GraduationCap size={40} weight="fill" className="text-accent" />
            <div>
              <h2 className="text-3xl font-bold text-foreground">Teaching Mode</h2>
              <p className="text-muted-foreground">Help me learn about this character</p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-foreground/90">
              I couldn't figure it out! But you can teach me so I'll know next time. Based on your
              answers, I'll remember this character's attributes.
            </p>

            <div className="space-y-3">
              <Label htmlFor="character-name" className="text-base font-semibold">
                Who were you thinking of?
              </Label>
              <Input
                id="character-name"
                placeholder="Enter character name..."
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && characterName.trim()) {
                    handleSubmit()
                  }
                }}
                className="h-12 text-lg"
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            {answers.length > 0 && (
              <div className="space-y-3 pt-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  What I'll Remember
                </h3>
                <div className="flex flex-wrap gap-2">
                  {answers.map((answer, index) => (
                    <Badge
                      key={index}
                      variant={getAnswerBadgeVariant(answer.value)}
                      className="px-3 py-1.5 text-sm"
                    >
                      {getAttributeLabel(answer.questionId)}: {answer.value}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-2">
                <GraduationCap size={20} className="text-accent flex-shrink-0 mt-0.5" />
                <div className="text-sm text-foreground/80">
                  <p className="font-semibold mb-1">How this helps:</p>
                  <p>
                    When you teach me, I'll add this character to my database with all the
                    attributes from your answers. The next time someone thinks of them, I'll be able
                    to guess correctly!
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSubmit}
              disabled={!characterName.trim() || isSubmitting}
              size="lg"
              className="flex-1 h-12 text-base bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20 hover:scale-105 transition-transform"
            >
              {isSubmitting ? (
                <>Processing...</>
              ) : (
                <>
                  <Plus size={20} weight="bold" className="mr-2" />
                  Teach Me This Character
                </>
              )}
            </Button>
            <Button
              onClick={onSkip}
              variant="outline"
              size="lg"
              className="h-12 px-6 hover:scale-105 transition-transform"
              disabled={isSubmitting}
            >
              <ArrowRight size={20} weight="bold" className="mr-2" />
              Skip
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
