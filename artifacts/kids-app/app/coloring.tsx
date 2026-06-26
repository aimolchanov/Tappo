import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Image as RNImage,
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  COLORING_IMAGES,
  ColoringDecoration,
  ColoringImage,
  ColoringRegion,
} from "@/data/coloringImages";
import { usePop } from "@/hooks/usePopSound";
import { useDifficulty } from "@/contexts/DifficultyContext";
import { LEVEL_TO_MAX_COLORING } from "@/constants/difficulty";
import { pickRandomIndex } from "@/utils/random";
import { hexToRgb, scanlineFill } from "@/utils/floodFill";

const GAMES_BG = require("@/assets/images/games_background.png");

const PALETTE = [
  "#FF4444",
  "#FF9500",
  "#FFD700",
  "#6BCB50",
  "#4ECDC4",
  "#45B7FF",
  "#4A90E2",
  "#9B59B6",
  "#FF6FC8",
  "#8B4513",
  "#FFFFFF",
  "#333333",
];

// ─── SVG helpers ──────────────────────────────────────────────────────────

/** SVG path string that draws an ellipse centered at (cx,cy) with radii rx,ry */
function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  return `M ${cx - rx},${cy} a ${rx},${ry} 0 1,0 ${2 * rx},0 a ${rx},${ry} 0 1,0 ${-2 * rx},0 Z`;
}

// ─── Small UI components ──────────────────────────────────────────────────

function ColorCircle({
  color,
  isSelected,
  onPress,
}: {
  color: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(isSelected ? 1.25 : 1.0);

  useEffect(() => {
    scale.value = withSpring(isSelected ? 1.25 : 1.0, {
      damping: 12,
      stiffness: 300,
    });
  }, [isSelected]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Reanimated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        style={[
          styles.colorCircle,
          { backgroundColor: color },
          color === "#FFFFFF" && styles.colorCircleWhite,
          isSelected && styles.colorCircleSelected,
        ]}
      />
    </Reanimated.View>
  );
}

// ─── Region renderer (shared by SvgCanvas and native PngCanvas) ───────────

function renderRegionShape(
  region: ColoringRegion,
  fill: string,
  onPress: () => void,
  showStroke: boolean
) {
  const strokeProps = showStroke
    ? {
        stroke: "#444" as const,
        strokeWidth: 2.5,
        strokeLinejoin: "round" as const,
      }
    : { stroke: "none" as const };

  const p = { fill, ...strokeProps, onPress };
  const k = region.id;

  if (region.type === "rect") {
    return (
      <Rect
        key={k}
        {...p}
        x={region.x}
        y={region.y}
        width={region.width}
        height={region.height}
      />
    );
  }
  if (region.type === "circle") {
    return <Circle key={k} {...p} cx={region.cx} cy={region.cy} r={region.r} />;
  }
  if (region.type === "ellipse") {
    return (
      <Path
        key={k}
        {...p}
        d={ellipsePath(region.cx!, region.cy!, region.rx!, region.ry!)}
      />
    );
  }
  return <Path key={k} {...p} d={region.d} />;
}

// ─── Web canvas flood-fill component ─────────────────────────────────────

/**
 * Web-only canvas with pixel-level scanline flood-fill.
 *
 * Image loading strategy:
 * - A hidden <RNImage ref={imgRef}> is rendered with the same source.
 * - react-native-web renders that as a DOM <img> (possibly inside a <div>).
 * - A useEffect accesses imgRef.current (DOM element or wrapper), finds the
 *   <img> child, and attaches a native DOM "load" listener.
 * - If the image is already cached/decoded (complete + naturalWidth > 0),
 *   we draw it synchronously; otherwise we wait for the "load" event.
 *
 * Coordinate mapping accounts for object-fit:contain letterboxing so taps
 * remain pixel-accurate regardless of container shape.
 */
function WebColorCanvas({
  image,
  onRegionPress,
  onMiss,
  selectedColor,
}: {
  image: ColoringImage;
  onRegionPress: (id: string) => void;
  onMiss: () => void;
  selectedColor: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadedRef = useRef(false);
  const selectedColorRef = useRef(selectedColor);
  // Persist canvas pixel data across image switches
  const savedStates = useRef(new Map<string, ImageData>());
  const prevImageIdRef = useRef(image.id);

  // Keep selectedColor current in event handlers without triggering re-renders
  useEffect(() => {
    selectedColorRef.current = selectedColor;
  }, [selectedColor]);

  // Save canvas state when user switches to a different image
  useEffect(() => {
    const prevId = prevImageIdRef.current;
    if (prevId === image.id) return;
    const canvas = canvasRef.current;
    if (canvas && loadedRef.current) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        savedStates.current.set(prevId, ctx.getImageData(0, 0, canvas.width, canvas.height));
      }
    }
    loadedRef.current = false;
    prevImageIdRef.current = image.id;
  }, [image.id]);

  /**
   * Called by the hidden <RNImage> onLoad.
   *
   * React-native-web's event wrapping drops `nativeEvent.target`, so we
   * navigate the DOM instead: canvas.parentElement is the shared wrapper div;
   * querySelector('img') finds the hidden <img> rendered by react-native-web.
   */
  const handleSourceLoad = useCallback(
    (_e: any) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Walk up to the shared wrapper View, then find the hidden <img>
      const parent = canvas.parentElement;
      const imgEl = parent?.querySelector<HTMLImageElement>("img");
      if (!imgEl || !imgEl.naturalWidth) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Restore previously saved coloring for this image
      const saved = savedStates.current.get(image.id);
      if (saved) {
        canvas.width = saved.width;
        canvas.height = saved.height;
        ctx.putImageData(saved, 0, 0);
        loadedRef.current = true;
        return;
      }

      // Draw fresh PNG at full intrinsic resolution
      canvas.width = imgEl.naturalWidth;
      canvas.height = imgEl.naturalHeight;
      try {
        ctx.drawImage(imgEl, 0, 0);
        loadedRef.current = true;
      } catch {
        // CORS taint fallback: reload via a fresh JS Image
        const fallback = new (window as any).Image() as HTMLImageElement;
        fallback.onload = () => {
          canvas.width = fallback.naturalWidth;
          canvas.height = fallback.naturalHeight;
          ctx.drawImage(fallback, 0, 0);
          loadedRef.current = true;
        };
        fallback.src = imgEl.src;
      }
    },
    [image.id]
  );

  const handlePointer = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas || !loadedRef.current) return;

      const ctx = canvas.getContext("2d")!;
      const rect = canvas.getBoundingClientRect();

      // Compute actual image bounds inside the canvas element.
      // object-fit:contain centers the image; we must account for letterboxing.
      const canvasAspect = canvas.width / canvas.height;
      const displayAspect = rect.width / rect.height;

      let imgLeft: number, imgTop: number, imgW: number, imgH: number;
      if (canvasAspect > displayAspect) {
        imgW = rect.width;
        imgH = rect.width / canvasAspect;
        imgLeft = rect.left;
        imgTop = rect.top + (rect.height - imgH) / 2;
      } else {
        imgH = rect.height;
        imgW = rect.height * canvasAspect;
        imgLeft = rect.left + (rect.width - imgW) / 2;
        imgTop = rect.top;
      }

      // Tap in the letterbox area → miss
      if (
        clientX < imgLeft ||
        clientX > imgLeft + imgW ||
        clientY < imgTop ||
        clientY > imgTop + imgH
      ) {
        onMiss();
        return;
      }

      // Map CSS pixel → canvas pixel
      const scaleX = canvas.width / imgW;
      const scaleY = canvas.height / imgH;
      const px = Math.max(0, Math.min(canvas.width - 1, Math.floor((clientX - imgLeft) * scaleX)));
      const py = Math.max(0, Math.min(canvas.height - 1, Math.floor((clientY - imgTop) * scaleY)));

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const rgb = hexToRgb(selectedColorRef.current);
      const filled = scanlineFill(imageData.data, canvas.width, canvas.height, px, py, rgb);

      if (filled) {
        ctx.putImageData(imageData, 0, 0);
        onRegionPress(`cf_${Date.now()}`);
      } else {
        onMiss();
      }
    },
    [onRegionPress, onMiss]
  );

  return (
    <>
      {/*
       * Hidden image: key={image.id} forces fresh load on image switch.
       * onLoad fires with e.nativeEvent = raw DOM Event;
       * e.nativeEvent.target is the <img> DOM element we draw to the canvas.
       */}
      <RNImage
        key={image.id}
        source={image.pngSource!}
        style={styles.hiddenSourceImg}
        onLoad={handleSourceLoad}
        resizeMode="contain"
      />
      {React.createElement("canvas", {
        ref: (el: HTMLCanvasElement | null) => {
          canvasRef.current = el;
        },
        onClick: (e: MouseEvent) => handlePointer(e.clientX, e.clientY),
        onTouchEnd: (e: TouchEvent) => {
          e.preventDefault();
          const t = e.changedTouches[0];
          if (t) handlePointer(t.clientX, t.clientY);
        },
        style: {
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "contain",
          cursor: "crosshair",
          touchAction: "none",
        },
      })}
    </>
  );
}

// ─── Canvas components ────────────────────────────────────────────────────

/**
 * Canvas for PNG-based coloring pages.
 *
 * Web:    HTML5 <canvas> with pixel-level scanline flood-fill.
 * Native: SVG colored fills (approximate regions) beneath the PNG line art.
 */
function PngCanvas({
  image,
  fills,
  onRegionPress,
  onMiss,
  selectedColor,
}: {
  image: ColoringImage;
  fills: Record<string, string>;
  onRegionPress: (id: string) => void;
  onMiss: () => void;
  selectedColor: string;
}) {
  if (Platform.OS === "web") {
    return (
      <View style={styles.pngCanvasWrapper}>
        <WebColorCanvas
          image={image}
          onRegionPress={onRegionPress}
          onMiss={onMiss}
          selectedColor={selectedColor}
        />
      </View>
    );
  }

  // ── Native: SVG region approach ─────────────────────────────────────────
  // fill="rgba(0,0,0,0)" instead of "transparent" — both are invisible but
  // rgba(0,0,0,0) is treated as a filled area in react-native-svg hit testing.
  const [, , vwStr, vhStr] = image.viewBox.split(" ");
  const vw = Number(vwStr);
  const vh = Number(vhStr);

  return (
    <View style={styles.pngCanvasWrapper}>
      {/* Layer 1: colored fills + touch regions */}
      <Svg
        viewBox={image.viewBox}
        width="100%"
        height="100%"
        style={StyleSheet.absoluteFill}
        preserveAspectRatio="xMidYMid meet"
      >
        <Rect
          x={0}
          y={0}
          width={vw}
          height={vh}
          fill="rgba(0,0,0,0)"
          onPress={onMiss}
        />
        {image.regions.map((region) =>
          renderRegionShape(
            region,
            fills[region.id] ?? "rgba(0,0,0,0)",
            () => onRegionPress(region.id),
            false
          )
        )}
      </Svg>

      {/* Layer 2: PNG line art — non-interactive, touches pass through */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <RNImage
          source={image.pngSource!}
          style={styles.pngImage}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

/** Canvas for legacy SVG-only coloring pages */
function SvgCanvas({
  image,
  fills,
  onRegionPress,
  onMiss,
}: {
  image: ColoringImage;
  fills: Record<string, string>;
  onRegionPress: (id: string) => void;
  onMiss: () => void;
}) {
  const renderDecoration = (dec: ColoringDecoration, idx: number) => {
    if (dec.type === "circle") {
      return (
        <Circle key={`d${idx}`} cx={dec.cx} cy={dec.cy} r={dec.r} fill="#444" />
      );
    }
    return (
      <Path
        key={`d${idx}`}
        d={dec.d}
        fill="none"
        stroke="#444"
        strokeWidth={2}
        strokeLinecap="round"
      />
    );
  };

  const [, , vwStr, vhStr] = image.viewBox.split(" ");
  const vw = Number(vwStr);
  const vh = Number(vhStr);

  return (
    <Svg
      viewBox={image.viewBox}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
    >
      <Rect
        x={0}
        y={0}
        width={vw}
        height={vh}
        fill="rgba(0,0,0,0)"
        onPress={onMiss}
      />
      {image.regions.map((region) =>
        renderRegionShape(
          region,
          fills[region.id] ?? region.defaultColor,
          () => onRegionPress(region.id),
          true
        )
      )}
      {image.decorations?.map(renderDecoration)}
    </Svg>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────

export default function ColoringScreen() {
  const insets = useSafeAreaInsets();
  const playPop = usePop();

  const { difficulty, recordSignal } = useDifficulty();
  const maxComplexity = LEVEL_TO_MAX_COLORING[difficulty];

  const availableImages = COLORING_IMAGES.filter(
    (img) => img.complexity <= maxComplexity
  );

  const [currentId, setCurrentId] = useState(() => {
    const pool =
      availableImages.length > 0 ? availableImages : COLORING_IMAGES;
    return pool[pickRandomIndex(pool.length, -1)].id;
  });
  const [selectedColor, setSelectedColor] = useState(PALETTE[0]);
  const [selectedColorIdx, setSelectedColorIdx] = useState(0);
  const [allFills, setAllFills] = useState<
    Record<string, Record<string, string>>
  >({});

  const startTimeRef = useRef(Date.now());
  const missCountRef = useRef(0);
  const hitCountRef = useRef(0);
  const completionReportedRef = useRef(false);

  // Reset tracking on image change
  useEffect(() => {
    startTimeRef.current = Date.now();
    missCountRef.current = 0;
    hitCountRef.current = 0;
    completionReportedRef.current = false;
  }, [currentId]);

  // Ensure selected image is valid for current difficulty
  useEffect(() => {
    if (!availableImages.find((img) => img.id === currentId)) {
      setCurrentId(availableImages[0]?.id ?? COLORING_IMAGES[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty]);

  const currentImage =
    availableImages.find((img) => img.id === currentId) ??
    availableImages[0] ??
    COLORING_IMAGES[0];
  const currentFills = allFills[currentId] ?? {};

  // Completion detection — safe, never inside a setState updater
  const filledCount = Object.keys(currentFills).length;
  const isComplete = filledCount >= currentImage.regions.length;

  useEffect(() => {
    if (!isComplete || completionReportedRef.current) return;
    completionReportedRef.current = true;
    recordSignal({
      screen: "coloring",
      durationMs: Date.now() - startTimeRef.current,
      missCount: missCountRef.current,
      hitCount: hitCountRef.current,
    });
  }, [isComplete, currentId, recordSignal]);

  const handleMiss = useCallback(() => {
    missCountRef.current += 1;
  }, []);

  const handleRegionPress = useCallback(
    (regionId: string) => {
      hitCountRef.current += 1;
      setAllFills((prev) => ({
        ...prev,
        [currentId]: {
          ...(prev[currentId] ?? {}),
          [regionId]: selectedColor,
        },
      }));
      playPop();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [currentId, selectedColor, playPop]
  );

  const handleColorSelect = (color: string, idx: number) => {
    setSelectedColor(color);
    setSelectedColorIdx(idx);
    Haptics.selectionAsync();
  };

  // 🔄 — load another random image. Progress of the current one is NOT saved.
  const loadAnother = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const pool = availableImages.length > 0 ? availableImages : COLORING_IMAGES;
    const prevIdx = pool.findIndex((img) => img.id === currentId);
    const next = pool[pickRandomIndex(pool.length, prevIdx)];
    setAllFills({});
    setCurrentId(next.id);
  }, [availableImages, currentId]);

  const poolSize =
    availableImages.length > 0 ? availableImages.length : COLORING_IMAGES.length;

  return (
    <ImageBackground
      source={GAMES_BG}
      resizeMode="cover"
      style={[
        styles.container,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0),
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      {/* ── Top bar (symmetric with Puzzles: back · refresh) ── */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={34} color="#FFFFFF" />
        </Pressable>

        {poolSize > 1 && (
          <Pressable onPress={loadAnother} style={styles.backBtn} hitSlop={8}>
            <Feather name="refresh-cw" size={28} color="#FFFFFF" />
          </Pressable>
        )}
      </View>

      {/* ── Canvas ── */}
      <View
        style={[
          styles.canvasContainer,
          { backgroundColor: currentImage.bgColor },
        ]}
      >
        {currentImage.pngSource ? (
          <PngCanvas
            image={currentImage}
            fills={currentFills}
            onRegionPress={handleRegionPress}
            onMiss={handleMiss}
            selectedColor={selectedColor}
          />
        ) : (
          <SvgCanvas
            image={currentImage}
            fills={currentFills}
            onRegionPress={handleRegionPress}
            onMiss={handleMiss}
          />
        )}
      </View>

      {/* ── Colour palette ── */}
      <View style={styles.palette}>
        {PALETTE.map((color, idx) => (
          <ColorCircle
            key={color}
            color={color}
            isSelected={selectedColorIdx === idx}
            onPress={() => handleColorSelect(color, idx)}
          />
        ))}
      </View>
    </ImageBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const CIRCLE = 54;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  topBar: {
    height: 80,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  backBtn: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: "#FF5C5C",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
  },
  thumbRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
  },
  imageThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "transparent",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageThumbnailSelected: {
    borderColor: "#FF5C5C",
    shadowOpacity: 0.25,
  },
  thumbnailEmoji: {
    fontSize: 34,
  },
  thumbPng: {
    width: 64,
    height: 64,
  },

  canvasContainer: {
    flex: 1,
    marginHorizontal: 8,
    borderRadius: 24,
    overflow: "hidden",
  },

  pngCanvasWrapper: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  pngImage: {
    width: "100%",
    height: "100%",
  },
  hiddenSourceImg: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    left: -100,
    top: -100,
  },

  palette: {
    height: 86,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  colorCircle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  colorCircleWhite: {
    borderWidth: 1.5,
    borderColor: "#CCCCCC",
  },
  colorCircleSelected: {
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
