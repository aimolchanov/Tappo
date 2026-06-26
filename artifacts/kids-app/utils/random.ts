/**
 * Shared randomization helpers for image selection
 * (used by Coloring and Puzzles screens).
 */

/**
 * Pick a random index in [0, count) that is different from `prevIndex`
 * whenever possible (no immediate repeat). Returns 0 for empty/single sets.
 */
export function pickRandomIndex(count: number, prevIndex: number): number {
  if (count <= 1) return 0;
  let next = Math.floor(Math.random() * count);
  if (next === prevIndex) {
    // shift by a random non-zero offset so we never land on prevIndex again
    next = (next + 1 + Math.floor(Math.random() * (count - 1))) % count;
  }
  return next;
}
