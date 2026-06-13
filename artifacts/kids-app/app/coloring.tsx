import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
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
        { backgroundColor: image.bgColor },
        isSelected && styles.imageThumbnailSelected,
      ]}
    >
      <Text style={styles.thumbnailEmoji}>{image.emoji}</Text>
    </Pressable>
  );
}

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
  const renderRegion = (region: ColoringRegion) => {
    const fill = fills[region.id] ?? region.defaultColor;
    const regionProps = {
      fill,
      stroke: "#444",
      strokeWidth: 2.5,
      strokeLinejoin: "round" as const,
      onPress: () => onRegionPress(region.id),
    };

    if (region.type === "circle") {
      return (
        <Circle key={region.id} {...regionProps} cx={region.cx} cy={region.cy} r={region.r} />
      );
    }
    if (region.type === "ellipse") {
      return (
        <Circle
          key={region.id}
          {...regionProps}
          cx={region.cx}
          cy={region.cy}
          r={(region.rx ?? 30 + (region.ry ?? 30)) / 2}
        />
      );
    }
    return <Path key={region.id} {...regionProps} d={region.d} />;
  };

  const renderDecoration = (dec: ColoringDecoration, idx: number) => {
    if (dec.type === "circle") {
      return (
        <Circle
          key={`d${idx}`}
          cx={dec.cx}
          cy={dec.cy}
          r={dec.r}
          fill="#444"
        />
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

  const [, , vw, vh] = image.viewBox.split(" ").map(Number);

  return (
    <Svg
      viewBox={image.viewBox}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Transparent catch-all for taps that miss every region */}
      <Rect x={0} y={0} width={vw} height={vh} fill="transparent" onPress={onMiss} />
      {image.regions.map(renderRegion)}
      {image.decorations?.map(renderDecoration)}
    </Svg>
  );
}

export default function ColoringScreen() {
  const insets = useSafeAreaInsets();
  const playPop = usePop();

  const { difficulty, recordSignal } = useDifficulty();
  const maxComplexity = LEVEL_TO_MAX_COLORING[difficulty];

  // Filter images to those appropriate for current difficulty level
  const availableImages = COLORING_IMAGES.filter(
    (img) => img.complexity <= maxComplexity
  );

  const [currentId, setCurrentId] = useState(availableImages[0]?.id ?? COLORING_IMAGES[0].id);
  const [selectedColor, setSelectedColor] = useState(PALETTE[0]);
  const [selectedColorIdx, setSelectedColorIdx] = useState(0);
  const [allFills, setAllFills] = useState<
    Record<string, Record<string, string>>
  >({});

  // Tracking refs for adaptive difficulty signal
  const startTimeRef = useRef(Date.now());
  const missCountRef = useRef(0);
  const hitCountRef = useRef(0);

  // Reset tracking counters when image changes
  useEffect(() => {
    startTimeRef.current = Date.now();
    missCountRef.current = 0;
    hitCountRef.current = 0;
  }, [currentId]);

  // When difficulty changes, ensure selected image is still available
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

  const handleMiss = useCallback(() => {
    missCountRef.current += 1;
  }, []);

  const handleRegionPress = useCallback((regionId: string) => {
    hitCountRef.current += 1;

    setAllFills((prev) => {
      const next = {
        ...prev,
        [currentId]: {
          ...(prev[currentId] ?? {}),
          [regionId]: selectedColor,
        },
      };

      // Check if all regions are now filled → record signal
      const filled = Object.keys(next[currentId] ?? {}).length;
      if (filled === currentImage.regions.length) {
        recordSignal({
          screen: "coloring",
          durationMs: Date.now() - startTimeRef.current,
          missCount: missCountRef.current,
          hitCount: hitCountRef.current,
        });
      }

      return next;
    });
    playPop();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [currentId, selectedColor, currentImage.regions.length, recordSignal, playPop]);

  const handleColorSelect = (color: string, idx: number) => {
    setSelectedColor(color);
    setSelectedColorIdx(idx);
    Haptics.selectionAsync();
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0),
          paddingLeft: insets.left,
          paddingRight: insets.right,
          backgroundColor: currentImage.bgColor,
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

      {/* ── SVG canvas ── */}
      <View style={styles.canvasContainer}>
        <SvgCanvas
          image={currentImage}
          fills={currentFills}
          onRegionPress={handleRegionPress}
          onMiss={handleMiss}
        />
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
    </View>
  );
}

const CIRCLE = 54;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ── Top bar ──
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

  // ── Canvas ──
  canvasContainer: {
    flex: 1,
    marginHorizontal: 8,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.6)",
  },

  // ── Palette ──
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
