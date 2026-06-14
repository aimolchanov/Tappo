/**
 * ─── MATCHING GAME DATA ───────────────────────────────────────────────────────
 *
 * Как добавить новый набор для раздела «Цвет»:
 * 1. Добавьте новый объект в COLORS (key, hex, itemEmojis).
 * 2. Больше ничего не нужно — generateColorPuzzle() подхватит автоматически.
 *
 * Как добавить новый ТИП задания (тень, форма и т.д.):
 * 1. Добавьте тип в PuzzleType.
 * 2. Создайте свой интерфейс (ShadowItem, ShapeItem…) и generateXxxPuzzle().
 * 3. Экранный компонент matching.tsx читает поле type и рендерит нужную версию.
 */

import type { DiffLevel } from "@/constants/difficulty";

// ─── Extensible puzzle type union ─────────────────────────────────
export type PuzzleType = "color"; // | "shadow" | "shape" | "size" | ...

// ─── Color type interfaces ─────────────────────────────────────────
export interface MatchItem {
  id: string;
  colorKey: string;
  color: string;   // hex background of the item circle
  emoji: string;   // decorative emoji drawn on top of the circle
}

export interface MatchTarget {
  id: string;
  colorKey: string;
  color: string;   // hex background of the basket — MUST match MatchItem.color
}

export interface ColorPuzzle {
  type: "color";
  items: MatchItem[];
  targets: MatchTarget[];
}

// ─── Color palette ─────────────────────────────────────────────────
// Тёплые, хорошо различимые цвета. Порядок = частота появления.
const COLORS = [
  { key: "red",    hex: "#FF6B6B", emojis: ["🍎", "🌷", "🍓", "❤️"] },
  { key: "yellow", hex: "#FFD93D", emojis: ["⭐", "🌻", "🌟", "🍋"] },
  { key: "teal",   hex: "#4ECDC4", emojis: ["💎", "🐟", "🫧", "🦋"] },
  { key: "green",  hex: "#95D5B2", emojis: ["🍀", "🐸", "🌿", "🌱"] },
  { key: "purple", hex: "#A78BFA", emojis: ["🍇", "🦄", "💜", "🌸"] },
  { key: "orange", hex: "#FF9500", emojis: ["🍊", "🎃", "🦊", "🌼"] },
] as const;

// ─── Difficulty config ─────────────────────────────────────────────
// One base item per selected color; distractors are extra same-color items
// that go into an already-existing basket (harder sorting on level 3).
// Total items: L1=2, L2=4, L3=6 — well within the 2-6 item target for ages 2-5.
export const MATCHING_CONFIG: Record<
  DiffLevel,
  { numColors: number; baseItems: number; distractors: number }
> = {
  1: { numColors: 2, baseItems: 1, distractors: 0 }, // 2 items, 2 baskets
  2: { numColors: 3, baseItems: 1, distractors: 1 }, // 4 items, 3 baskets
  3: { numColors: 4, baseItems: 1, distractors: 2 }, // 6 items, 4 baskets
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
  const chosenColors = shuffle(COLORS).slice(0, cfg.numColors);

  const targets: MatchTarget[] = chosenColors.map((c) => ({
    id: `target_${c.key}_${uid()}`,
    colorKey: c.key,
    color: c.hex,
  }));

  const items: MatchItem[] = [];

  // One base item per selected color
  chosenColors.forEach((c) => {
    const emojiPool = shuffle(c.emojis);
    for (let i = 0; i < cfg.baseItems; i++) {
      items.push({
        id: `item_${c.key}_${i}_${uid()}`,
        colorKey: c.key,
        color: c.hex,
        emoji: emojiPool[i % emojiPool.length],
      });
    }
  });

  // Distractors (level 3): extra items from already-chosen colors.
  // A child has to sort more items into fewer baskets — harder but still fair.
  if (cfg.distractors > 0) {
    const extraColors = shuffle(chosenColors);
    for (let i = 0; i < cfg.distractors; i++) {
      const c = extraColors[i % extraColors.length];
      const e = shuffle(c.emojis);
      items.push({
        id: `extra_${c.key}_${i}_${uid()}`,
        colorKey: c.key,
        color: c.hex,
        emoji: e[0],
      });
    }
  }

  return { type: "color", items: shuffle(items), targets };
}
