import { Button } from "@/components/ui/button";
import { PersonaSelector } from "@/components/PersonaSelector";
import { WeeklyRecapCard } from "@/components/WeeklyRecapCard";
import type { GamePhase } from "@/hooks/useGameState";
import type { GlobalStats } from "@/hooks/useGlobalStats";
import type { Achievement } from "@/hooks/useAchievements";
import type { WeeklyRecap } from "@/hooks/useWeeklyRecap";
import type {
  Character,
  CharacterCategory,
} from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import type { Difficulty } from "@/lib/types";
import {
  BrainIcon,
  ChartBarIcon,
  ClipboardTextIcon,
  FireSimpleIcon,
  FlaskIcon,
  GearIcon,
  PlayIcon,
  SparkleIcon,
  TreeStructureIcon,
  WrenchIcon,
} from "@phosphor-icons/react";

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
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  categories: CharacterCategory[];
  setCategories: (c: CharacterCategory[]) => void;
  streak: number;
  personalBest?: number | null;
  achievements?: Achievement[];
  weeklyRecap?: WeeklyRecap | null;
}

export function WelcomeScreen({
  startGame,
  serverTotal,
  online: _online,
  maxQuestions,
  gameHistory,
  gamesPlayed: _gamesPlayed,
  hasSavedSession,
  resumeSession,
  clearSession,
  showDevTools,
  navigate,
  characters: _characters,
  globalStats,
  difficulty,
  setDifficulty,
  categories,
  setCategories,
  streak,
  personalBest = null,
  achievements = [],
  weeklyRecap = null,
}: Readonly<WelcomeScreenProps>) {
  const filteredTotal =
    categories.length === 0
      ? null
      : globalStats?.byCategory
          ?.filter((c) => categories.includes(c.category as CharacterCategory))
          .reduce((sum, c) => sum + c.count, 0) ?? null;

  return (
    <>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Hero */}
        <div className="text-center space-y-3">
          <SparkleIcon
            size={64}
            weight="fill"
            className="mx-auto text-accent animate-float"
          />
          <h2
            data-phase-focus
            tabIndex={-1}
            className="text-3xl md:text-4xl font-bold text-foreground focus:outline-none"
          >
            Think of a Character
          </h2>
          <p className="text-base text-muted-foreground max-w-md mx-auto">
            I'll ask strategic questions and try to guess who you're
            thinking of.
          </p>
          {streak >= 2 && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent text-sm font-semibold mx-auto">
              <FireSimpleIcon size={16} weight="fill" />
              {streak}-day streak
            </div>
          )}
          {personalBest !== null && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-sm font-medium mx-auto">
              🏆 Best: {personalBest}q
            </div>
          )}
          {achievements.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-1" aria-label="Achievements">
              {achievements.map((a) => (
                <span
                  key={a.id}
                  title={a.description}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary/60 border border-border/60 text-xs font-medium text-foreground/80 cursor-default select-none"
                >
                  <span aria-hidden="true">{a.emoji}</span>
                  {a.label}
                </span>
              ))}
            </div>
          )}
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
              <Button onClick={clearSession} variant="outline">
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {/* Detective persona / difficulty */}
        <PersonaSelector difficulty={difficulty} setDifficulty={setDifficulty} />

        {/* Weekly recap card — shown on Mondays only */}
        {weeklyRecap && <WeeklyRecapCard recap={weeklyRecap} />}

        {/* Category filter chips */}
        <div
          className="flex flex-wrap justify-center gap-1.5"
          role="group"
          aria-label="Filter by category"
        >
          {(Object.entries(CATEGORY_LABELS) as [CharacterCategory, string][]).map(([key, label]) => {
            const active = categories.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() =>
                  setCategories(
                    active
                      ? categories.filter((c) => c !== key)
                      : [...categories, key],
                  )
                }
                aria-pressed={active}
                className={`px-3 py-2 min-h-[44px] rounded-full text-xs font-medium border transition-all inline-flex items-center ${
                  active
                    ? "bg-accent text-accent-foreground border-accent shadow-sm"
                    : "bg-card/50 text-muted-foreground border-border/60 hover:border-accent/50 hover:text-foreground"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Primary CTA */}
        <div className="text-center space-y-2">
          <Button
            onClick={startGame}
            size="lg"
            className="h-12 px-8 text-lg bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20 hover:scale-105 transition-transform"
          >
            <PlayIcon size={24} weight="fill" className="mr-2" />
            Start Game
          </Button>

          <Button
            onClick={() => navigate("describeYourself")}
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground text-xs touch-target"
          >
            Or: which character are <em>you</em>? →
          </Button>

          <p className="text-xs text-muted-foreground">
            {filteredTotal != null ? (
              <>
                <span className="text-accent font-medium">
                  ~{filteredTotal}
                </span>{" "}
                of {serverTotal || "500+"} characters
              </>
            ) : (
              <>{serverTotal || "500+"} characters</>
            )}{" "}
            · {maxQuestions} questions
            {globalStats?.gameStats &&
              globalStats.gameStats.totalGames >= 10 && (
                <>
                  {" "}
                  · AI wins{" "}
                  <strong>
                    {Math.round(globalStats.gameStats.winRate)}%
                  </strong>{" "}
                  of{" "}
                  {globalStats.gameStats.totalGames.toLocaleString()}{" "}
                  games
                </>
              )}
          </p>

          {gameHistory && gameHistory.length > 0 && !hasSavedSession && (() => {
            const last = gameHistory[gameHistory.length - 1];
            return (
              <p className="text-xs text-muted-foreground/60">
                Last: {last.won ? "Won" : "Lost"} in {last.steps.length}{" "}
                Qs — {last.characterName}
              </p>
            );
          })()}
        </div>

        {import.meta.env.DEV && showDevTools && (
          <div className="border-2 border-dashed border-yellow-500/30 rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-yellow-500 flex items-center gap-2">
              <WrenchIcon size={24} />
              Developer Tools
            </h3>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => { window.location.href = '/admin/coverage' }}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <ClipboardTextIcon size={18} />
                Coverage Report
              </Button>
              <Button
                onClick={() => { window.location.href = '/admin/demo' }}
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
                onClick={() => { window.location.href = '/admin/env' }}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <TreeStructureIcon size={18} />
                Test Environment
              </Button>
              <Button
                onClick={() => { window.location.href = '/admin/bulk-habitat' }}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <BrainIcon size={18} weight="fill" />
                AI Enrichment
              </Button>
              <Button
                onClick={() => { window.location.href = '/admin/cost' }}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <ChartBarIcon size={18} />
                Cost Dashboard
              </Button>
              <Button
                onClick={() => { window.location.href = '/admin/hygiene' }}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <WrenchIcon size={18} />
                Data Hygiene
              </Button>
              <Button
                onClick={() => { window.location.href = '/admin' }}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <WrenchIcon size={18} />
                Admin Panel
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
