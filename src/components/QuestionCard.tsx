import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, Question as QuestionIcon } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import type { Question, AnswerValue } from '@/lib/types'
import { llmWithMeta, LlmError } from '@/lib/llm'
import { conversationalParse_v1 } from '@/lib/prompts'
import { toast } from 'sonner'

interface QuestionCardProps {
  question: Question
  questionNumber: number
  totalQuestions: number
  onAnswer: (value: AnswerValue) => void
  isProcessing?: boolean
}

const answerButtonStyles: Record<AnswerValue, string> = {
  yes: 'bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20',
  no: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-lg shadow-destructive/20',
  maybe: 'bg-secondary hover:bg-secondary/80 text-secondary-foreground',
  unknown: 'bg-secondary hover:bg-secondary/80 text-secondary-foreground',
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  onAnswer,
  isProcessing = false,
}: Readonly<QuestionCardProps>) {
  const [freeText, setFreeText] = useState('')
  const [isInterpreting, setIsInterpreting] = useState(false)

  const handleFreeText = async () => {
    if (!freeText.trim()) return
    setIsInterpreting(true)
    try {
      const { system, user } = conversationalParse_v1(freeText, question.text, question.attribute)
      const result = await llmWithMeta({ prompt: user, model: 'gpt-4o-mini', jsonMode: true, systemPrompt: system })
      const parsed = JSON.parse(result.content) as { value: AnswerValue; confidence: number }
      if (['yes', 'no', 'maybe', 'unknown'].includes(parsed.value)) {
        onAnswer(parsed.value)
        setFreeText('')
      }
    } catch (e) {
      const msg = e instanceof LlmError ? e.message : 'Could not interpret your answer'
      toast(msg, { description: 'Please use the buttons instead' })
    } finally {
      setIsInterpreting(false)
    }
  }

  const answerButtons: Array<{ value: AnswerValue; label: string; icon: typeof CheckCircle }> = [
    { value: 'yes', label: 'Yes', icon: CheckCircle },
    { value: 'no', label: 'No', icon: XCircle },
    { value: 'maybe', label: 'Maybe', icon: QuestionIcon },
    { value: 'unknown', label: "Don't Know", icon: QuestionIcon },
  ]

  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="p-6 md:p-8 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-sm border-2 border-primary/30 shadow-xl">
        <div className="space-y-4 md:space-y-6">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-muted-foreground">
              Question {questionNumber} of {totalQuestions}
            </div>
            <div className="text-xs text-muted-foreground px-3 py-1 rounded-full bg-secondary/20">
              {Math.round((questionNumber / totalQuestions) * 100)}% Complete
            </div>
          </div>

          <div className="min-h-[80px] md:min-h-[120px] flex items-center" aria-live="polite">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-semibold leading-tight text-foreground">
              {question.displayText || question.text}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {answerButtons.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                onClick={() => onAnswer(value)}
                disabled={isProcessing}
                size="lg"
                aria-label={`Answer ${label}`}
                className={`h-16 text-lg font-medium transition-all duration-200 ${answerButtonStyles[value]} hover:scale-105 active:scale-95`}
              >
                <Icon size={24} weight="fill" className="mr-2" />
                {label}
              </Button>
            ))}
          </div>

          {/* Free-text answer input */}
          <div className="flex gap-2">
              <Input
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder="Or type your answer..."
                disabled={isProcessing || isInterpreting}
                onKeyDown={(e) => e.key === 'Enter' && handleFreeText()}
                className="flex-1"
              />
              <Button
                onClick={handleFreeText}
                disabled={!freeText.trim() || isProcessing || isInterpreting}
                size="sm"
                variant="secondary"
              >
                {isInterpreting ? '...' : 'Send'}
              </Button>
            </div>
        </div>
      </Card>
    </motion.div>
  )
}

export function ThinkingCard() {
  return (
    <Card className="p-6 md:p-8 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-sm border-2 border-primary/30 shadow-xl">
      <div className="space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <div className="min-h-[80px] md:min-h-[120px] flex items-center">
          <div className="space-y-3 w-full">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-8 w-1/2" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
        <p className="text-center text-sm text-muted-foreground animate-pulse">Analyzing possibilities...</p>
      </div>
    </Card>
  )
}
