import { parseUrlChallenge } from "@/lib/sharing";
import type { SharePayload } from "@/lib/sharing";
import type { GameAction, GamePhase } from "@/hooks/useGameState";
import { useEffect, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";

export interface UseAppLifecycleEffectsOptions {
  gamePhase: GamePhase;
  onboardingDone: boolean;
  gamesPlayed: number;
  setShowOnboarding: (show: boolean) => void;
  updateAvailable: boolean;
  reloadForUpdate: () => void;
  navigate: (phase: GamePhase) => void;
  setChallenge: Dispatch<SetStateAction<SharePayload | null>>;
  serverLastError: { message: string; action: "answer" | "skip" } | null;
  clearServerError: () => void;
  showQuitDialog: boolean;
  setShowQuitDialog: (show: boolean) => void;
  dispatch: Dispatch<GameAction>;
  startGame: () => Promise<void>;
}

export function useAppLifecycleEffects(options: UseAppLifecycleEffectsOptions) {
  const {
    gamePhase,
    onboardingDone,
    gamesPlayed,
    setShowOnboarding,
    updateAvailable,
    reloadForUpdate,
    navigate,
    setChallenge,
    serverLastError,
    clearServerError,
    showQuitDialog,
    setShowQuitDialog,
    dispatch,
    startGame,
  } = options;

  useEffect(() => {
    if (gamePhase === "playing" && !onboardingDone && gamesPlayed === 0) {
      setShowOnboarding(true);
    }
  }, [gamePhase, onboardingDone, gamesPlayed, setShowOnboarding]);

  useEffect(() => {
    if (!updateAvailable) return;
    toast("Update available", {
      description: "A new version of Andernator is ready.",
      action: { label: "Reload", onClick: reloadForUpdate },
      duration: Infinity,
    });
  }, [updateAvailable, reloadForUpdate]);

  useEffect(() => {
    const target = document.querySelector<HTMLElement>("[data-phase-focus]");
    if (target) target.focus({ preventScroll: true });
  }, [gamePhase]);

  useEffect(() => {
    const payload = parseUrlChallenge();
    if (payload) {
      setChallenge(payload);
      navigate("challenge");
      globalThis.history.replaceState(
        null,
        "",
        globalThis.location.pathname,
      );
    }
  }, [navigate, setChallenge]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Escape") {
        if (serverLastError) {
          clearServerError();
          e.preventDefault();
          return;
        }
        if (showQuitDialog) {
          setShowQuitDialog(false);
          e.preventDefault();
          return;
        }
        if (gamePhase === "guessing") {
          dispatch({ type: "REJECT_GUESS" });
          e.preventDefault();
        }
        return;
      }

      if ((e.key === "r" || e.key === "R") && gamePhase === "gameOver") {
        e.preventDefault();
        void startGame();
      }
    };
    globalThis.addEventListener("keydown", handler);
    return () => globalThis.removeEventListener("keydown", handler);
    // startGame is intentionally omitted to avoid rebinding listener every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamePhase, serverLastError, showQuitDialog, clearServerError, dispatch, setShowQuitDialog]);
}
