import { useState, useEffect, lazy, Suspense } from 'react'
import { useKV } from '@/hooks/useKV'
import { AnimatePresence } from 'framer-motion'
import { SparkleIcon, PlayIcon, GearIcon, FlaskIcon, ChartBarIcon, UsersIcon, ClipboardTextIcon, BrainIcon, TreeStructureIcon, WrenchIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Toaster, toast } from 'sonner'
import { QuestionCard } from '@/components/QuestionCard'
import { ReasoningPanel } from '@/components/ReasoningPanel'
import { GuessReveal, GameOver } from '@/components/GuessReveal'
import { DEFAULT_CHARACTERS, DEFAULT_QUESTIONS } from '@/lib/database'
import {
  selectBestQuestion,
  generateReasoning,
  shouldMakeGuess,
  getBestGuess,
  calculateProbabilities,
  detectContradictions,
} from '@/lib/gameEngine'
import type { Character, Question, Answer, AnswerValue, ReasoningExplanation } from '@/lib/types'

const TeachingMode = lazy(() => import('@/components/TeachingMode').then(m => ({ default: m.TeachingMode })))
const QuestionManager = lazy(() => import('@/components/QuestionManager').then(m => ({ default: m.QuestionManager })))
const QuestionGeneratorDemo = lazy(() => import('@/components/QuestionGeneratorDemo').then(m => ({ default: m.QuestionGeneratorDemo })))
const StatsDashboard = lazy(() => import('@/components/StatsDashboard').then(m => ({ default: m.StatsDashboard })))
const CharacterComparison = lazy(() => import('@/components/CharacterComparison').then(m => ({ default: m.CharacterComparison })))
const AttributeCoverageReport = lazy(() => import('@/components/AttributeCoverageReport').then(m => ({ default: m.AttributeCoverageReport })))
const AttributeRecommender = lazy(() => import('@/components/AttributeRecommender').then(m => ({ default: m.AttributeRecommender })))
const CategoryRecommender = lazy(() => import('@/components/CategoryRecommender').then(m => ({ default: m.CategoryRecommender })))
const EnvironmentTest = lazy(() => import('@/components/EnvironmentTest').then(m => ({ default: m.EnvironmentTest })))
const MultiCategoryEnhancer = lazy(() => import('@/components/MultiCategoryEnhancer').then(m => ({ default: m.MultiCategoryEnhancer })))

type GamePhase = 'welcome' | 'playing' | 'guessing' | 'gameOver' | 'teaching' | 'manage' | 'demo' | 'stats' | 'compare' | 'coverage' | 'recommender' | 'categoryRecommender' | 'environmentTest' | 'bulkHabitat'

interface GameHistoryEntry {
  characterId: string
  questionsAsked: string[]
  won: boolean
  timestamp: number
}

function App() {
  const [characters, setCharacters] = useKV<Character[]>('characters', DEFAULT_CHARACTERS)
  const [questions, setQuestions] = useKV<Question[]>('questions', DEFAULT_QUESTIONS)
  const [gameHistory, setGameHistory] = useKV<GameHistoryEntry[]>('game-history', [])

  const [gamePhase, setGamePhase] = useState<GamePhase>('welcome')
  const [answers, setAnswers] = useState<Answer[]>([])
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [reasoning, setReasoning] = useState<ReasoningExplanation | null>(null)
  const [possibleCharacters, setPossibleCharacters] = useState<Character[]>(DEFAULT_CHARACTERS)
  const [finalGuess, setFinalGuess] = useState<Character | null>(null)
  const [isThinking, setIsThinking] = useState(false)
  const [gameWon, setGameWon] = useState(false)
  const [askedQuestionIds, setAskedQuestionIds] = useState<string[]>([])
  const [selectedCharacterForRec, setSelectedCharacterForRec] = useState<Character | null>(null)
  const [showDevTools, setShowDevTools] = useState(false)

  useEffect(() => {
    if (gamePhase === 'playing' && currentQuestion === null && possibleCharacters.length > 0) {
      generateNextQuestion()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamePhase, currentQuestion, possibleCharacters])

  const startGame = () => {
    setGamePhase('playing')
    setAnswers([])
    setPossibleCharacters(characters || DEFAULT_CHARACTERS)
    setCurrentQuestion(null)
    setReasoning(null)
    setFinalGuess(null)
    setGameWon(false)
    setAskedQuestionIds([])
  }

  const generateNextQuestion = () => {
    setIsThinking(true)

    setTimeout(() => {
      const allCharacters = characters || DEFAULT_CHARACTERS
      const allQuestions = questions || DEFAULT_QUESTIONS
      const filtered = filterPossibleCharacters(allCharacters, answers)
      setPossibleCharacters(filtered)

      const { hasContradiction } = detectContradictions(allCharacters, answers)
      if (hasContradiction) {
        toast.warning('Your answers seem contradictory — no characters match! Undoing last answer.')
        setAnswers((prev) => prev.slice(0, -1))
        setIsThinking(false)
        return
      }

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
        setAskedQuestionIds((prev) => [...prev, nextQuestion.id])
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
    
    if (finalGuess) {
      setGameHistory((currentHistory) => [
        ...(currentHistory || []),
        {
          characterId: finalGuess.id,
          questionsAsked: askedQuestionIds,
          won: true,
          timestamp: Date.now(),
        },
      ])
    }
  }

  const handleIncorrectGuess = () => {
    setGameWon(false)
    setGamePhase('gameOver')
    toast.error("I'll learn from this and do better next time!")
    
    if (finalGuess) {
      setGameHistory((currentHistory) => [
        ...(currentHistory || []),
        {
          characterId: finalGuess.id,
          questionsAsked: askedQuestionIds,
          won: false,
          timestamp: Date.now(),
        },
      ])
    }
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

  const handleOpenStats = () => {
    setGamePhase('stats')
  }

  const handleExitStats = () => {
    setGamePhase('welcome')
  }

  const handleOpenCompare = () => {
    setGamePhase('compare')
  }

  const handleExitCompare = () => {
    setGamePhase('welcome')
  }

  const handleOpenCoverage = () => {
    setGamePhase('coverage')
  }

  const handleExitCoverage = () => {
    setGamePhase('welcome')
  }

  const handleOpenRecommender = (character: Character) => {
    setSelectedCharacterForRec(character)
    setGamePhase('categoryRecommender')
  }

  const handleUpdateCharacter = (updatedCharacter: Character) => {
    setCharacters((currentCharacters) =>
      (currentCharacters || []).map((char) =>
        char.id === updatedCharacter.id ? updatedCharacter : char
      )
    )
    toast.success(`Updated ${updatedCharacter.name}'s attributes!`)
  }

  const handleExitRecommender = () => {
    setSelectedCharacterForRec(null)
    setGamePhase('welcome')
  }

  const handleOpenEnvironmentTest = (character: Character) => {
    setSelectedCharacterForRec(character)
    setGamePhase('environmentTest')
  }

  const handleExitEnvironmentTest = () => {
    setSelectedCharacterForRec(null)
    setGamePhase('welcome')
  }

  const handleOpenBulkHabitat = () => {
    setGamePhase('bulkHabitat')
  }

  const handleExitBulkHabitat = () => {
    setGamePhase('welcome')
  }

  const handleUpdateCharacters = (updatedCharacters: Character[]) => {
    setCharacters(() => updatedCharacters)
  }

  if (gamePhase === 'bulkHabitat') {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <MultiCategoryEnhancer
            characters={characters || DEFAULT_CHARACTERS}
            onUpdateCharacters={handleUpdateCharacters}
            onBack={handleExitBulkHabitat}
          />
          </Suspense>
        </div>
      </div>
    )
  }

  if (gamePhase === 'demo') {
    return <Suspense fallback={<Skeleton className="h-96 w-full" />}><QuestionGeneratorDemo onBack={handleExitDemo} /></Suspense>
  }

  if (gamePhase === 'environmentTest' && selectedCharacterForRec) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <EnvironmentTest
            character={selectedCharacterForRec}
            onUpdateCharacter={handleUpdateCharacter}
            onBack={handleExitEnvironmentTest}
          />
          </Suspense>
        </div>
      </div>
    )
  }

  if (gamePhase === 'coverage') {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <AttributeCoverageReport
            characters={characters || DEFAULT_CHARACTERS}
            onBack={handleExitCoverage}
          />
          </Suspense>
        </div>
      </div>
    )
  }

  if (gamePhase === 'categoryRecommender' && selectedCharacterForRec) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <CategoryRecommender
            character={selectedCharacterForRec}
            onUpdateCharacter={handleUpdateCharacter}
            onBack={handleExitRecommender}
          />
          </Suspense>
        </div>
      </div>
    )
  }

  if (gamePhase === 'recommender' && selectedCharacterForRec) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <AttributeRecommender
            character={selectedCharacterForRec}
            onUpdateCharacter={handleUpdateCharacter}
            onBack={handleExitRecommender}
          />
          </Suspense>
        </div>
      </div>
    )
  }

  if (gamePhase === 'compare') {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <CharacterComparison
            characters={characters || DEFAULT_CHARACTERS}
            onBack={handleExitCompare}
            onOpenRecommender={handleOpenRecommender}
          />
          </Suspense>
        </div>
      </div>
    )
  }

  if (gamePhase === 'stats') {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <StatsDashboard
            characters={characters || DEFAULT_CHARACTERS}
            questions={questions || DEFAULT_QUESTIONS}
            gameHistory={gameHistory || []}
            onBack={handleExitStats}
          />
          </Suspense>
        </div>
      </div>
    )
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
                  <SparkleIcon size={40} weight="fill" className="text-accent" />
                  <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
                    Mystic Guesser
                  </h1>
                </div>
                <div className="flex items-center gap-3">
                  {gamePhase === 'welcome' && (
                    <>
                      <Button
                        onClick={handleOpenStats}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2 bg-accent/10 hover:bg-accent/20 border-accent/30"
                      >
                        <ChartBarIcon size={20} />
                        <span className="hidden sm:inline">Statistics</span>
                      </Button>
                      <Button
                        onClick={handleOpenCompare}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <UsersIcon size={20} />
                        <span className="hidden sm:inline">Compare</span>
                      </Button>
                      {import.meta.env.DEV && (
                        <Button
                          onClick={() => setShowDevTools(!showDevTools)}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2 border-dashed border-yellow-500/50 text-yellow-500"
                        >
                          <WrenchIcon size={20} />
                          <span className="hidden sm:inline">Dev Tools</span>
                        </Button>
                      )}
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
                  <SparkleIcon size={80} weight="fill" className="mx-auto text-accent animate-float" />
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

                <div className="text-center space-y-4">
                  <Button
                    onClick={startGame}
                    size="lg"
                    className="h-16 px-8 text-xl bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20 hover:scale-105 transition-transform"
                  >
                    <PlayIcon size={28} weight="fill" className="mr-3" />
                    Start Game
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    I know {(characters || DEFAULT_CHARACTERS).length} characters — can you stump me?
                  </p>
                </div>

                {import.meta.env.DEV && showDevTools && (
                  <div className="border-2 border-dashed border-yellow-500/30 rounded-xl p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-yellow-500 flex items-center gap-2">
                      <WrenchIcon size={24} />
                      Developer Tools
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      <Button onClick={handleOpenCoverage} variant="outline" size="sm" className="flex items-center gap-2">
                        <ClipboardTextIcon size={18} />
                        Coverage Report
                      </Button>
                      <Button onClick={handleOpenDemo} variant="outline" size="sm" className="flex items-center gap-2">
                        <FlaskIcon size={18} />
                        Test Generator
                      </Button>
                      <Button onClick={handleManageQuestions} variant="outline" size="sm" className="flex items-center gap-2">
                        <GearIcon size={18} />
                        Manage Questions
                      </Button>
                      <Button
                        onClick={() => {
                          const spongebob = (characters || DEFAULT_CHARACTERS).find(c => c.id === 'spongebob')
                          if (spongebob) handleOpenEnvironmentTest(spongebob)
                        }}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <TreeStructureIcon size={18} />
                        Test Environment
                      </Button>
                      <Button onClick={handleOpenBulkHabitat} variant="outline" size="sm" className="flex items-center gap-2">
                        <BrainIcon size={18} weight="fill" />
                        AI Enrichment
                      </Button>
                    </div>
                  </div>
                )}
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
                        totalQuestions={15}
                        onAnswer={handleAnswer}
                        isProcessing={isThinking}
                      />
                    )}
                  </AnimatePresence>
                  <Progress value={(answers.length / 15) * 100} className="h-2" />
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
                <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                <TeachingMode
                  answers={answers}
                  existingCharacters={characters || DEFAULT_CHARACTERS}
                  onAddCharacter={handleAddCharacter}
                  onSkip={handleSkipTeaching}
                />
                </Suspense>
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
                <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                <QuestionManager
                  characters={characters || DEFAULT_CHARACTERS}
                  questions={questions || DEFAULT_QUESTIONS}
                  onAddQuestions={handleAddQuestions}
                />
                </Suspense>
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