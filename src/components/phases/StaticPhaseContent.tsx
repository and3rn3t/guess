import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGameContext } from "@/contexts/GameContext";
import type { GamePhase } from "@/hooks/useGameState";
import { DEFAULT_CHARACTERS, DEFAULT_QUESTIONS } from "@/lib/database";
import { lazy, Suspense } from "react";

const TeachingMode = lazy(() =>
  import("@/components/TeachingMode").then((m) => ({ default: m.TeachingMode })),
);
const DescribeYourselfScreen = lazy(() =>
  import("@/components/DescribeYourselfScreen").then((m) => ({
    default: m.DescribeYourselfScreen,
  })),
);
const QuestionManager = lazy(() =>
  import("@/components/QuestionManager").then((m) => ({
    default: m.QuestionManager,
  })),
);
const StatsDashboard = lazy(() =>
  import("@/components/StatsDashboard").then((m) => ({
    default: m.StatsDashboard,
  })),
);
const CharacterComparison = lazy(() =>
  import("@/components/CharacterComparison").then((m) => ({
    default: m.CharacterComparison,
  })),
);
const GameHistory = lazy(() =>
  import("@/components/GameHistory").then((m) => ({ default: m.GameHistory })),
);

interface Props {
  phase: GamePhase;
}

/**
 * Renders the static (non-animated) phase content for a given game phase.
 * Reads all needed values from GameContext directly. Returns null for
 * phases that are handled by the animated manifest in GamePhaseRouter.
 */
export function StaticPhaseContent({ phase }: Props) {
  const {
    game: { answers },
    navigate,
    characters,
    questions,
    activeCharacters,
    persona,
    globalStats,
    gameHistory,
    statsLoading,
    startGame,
    handleAddCharacter,
    handleAddQuestions,
  } = useGameContext();

  switch (phase) {
    case "teaching":
      return (
        <div className="max-w-2xl mx-auto">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <TeachingMode
              answers={answers}
              existingCharacters={characters || DEFAULT_CHARACTERS}
              onAddCharacter={handleAddCharacter}
              onAddQuestions={handleAddQuestions}
              onPlayAgain={() => void startGame()}
              onGoHome={() => navigate("welcome")}
            />
          </Suspense>
        </div>
      );

    case "describeYourself":
      return (
        <div className="max-w-xl mx-auto">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <DescribeYourselfScreen
              questions={questions || DEFAULT_QUESTIONS}
              characters={activeCharacters}
              persona={persona}
              onClose={() => navigate("welcome")}
            />
          </Suspense>
        </div>
      );

    case "manage":
      return (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-foreground">
                Question Pool Manager
              </h2>
              <p className="text-muted-foreground mt-1">
                Generate new questions from user-taught characters
              </p>
            </div>
            <Button onClick={() => navigate("welcome")} variant="outline">
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
                <div className="text-sm text-muted-foreground">
                  Total Characters
                </div>
              </div>
              <div className="bg-background/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-accent">
                  {(questions || DEFAULT_QUESTIONS).length}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Questions
                </div>
              </div>
              <div className="bg-background/50 rounded-lg p-4">
                <div className="text-2xl font-bold text-accent">
                  {
                    (characters || DEFAULT_CHARACTERS).filter((c) =>
                      c.id.startsWith("char-"),
                    ).length
                  }
                </div>
                <div className="text-sm text-muted-foreground">
                  User-Taught
                </div>
              </div>
            </div>
          </div>
        </div>
      );

    case "stats":
      return (
        <div className="max-w-4xl mx-auto">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <StatsDashboard
              stats={globalStats}
              loading={statsLoading}
              onBack={() => navigate("welcome")}
            />
          </Suspense>
        </div>
      );

    case "history":
      return (
        <div className="max-w-4xl mx-auto">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <GameHistory
              history={gameHistory}
              loading={statsLoading}
              onBack={() => navigate("welcome")}
            />
          </Suspense>
        </div>
      );

    case "compare":
      return (
        <div className="max-w-4xl mx-auto">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <CharacterComparison
              characters={characters || DEFAULT_CHARACTERS}
              onBack={() => navigate("welcome")}
            />
          </Suspense>
        </div>
      );

    default:
      return null;
  }
}
