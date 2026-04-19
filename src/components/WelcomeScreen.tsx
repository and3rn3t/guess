import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { GamePhase } from "@/hooks/useGameState";
import { DEFAULT_CHARACTERS } from "@/lib/database";
import type {
  Character,
  CharacterCategory,
  Difficulty,
  GameHistoryEntry,
} from "@/lib/types";
import { CATEGORY_LABELS, DIFFICULTIES } from "@/lib/types";
import {
  BrainIcon,
  ChartBarIcon,
  ClipboardTextIcon,
  CloudCheckIcon,
  FlaskIcon,
  GearIcon,
  LightningIcon,
  PlayIcon,
  SparkleIcon,
  TreeStructureIcon,
  WifiSlashIcon,
  WrenchIcon,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";

interface WelcomeScreenProps {
  startGame: () => void;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  selectedCategories: Set<CharacterCategory>;
  toggleCategory: (cat: CharacterCategory) => void;
  activeCharacters: Character[];
  llmMode: boolean;
  setLlmMode: (v: boolean) => void;
  serverMode: boolean;
  setServerMode: (v: boolean) => void;
  serverTotal: number | null;
  online: boolean;
  maxQuestions: number;
  gameHistory: GameHistoryEntry[] | null;
  hasSavedSession: boolean;
  resumeSession: () => void;
  clearSession: () => void;
  showDevTools: boolean;
  navigate: (phase: GamePhase, character?: Character) => void;
  characters: Character[] | null;
}

export function WelcomeScreen({
  startGame,
  difficulty,
  setDifficulty,
  selectedCategories,
  toggleCategory,
  activeCharacters,
  llmMode,
  setLlmMode,
  serverMode,
  setServerMode,
  serverTotal,
  online,
  maxQuestions,
  gameHistory,
  hasSavedSession,
  resumeSession,
  clearSession,
  showDevTools,
  navigate,
  characters,
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
                  {DIFFICULTIES[difficulty].label} · {serverMode ? (serverTotal || "500+") : activeCharacters.length} characters
                </p>
              </div>
            );
          })()}

        {/* Primary CTA for new players */}
        {(!gameHistory || gameHistory.length === 0) && !hasSavedSession && (
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
        <Collapsible defaultOpen={!gameHistory || gameHistory.length === 0}>
          <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-5">
            <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
              <h3 className="text-base font-semibold text-foreground">
                How It Works
              </h3>
              <span className="text-xs text-muted-foreground">
                {gameHistory && gameHistory.length > 0
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

        {/* Game Settings — consolidated single card */}
        <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-5 space-y-5">
          {/* Difficulty */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Difficulty</h4>
            <div className="flex gap-2">
              {(
                Object.entries(DIFFICULTIES) as [
                  Difficulty,
                  (typeof DIFFICULTIES)[Difficulty],
                ][]
              ).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setDifficulty(key)}
                  className={`flex-1 px-3 py-3 rounded-lg border text-sm font-medium transition-colors ${
                    difficulty === key
                      ? "bg-accent text-accent-foreground border-accent"
                      : "bg-card border-border hover:bg-accent/10"
                  }`}
                >
                  {cfg.label}
                  <span className="block text-[11px] opacity-70">
                    {cfg.maxQuestions} Qs
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-border/50" />

          {/* Categories */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">Categories</h4>
              <span className="text-xs text-muted-foreground">
                {selectedCategories.size === 0
                  ? "All"
                  : selectedCategories.size}{" "}
                selected · {activeCharacters.length} characters
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                Object.entries(CATEGORY_LABELS) as [
                  CharacterCategory,
                  string,
                ][]
              ).map(([key, label]) => {
                const count = (characters || DEFAULT_CHARACTERS).filter(
                  (c) => c.category === key,
                ).length;
                const isSelected = selectedCategories.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleCategory(key)}
                    className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      isSelected
                        ? "bg-accent text-accent-foreground border-accent"
                        : "bg-card border-border hover:bg-accent/10"
                    }`}
                  >
                    {label}
                    <span className="ml-1 opacity-60">{count}</span>
                  </button>
                );
              })}
            </div>
            {activeCharacters.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                e.g.{" "}
                {activeCharacters
                  .slice(0, 4)
                  .map((c) => c.name)
                  .join(", ")}
                {activeCharacters.length > 4 && ` + ${activeCharacters.length - 4} more`}
              </p>
            )}
          </div>

          <div className="border-t border-border/50" />

          {/* AI Mode */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BrainIcon size={18} weight="fill" className="text-accent" />
              <span className="text-sm font-medium text-foreground">AI-Enhanced Mode</span>
            </div>
            <button
              onClick={() => setLlmMode(!llmMode)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                llmMode ? "bg-accent" : "bg-muted"
              }`}
              role="switch"
              aria-checked={llmMode}
              aria-label="Toggle AI-Enhanced Mode"
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform ${
                  llmMode ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          {llmMode && (
            <p
              className={`text-xs -mt-3 ${online ? "text-accent" : "text-destructive"}`}
            >
              {online ? (
                "✨ Dynamic questions & narrative explanations"
              ) : (
                <span className="flex items-center gap-1">
                  <WifiSlashIcon size={14} weight="bold" />
                  Offline — AI features unavailable
                </span>
              )}
            </p>
          )}

          <div className="border-t border-border/50" />

          {/* Server Mode */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CloudCheckIcon size={18} className="text-accent" />
              <span className="text-sm font-medium text-foreground">Server Mode</span>
            </div>
            <button
              onClick={() => setServerMode(!serverMode)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                serverMode ? "bg-accent" : "bg-muted"
              }`}
              role="switch"
              aria-checked={serverMode}
              aria-label="Toggle Server Mode"
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform ${
                  serverMode ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          {serverMode && (
            <p
              className={`text-xs -mt-3 ${online ? "text-accent" : "text-destructive"}`}
            >
              {online ? (
                "🌐 Play against the full character database on the server"
              ) : (
                <span className="flex items-center gap-1">
                  <WifiSlashIcon size={14} weight="bold" />
                  Offline — server mode unavailable
                </span>
              )}
            </p>
          )}
        </div>

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
            {serverMode ? (serverTotal || "500+") : activeCharacters.length} characters · {maxQuestions}{" "}
            questions · {DIFFICULTIES[difficulty].label}
            {serverMode && " · Server"}
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
