import { Button } from "@/components/ui/button";
import type { GameAction, GamePhase } from "@/hooks/useGameState";
import type { Answer, Question } from "@/lib/types";
import type { SyncStatus } from "@/lib/sync";
import {
  ArrowLeftIcon,
  CloudArrowUpIcon,
  CloudCheckIcon,
  CloudSlashIcon,
  CloudXIcon,
  ClockCounterClockwiseIcon,
  ChartBarIcon,
  HouseIcon,
  MoonIcon,
  SpeakerHighIcon,
  SpeakerSlashIcon,
  SparkleIcon,
  SunIcon,
  UsersIcon,
  WrenchIcon,
} from "@phosphor-icons/react";
import { memo } from "react";

const analytics = () => import("@/lib/analytics");

const INSIGHT_TABS = [
  { phase: "stats" as const, label: "Stats", icon: ChartBarIcon },
  {
    phase: "history" as const,
    label: "History",
    icon: ClockCounterClockwiseIcon,
  },
  { phase: "compare" as const, label: "Compare", icon: UsersIcon },
] as const;

interface AppHeaderProps {
  gamePhase: GamePhase;
  navigate: (phase: GamePhase) => void;
  dispatch: React.Dispatch<GameAction>;
  answers: Answer[];
  currentQuestion: Question | null;
  maxQuestions: number;
  syncStatus: SyncStatus;
  muted: boolean;
  toggleMute: () => void;
  theme: string | undefined;
  toggleTheme: () => void;
  setShowQuitDialog: (show: boolean) => void;
}

function AppHeaderBase({
  gamePhase,
  navigate,
  dispatch,
  answers,
  currentQuestion,
  maxQuestions,
  syncStatus,
  muted,
  toggleMute,
  theme,
  toggleTheme,
  setShowQuitDialog,
}: Readonly<AppHeaderProps>) {
  return (
    <header
      aria-label="Game navigation"
      className="border-b border-border/50 backdrop-blur-sm bg-background/80"
    >
      <div className="container mx-auto px-4 py-4 md:py-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              if (gamePhase === "playing") {
                setShowQuitDialog(true);
              } else {
                navigate("welcome");
              }
            }}
            className="flex items-center gap-2 md:gap-3 hover:opacity-80 transition-opacity"
          >
            <SparkleIcon
              size={32}
              weight="fill"
              className="text-accent md:w-10 md:h-10"
            />
            <h1 className="text-2xl md:text-4xl font-bold text-foreground tracking-tight">
              Andernator
            </h1>
          </button>
          <div className="flex items-center gap-1 sm:gap-1.5 md:gap-3">
            {/* Welcome phase: Stats, History, Compare, Dev Tools */}
            {gamePhase === "welcome" && (
              <>
                <Button
                  onClick={() => {
                    analytics().then((m) => m.trackFeatureUse("stats"));
                    navigate("stats");
                  }}
                  variant="outline"
                  size="sm"
                  aria-label="Statistics"
                  className="flex items-center gap-2 bg-accent/10 hover:bg-accent/20 border-accent/30 touch-target"
                >
                  <ChartBarIcon size={20} />
                  <span className="hidden sm:inline" aria-hidden="true">Statistics</span>
                </Button>
                <Button
                  onClick={() => {
                    analytics().then((m) => m.trackFeatureUse("history"));
                    navigate("history");
                  }}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 touch-target"
                >
                  <ClockCounterClockwiseIcon size={20} />
                  <span className="hidden sm:inline">History</span>
                </Button>
                <Button
                  onClick={() => {
                    analytics().then((m) => m.trackFeatureUse("compare"));
                    navigate("compare");
                  }}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 touch-target"
                >
                  <UsersIcon size={20} />
                  <span className="hidden sm:inline">Compare</span>
                </Button>
                {import.meta.env.DEV && (
                  <Button
                    onClick={() => dispatch({ type: "TOGGLE_DEV_TOOLS" })}
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

            {/* Playing phase: question counter badge + quit button */}
            {gamePhase === "playing" && (
              <>
                <span className="inline-flex items-center rounded-full bg-accent/20 px-3 py-1 text-sm font-medium text-accent">
                  Q{answers.length + (currentQuestion ? 1 : 0)}/{maxQuestions}
                </span>
                <button
                  onClick={() => setShowQuitDialog(true)}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors touch-target px-2 rounded-md"
                >
                  <ArrowLeftIcon size={18} />
                  Quit
                </button>
              </>
            )}

            {/* GameOver / Teaching phase: Home button */}
            {(gamePhase === "gameOver" ||
              gamePhase === "teaching" ||
              gamePhase === "guessing") && (
              <Button
                onClick={() => navigate("welcome")}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 touch-target"
              >
                <HouseIcon size={20} />
                <span className="hidden sm:inline">Home</span>
              </Button>
            )}

            {/* Stats / History / Compare: cross-navigation tabs + Home */}
            {(gamePhase === "stats" ||
              gamePhase === "history" ||
              gamePhase === "compare") && (
              <>
                {INSIGHT_TABS.map((tab) => (
                  <Button
                    key={tab.phase}
                    onClick={() => navigate(tab.phase)}
                    variant={gamePhase === tab.phase ? "default" : "outline"}
                    size="sm"
                    className={`flex items-center gap-2 touch-target ${gamePhase === tab.phase ? "bg-accent text-accent-foreground" : ""}`}
                  >
                    <tab.icon size={18} />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </Button>
                ))}
                <Button
                  onClick={() => navigate("welcome")}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 touch-target"
                >
                  <HouseIcon size={20} />
                  <span className="hidden sm:inline">Home</span>
                </Button>
              </>
            )}

            <span
              className="text-muted-foreground inline-flex items-center justify-center touch-target"
              title={`Sync: ${syncStatus}`}
              aria-label={`Sync status: ${syncStatus}`}
            >
              {syncStatus === "synced" && (
                <CloudCheckIcon size={20} className="text-green-400" />
              )}
              {syncStatus === "pending" && (
                <CloudArrowUpIcon
                  size={20}
                  className="text-yellow-400 animate-pulse"
                />
              )}
              {syncStatus === "error" && (
                <CloudXIcon size={20} className="text-red-400" />
              )}
              {syncStatus === "offline" && (
                <CloudSlashIcon size={20} className="text-muted-foreground" />
              )}
            </span>
            <Button
              onClick={toggleMute}
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground touch-target"
              title={muted ? "Unmute sounds" : "Mute sounds"}
              aria-label={muted ? "Unmute sounds" : "Mute sounds"}
            >
              {muted ? (
                <SpeakerSlashIcon size={22} />
              ) : (
                <SpeakerHighIcon size={22} />
              )}
            </Button>
            <Button
              onClick={toggleTheme}
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground touch-target"
              title={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              aria-label={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
            >
              {theme === "dark" ? (
                <SunIcon size={22} />
              ) : (
                <MoonIcon size={22} />
              )}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

export const AppHeader = memo(AppHeaderBase);
