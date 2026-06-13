---
name: Adaptive difficulty system
description: How the silent auto-difficulty system works and where to tune it
---

## Architecture
- `constants/difficulty.ts` — ALL thresholds in one place (parent-facing comments)
- `hooks/useAdaptiveDifficulty.ts` — engine; persists to `@kidsapp_difficulty_v1` in AsyncStorage
- `contexts/DifficultyContext.tsx` — reads `ageGroup` from SettingsContext; maps "2-3"→1, "4-5"→3, "auto"→adaptiveLevel
- Providers order in `_layout.tsx`: SettingsProvider → DifficultyProvider → GestureHandlerRootView

## Signal flow
1. Puzzle completes → `recordSignal({ screen:"puzzle", durationMs, missCount, hitCount })`
2. Coloring: all regions filled → `recordSignal({ screen:"coloring", ... })`
3. Engine classifies: "hard" / "easy" / "neutral"
4. Consecutive run counters: 3 hard → level down, 4 easy → level up (min 2 sessions cooldown)

## What difficulty controls
- Level 1: puzzle 2×2, coloring complexity≤1 (sun+caterpillar), buttons 110% size
- Level 2: puzzle 3×2, coloring complexity≤2 (all 4 images), buttons 100%
- Level 3: puzzle 3×3, coloring complexity≤2, buttons 100%

## Miss detection
- Puzzles: `onMiss` prop on PuzzlePieceView → called in panResponder when dist >= SNAP_DIST
- Coloring: transparent `<Rect>` as first child of SVG catches background taps

## Where to tune
Edit ONLY `constants/difficulty.ts` — all values have JSDoc comments explaining what to change.

**Why:** Tuning from user tests should not require touching component code. All magic numbers live in one file.
