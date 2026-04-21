import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { GamePhase } from "@/hooks/useGameState";
import type { GlobalStats } from "@/hooks/useGlobalStats";
import type { DailyChallengeStatus } from "@/hooks/useDailyChallenge";
import { DEFAULT_CHARACTERS } from "@/lib/database";
import type {
  Character,
} from "@/lib/types";
import {
  BrainIcon,
  CalendarBlankIcon,
  ChartBarIcon,
  ClipboardTextIcon,
  FlaskIcon,
  GearIcon,
  LightningIcon,
  PlayIcon,
  SparkleIcon,
  TreeStructureIcon,
  WrenchIcon,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";

interface WelcomeScreenProps {
  startGame: () => void;
  serverTotal: number | null;
  online: boolean;
  maxQuestions: number;
  gameHistory: Array<{ won: boolean; characterName: string; steps: unknown[] }> | null;
  gamesPlayed: number;
  hasSavedSession: boolean;
  resumeSession: () => void;
  clearSession: () => void;
  showDevTools: boolean;
  navigate: (phase: GamePhase, character?: Character) => void;
  characters: Character[] | null;
  globalStats: GlobalStats | null;
  dailyStatus: DailyChallengeStatus | null;
  startDailyChallenge: () => void;
}

export function WelcomeScreen({
  startGame,
  serverTotal,
  online: _online,
  maxQuestions,
  gameHistory,
  gamesPlayed,
  hasSavedSession,
  resumeSession,
  clearSession,
  showDevTools,
  navigate,
  characters,
  globalStats,
  dailyStatus,
  startDailyChallenge,
}: Readonly<WelcomeScreenProps>) {
  return (
    <motion.div
      key="welcome"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Hero */}
        <div className="text-center space-y-3">
          <SparkleIcon
            size={64}
            weight="fill"
            className="mx-auto text-accent animate-float"
          />
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            Think of a Character
          </h2>
          <p className="text-base text-muted-foreground max-w-md mx-auto">
            I'll ask strategic questions and try to guess who you're
            thinking of.
          </p>
        </div>

        {/* Daily Challenge */}
        {dailyStatus && !hasSavedSession && (
          <div className={`rounded-xl p-4 border flex items-center justify-between gap-4 ${dailyStatus.completed ? 'bg-secondary/30 border-border/50' : 'bg-accent/10 border-accent/40'}`}>
            <div className="min-w-0">
              <p className="font-semibold text-foreground flex items-center gap-2">
                <CalendarBlankIcon size={18} weight="fill" className="text-accent shrink-0" />
                Daily Challenge
              </p>
              {dailyStatus.completed ? (
                <p className="text-sm text-muted-foreground">
                  {dailyStatus.won ? '✅' : '❌'} {dailyStatus.characterName} &middot; {dailyStatus.questionsAsked ?? '?'} questions
                </p>
              ) : (
                <p className="text-sm text-muted-foreground truncate">
                  Everyone's thinking of the same character today
                </p>
              )}
            </div>
            {!dailyStatus.completed && (
              <Button
                onClick={startDailyChallenge}
                className="shrink-0 bg-accent hover:bg-accent/90 text-accent-foreground"
                size="sm"
              >
                Play
              </Button>
            )}
          </div>
        )}

        {/* Resume saved session */}
        {hasSavedSession && (
          <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">
                Resume your game?
              </p>
              <p className="text-sm text-muted-foreground">
                You have an unfinished game in progress
              </p>
            </div>
            <div className="flex gap-2 ml-4 shrink-0">
              <Button
                onClick={resumeSession}
                className="bg-accent hover:bg-accent/90"
              >
                Resume
              </Button>
              <Button
                onClick={clearSession}
                variant="outline"
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {/* Last game + Quick Play for returning players */}
        {gameHistory &&
          gameHistory.length > 0 &&
          !hasSavedSession &&
          (() => {
            const last = gameHistory[gameHistory.length - 1];
            return (
              <div className="space-y-3">
                <Button
                  onClick={startGame}
                  size="lg"
                  className="w-full h-14 text-lg gap-3 bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20 hover:scale-[1.02] transition-transform"
                >
                  <LightningIcon size={22} weight="fill" />
                  Quick Play
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Last: {last.won ? "Won" : "Lost"} in{" "}
                  {last.steps.length} Qs — {last.characterName}
                  {" · "}
                  {serverTotal || "500+"} characters
                </p>
              </div>
            );
          })()}

        {/* Primary CTA for new players */}
        {gamesPlayed === 0 && !hasSavedSession && (
          <div className="text-center">
            <Button
              onClick={startGame}
              size="lg"
              className="h-14 px-8 text-xl bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20 hover:scale-105 transition-transform"
            >
              <PlayIcon size={28} weight="fill" className="mr-3" />
              Start Game
            </Button>
          </div>
        )}

        {/* How It Works — expanded for new users, collapsed for returning */}
        <Collapsible defaultOpen={gamesPlayed === 0}>
          <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-5">
            <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
              <h3 className="text-base font-semibold text-foreground">
                How It Works
              </h3>
              <span className="text-xs text-muted-foreground">
                {gamesPlayed > 0
                  ? "Tap to expand"
                  : ""}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-3 text-foreground/90">
              {[
                ["1", "Strategic Questioning", "I ask questions that split possibilities optimally."],
                ["2", "Real-Time Reasoning", "See exactly why I chose each question."],
                ["3", "Confidence Building", "Watch my confidence grow until the final guess!"],
              ].map(([num, title, desc]) => (
                <div key={num} className="flex gap-3 items-start">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold">
                    {num}
                  </div>
                  <div>
                    <span className="font-medium text-sm">{title}</span>
                    <span className="text-sm text-muted-foreground ml-1">— {desc}</span>
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Bottom CTA */}
        <div className="text-center space-y-2">
          <Button
            onClick={startGame}
            size="lg"
            className="h-12 px-8 text-lg bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20 hover:scale-105 transition-transform"
          >
            <PlayIcon size={24} weight="fill" className="mr-2" />
            Start Game
          </Button>
          <p className="text-xs text-muted-foreground">
            {serverTotal || "500+"} characters · {maxQuestions} questions
            {globalStats?.gameStats && globalStats.gameStats.totalGames >= 10 && (
              <> · AI wins <strong>{Math.round(globalStats.gameStats.winRate)}%</strong> of {globalStats.gameStats.totalGames.toLocaleString()} games</>
            )}
          </p>
        </div>

        {import.meta.env.DEV && showDevTools && (
          <div className="border-2 border-dashed border-yellow-500/30 rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-yellow-500 flex items-center gap-2">
              <WrenchIcon size={24} />
              Developer Tools
            </h3>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => navigate("coverage")}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <ClipboardTextIcon size={18} />
                Coverage Report
              </Button>
              <Button
                onClick={() => navigate("demo")}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <FlaskIcon size={18} />
                Test Generator
              </Button>
              <Button
                onClick={() => navigate("manage")}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <GearIcon size={18} />
                Manage Questions
              </Button>
              <Button
                onClick={() => {
                  const spongebob = (
                    characters || DEFAULT_CHARACTERS
                  ).find((c) => c.id === "spongebob");
                  if (spongebob) navigate("environmentTest", spongebob);
                }}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <TreeStructureIcon size={18} />
                Test Environment
              </Button>
              <Button
                onClick={() => navigate("bulkHabitat")}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <BrainIcon size={18} weight="fill" />
                AI Enrichment
              </Button>
              <Button
                onClick={() => navigate("costDashboard")}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <ChartBarIcon size={18} />
                Cost Dashboard
              </Button>
              <Button
                onClick={() => navigate("dataHygiene")}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <WrenchIcon size={18} />
                Data Hygiene
              </Button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
