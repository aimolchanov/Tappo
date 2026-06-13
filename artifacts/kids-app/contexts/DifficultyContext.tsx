/**
 * DifficultyContext
 *
 * Provides the effective difficulty level to every screen.
 *
 * Effective level = manual override  OR  adaptive engine:
 *   ageGroup "2-3"  → always level 1
 *   ageGroup "4-5"  → always level 3
 *   ageGroup "auto" → adaptive engine (starts at 2, adjusts silently)
 */
import React, { createContext, useContext, useEffect } from "react";

import { type DiffLevel } from "@/constants/difficulty";
import { useAppSettings } from "@/contexts/SettingsContext";
import {
  type DifficultySignal,
  useAdaptiveDifficulty,
} from "@/hooks/useAdaptiveDifficulty";

// ─── Context shape ─────────────────────────────────────────────────────────
interface DifficultyCtx {
  /** Effective difficulty level 1 | 2 | 3 — ready to use in screens */
  difficulty: DiffLevel;
  /** Whether adaptive mode is active (ageGroup === "auto") */
  isAuto: boolean;
  /** Call this after each completed task session */
  recordSignal: (signal: DifficultySignal) => void;
}

const DifficultyContext = createContext<DifficultyCtx>({
  difficulty: 2,
  isAuto: true,
  recordSignal: () => {},
});

// ─── Provider ──────────────────────────────────────────────────────────────
export function DifficultyProvider({ children }: { children: React.ReactNode }) {
  const { ageGroup } = useAppSettings();
  const { adaptiveLevel, recordSignal, resetAdaptive } = useAdaptiveDifficulty();

  // When parent switches away from "auto", reset the adaptive counters so
  // that going back to "auto" starts fresh from the middle level.
  useEffect(() => {
    if (ageGroup !== "auto") {
      resetAdaptive();
    }
  }, [ageGroup, resetAdaptive]);

  const isAuto = ageGroup === "auto";

  // Manual overrides: "2-3" → 1, "4-5" → 3
  const effectiveLevel: DiffLevel = isAuto
    ? adaptiveLevel
    : ageGroup === "2-3"
    ? 1
    : 3;

  // Adaptive recordSignal is a no-op when in manual mode
  const safeRecord = isAuto ? recordSignal : () => {};

  return (
    <DifficultyContext.Provider
      value={{ difficulty: effectiveLevel, isAuto, recordSignal: safeRecord }}
    >
      {children}
    </DifficultyContext.Provider>
  );
}

/** Read current effective difficulty from any screen or hook */
export function useDifficulty(): DifficultyCtx {
  return useContext(DifficultyContext);
}
