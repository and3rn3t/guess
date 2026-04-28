import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Flask, Sparkle, ArrowRight, CheckCircle, Plus } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { QuestionManager } from '@/components/QuestionManager'
import type { Character, Question } from '@/lib/types'
import { DEFAULT_CHARACTERS, DEFAULT_QUESTIONS } from '@/lib/database'

interface QuestionGeneratorDemoProps {
  onBack: () => void
  initialCharacters?: Character[]
}

type DemoStep = 'intro' | 'character' | 'generator' | 'success'

const TEST_CHARACTER: Character = {
  id: 'demo-spiderman',
  name: 'Spider-Man',
  category: 'comics',
  attributes: {
    isReal: false,
    isAnimal: false,
    isHuman: true,
    canFly: false,
    hasSuperpowers: true,
    isVillain: false,
    fromVideoGame: true,
    fromMovie: true,
    fromBook: true,
    isFictional: true,
    wearsHat: false,
    hasMagicPowers: false,
    isHero: true,
    canTalk: true,
    hasWebShooters: true,
    climbsWalls: true,
    hasSpiderSense: true,
    wearsAMask: true,
    livesInNewYork: true,
  },
}

export function QuestionGeneratorDemo({ onBack, initialCharacters }: QuestionGeneratorDemoProps) {
  const baseCharacters = initialCharacters ?? DEFAULT_CHARACTERS
  const [currentStep, setCurrentStep] = useState<DemoStep>('intro')
  const [characters, setCharacters] = useState<Character[]>([...baseCharacters])
  const [questions, setQuestions] = useState<Question[]>([...DEFAULT_QUESTIONS])
  const [generatedCount, setGeneratedCount] = useState(0)

  const handleAddTestCharacter = () => {
    setCharacters([...baseCharacters, TEST_CHARACTER])
    setCurrentStep('character')
  }

  const handleProceedToGenerator = () => {
    setCurrentStep('generator')
  }

  const handleQuestionsGenerated = (newQuestions: Question[]) => {
    setQuestions([...questions, ...newQuestions])
    setGeneratedCount(newQuestions.length)
    setCurrentStep('success')
  }

  const newAttributes = Object.keys(TEST_CHARACTER.attributes).filter(
    (attr) => !DEFAULT_QUESTIONS.some((q) => q.attribute === attr)
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Flask size={40} weight="fill" className="text-accent" />
              <div>
                <h1 className="text-3xl font-bold text-foreground">Question Generator Test Lab</h1>
                <p className="text-muted-foreground">
                  Watch AI generate questions from new character attributes
                </p>
              </div>
            </div>
            <Button onClick={onBack} variant="outline">
              Exit Demo
            </Button>
          </div>

          <AnimatePresence mode="wait">
            {currentStep === 'intro' && (
              <motion.div
                key="intro"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="p-5 sm:p-8 bg-linear-to-br from-primary/10 to-accent/10 backdrop-blur-sm border-2 border-primary/20">
                  <div className="space-y-6">
                    <div className="text-center space-y-4">
                      <Sparkle size={80} weight="fill" className="mx-auto text-accent animate-float" />
                      <h2 className="text-4xl font-bold text-foreground">
                        Test the Question Generator
                      </h2>
                      <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        This demo shows how the AI analyzes new characters and generates questions for
                        attributes that don't exist in the current question pool.
                      </p>
                    </div>

                    <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 space-y-4">
                      <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
                        <Plus size={24} className="text-accent" />
                        Test Character: Spider-Man
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-semibold text-muted-foreground mb-2">
                            Standard Attributes (Already Covered):
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {Object.keys(TEST_CHARACTER.attributes)
                              .filter((attr) =>
                                DEFAULT_QUESTIONS.some((q) => q.attribute === attr)
                              )
                              .map((attr) => (
                                <Badge key={attr} variant="secondary" className="text-xs">
                                  {attr}
                                </Badge>
                              ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-accent mb-2">
                            🎯 New Attributes (Will Generate Questions):
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {newAttributes.map((attr) => (
                              <Badge
                                key={attr}
                                className="text-xs bg-accent/20 text-accent border-accent/30"
                              >
                                {attr}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/30 rounded-lg p-6 space-y-3">
                      <h4 className="font-semibold text-foreground">What will happen:</h4>
                      <ol className="space-y-2 text-foreground/80">
                        <li className="flex gap-3">
                          <span className="shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm font-bold">
                            1
                          </span>
                          <span>
                            Add Spider-Man to the character database with {newAttributes.length} new
                            unique attributes
                          </span>
                        </li>
                        <li className="flex gap-3">
                          <span className="shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm font-bold">
                            2
                          </span>
                          <span>
                            The AI will analyze which attributes are useful for discrimination
                          </span>
                        </li>
                        <li className="flex gap-3">
                          <span className="shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm font-bold">
                            3
                          </span>
                          <span>
                            Generate natural, conversational yes/no questions for those attributes
                          </span>
                        </li>
                        <li className="flex gap-3">
                          <span className="shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm font-bold">
                            4
                          </span>
                          <span>Show the newly generated questions ready to be added to the pool</span>
                        </li>
                      </ol>
                    </div>

                    <Button
                      onClick={handleAddTestCharacter}
                      size="lg"
                      className="w-full h-14 text-lg bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20"
                    >
                      <Plus size={24} weight="bold" className="mr-3" />
                      Add Spider-Man & Start Test
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}

            {currentStep === 'character' && (
              <motion.div
                key="character"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="p-5 sm:p-8 bg-linear-to-br from-accent/20 to-primary/10 backdrop-blur-sm border-2 border-accent/30">
                  <div className="space-y-6">
                    <div className="text-center space-y-4">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200 }}
                      >
                        <CheckCircle size={80} weight="fill" className="mx-auto text-accent" />
                      </motion.div>
                      <h2 className="text-3xl font-bold text-foreground">Character Added!</h2>
                      <p className="text-lg text-muted-foreground">
                        Spider-Man has been added to the database with {newAttributes.length} new
                        attributes
                      </p>
                    </div>

                    <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-foreground mb-3">
                        Database Statistics
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-background/50 rounded-lg p-4">
                          <div className="text-3xl font-bold text-accent">
                            {characters.length}
                          </div>
                          <div className="text-sm text-muted-foreground">Total Characters</div>
                        </div>
                        <div className="bg-background/50 rounded-lg p-4">
                          <div className="text-3xl font-bold text-accent">{newAttributes.length}</div>
                          <div className="text-sm text-muted-foreground">New Attributes</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/30 rounded-lg p-4">
                      <p className="text-sm text-foreground/80">
                        <span className="font-semibold">Next:</span> The Question Manager will analyze
                        these new attributes and determine which ones are useful for distinguishing
                        between characters. Attributes that are too common or too rare won't generate
                        questions.
                      </p>
                    </div>

                    <Button
                      onClick={handleProceedToGenerator}
                      size="lg"
                      className="w-full h-14 text-lg bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20"
                    >
                      <ArrowRight size={24} weight="bold" className="mr-3" />
                      Open Question Generator
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}

            {currentStep === 'generator' && (
              <motion.div
                key="generator"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <Card className="p-6 bg-card/50 backdrop-blur-sm border-2 border-primary/20">
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
                      <Sparkle size={24} className="text-accent" />
                      Live Test in Progress
                    </h3>
                    <p className="text-foreground/80">
                      Click "Generate New Questions" below to watch the AI analyze Spider-Man's
                      attributes and create questions. The system will:
                    </p>
                    <ul className="list-disc list-inside text-sm text-foreground/70 space-y-1 ml-4">
                      <li>Identify the {newAttributes.length} new attributes</li>
                      <li>Calculate which ones are useful for discrimination</li>
                      <li>Use GPT-4 to generate natural yes/no questions</li>
                      <li>Display the results with reasoning</li>
                    </ul>
                  </div>
                </Card>

                <QuestionManager
                  characters={characters}
                  questions={questions}
                  onAddQuestions={handleQuestionsGenerated}
                />
              </motion.div>
            )}

            {currentStep === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="p-5 sm:p-8 bg-linear-to-br from-accent/20 to-primary/10 backdrop-blur-sm border-2 border-accent/30">
                  <div className="space-y-6">
                    <div className="text-center space-y-4">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200 }}
                      >
                        <CheckCircle size={100} weight="fill" className="mx-auto text-accent" />
                      </motion.div>
                      <h2 className="text-4xl font-bold text-foreground">Test Complete! 🎉</h2>
                      <p className="text-xl text-muted-foreground">
                        Successfully generated {generatedCount} new questions
                      </p>
                    </div>

                    <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-6 space-y-4">
                      <h3 className="text-xl font-semibold text-foreground">What Just Happened</h3>
                      <div className="space-y-3 text-foreground/80">
                        <div className="flex gap-3">
                          <CheckCircle size={24} weight="fill" className="text-accent shrink-0" />
                          <div>
                            <p className="font-semibold">Character Analysis</p>
                            <p className="text-sm text-muted-foreground">
                              Analyzed Spider-Man's {newAttributes.length} unique attributes
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <CheckCircle size={24} weight="fill" className="text-accent shrink-0" />
                          <div>
                            <p className="font-semibold">Attribute Filtering</p>
                            <p className="text-sm text-muted-foreground">
                              Identified which attributes provide good discrimination between characters
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <CheckCircle size={24} weight="fill" className="text-accent shrink-0" />
                          <div>
                            <p className="font-semibold">AI Question Generation</p>
                            <p className="text-sm text-muted-foreground">
                              Used GPT-4 to create {generatedCount} natural, conversational questions
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <CheckCircle size={24} weight="fill" className="text-accent shrink-0" />
                          <div>
                            <p className="font-semibold">Pool Expansion</p>
                            <p className="text-sm text-muted-foreground">
                              Questions are now available for future games
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/30 rounded-lg p-6">
                      <p className="text-foreground/80">
                        <span className="font-semibold text-accent">Success!</span> The question
                        generator successfully expanded the game's question pool by analyzing
                        user-taught characters. This same process happens automatically when players
                        teach the game new characters through the Teaching Mode.
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        onClick={onBack}
                        size="lg"
                        className="flex-1 h-12 bg-accent hover:bg-accent/90 text-accent-foreground"
                      >
                        Return to Game
                      </Button>
                      <Button
                        onClick={() => {
                          setCurrentStep('intro')
                          setCharacters([...DEFAULT_CHARACTERS])
                          setQuestions([...DEFAULT_QUESTIONS])
                          setGeneratedCount(0)
                        }}
                        variant="outline"
                        size="lg"
                        className="h-12"
                      >
                        Run Again
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
