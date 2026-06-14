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
// Яркие, хорошо различимые цвета. Первые 3 — максимально контрастные
// (красный, жёлтый, синий — первичные, самые понятные малышам).
const COLORS = [
  { key: "red",    hex: "#FF4757" },
  { key: "yellow", hex: "#FFD32A" },
  { key: "blue",   hex: "#45AAF2" },
  { key: "green",  hex: "#26DE81" },
  { key: "purple", hex: "#A29BFE" },
  { key: "orange", hex: "#FD9644" },
] as const;

// ─── Difficulty config ──────────────────────────────────────────────
// itemsPerColor одинаково для каждого цвета → никаких «ошибок»-перекосов.
export const MATCHING_CONFIG: Record<
  DiffLevel,
  { numColors: number; itemsPerColor: number }
> = {
  1: { numColors: 3, itemsPerColor: 1 }, // 3 items : 3 baskets — strict 1:1
  2: { numColors: 3, itemsPerColor: 2 }, // 6 items : 3 baskets — 2 per color
  3: { numColors: 4, itemsPerColor: 2 }, // 8 items : 4 baskets — 2 per color
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
  // Shuffle and pick N colors; use slice of full palette
  const chosenColors = shuffle(COLORS).slice(0, cfg.numColors);

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
