export interface ColoringRegion {
  id: string;
  type: "path" | "circle" | "ellipse";
  d?: string;
  cx?: number;
  cy?: number;
  r?: number;
  rx?: number;
  ry?: number;
  defaultColor: string;
}

export interface ColoringDecoration {
  type: "path" | "circle";
  d?: string;
  cx?: number;
  cy?: number;
  r?: number;
}

export interface ColoringImage {
  id: string;
  emoji: string;
  viewBox: string;
  bgColor: string;
  regions: ColoringRegion[];
  decorations?: ColoringDecoration[];
  /**
   * 1 = simple (few large regions, easy to tap) — shown at difficulty level 1+
   * 2 = medium (more regions, smaller areas) — shown at difficulty level 2+
   */
  complexity: 1 | 2;
}

// ─── BUTTERFLY ────────────────────────────────────────────
const butterfly: ColoringImage = {
  id: "butterfly",
  emoji: "🦋",
  complexity: 2,
  viewBox: "0 0 600 400",
  bgColor: "#F0F7FF",
  regions: [
    {
      id: "left_upper",
      type: "path",
      d: "M 286 158 C 260 112 190 72 118 82 C 58 90 30 140 45 192 C 58 238 112 260 170 258 C 218 256 256 232 274 204 C 280 194 285 178 286 162 Z",
      defaultColor: "#F8F8F8",
    },
    {
      id: "right_upper",
      type: "path",
      d: "M 314 158 C 340 112 410 72 482 82 C 542 90 570 140 555 192 C 542 238 488 260 430 258 C 382 256 344 232 326 204 C 320 194 315 178 314 162 Z",
      defaultColor: "#F8F8F8",
    },
    {
      id: "left_lower",
      type: "path",
      d: "M 286 195 C 265 212 235 225 198 228 C 160 232 132 222 118 204 C 106 189 118 170 148 164 C 178 158 226 166 268 185 Z",
      defaultColor: "#F8F8F8",
    },
    {
      id: "right_lower",
      type: "path",
      d: "M 314 195 C 335 212 365 225 402 228 C 440 232 468 222 482 204 C 494 189 482 170 452 164 C 422 158 374 166 332 185 Z",
      defaultColor: "#F8F8F8",
    },
    {
      id: "body",
      type: "path",
      d: "M 300 108 C 310 118 314 150 314 182 C 314 214 310 248 300 272 C 290 248 286 214 286 182 C 286 150 290 118 300 108 Z",
      defaultColor: "#EEEEEE",
    },
    {
      id: "head",
      type: "circle",
      cx: 300,
      cy: 99,
      r: 14,
      defaultColor: "#EEEEEE",
    },
  ],
  decorations: [
    { type: "path", d: "M 295 87 C 285 72 272 58 262 50" },
    { type: "circle", cx: 261, cy: 47, r: 5 },
    { type: "path", d: "M 305 87 C 315 72 328 58 338 50" },
    { type: "circle", cx: 339, cy: 47, r: 5 },
  ],
};

// ─── SUN ──────────────────────────────────────────────────
const sun: ColoringImage = {
  id: "sun",
  emoji: "☀️",
  complexity: 1,
  viewBox: "0 0 400 400",
  bgColor: "#FFFBF0",
  regions: [
    {
      id: "rays",
      type: "path",
      d: "M 200 28 L 240 95 L 318 78 L 300 155 L 368 196 L 300 240 L 318 318 L 240 300 L 200 368 L 160 300 L 82 318 L 100 240 L 32 196 L 100 155 L 82 78 L 160 95 Z",
      defaultColor: "#F8F8F8",
    },
    {
      id: "disc",
      type: "circle",
      cx: 200,
      cy: 196,
      r: 98,
      defaultColor: "#F8F8F8",
    },
  ],
  decorations: [
    { type: "circle", cx: 175, cy: 185, r: 10 },
    { type: "circle", cx: 225, cy: 185, r: 10 },
    {
      type: "path",
      d: "M 170 222 C 180 238 220 238 230 222",
    },
  ],
};

// ─── HOUSE ────────────────────────────────────────────────
const house: ColoringImage = {
  id: "house",
  emoji: "🏠",
  complexity: 2,
  viewBox: "0 0 400 420",
  bgColor: "#F5FFF0",
  regions: [
    {
      id: "chimney",
      type: "path",
      d: "M 268 75 L 308 75 L 308 170 L 268 170 Z",
      defaultColor: "#F8F8F8",
    },
    {
      id: "roof",
      type: "path",
      d: "M 200 42 L 358 192 L 42 192 Z",
      defaultColor: "#F8F8F8",
    },
    {
      id: "walls",
      type: "path",
      d: "M 58 192 L 342 192 L 342 388 L 58 388 Z",
      defaultColor: "#F8F8F8",
    },
    {
      id: "door",
      type: "path",
      d: "M 163 292 L 237 292 L 237 388 L 163 388 Z",
      defaultColor: "#F8F8F8",
    },
    {
      id: "window_left",
      type: "path",
      d: "M 78 218 L 148 218 L 148 276 L 78 276 Z",
      defaultColor: "#F8F8F8",
    },
    {
      id: "window_right",
      type: "path",
      d: "M 252 218 L 322 218 L 322 276 L 252 276 Z",
      defaultColor: "#F8F8F8",
    },
  ],
  decorations: [
    { type: "circle", cx: 230, cy: 340, r: 5 },
    { type: "path", d: "M 113 218 L 113 276" },
    { type: "path", d: "M 78 247 L 148 247" },
    { type: "path", d: "M 287 218 L 287 276" },
    { type: "path", d: "M 252 247 L 322 247" },
  ],
};

// ─── CATERPILLAR ──────────────────────────────────────────
const caterpillar: ColoringImage = {
  id: "caterpillar",
  emoji: "🐛",
  complexity: 1,
  viewBox: "0 0 600 260",
  bgColor: "#F5FFF5",
  regions: [
    {
      id: "seg1",
      type: "circle",
      cx: 82,
      cy: 148,
      r: 58,
      defaultColor: "#F8F8F8",
    },
    {
      id: "seg2",
      type: "circle",
      cx: 184,
      cy: 148,
      r: 52,
      defaultColor: "#F8F8F8",
    },
    {
      id: "seg3",
      type: "circle",
      cx: 280,
      cy: 148,
      r: 52,
      defaultColor: "#F8F8F8",
    },
    {
      id: "seg4",
      type: "circle",
      cx: 376,
      cy: 148,
      r: 52,
      defaultColor: "#F8F8F8",
    },
    {
      id: "seg5",
      type: "circle",
      cx: 472,
      cy: 148,
      r: 52,
      defaultColor: "#F8F8F8",
    },
    {
      id: "head",
      type: "circle",
      cx: 538,
      cy: 138,
      r: 56,
      defaultColor: "#F8F8F8",
    },
  ],
  decorations: [
    { type: "circle", cx: 522, cy: 122, r: 9 },
    { type: "circle", cx: 554, cy: 122, r: 9 },
    { type: "circle", cx: 523, cy: 124, r: 4 },
    { type: "circle", cx: 555, cy: 124, r: 4 },
    { type: "path", d: "M 524 150 C 534 162 546 162 554 150" },
    { type: "path", d: "M 538 84 C 528 68 520 55 515 45" },
    { type: "circle", cx: 513, cy: 42, r: 6 },
    { type: "path", d: "M 538 84 C 548 68 556 55 561 45" },
    { type: "circle", cx: 563, cy: 42, r: 6 },
  ],
};

// ─────────────────────────────────────────────────────────
// HOW TO ADD A NEW IMAGE:
//
// 1. Create a new object with:
//    - id: unique string
//    - emoji: the emoji shown in the selector
//    - viewBox: "0 0 W H" — coordinate space of your SVG
//    - bgColor: light background for the canvas
//    - regions: array of colorable areas (path, circle, or ellipse)
//    - decorations: optional non-colorable details (outlines, dots, etc.)
//
// 2. For each region, write an SVG path string in `d` (or cx/cy/r for circles).
//    The child taps the region → it fills with the selected color.
//    You can get SVG paths from freesvg.org, openclipart.org, or draw your own
//    in any vector editor (Inkscape, Figma, Illustrator) and export as SVG.
//
// 3. Add the new object to the COLORING_IMAGES array below.
// ─────────────────────────────────────────────────────────

export const COLORING_IMAGES: ColoringImage[] = [
  butterfly,
  sun,
  house,
  caterpillar,
];
