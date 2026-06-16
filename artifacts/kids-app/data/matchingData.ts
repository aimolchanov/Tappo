/**
 * ─── MATCHING GAME DATA ───────────────────────────────────────────────────────
 *
 * Три уровня сложности (1:1, 2:1, 2:1 с 4 цветами):
 *   Level 1 — 3 предмета, 3 корзины   (строго 1 предмет на цвет)
 *   Level 2 — 6 предметов, 3 корзины  (по 2 предмета каждого цвета)
 *   Level 3 — 8 предметов, 4 корзины  (по 2 предмета каждого цвета)
 *
 * Каждый предмет ВСЕГДА имеет соответствующую корзину — головоломка всегда решаема.
 */

import type { DiffLevel } from "@/constants/difficulty";

// ─── Type union — extensible for future "shadow", "shape" types ────
export type PuzzleType = "color";

// ─── Interfaces ────────────────────────────────────────────────────
export interface MatchItem {
  id: string;
  colorKey: string;
  color: string; // shown as a solid colored inner circle on a neutral background
}

export interface MatchTarget {
  id: string;
  colorKey: string;
  color: string;
}

export interface ColorPuzzle {
  type: "color";
  items: MatchItem[];
  targets: MatchTarget[];
}

// ─── Color palette ─────────────────────────────────────────────────
// Дизайн-системные цвета: первые 3 — всегда для Level 1 (фиксировано).
// Level 2/3 добавляют цвета из расширенной палитры ниже.
const LEVEL1_COLORS = [
  { key: "coral",  hex: "#FF6B6B" },
  { key: "yellow", hex: "#FFD93D" },
  { key: "teal",   hex: "#4ECDC4" },
] as const;

const EXTRA_COLORS = [
  { key: "purple", hex: "#C77DFF" },
  { key: "orange", hex: "#FF9F43" },
  { key: "green",  hex: "#6BCB50" },
] as const;

const COLORS = [...LEVEL1_COLORS, ...EXTRA_COLORS] as const;

// ─── Difficulty config ──────────────────────────────────────────────
// itemsPerColor одинаково для каждого цвета → никаких «ошибок»-перекосов.
export const MATCHING_CONFIG: Record<
  DiffLevel,
  { numColors: number; itemsPerColor: number }
> = {
  1: { numColors: 3, itemsPerColor: 1 }, // 3 tokens : 3 targets — fixed Coral/Yellow/Teal
  2: { numColors: 3, itemsPerColor: 1 }, // 3 tokens : 3 targets — random from full palette
  3: { numColors: 3, itemsPerColor: 1 }, // 3 tokens : 3 targets — random from full palette
};

// ─── Helpers ───────────────────────────────────────────────────────
function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let _uid = 0;
function uid() {
  return String(++_uid);
}

// ─── Generator ─────────────────────────────────────────────────────
export function generateColorPuzzle(level: DiffLevel): ColorPuzzle {
  const cfg = MATCHING_CONFIG[level];
  // Level 1: always Coral + Yellow + Teal (fixed design-system colors).
  // Level 2+: shuffle the full palette and take N.
  const chosenColors: Array<{ key: string; hex: string }> =
    level === 1
      ? shuffle(LEVEL1_COLORS)
      : shuffle(COLORS).slice(0, cfg.numColors);

  const targets: MatchTarget[] = chosenColors.map((c) => ({
    id: `target_${c.key}_${uid()}`,
    colorKey: c.key,
    color: c.hex,
  }));

  const items: MatchItem[] = [];
  chosenColors.forEach((c) => {
    for (let i = 0; i < cfg.itemsPerColor; i++) {
      items.push({
        id: `item_${c.key}_${i}_${uid()}`,
        colorKey: c.key,
        color: c.hex,
      });
    }
  });

  return { type: "color", items: shuffle(items), targets };
}
