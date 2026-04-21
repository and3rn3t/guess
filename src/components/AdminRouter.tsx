import { AttributeCoverageReport } from "@/components/AttributeCoverageReport";
import { AttributeRecommender } from "@/components/AttributeRecommender";
import { CategoryRecommender } from "@/components/CategoryRecommender";
import { CostDashboard } from "@/components/CostDashboard";
import { DataHygiene } from "@/components/DataHygiene";
import { EnvironmentTest } from "@/components/EnvironmentTest";
import { MultiCategoryEnhancer } from "@/components/MultiCategoryEnhancer";
import { QuestionGeneratorDemo } from "@/components/QuestionGeneratorDemo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { GamePhase } from "@/hooks/useGameState";
import { DEFAULT_CHARACTERS, DEFAULT_QUESTIONS } from "@/lib/database";
import type { SharePayload } from "@/lib/sharing";
import type { Character, Question } from "@/lib/types";
import { PlayIcon, SparkleIcon } from "@phosphor-icons/react";
import { Suspense } from "react";
import { Toaster } from "sonner";

const ANSWER_EMOJI: Record<string, string> = {
  yes: "🟢",
  no: "🔴",
  maybe: "🟡",
};

interface AdminRouterProps {
  gamePhase: GamePhase;
  characters: Character[] | null;
  questions: Question[] | null;
  selectedCharacter: Character | null;
  challenge: SharePayload | null;
  navigate: (phase: "welcome") => void;
  handleUpdateCharacter: (c: Character) => void;
  handleUpdateCharacters: (c: Character[]) => void;
  handleUpdateQuestion: (q: Question) => void;
  setChallenge: (v: null) => void;
}

function wrap(children: React.ReactNode, maxW?: string) {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {maxW ? <div className={maxW}>{children}</div> : children}
      </div>
    </div>
  );
}

export function AdminRouter({
  gamePhase,
  characters,
  questions,
  selectedCharacter,
  challenge,
  navigate,
  handleUpdateCharacter,
  handleUpdateCharacters,
  handleUpdateQuestion,
  setChallenge,
}: Readonly<AdminRouterProps>): React.JSX.Element | null {
  const onBack = () => navigate("welcome");
  const allChars = characters || DEFAULT_CHARACTERS;
  const allQuestions = questions || DEFAULT_QUESTIONS;

  switch (gamePhase) {
    case "bulkHabitat":
      return wrap(
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <MultiCategoryEnhancer
            characters={allChars}
            onUpdateCharacters={handleUpdateCharacters}
            onBack={onBack}
          />
        </Suspense>,
      );
    case "demo":
      return (
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <QuestionGeneratorDemo onBack={onBack} />
        </Suspense>
      );
    case "environmentTest":
      if (!selectedCharacter) return null;
      return wrap(
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <EnvironmentTest
            character={selectedCharacter}
            onUpdateCharacter={handleUpdateCharacter}
            onBack={onBack}
          />
        </Suspense>,
      );
    case "coverage":
      return wrap(
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <AttributeCoverageReport characters={allChars} onBack={onBack} />
        </Suspense>,
      );
    case "categoryRecommender":
      if (!selectedCharacter) return null;
      return wrap(
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <CategoryRecommender
            character={selectedCharacter}
            onUpdateCharacter={handleUpdateCharacter}
            onBack={onBack}
          />
        </Suspense>,
      );
    case "recommender":
      if (!selectedCharacter) return null;
      return wrap(
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <AttributeRecommender
            character={selectedCharacter}
            onUpdateCharacter={handleUpdateCharacter}
            onBack={onBack}
          />
        </Suspense>,
      );
    case "costDashboard":
      return wrap(
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <CostDashboard onBack={onBack} />
        </Suspense>,
        "max-w-4xl mx-auto",
      );
    case "dataHygiene":
      return wrap(
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <DataHygiene
            characters={allChars}
            questions={allQuestions}
            onUpdateCharacter={handleUpdateCharacter}
            onUpdateQuestion={handleUpdateQuestion}
            onBack={onBack}
          />
        </Suspense>,
        "max-w-4xl mx-auto",
      );
    case "challenge": {
      if (!challenge) return null;
      const answerBar = challenge.steps
        .map((s) => ANSWER_EMOJI[s.answer] ?? "⚪")
        .join("");
      return (
        <>
          <Toaster position="top-center" richColors />
          <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="max-w-md w-full space-y-6 text-center">
              <SparkleIcon
                size={64}
                weight="fill"
                className="mx-auto text-accent animate-float"
              />
              <h1 className="text-3xl font-bold text-foreground">Challenge!</h1>
              <p className="text-muted-foreground text-lg">
                {challenge.won
                  ? `Andernator figured out ${challenge.characterName} in ${challenge.questionCount} questions!`
                  : `Someone stumped Andernator thinking of ${challenge.characterName}!`}
              </p>
              <div className="text-2xl tracking-wider">{answerBar}</div>
              <div className="flex flex-wrap gap-2 justify-center">
                <span className="inline-flex items-center rounded-full bg-accent/20 px-3 py-1 text-sm font-medium text-accent">
                  {challenge.difficulty.charAt(0).toUpperCase() +
                    challenge.difficulty.slice(1)}
                </span>
                <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
                  {challenge.questionCount} questions
                </span>
              </div>
              <p className="text-foreground font-semibold text-lg">
                Can you do better?
              </p>
              <Button
                onClick={() => {
                  setChallenge(null);
                  navigate("welcome");
                }}
                size="lg"
                className="h-14 px-8 text-lg bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20 hover:scale-105 transition-transform"
              >
                <PlayIcon size={24} weight="fill" className="mr-2" />
                Play Now
              </Button>
            </div>
          </div>
        </>
      );
    }
    default:
      return null;
  }
}
