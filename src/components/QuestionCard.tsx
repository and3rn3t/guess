import { motion } from 'framer-motion'
import { CheckCircle, XCircle, Question as QuestionIcon } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { Question, AnswerValue } from '@/lib/types'

interface QuestionCardProps {
  question: Question
  questionNumber: number
  totalQuestions: number
  onAnswer: (value: AnswerValue) => void
  isProcessing?: boolean
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  onAnswer,
  isProcessing = false,
}: QuestionCardProps) {
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
      <Card className="p-8 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-2 border-primary/30 shadow-xl">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-muted-foreground">
              Question {questionNumber} of {totalQuestions}
            </div>
            <div className="text-xs text-muted-foreground px-3 py-1 rounded-full bg-secondary/20">
              {Math.round((questionNumber / totalQuestions) * 100)}% Complete
            </div>
          </div>

          <div className="min-h-[120px] flex items-center">
            <h2 className="text-3xl md:text-4xl font-semibold leading-tight text-foreground">
              {question.text}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {answerButtons.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                onClick={() => onAnswer(value)}
                disabled={isProcessing}
                size="lg"
                className={`h-16 text-lg font-medium transition-all duration-200 ${
                  value === 'yes'
                    ? 'bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20'
                    : value === 'no'
                      ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-lg shadow-destructive/20'
                      : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                } hover:scale-105 active:scale-95`}
              >
                <Icon size={24} weight="fill" className="mr-2" />
                {label}
              </Button>
            ))}
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
