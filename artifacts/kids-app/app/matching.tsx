import { Feather } from "@expo/vector-icons";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MatchingMascot, type MascotMood } from "@/components/MatchingMascot";
import { useDifficulty } from "@/contexts/DifficultyContext";
import { useAppSettings } from "@/contexts/SettingsContext";
import {
  generateColorPuzzle,
  type MatchItem,
  type MatchTarget,
} from "@/data/matchingData";
import { usePop } from "@/hooks/usePopSound";

// ─── Layout constants ─────────────────────────────────────────────
const HEADER_H = 68;
const BASKET_V_PAD = 20;
const BASKET_GAP = 22;
const ITEM_H_GAP = 16;
const ITEM_V_GAP = 20;
const ITEM_AREA_TOP_PAD = 28;
const SNAP_DIST = 88;

// ─── Target with computed center ──────────────────────────────────
interface TargetWithPos extends MatchTarget {
  centerX: number;
  centerY: number;
}

// ─── Basket — rounded-rectangle container ─────────────────────────
function BasketView({
  target,
  size,
  matchCount,
  itemsPerColor,
}: {
  target: TargetWithPos;
  size: number;
  matchCount: number;
  itemsPerColor: number;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (matchCount > 0) {
      scale.value = withSequence(
        withSpring(1.16, { damping: 3, stiffness: 480 }),
        withSpring(1.0, { damping: 7 })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchCount]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isFilled = matchCount >= itemsPerColor;
  const hasAny = matchCount > 0;
  const R = Math.round(size * 0.22); // rounded-rect radius — NOT a circle

  return (
    <Reanimated.View style={animStyle}>
      {/* Outer container — reads clearly as a "tray / drop zone" */}
      <View
        style={[
          styles.basket,
          {
            width: size,
            height: size,
            borderRadius: R,
            backgroundColor: hasAny ? target.color : "#FFF8F0",
            borderWidth: isFilled ? 0 : 3.5,
            borderColor: target.color,
            borderStyle: isFilled ? "solid" : "dashed",
            shadowColor: target.color,
            shadowOffset: { width: 0, height: hasAny ? 6 : 3 },
            shadowOpacity: hasAny ? 0.55 : 0.25,
            shadowRadius: hasAny ? 12 : 6,
            elevation: hasAny ? 14 : 5,
          },
        ]}
      >
        {/* Empty state: colored inner "drop-here" circle */}
        {!hasAny && (
          <View
            style={{
              width: size * 0.46,
              height: size * 0.46,
              borderRadius: (size * 0.46) / 2,
              backgroundColor: target.color,
              opacity: 0.22,
            }}
          />
        )}

        {/* Partially filled: subtle count badge */}
        {hasAny && !isFilled && itemsPerColor > 1 && (
          <Text
            style={{
              color: "rgba(255,255,255,0.9)",
              fontSize: size * 0.3,
              fontWeight: "700",
            }}
          >
            {matchCount}/{itemsPerColor}
          </Text>
        )}

        {/* Fully filled: white checkmark */}
        {isFilled && (
          <Text style={{ fontSize: size * 0.42, color: "#fff" }}>✓</Text>
        )}
      </View>
    </Reanimated.View>
  );
}

// ─── Draggable item — neutral circle + colored inner dot ──────────
interface DraggableItemProps {
  item: MatchItem;
  size: number;
  originX: number;
  originY: number;
  targets: TargetWithPos[];
  onMatch: (itemId: string, targetId: string) => void;
  onMiss: () => void;
  onPlaySnap: () => void;
  onPlayMiss: () => void;
  isComplete: boolean;
  resetKey: number;
}

function DraggableColorItem({
  item,
  size,
  originX,
  originY,
  targets,
  onMatch,
  onMiss,
  onPlaySnap,
  onPlayMiss,
  isComplete,
  resetKey,
}: DraggableItemProps) {
  const posRef = useRef({ x: originX, y: originY });
  const animPos = useRef(
    new Animated.ValueXY({ x: originX, y: originY })
  ).current;
  // Scales down to ~0.62 once dropped in basket (stays visible under basket)
  const itemScale = useRef(new Animated.Value(1)).current;
  const isMatchedRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    isMatchedRef.current = false;
    posRef.current = { x: originX, y: originY };
    animPos.setValue({ x: originX, y: originY });
    itemScale.setValue(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, originX, originY]);

  const { PanResponder } = require("react-native");

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () =>
          !isMatchedRef.current && !isComplete,
        onMoveShouldSetPanResponder: () =>
          !isMatchedRef.current && !isComplete,
        onPanResponderGrant: () => {
          setIsDragging(true);
          animPos.setOffset(posRef.current);
          animPos.setValue({ x: 0, y: 0 });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
        onPanResponderMove: Animated.event(
          [null, { dx: animPos.x, dy: animPos.y }],
          { useNativeDriver: false }
        ),
        onPanResponderRelease: (
          _: unknown,
          gs: { dx: number; dy: number }
        ) => {
          setIsDragging(false);
          animPos.flattenOffset();

          // Use ITEM CENTER (not top-left) for distance comparison
          const itemCenterX = posRef.current.x + gs.dx + size / 2;
          const itemCenterY = posRef.current.y + gs.dy + size / 2;
          posRef.current = {
            x: posRef.current.x + gs.dx,
            y: posRef.current.y + gs.dy,
          };

          if (isMatchedRef.current) return;

          let bestTarget: TargetWithPos | null = null;
          let bestDist = SNAP_DIST;

          for (const t of targets) {
            if (t.colorKey !== item.colorKey) continue;
            const dist = Math.hypot(
              itemCenterX - t.centerX,
              itemCenterY - t.centerY
            );
            if (dist < bestDist) {
              bestDist = dist;
              bestTarget = t;
            }
          }

          if (bestTarget) {
            // ✅ Match — snap item center to basket center, then scale down
            isMatchedRef.current = true;
            Animated.spring(animPos, {
              toValue: {
                x: bestTarget.centerX - size / 2,
                y: bestTarget.centerY - size / 2,
              },
              tension: 220,
              friction: 7,
              useNativeDriver: false,
            }).start(() => {
              Animated.spring(itemScale, {
                toValue: 0.62,
                tension: 200,
                friction: 8,
                useNativeDriver: false,
              }).start();
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onPlaySnap();
            onMatch(item.id, bestTarget.id);
          } else {
            // ❌ Miss — spring back silently
            onMiss();
            onPlayMiss();
            Animated.spring(animPos, {
              toValue: { x: originX, y: originY },
              tension: 110,
              friction: 11,
              useNativeDriver: false,
            }).start(() => {
              posRef.current = { x: originX, y: originY };
            });
          }
        },
        onPanResponderTerminate: (
          _: unknown,
          gs: { dx: number; dy: number }
        ) => {
          setIsDragging(false);
          animPos.flattenOffset();
          posRef.current = {
            x: posRef.current.x + gs.dx,
            y: posRef.current.y + gs.dy,
          };
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      originX,
      originY,
      item.colorKey,
      item.id,
      isComplete,
      size,
      ...targets.map((t) => t.id),
    ]
  );

  const innerSize = size * 0.68;

  return (
    <Animated.View
      style={[
        styles.itemAbsolute,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          zIndex: isDragging ? 300 : 20,
          transform: [
            ...animPos.getTranslateTransform(),
            { scale: itemScale },
          ],
          shadowColor: item.color,
          shadowOffset: { width: 0, height: isDragging ? 10 : 4 },
          shadowOpacity: isDragging ? 0.45 : 0.2,
          shadowRadius: isDragging ? 18 : 8,
          elevation: isDragging ? 18 : 4,
        },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Neutral cream outer circle — no color hint */}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#FFF8F0",
          borderWidth: 3,
          borderColor: "rgba(255,255,255,0.9)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {/* Large solid colored inner circle — this IS the item */}
        <View
          style={{
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            backgroundColor: item.color,
          }}
        />
      </View>
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────
export default function MatchingScreen() {
  const insets = useSafeAreaInsets();
  const { width: SW, height: SH } = Dimensions.get("window");

  const { soundEffects, volume } = useAppSettings();
  const { difficulty: diffLevel, recordSignal } = useDifficulty();
  const playPop = usePop();

  const snapPlayer = useAudioPlayer(
    require("@/assets/sounds/snap.wav") as number
  );
  const completePlayer = useAudioPlayer(
    require("@/assets/sounds/complete.wav") as number
  );

  // ── Puzzle state ──────────────────────────────────────────────
  const [resetKey, setResetKey] = useState(0);
  const [puzzle, setPuzzle] = useState(() => generateColorPuzzle(diffLevel));
  const [matchCounts, setMatchCounts] = useState<Record<string, number>>({});
  const [matchedItems, setMatchedItems] = useState<Record<string, boolean>>({});
  const [mascotMood, setMascotMood] = useState<MascotMood>("idle");

  const startTimeRef = useRef(Date.now());
  const missCountRef = useRef(0);
  const hitCountRef = useRef(0);

  useEffect(() => {
    const newPuzzle = generateColorPuzzle(diffLevel);
    setPuzzle(newPuzzle);
    setMatchCounts({});
    setMatchedItems({});
    setMascotMood("idle");
    startTimeRef.current = Date.now();
    missCountRef.current = 0;
    hitCountRef.current = 0;
    setResetKey((k) => k + 1);
  }, [diffLevel]);

  const totalItems = puzzle.items.length;
  const matchedCount = Object.keys(matchedItems).length;
  const isComplete = matchedCount === totalItems;

  // Items per color (all levels use same count per color)
  const { itemsPerColor } = useMemo(() => {
    const cfg = { 1: 1, 2: 2, 3: 2 } as const;
    return { itemsPerColor: cfg[diffLevel as 1 | 2 | 3] ?? 1 };
  }, [diffLevel]);

  // ── Sounds ────────────────────────────────────────────────────
  const playSnap = useCallback(() => {
    if (!soundEffects) return;
    try {
      snapPlayer.volume = volume;
      snapPlayer.seekTo(0);
      snapPlayer.play();
    } catch {}
  }, [snapPlayer, soundEffects, volume]);

  const playMiss = useCallback(() => {
    if (!soundEffects) return;
    playPop();
  }, [playPop, soundEffects]);

  // ── Match / miss handlers ─────────────────────────────────────
  const handleMatch = useCallback(
    (itemId: string, targetId: string) => {
      hitCountRef.current += 1;

      setMatchCounts((prev) => ({
        ...prev,
        [targetId]: (prev[targetId] ?? 0) + 1,
      }));
      setMatchedItems((prev) => {
        const next = { ...prev, [itemId]: true };

        if (Object.keys(next).length === totalItems) {
          setMascotMood("celebrate");
          recordSignal({
            screen: "matching",
            durationMs: Date.now() - startTimeRef.current,
            missCount: missCountRef.current,
            hitCount: hitCountRef.current,
          });
          setTimeout(() => {
            if (soundEffects) {
              try {
                completePlayer.volume = volume;
                completePlayer.seekTo(0);
                completePlayer.play();
              } catch {}
            }
          }, 180);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

          setTimeout(() => {
            const newPuzzle = generateColorPuzzle(diffLevel);
            setPuzzle(newPuzzle);
            setMatchCounts({});
            setMatchedItems({});
            setMascotMood("idle");
            startTimeRef.current = Date.now();
            missCountRef.current = 0;
            hitCountRef.current = 0;
            setResetKey((k) => k + 1);
          }, 1400);
        } else {
          setMascotMood("happy");
          setTimeout(() => setMascotMood("idle"), 1000);
        }

        return next;
      });
    },
    [totalItems, diffLevel, recordSignal, soundEffects, volume, completePlayer]
  );

  const handleMiss = useCallback(() => {
    missCountRef.current += 1;
  }, []);

  // ── Shuffle / new puzzle ──────────────────────────────────────
  const reshufflePuzzle = useCallback(() => {
    const newPuzzle = generateColorPuzzle(diffLevel);
    setPuzzle(newPuzzle);
    setMatchCounts({});
    setMatchedItems({});
    setMascotMood("idle");
    startTimeRef.current = Date.now();
    missCountRef.current = 0;
    hitCountRef.current = 0;
    setResetKey((k) => k + 1);
  }, [diffLevel]);

  // ── Layout ────────────────────────────────────────────────────
  const webOff = Platform.OS === "web" ? 67 : 0;
  const topSafe = insets.top + webOff;
  const botSafe = insets.bottom + (Platform.OS === "web" ? 34 : 0);
  const sideSafe = insets.left;

  const BASKET_SIZE = Math.max(Math.min(Math.floor(SW / 5.8), 130), 70);
  const ITEM_SIZE = Math.max(Math.min(Math.floor(SW / 7), 108), 58);

  const headerBottom = topSafe + HEADER_H;
  const basketCenterY = headerBottom + BASKET_V_PAD + BASKET_SIZE / 2;
  const basketAreaBottom =
    headerBottom + BASKET_V_PAD + BASKET_SIZE + BASKET_V_PAD;

  const itemAreaTop = basketAreaBottom + ITEM_AREA_TOP_PAD;
  const itemAreaH = SH - itemAreaTop - botSafe - 16;

  // Basket positions — centered row
  const numTargets = puzzle.targets.length;
  const totalBasketW = numTargets * BASKET_SIZE + (numTargets - 1) * BASKET_GAP;
  const basketStartX = sideSafe + (SW - totalBasketW) / 2;

  const targets: TargetWithPos[] = puzzle.targets.map((t, i) => ({
    ...t,
    centerX: basketStartX + i * (BASKET_SIZE + BASKET_GAP) + BASKET_SIZE / 2,
    centerY: basketCenterY,
  }));

  // Item positions — single row for ≤3, 2-row grid for more
  const itemPositions: Array<{ x: number; y: number }> = useMemo(() => {
    const n = puzzle.items.length;
    const perRow = n <= 3 ? n : Math.ceil(n / 2);
    const numRows = Math.ceil(n / perRow);

    const totalGridH =
      numRows * ITEM_SIZE + Math.max(0, numRows - 1) * ITEM_V_GAP;
    const gridStartY = itemAreaTop + Math.max(0, (itemAreaH - totalGridH) / 2);

    const positions: Array<{ x: number; y: number }> = [];

    for (let r = 0; r < numRows; r++) {
      const rowStart = r * perRow;
      const rowEnd = Math.min(rowStart + perRow, n);
      const rowCount = rowEnd - rowStart;
      const rowW = rowCount * ITEM_SIZE + (rowCount - 1) * ITEM_H_GAP;
      const rowStartX = sideSafe + (SW - rowW) / 2;
      const rowCenterY = gridStartY + r * (ITEM_SIZE + ITEM_V_GAP) + ITEM_SIZE / 2;

      for (let c = 0; c < rowCount; c++) {
        positions.push({
          x: rowStartX + c * (ITEM_SIZE + ITEM_H_GAP),
          y: rowCenterY,
        });
      }
    }

    return positions;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle.items.length, ITEM_SIZE, itemAreaTop, itemAreaH, SW, sideSafe]);

  return (
    <View
      style={[
        styles.root,
        { paddingLeft: insets.left, paddingRight: insets.right },
      ]}
    >
      {/* ── Background blobs ── */}
      <View style={styles.bgBlob1} pointerEvents="none" />
      <View style={styles.bgBlob2} pointerEvents="none" />

      {/* ── Header — back + shuffle only, no progress dots ── */}
      <View
        style={[
          styles.header,
          { top: topSafe, height: HEADER_H, left: insets.left, right: insets.right },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="arrow-left" size={28} color="#8A7060" />
        </Pressable>

        <View style={{ flex: 1 }} />

        <Pressable onPress={reshufflePuzzle} style={styles.headerBtn}>
          <Feather name="shuffle" size={24} color="#8A7060" />
        </Pressable>
      </View>

      {/* ── Draggable items — rendered FIRST, baskets appear on top ── */}
      {puzzle.items.map((item, idx) => {
        const pos = itemPositions[idx] ?? { x: 40, y: itemAreaTop + 20 };
        const ox = pos.x;
        const oy = pos.y - ITEM_SIZE / 2;
        return (
          <DraggableColorItem
            key={`${item.id}-${resetKey}`}
            item={item}
            size={ITEM_SIZE}
            originX={ox}
            originY={oy}
            targets={targets}
            onMatch={handleMatch}
            onMiss={handleMiss}
            onPlaySnap={playSnap}
            onPlayMiss={playMiss}
            isComplete={isComplete}
            resetKey={resetKey}
          />
        );
      })}

      {/* ── Baskets — rendered AFTER items so they sit on top ── */}
      {targets.map((t) => (
        <View
          key={t.id}
          style={{
            position: "absolute",
            left: t.centerX - BASKET_SIZE / 2,
            top: t.centerY - BASKET_SIZE / 2,
            zIndex: 50,
          }}
        >
          <BasketView
            target={t}
            size={BASKET_SIZE}
            matchCount={matchCounts[t.id] ?? 0}
            itemsPerColor={itemsPerColor}
          />
        </View>
      ))}

      {/* ── Mascot ── */}
      <View
        style={[
          styles.mascotCorner,
          { bottom: botSafe + 20, right: insets.right + 20 },
        ]}
      >
        <MatchingMascot
          mood={mascotMood}
          size={Math.min(BASKET_SIZE * 0.68, 72)}
        />
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFF7ED",
    overflow: "hidden",
  },
  bgBlob1: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#FFE5C8",
    opacity: 0.35,
    top: -70,
    right: -80,
  },
  bgBlob2: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "#C8EFE8",
    opacity: 0.28,
    bottom: -50,
    left: -60,
  },
  header: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    zIndex: 100,
  },
  headerBtn: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  basket: {
    justifyContent: "center",
    alignItems: "center",
  },
  itemAbsolute: {
    position: "absolute",
  },
  mascotCorner: {
    position: "absolute",
    zIndex: 50,
  },
});
