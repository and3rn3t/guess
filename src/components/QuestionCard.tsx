import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, Question as QuestionIcon, Keyboard } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Question, AnswerValue } from '@/lib/types'
import { llmWithMeta, LlmError } from '@/lib/llm'
import { conversationalParse_v1 } from '@/lib/prompts'
import { toast } from 'sonner'
import { useSwipeAnswer } from '@/hooks/useSwipeAnswer'

interface QuestionCardProps {
  question: Question
  questionNumber: number
  totalQuestions: number
  onAnswer: (value: AnswerValue) => void
  isProcessing?: boolean
}

const answerButtonStyles: Record<AnswerValue, string> = {
  yes: 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/30',
  no: 'bg-rose-500 hover:bg-rose-400 text-white shadow-lg shadow-rose-500/30',
  maybe: 'bg-amber-500 hover:bg-amber-400 text-white shadow-lg shadow-amber-500/30',
  unknown: 'bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-muted-foreground/30',
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
  const inputRef = useRef<HTMLInputElement>(null)
  const firstAnswerRef = useRef<HTMLButtonElement>(null)
  const shortcutPopoverRef = useRef<HTMLElement>(null)

  const handleInputFocus = useCallback(() => {
    // Wait for the iOS keyboard to animate into place before scrolling
    setTimeout(() => {
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 300)
  }, [])

  // Auto-focus first answer button on each new question (1.8)
  useEffect(() => {
    if (!isProcessing) {
      firstAnswerRef.current?.focus()
    }
  }, [question.id, isProcessing])

  // Keyboard shortcuts: Y=yes, N=no, M=maybe, U=don't know, ?=toggle shortcut overlay
  useEffect(() => {
    const KEY_MAP: Record<string, AnswerValue> = {
      y: 'yes',
      n: 'no',
      m: 'maybe',
      u: 'unknown',
    }
    const handleKey = (e: KeyboardEvent) => {
      if (isProcessing) return
      // Don't fire when user is typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName.toLowerCase()
      if (tag === 'input' || tag === 'textarea') return
      if (e.key === '?') {
        const el = shortcutPopoverRef.current as HTMLElement & { togglePopover?: () => void }
        el?.togglePopover?.()
        return
      }
      const answer = KEY_MAP[e.key.toLowerCase()]
      if (answer) onAnswer(answer)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isProcessing, onAnswer])

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

  const {
    dragX,
    dragY,
    cardRotate,
    yesOverlayOpacity,
    noOverlayOpacity,
    maybeOverlayOpacity,
    yesLabelOpacity,
    noLabelOpacity,
    maybeLabelOpacity,
    handleDragEnd,
    isDragEnabled,
  } = useSwipeAnswer({ onAnswer, enabled: !isProcessing })

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
      {/* Draggable layer — handles swipe-to-answer on mobile */}
      <motion.div
        drag={isDragEnabled ? true : false}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.15}
        style={{ x: dragX, y: dragY, rotate: cardRotate }}
        onDragEnd={handleDragEnd}
        className="relative cursor-grab active:cursor-grabbing"
      >
        {/* YES swipe overlay (emerald gradient, right drag) */}
        <motion.div
          aria-hidden
          className="absolute inset-0 rounded-xl pointer-events-none z-10 bg-gradient-to-br from-emerald-400/80 to-green-600/60 flex items-center justify-center"
          style={{ opacity: yesOverlayOpacity }}
        >
          <motion.div style={{ scale: yesOverlayOpacity }}>
            <CheckCircle size={72} weight="fill" className="text-white drop-shadow-lg" />
          </motion.div>
        </motion.div>
        {/* NO swipe overlay (rose gradient, left drag) */}
        <motion.div
          aria-hidden
          className="absolute inset-0 rounded-xl pointer-events-none z-10 bg-gradient-to-br from-rose-400/80 to-red-600/60 flex items-center justify-center"
          style={{ opacity: noOverlayOpacity }}
        >
          <motion.div style={{ scale: noOverlayOpacity }}>
            <XCircle size={72} weight="fill" className="text-white drop-shadow-lg" />
          </motion.div>
        </motion.div>
        {/* MAYBE swipe overlay (amber gradient, up drag) */}
        <motion.div
          aria-hidden
          className="absolute inset-0 rounded-xl pointer-events-none z-10 bg-gradient-to-br from-amber-400/80 to-yellow-600/60 flex items-center justify-center"
          style={{ opacity: maybeOverlayOpacity }}
        >
          <motion.div style={{ scale: maybeOverlayOpacity }}>
            <QuestionIcon size={72} weight="fill" className="text-white drop-shadow-lg" />
          </motion.div>
        </motion.div>
        {/* MAYBE hint label */}
        <motion.span
          aria-hidden
          className="absolute inset-x-0 top-4 z-20 pointer-events-none font-bold text-2xl text-amber-400 border-2 border-amber-400 rounded-lg px-3 py-1 mx-auto w-fit"
          style={{ opacity: maybeLabelOpacity }}
        >
          MAYBE
        </motion.span>
        {/* MAYBE hint label */}
        <motion.span
          aria-hidden
          className="absolute inset-x-0 top-4 z-20 pointer-events-none font-bold text-2xl text-amber-400 border-2 border-amber-400 rounded-lg px-3 py-1 mx-auto w-fit"
          style={{ opacity: maybeLabelOpacity }}
        >
          MAYBE
        </motion.span>
        {/* YES hint label */}
        <motion.span
          aria-hidden
          className="absolute left-4 top-6 z-20 pointer-events-none font-bold text-2xl text-emerald-400 border-2 border-emerald-400 rounded-lg px-3 py-1"
          style={{ opacity: yesLabelOpacity, rotate: '-15deg' }}
        >
          YES
        </motion.span>
        {/* NO hint label */}
        <motion.span
          aria-hidden
          className="absolute right-4 top-6 z-20 pointer-events-none font-bold text-2xl text-rose-400 border-2 border-rose-400 rounded-lg px-3 py-1"
          style={{ opacity: noLabelOpacity, rotate: '15deg' }}
        >
          NO
        </motion.span>

        <Card className={`p-6 md:p-8 bg-linear-to-br from-card via-card/60 to-primary/5 backdrop-blur-md shadow-xl border-2 transition-colors duration-300 ${isProcessing ? 'border-accent/40' : 'border-primary/30'}`}>
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
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-semibold leading-tight text-foreground select-none">
                {question.displayText || question.text}
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {answerButtons.map(({ value, label, icon: Icon }, idx) => (
                <motion.div key={value} whileTap={{ scale: 0.93 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }}>
                  <Button
                    ref={idx === 0 ? firstAnswerRef : undefined}
                    onClick={() => onAnswer(value)}
                    disabled={isProcessing}
                    size="lg"
                    aria-label={`Answer ${label}`}
                    className={`w-full h-16 text-lg font-medium transition-all duration-200 select-none ${answerButtonStyles[value]} hover:scale-105`}
                  >
                    <Icon size={24} weight="fill" className="mr-2" />
                    {label}
                  </Button>
                </motion.div>
              ))}
            </div>

            {/* Keyboard shortcut hint — hidden on touch devices */}
            <p className="hidden md:flex items-center justify-center gap-1 text-xs text-muted-foreground/50 select-none">
              <kbd className="font-mono">Y</kbd> Yes &middot; <kbd className="font-mono">N</kbd> No &middot; <kbd className="font-mono">M</kbd> Maybe &middot; <kbd className="font-mono">U</kbd> Don't know
              <button
                aria-label="Show keyboard shortcuts"
                className="ml-2 opacity-50 hover:opacity-100 transition-opacity"
                onClick={() => {
                  const el = shortcutPopoverRef.current as HTMLElement & { togglePopover?: () => void }
                  el?.togglePopover?.()
                }}
              >
                <Keyboard size={14} />
              </button>
            </p>

            {/* Keyboard shortcut popover — native Popover API, no JS state (1.6) */}
            <div
              ref={shortcutPopoverRef as React.Ref<HTMLDivElement>}
              popover="auto"
              className="m-auto p-5 rounded-xl bg-card border border-border shadow-2xl text-sm space-y-2 max-w-xs"
            >
              <p className="font-semibold text-foreground mb-3 flex items-center gap-2"><Keyboard size={16} /> Keyboard Shortcuts</p>
              {[
                { key: 'Y', label: 'Yes' },
                { key: 'N', label: 'No' },
                { key: 'M', label: 'Maybe' },
                { key: 'U', label: "Don't know" },
                { key: '?', label: 'Toggle this overlay' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <kbd className="font-mono bg-secondary px-2 py-0.5 rounded text-xs">{key}</kbd>
                  <span className="text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>

            {/* Free-text answer input */}
            <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder="Or type your answer..."
                  disabled={isProcessing || isInterpreting}
                  onKeyDown={(e) => e.key === 'Enter' && handleFreeText()}
                  onFocus={handleInputFocus}
                  inputMode="text"
                  enterKeyHint="send"
                  autoCapitalize="sentences"
                  autoCorrect="on"
                  className="flex-1 text-base"
                />
                <Button
                  onClick={handleFreeText}
                  disabled={!freeText.trim() || isProcessing || isInterpreting}
                  size="default"
                  variant="secondary"
                  className="touch-target"
                >
                  {isInterpreting ? '...' : 'Send'}
                </Button>
              </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  )
}

export function ThinkingCard() {
  return (
    <Card className="p-6 md:p-8 bg-linear-to-br from-card via-card/60 to-primary/5 backdrop-blur-md border-2 border-accent/40 shadow-xl">
      <div className="space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-5 w-32 rounded-md bg-accent/10 animate-shimmer" />
          <div className="h-6 w-24 rounded-full bg-accent/10 animate-shimmer" />
        </div>
        <div className="min-h-[80px] md:min-h-[120px] flex items-center">
          <div className="space-y-3 w-full">
            <div className="h-8 w-3/4 rounded-md bg-accent/10 animate-shimmer" />
            <div className="h-8 w-1/2 rounded-md bg-accent/8 animate-shimmer [animation-delay:0.15s]" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(['emerald', 'rose', 'amber', 'secondary'] as const).map((color, i) => (
            <div
              key={color}
              className={`h-16 rounded-lg animate-shimmer [animation-delay:${i * 0.1}s] ${
                color === 'emerald' ? 'bg-emerald-500/10' :
                color === 'rose' ? 'bg-rose-500/10' :
                color === 'amber' ? 'bg-amber-500/10' :
                'bg-secondary/20'
              }`}
            />
          ))}
        </div>
        <div className="flex items-center justify-center gap-2 text-sm text-accent/70">
          <motion.div
            className="w-2 h-2 rounded-full bg-accent"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0 }}
          />
          <motion.div
            className="w-2 h-2 rounded-full bg-accent"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
          />
          <motion.div
            className="w-2 h-2 rounded-full bg-accent"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
          />
          <span className="ml-1">Analyzing possibilities...</span>
        </div>
      </div>
    </Card>
  )
}
