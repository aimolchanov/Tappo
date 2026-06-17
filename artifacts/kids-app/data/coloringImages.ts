export interface ColoringRegion {
  id: string;
  type: "path" | "circle" | "ellipse" | "rect";
  d?: string;
  cx?: number;
  cy?: number;
  r?: number;
  rx?: number;
  ry?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
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
  pngSource?: number;
  viewBox: string;
  bgColor: string;
  regions: ColoringRegion[];
  decorations?: ColoringDecoration[];
  complexity: 1 | 2;
}

// ─── OWL ──────────────────────────────────────────────────
const owl: ColoringImage = {
  id: "owl_central",
  emoji: "🦉",
  pngSource: require("@/assets/images/coloring_owl_central.png"),
  viewBox: "0 0 1100 600",
  bgColor: "#FFFFFF",
  complexity: 1,
  regions: [
    { id: "sky",       type: "rect",    x: 0,   y: 0,   width: 1100, height: 600, defaultColor: "transparent" },
    { id: "branch",    type: "rect",    x: 0,   y: 490, width: 1100, height: 110, defaultColor: "transparent" },
    { id: "owl_body",  type: "ellipse", cx: 550, cy: 390, rx: 200, ry: 220, defaultColor: "transparent" },
    { id: "owl_head",  type: "ellipse", cx: 550, cy: 200, rx: 140, ry: 120, defaultColor: "transparent" },
  ],
};

// ─── MUSHROOM HOUSE ───────────────────────────────────────
const mushroomHouse: ColoringImage = {
  id: "mushroom_house",
  emoji: "🍄",
  pngSource: require("@/assets/images/coloring_mushroom_house.png"),
  viewBox: "0 0 1100 600",
  bgColor: "#FFFFFF",
  complexity: 2,
  regions: [
    { id: "sky",          type: "rect",    x: 0,   y: 0,   width: 1100, height: 220, defaultColor: "transparent" },
    { id: "cap",          type: "ellipse", cx: 550, cy: 240, rx: 460, ry: 220, defaultColor: "transparent" },
    { id: "house_body",   type: "rect",    x: 290,  y: 360, width: 520,  height: 240, defaultColor: "transparent" },
    { id: "door",         type: "rect",    x: 430,  y: 460, width: 240,  height: 140, defaultColor: "transparent" },
    { id: "grass",        type: "ellipse", cx: 550, cy: 575, rx: 460, ry: 50,  defaultColor: "transparent" },
  ],
};

// ─── BRONTOSAURUS ─────────────────────────────────────────
const brontosaurus: ColoringImage = {
  id: "brontosaurus",
  emoji: "🦕",
  pngSource: require("@/assets/images/coloring_brontosaurus.png"),
  viewBox: "0 0 1100 600",
  bgColor: "#FFFFFF",
  complexity: 1,
  regions: [
    { id: "sky",         type: "rect",    x: 0,   y: 0,   width: 1100, height: 280, defaultColor: "transparent" },
    { id: "ground",      type: "rect",    x: 0,   y: 510, width: 1100, height: 90,  defaultColor: "transparent" },
    { id: "dino_body",   type: "ellipse", cx: 600, cy: 470, rx: 360, ry: 130, defaultColor: "transparent" },
    { id: "dino_neck",   type: "ellipse", cx: 820, cy: 240, rx: 100, ry: 240, defaultColor: "transparent" },
    { id: "plants",      type: "ellipse", cx: 120, cy: 460, rx: 105, ry: 160, defaultColor: "transparent" },
  ],
};

// ─── LION ─────────────────────────────────────────────────
const lion: ColoringImage = {
  id: "lion",
  emoji: "🦁",
  pngSource: require("@/assets/images/coloring_lion.png"),
  viewBox: "0 0 1100 600",
  bgColor: "#FFFFFF",
  complexity: 1,
  regions: [
    { id: "background",  type: "rect",    x: 0,   y: 0,   width: 1100, height: 600, defaultColor: "transparent" },
    { id: "mane",        type: "ellipse", cx: 550, cy: 330, rx: 440, ry: 320, defaultColor: "transparent" },
    { id: "face",        type: "ellipse", cx: 550, cy: 310, rx: 270, ry: 250, defaultColor: "transparent" },
    { id: "lower_body",  type: "ellipse", cx: 550, cy: 560, rx: 360, ry: 70,  defaultColor: "transparent" },
  ],
};

// ─── TUGBOAT ──────────────────────────────────────────────
const tugboat: ColoringImage = {
  id: "tugboat",
  emoji: "🚢",
  pngSource: require("@/assets/images/coloring_tugboat.png"),
  viewBox: "0 0 1100 600",
  bgColor: "#FFFFFF",
  complexity: 2,
  regions: [
    { id: "sky",         type: "rect",    x: 0,   y: 0,   width: 1100, height: 380, defaultColor: "transparent" },
    { id: "water",       type: "rect",    x: 0,   y: 420, width: 1100, height: 180, defaultColor: "transparent" },
    { id: "hull",        type: "ellipse", cx: 440, cy: 460, rx: 300, ry: 80,  defaultColor: "transparent" },
    { id: "cabin",       type: "rect",    x: 310,  y: 240, width: 290,  height: 200, defaultColor: "transparent" },
  ],
};

// ─── SNAIL ────────────────────────────────────────────────
const snail: ColoringImage = {
  id: "snail",
  emoji: "🐌",
  pngSource: require("@/assets/images/coloring_snail.png"),
  viewBox: "0 0 1100 600",
  bgColor: "#FFFFFF",
  complexity: 1,
  regions: [
    { id: "background",  type: "rect",    x: 0,   y: 0,   width: 1100, height: 600, defaultColor: "transparent" },
    { id: "ground",      type: "rect",    x: 0,   y: 510, width: 1100, height: 90,  defaultColor: "transparent" },
    { id: "shell",       type: "ellipse", cx: 360, cy: 360, rx: 275, ry: 250, defaultColor: "transparent" },
    { id: "body",        type: "ellipse", cx: 690, cy: 470, rx: 260, ry: 90,  defaultColor: "transparent" },
    { id: "head",        type: "ellipse", cx: 850, cy: 370, rx: 115, ry: 100, defaultColor: "transparent" },
  ],
};

// ─── BALLOON ──────────────────────────────────────────────
const balloon: ColoringImage = {
  id: "balloon",
  emoji: "🎈",
  pngSource: require("@/assets/images/coloring_balloon.png"),
  viewBox: "0 0 1100 600",
  bgColor: "#FFFFFF",
  complexity: 1,
  regions: [
    { id: "sky",         type: "rect",    x: 0,   y: 0,   width: 1100, height: 600, defaultColor: "transparent" },
    { id: "cloud",       type: "ellipse", cx: 790, cy: 310, rx: 265, ry: 155, defaultColor: "transparent" },
    { id: "balloon_body",type: "ellipse", cx: 290, cy: 255, rx: 205, ry: 245, defaultColor: "transparent" },
    { id: "basket",      type: "rect",    x: 255,  y: 495, width: 70,   height: 55,  defaultColor: "transparent" },
  ],
};

export const COLORING_IMAGES: ColoringImage[] = [
  owl,
  mushroomHouse,
  brontosaurus,
  lion,
  tugboat,
  snail,
  balloon,
];
