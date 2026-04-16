import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { AnimatePresence } from 'framer-motion'
import { Sparkle, Play, Gear, Flask } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Toaster, toast } from 'sonner'
import { QuestionCard } from '@/components/QuestionCard'
import { ReasoningPanel } from '@/components/ReasoningPanel'
import { GuessReveal, GameOver } from '@/components/GuessReveal'
import { TeachingMode } from '@/components/TeachingMode'
import { QuestionManager } from '@/components/QuestionManager'
import { QuestionGeneratorDemo } from '@/components/QuestionGeneratorDemo'
import { DEFAULT_CHARACTERS, DEFAULT_QUESTIONS } from '@/lib/database'
import {
  selectBestQuestion,
  generateReasoning,
  shouldMakeGuess,
  getBestGuess,
  calculateProbabilities,
} from '@/lib/gameEngine'
import type { Character, Question, Answer, AnswerValue, ReasoningExplanation } from '@/lib/types'

type GamePhase = 'welcome' | 'playing' | 'guessing' | 'gameOver' | 'teaching' | 'manage' | 'demo'

function App() {
  const [characters, setCharacters] = useKV<Character[]>('characters', DEFAULT_CHARACTERS)
  const [questions, setQuestions] = useKV<Question[]>('questions', DEFAULT_QUESTIONS)

  const [gamePhase, setGamePhase] = useState<GamePhase>('welcome')
  const [answers, setAnswers] = useState<Answer[]>([])
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [reasoning, setReasoning] = useState<ReasoningExplanation | null>(null)
  const [possibleCharacters, setPossibleCharacters] = useState<Character[]>(DEFAULT_CHARACTERS)
  const [finalGuess, setFinalGuess] = useState<Character | null>(null)
  const [isThinking, setIsThinking] = useState(false)
  const [gameWon, setGameWon] = useState(false)

  useEffect(() => {
    if (gamePhase === 'playing' && currentQuestion === null && possibleCharacters.length > 0) {
      generateNextQuestion()
    }
  }, [gamePhase, currentQuestion, possibleCharacters])

  const startGame = () => {
    setGamePhase('playing')
    setAnswers([])
    setPossibleCharacters(characters || DEFAULT_CHARACTERS)
    setCurrentQuestion(null)
    setReasoning(null)
    setFinalGuess(null)
    setGameWon(false)
  }

  const generateNextQuestion = () => {
    setIsThinking(true)

    setTimeout(() => {
      const allCharacters = characters || DEFAULT_CHARACTERS
      const allQuestions = questions || DEFAULT_QUESTIONS
      const filtered = filterPossibleCharacters(allCharacters, answers)
      setPossibleCharacters(filtered)

      if (shouldMakeGuess(filtered, answers, answers.length)) {
        const guess = getBestGuess(filtered, answers)
        setFinalGuess(guess)
        setGamePhase('guessing')
        setIsThinking(false)
        return
      }

      const nextQuestion = selectBestQuestion(filtered, answers, allQuestions)

      if (nextQuestion) {
        const newReasoning = generateReasoning(nextQuestion, filtered, answers)
        setCurrentQuestion(nextQuestion)
        setReasoning(newReasoning)
      } else {
        const guess = getBestGuess(filtered, answers)
        setFinalGuess(guess)
        setGamePhase('guessing')
      }

      setIsThinking(false)
    }, 800)
  }

  const filterPossibleCharacters = (chars: Character[], currentAnswers: Answer[]): Character[] => {
    return chars.filter((char) => {
      const probabilities = calculateProbabilities([char], currentAnswers)
      return probabilities.get(char.id)! > 0
    })
  }

  const handleAnswer = (value: AnswerValue) => {
    if (!currentQuestion) return

    const newAnswer: Answer = {
      questionId: currentQuestion.attribute,
      value,
    }

    setAnswers((prev) => [...prev, newAnswer])
    setCurrentQuestion(null)
    toast.success(`Answer recorded: ${value}`)
  }

  const handleCorrectGuess = () => {
    setGameWon(true)
    setGamePhase('gameOver')
    toast.success('🎉 I got it right!')
  }

  const handleIncorrectGuess = () => {
    setGameWon(false)
    setGamePhase('gameOver')
    toast.error("I'll learn from this and do better next time!")
  }

  const handleTeachMode = () => {
    setGamePhase('teaching')
  }

  const handleAddCharacter = (character: Character) => {
    setCharacters((currentCharacters) => [...(currentCharacters || []), character])
    toast.success(`I've learned about ${character.name}!`)
  }

  const handleSkipTeaching = () => {
    setGamePhase('gameOver')
  }

  const handleManageQuestions = () => {
    setGamePhase('manage')
  }

  const handleAddQuestions = (newQuestions: Question[]) => {
    setQuestions((currentQuestions) => [...(currentQuestions || []), ...newQuestions])
  }

  const handleBackToWelcome = () => {
    setGamePhase('welcome')
  }

  const handleOpenDemo = () => {
    setGamePhase('demo')
  }

  const handleExitDemo = () => {
    setGamePhase('welcome')
  }

  if (gamePhase === 'demo') {
    return <QuestionGeneratorDemo onBack={handleExitDemo} />
  }

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="min-h-screen bg-background relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `
              radial-gradient(circle at 20% 50%, oklch(0.35 0.15 300 / 0.3) 0%, transparent 50%),
              radial-gradient(circle at 80% 80%, oklch(0.70 0.15 220 / 0.2) 0%, transparent 50%),
              radial-gradient(circle at 40% 20%, oklch(0.28 0.12 280 / 0.2) 0%, transparent 50%)
            `,
          }}
        />

        <div className="relative z-10">
          <header className="border-b border-border/50 backdrop-blur-sm bg-background/80">
            <div className="container mx-auto px-4 py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkle size={40} weight="fill" className="text-accent" />
                  <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
                    Mystic Guesser
                  </h1>
                </div>
                <div className="flex items-center gap-3">
                  {gamePhase === 'welcome' && (
                    <>
                      <Button
                        onClick={handleOpenDemo}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2 bg-accent/10 hover:bg-accent/20 border-accent/30"
                      >
                        <Flask size={20} />
                        <span className="hidden sm:inline">Test Generator</span>
                      </Button>
                      <Button
                        onClick={handleManageQuestions}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <Gear size={20} />
                        <span className="hidden sm:inline">Manage Questions</span>
                      </Button>
                    </>
                  )}
                  {gamePhase !== 'welcome' && (
                    <div className="text-sm text-muted-foreground">
                      Questions: {answers.length}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          <main className="container mx-auto px-4 py-8 md:py-12">
            {gamePhase === 'welcome' && (
              <div className="max-w-4xl mx-auto space-y-8">
                <div className="text-center space-y-4">
                  <Sparkle size={80} weight="fill" className="mx-auto text-accent animate-float" />
                  <h2 className="text-4xl md:text-5xl font-bold text-foreground">
                    Think of a Character
                  </h2>
                  <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                    I'll read your mind by asking strategic questions. Watch as I explain my
                    reasoning in real-time!
                  </p>
                </div>

                <div className="bg-card/50 backdrop-blur-sm border-2 border-primary/20 rounded-xl p-8 space-y-6">
                  <h3 className="text-2xl font-semibold text-foreground">How It Works</h3>
                  <div className="space-y-4 text-foreground/90">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold">
                        1
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">Strategic Questioning</h4>
                        <p className="text-sm text-muted-foreground">
                          I analyze all possibilities and ask questions that split them optimally,
                          eliminating roughly half with each answer.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold">
                        2
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">Real-Time Reasoning</h4>
                        <p className="text-sm text-muted-foreground">
                          The explanation panel shows you exactly why I chose each question and how
                          your answers narrow down the possibilities.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold">
                        3
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">Confidence Building</h4>
                        <p className="text-sm text-muted-foreground">
                          Watch my confidence grow with each answer until I'm ready to make my final
                          guess!
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <Button
                    onClick={startGame}
                    size="lg"
                    className="h-16 px-8 text-xl bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20 hover:scale-105 transition-transform"
                  >
                    <Play size={28} weight="fill" className="mr-3" />
                    Start Game
                  </Button>
                </div>
              </div>
            )}

            {gamePhase === 'playing' && (
              <div className="grid lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
                <div className="space-y-6">
                  <AnimatePresence mode="wait">
                    {currentQuestion && (
                      <QuestionCard
                        question={currentQuestion}
                        questionNumber={answers.length + 1}
                        totalQuestions={20}
                        onAnswer={handleAnswer}
                        isProcessing={isThinking}
                      />
                    )}
                  </AnimatePresence>
                  <Progress value={(answers.length / 20) * 100} className="h-2" />
                </div>

                <div className="lg:sticky lg:top-8 lg:self-start">
                  <ReasoningPanel reasoning={reasoning} isThinking={isThinking} />
                </div>
              </div>
            )}

            {gamePhase === 'guessing' && finalGuess && (
              <div className="max-w-2xl mx-auto">
                <GuessReveal
                  character={finalGuess}
                  onCorrect={handleCorrectGuess}
                  onIncorrect={handleIncorrectGuess}
                />
              </div>
            )}

            {gamePhase === 'gameOver' && (
              <div className="max-w-2xl mx-auto">
                <GameOver
                  won={gameWon}
                  character={finalGuess}
                  onPlayAgain={startGame}
                  onTeachMode={!gameWon ? handleTeachMode : undefined}
                />
              </div>
            )}

            {gamePhase === 'teaching' && (
              <div className="max-w-2xl mx-auto">
                <TeachingMode
                  answers={answers}
                  onAddCharacter={handleAddCharacter}
                  onSkip={handleSkipTeaching}
                />
              </div>
            )}

            {gamePhase === 'manage' && (
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-foreground">Question Pool Manager</h2>
                    <p className="text-muted-foreground mt-1">
                      Generate new questions from user-taught characters
                    </p>
                  </div>
                  <Button onClick={handleBackToWelcome} variant="outline">
                    Back to Game
                  </Button>
                </div>
                <QuestionManager
                  characters={characters || DEFAULT_CHARACTERS}
                  questions={questions || DEFAULT_QUESTIONS}
                  onAddQuestions={handleAddQuestions}
                />
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-3">
                    Current Statistics
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-background/50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-accent">
                        {(characters || DEFAULT_CHARACTERS).length}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Characters</div>
                    </div>
                    <div className="bg-background/50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-accent">
                        {(questions || DEFAULT_QUESTIONS).length}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Questions</div>
                    </div>
                    <div className="bg-background/50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-accent">
                        {
                          (characters || DEFAULT_CHARACTERS).filter(
                            (c) => c.id.startsWith('char-')
                          ).length
                        }
                      </div>
                      <div className="text-sm text-muted-foreground">User-Taught</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  )
}

export default App