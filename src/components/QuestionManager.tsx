import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Sparkle, Lightning, Info, Plus } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import type { Character, Question } from '@/lib/types'
import { analyzeAndGenerateQuestions, getQuestionGenerationInsight } from '@/lib/questionGenerator'

interface QuestionManagerProps {
  characters: Character[]
  questions: Question[]
  onAddQuestions: (questions: Question[]) => void
}

export function QuestionManager({ characters, questions, onAddQuestions }: QuestionManagerProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([])
  const [reasoning, setReasoning] = useState<string>('')
  const [showDetails, setShowDetails] = useState(false)

  const insight = getQuestionGenerationInsight(characters, questions)
  const hasNewAttributesToProcess = !insight.includes('All character attributes')

  const handleGenerateQuestions = async () => {
    setIsGenerating(true)
    setGeneratedQuestions([])
    setReasoning('')
    setShowDetails(false)

    try {
      const result = await analyzeAndGenerateQuestions(characters, questions)

      if (result.newQuestions.length > 0) {
        setGeneratedQuestions(result.newQuestions)
        setReasoning(result.reasoning)
        toast.success(`Generated ${result.newQuestions.length} new questions!`)
      } else {
        toast.info(result.reasoning)
        setReasoning(result.reasoning)
      }
    } catch (error) {
      console.error('Error generating questions:', error)
      toast.error('Failed to generate questions. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleAddAllQuestions = () => {
    onAddQuestions(generatedQuestions)
    toast.success(`Added ${generatedQuestions.length} questions to the pool!`)
    setGeneratedQuestions([])
    setReasoning('')
  }

  return (
    <div className="space-y-4">
      <Card className="p-6 bg-linear-to-br from-primary/10 to-accent/10 backdrop-blur-sm border-2 border-primary/20">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Lightning size={32} weight="fill" className="text-accent" />
              <div>
                <h3 className="text-xl font-bold text-foreground">Question Generator</h3>
                <p className="text-sm text-muted-foreground">
                  Expand the question pool with AI-powered analysis
                </p>
              </div>
            </div>
            <Button
              onClick={() => setShowDetails(!showDetails)}
              variant="ghost"
              size="sm"
              className="shrink-0"
            >
              <Info size={20} />
            </Button>
          </div>

          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="bg-muted/30 rounded-lg p-4 space-y-2 border border-border/50">
                  <div className="flex items-start gap-2">
                    <Sparkle size={20} className="text-accent shrink-0 mt-0.5" />
                    <div className="text-sm text-foreground/80 space-y-2">
                      <p className="font-semibold">How Question Generation Works:</p>
                      <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>Analyzes all user-taught characters for new attributes</li>
                        <li>Identifies attributes that effectively discriminate between characters</li>
                        <li>Uses AI to generate natural, conversational questions</li>
                        <li>Adds questions to the pool for future games</li>
                      </ol>
                      <p className="mt-2">
                        <strong>Current Status:</strong> {characters.length} characters,{' '}
                        {questions.length} questions
                      </p>
                      <p className="text-accent font-medium">{insight}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-3">
            <Button
              onClick={handleGenerateQuestions}
              disabled={isGenerating || !hasNewAttributesToProcess}
              className="flex-1 h-12 bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20"
            >
              {isGenerating ? (
                <>
                  <Sparkle size={20} weight="fill" className="mr-2 animate-spin" />
                  Generating Questions...
                </>
              ) : (
                <>
                  <Sparkle size={20} weight="fill" className="mr-2" />
                  Generate New Questions
                </>
              )}
            </Button>
          </div>

          {isGenerating && (
            <div className="space-y-2">
              <Progress value={undefined} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">
                Analyzing character attributes...
              </p>
            </div>
          )}

          {reasoning && !isGenerating && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card/50 rounded-lg p-4 border border-border"
            >
              <p className="text-sm text-foreground/80">{reasoning}</p>
            </motion.div>
          )}
        </div>
      </Card>

      <AnimatePresence>
        {generatedQuestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="p-6 bg-linear-to-br from-card to-accent/5 backdrop-blur-sm border-2 border-accent/30">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Plus size={24} weight="bold" className="text-accent" />
                    Generated Questions ({generatedQuestions.length})
                  </h4>
                  <Button
                    onClick={handleAddAllQuestions}
                    size="sm"
                    className="bg-accent hover:bg-accent/90 text-accent-foreground"
                  >
                    Add All to Pool
                  </Button>
                </div>

                <div className="space-y-3">
                  {generatedQuestions.map((question, index) => (
                    <motion.div
                      key={question.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-background/50 rounded-lg p-4 border border-border/50"
                    >
                      <div className="flex items-start gap-3">
                        <Badge
                          variant="secondary"
                          className="shrink-0 mt-1 font-mono text-xs"
                        >
                          {index + 1}
                        </Badge>
                        <div className="flex-1 space-y-1">
                          <p className="text-foreground font-medium">{question.text}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            Attribute: {question.attribute}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
