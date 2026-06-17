import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Image as RNImage,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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

/** SVG path string that draws an ellipse centered at (cx,cy) with radii rx,ry */
function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  return `M ${cx - rx},${cy} a ${rx},${ry} 0 1,0 ${2 * rx},0 a ${rx},${ry} 0 1,0 ${-2 * rx},0 Z`;
}

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

function ImageThumb({
  image,
  isSelected,
  onPress,
}: {
  image: ColoringImage;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.imageThumbnail,
        { backgroundColor: image.pngSource ? "#F8F8F8" : image.bgColor },
        isSelected && styles.imageThumbnailSelected,
      ]}
    >
      {image.pngSource ? (
        <RNImage
          source={image.pngSource}
          style={styles.thumbPng}
          resizeMode="cover"
        />
      ) : (
        <Text style={styles.thumbnailEmoji}>{image.emoji}</Text>
      )}
    </Pressable>
  );
}

/** Region renderer shared by both canvas types */
function renderRegionShape(
  region: ColoringRegion,
  fill: string,
  onPress: () => void,
  showStroke: boolean
) {
  const strokeProps = showStroke
    ? { stroke: "#444" as const, strokeWidth: 2.5, strokeLinejoin: "round" as const }
    : { stroke: "none" as const };

  const p = { fill, ...strokeProps, onPress };
  const k = region.id;

  if (region.type === "rect") {
    return (
      <Rect
        key={k} {...p}
        x={region.x} y={region.y}
        width={region.width} height={region.height}
      />
    );
  }
  if (region.type === "circle") {
    return <Circle key={k} {...p} cx={region.cx} cy={region.cy} r={region.r} />;
  }
  if (region.type === "ellipse") {
    return (
      <Path
        key={k} {...p}
        d={ellipsePath(region.cx!, region.cy!, region.rx!, region.ry!)}
      />
    );
  }
  return <Path key={k} {...p} d={region.d} />;
}

/**
 * Canvas for PNG-based coloring pages.
 *  Layer 1 — SVG colored fills + touch detection (underneath PNG)
 *  Layer 2 — PNG line art on top (non-interactive, touches pass through)
 */
function PngCanvas({
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
        {/* Catch-all miss target */}
        <Rect
          x={0}
          y={0}
          width={vw}
          height={vh}
          fill="transparent"
          onPress={onMiss}
        />
        {image.regions.map((region) =>
          renderRegionShape(
            region,
            fills[region.id] ?? "transparent",
            () => onRegionPress(region.id),
            false
          )
        )}
      </Svg>

      {/* Layer 2: PNG line art — non-interactive so touches reach Layer 1.
          Must use width/height 100% (not absoluteFill) so the browser
          <img> element is constrained to the wrapper bounds before
          object-fit:contain takes effect. absoluteFill sets only
          position/insets, which is insufficient for <img> sizing on web. */}
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
        fill="transparent"
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

export default function ColoringScreen() {
  const insets = useSafeAreaInsets();
  const playPop = usePop();

  const { difficulty, recordSignal } = useDifficulty();
  const maxComplexity = LEVEL_TO_MAX_COLORING[difficulty];

  const availableImages = COLORING_IMAGES.filter(
    (img) => img.complexity <= maxComplexity
  );

  const [currentId, setCurrentId] = useState(
    availableImages[0]?.id ?? COLORING_IMAGES[0].id
  );
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
      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={34} color="#FFFFFF" />
        </Pressable>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbRow}
        >
          {availableImages.map((img) => (
            <ImageThumb
              key={img.id}
              image={img}
              isSelected={currentId === img.id}
              onPress={() => setCurrentId(img.id)}
            />
          ))}
        </ScrollView>
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

const CIRCLE = 54;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  topBar: {
    height: 80,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 12,
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
