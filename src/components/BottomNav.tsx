import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { GamePhase } from "@/hooks/useGameState";
import {
  ChartBarIcon,
  ClockCounterClockwiseIcon,
  DeviceMobileIcon,
  DotsThreeIcon,
  GearSixIcon,
  HouseIcon,
  MoonIcon,
  SpeakerHighIcon,
  SpeakerSlashIcon,
  SunIcon,
  UsersIcon,
  XIcon,
} from "@phosphor-icons/react";

interface BottomNavProps {
  gamePhase: GamePhase;
  navigate: (phase: GamePhase) => void;
  muted: boolean;
  toggleMute: () => void;
  theme: string | undefined;
  toggleTheme: () => void;
  canInstall: boolean;
  promptInstall: () => Promise<void>;
}

const NAV_PHASES: GamePhase[] = ["welcome", "stats", "history", "compare"];

const MAIN_TABS = [
  { phase: "welcome" as GamePhase, label: "Home", icon: HouseIcon },
  { phase: "stats" as GamePhase, label: "Stats", icon: ChartBarIcon },
  {
    phase: "history" as GamePhase,
    label: "History",
    icon: ClockCounterClockwiseIcon,
  },
] as const;

export function BottomNav({
  gamePhase,
  navigate,
  muted,
  toggleMute,
  theme,
  toggleTheme,
  canInstall,
  promptInstall,
}: Readonly<BottomNavProps>) {
  const [moreOpen, setMoreOpen] = useState(false);

  if (!NAV_PHASES.includes(gamePhase)) return null;

  const isMoreActive = gamePhase === "compare";

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setMoreOpen(false)}
            aria-hidden
          />
        )}
      </AnimatePresence>

      {/* More drawer */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            key="more-drawer"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 z-50 rounded-t-2xl bg-background border-t border-border shadow-2xl lg:hidden"
            style={{
              bottom: "calc(4rem + env(safe-area-inset-bottom))",
            }}
            role="dialog"
            aria-modal="true"
            aria-label="More options"
          >
            <div className="p-4 space-y-1">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  More
                </span>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="touch-target inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                  aria-label="Close menu"
                >
                  <XIcon size={20} />
                </button>
              </div>

              {/* Compare */}
              <button
                onClick={() => {
                  navigate("compare");
                  setMoreOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 min-h-[48px] rounded-xl text-sm font-medium transition-colors ${
                  gamePhase === "compare"
                    ? "bg-accent/20 text-accent"
                    : "hover:bg-muted/60 text-foreground"
                }`}
              >
                <UsersIcon size={20} />
                Compare Characters
              </button>

              {/* Install PWA */}
              {canInstall && (
                <button
                  onClick={() => {
                    void promptInstall();
                    setMoreOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 min-h-[48px] rounded-xl text-sm font-medium hover:bg-muted/60 text-foreground transition-colors"
                >
                  <DeviceMobileIcon size={20} />
                  Add to Home Screen
                </button>
              )}

              {/* Theme toggle */}
              <button
                onClick={() => {
                  toggleTheme();
                  setMoreOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 min-h-[48px] rounded-xl text-sm font-medium hover:bg-muted/60 text-foreground transition-colors"
              >
                {theme === "dark" ? <SunIcon size={20} /> : <MoonIcon size={20} />}
                {theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              </button>

              {/* Mute toggle */}
              <button
                onClick={() => {
                  toggleMute();
                  setMoreOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 min-h-[48px] rounded-xl text-sm font-medium hover:bg-muted/60 text-foreground transition-colors"
              >
                {muted ? (
                  <SpeakerSlashIcon size={20} />
                ) : (
                  <SpeakerHighIcon size={20} />
                )}
                {muted ? "Unmute Sounds" : "Mute Sounds"}
              </button>

              <div className="h-px bg-border/60 my-2" />

              {/* Admin */}
              <a
                href="/admin"
                className="w-full flex items-center gap-3 px-3 min-h-[48px] rounded-xl text-sm font-medium hover:bg-muted/60 text-muted-foreground transition-colors"
                onClick={() => setMoreOpen(false)}
              >
                <GearSixIcon size={20} weight="duotone" />
                Admin Panel
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom nav bar */}
      <nav
        aria-label="Main navigation"
        className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-stretch h-16">
          {MAIN_TABS.map(({ phase, label, icon: Icon }) => {
            const active = gamePhase === phase;
            return (
              <button
                key={phase}
                onClick={() => {
                  setMoreOpen(false);
                  navigate(phase);
                }}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                  active
                    ? "text-accent"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={22} weight={active ? "fill" : "regular"} />
                {label}
                {active && (
                  <span className="absolute bottom-0 h-0.5 w-8 rounded-full bg-accent" />
                )}
              </button>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            aria-label="More options"
            aria-expanded={moreOpen}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
              isMoreActive || moreOpen
                ? "text-accent"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <DotsThreeIcon size={22} weight={isMoreActive || moreOpen ? "fill" : "regular"} />
            More
            {isMoreActive && !moreOpen && (
              <span className="absolute bottom-0 h-0.5 w-8 rounded-full bg-accent" />
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
