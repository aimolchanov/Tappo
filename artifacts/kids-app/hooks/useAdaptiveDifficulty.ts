import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

import { THRESHOLDS, type DiffLevel } from "@/constants/difficulty";

// ─── Persisted state ──────────────────────────────────────────────────────────
interface AdaptiveState {
  adaptiveLevel: DiffLevel;
  hardRun: number;       // consecutive "too hard" signals
  easyRun: number;       // consecutive "too easy" signals
  sessionCount: number;  // total signals ever received
  lastAdjustAt: number;  // sessionCount value when level last changed
}

const KEY = "@kidsapp_difficulty_v1";

const DEFAULTS: AdaptiveState = {
  adaptiveLevel: 2,  // start at middle level
  hardRun: 0,
  easyRun: 0,
  sessionCount: 0,
  lastAdjustAt: 0,
};

// ─── Signal type ──────────────────────────────────────────────────────────────
export interface DifficultySignal {
  /** Which screen produced this signal */
  screen: "puzzle" | "coloring" | "matching";
  /** How long the session lasted in ms */
  durationMs: number;
  /** Number of taps/drops that missed any target */
  missCount: number;
  /** Number of successful interactions (region taps / piece snaps) */
  hitCount: number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAdaptiveDifficulty() {
  const [state, setState] = useState<AdaptiveState>(DEFAULTS);

  // Load from storage on mount
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((json) => {
        if (json) {
          try {
            setState({ ...DEFAULTS, ...JSON.parse(json) });
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  const persist = useCallback((s: AdaptiveState) => {
    AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});
  }, []);

  /**
   * Reset adaptive state (called when parent switches to manual mode or
   * chooses a specific age group).
   */
  const resetAdaptive = useCallback(() => {
    const fresh = { ...DEFAULTS };
    setState(fresh);
    persist(fresh);
  }, [persist]);

  /**
   * Record a completed-task signal and potentially adjust the level.
   * This is the only external write; screens call it after each session.
   */
  const recordSignal = useCallback(
    (signal: DifficultySignal) => {
      setState((prev) => {
        // ── 1. Classify signal ──────────────────────────────────────────────
        const totalTaps = signal.missCount + signal.hitCount;
        const missRatio = totalTaps > 0 ? signal.missCount / totalTaps : 0;

        let verdict: "hard" | "easy" | "neutral";

        if (signal.screen === "puzzle") {
          const tooHard =
            signal.durationMs > THRESHOLDS.puzzle.hardMs ||
            missRatio > THRESHOLDS.puzzle.missRatioHard;
          const tooEasy =
            signal.durationMs < THRESHOLDS.puzzle.easyMs &&
            signal.missCount === 0;
          verdict = tooHard ? "hard" : tooEasy ? "easy" : "neutral";
        } else if (signal.screen === "matching") {
          const tooHard = missRatio > THRESHOLDS.matching.missRatioHard;
          const tooEasy =
            signal.hitCount > 0 &&
            signal.missCount === 0 &&
            signal.durationMs < THRESHOLDS.matching.easyMs;
          verdict = tooHard ? "hard" : tooEasy ? "easy" : "neutral";
        } else {
          const tooHard = missRatio > THRESHOLDS.coloring.missRatioHard;
          const tooEasy =
            signal.hitCount > 0 &&
            signal.missCount === 0 &&
            signal.durationMs < THRESHOLDS.coloring.easyMs;
          verdict = tooHard ? "hard" : tooEasy ? "easy" : "neutral";
        }

        // ── 2. Update run counters ──────────────────────────────────────────
        const newSession = prev.sessionCount + 1;
        let hardRun = verdict === "hard" ? prev.hardRun + 1 : 0;
        let easyRun = verdict === "easy" ? prev.easyRun + 1 : 0;
        // neutral resets both runs
        if (verdict === "neutral") { hardRun = 0; easyRun = 0; }

        // ── 3. Maybe adjust level ───────────────────────────────────────────
        const { hardRunToDecrease, easyRunToIncrease, minSessionsBetween } =
          THRESHOLDS.adaptive;
        const cooldownOk =
          newSession - prev.lastAdjustAt >= minSessionsBetween;

        let newLevel = prev.adaptiveLevel;
        let newLastAdjust = prev.lastAdjustAt;

        if (cooldownOk && hardRun >= hardRunToDecrease && newLevel > 1) {
          newLevel = (newLevel - 1) as DiffLevel;
          hardRun = 0;
          easyRun = 0;
          newLastAdjust = newSession;
        } else if (cooldownOk && easyRun >= easyRunToIncrease && newLevel < 3) {
          newLevel = (newLevel + 1) as DiffLevel;
          hardRun = 0;
          easyRun = 0;
          newLastAdjust = newSession;
        }

        const next: AdaptiveState = {
          adaptiveLevel: newLevel,
          hardRun,
          easyRun,
          sessionCount: newSession,
          lastAdjustAt: newLastAdjust,
        };

        // Persist asynchronously — never block the UI
        AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    []
  );

  return {
    adaptiveLevel: state.adaptiveLevel,
    recordSignal,
    resetAdaptive,
  };
}
