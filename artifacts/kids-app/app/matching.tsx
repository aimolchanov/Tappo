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
  withTiming,
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
const BASKET_V_PAD = 18;  // space above the baskets row
const BASKET_GAP = 26;    // horizontal gap between baskets
const ITEM_H_GAP = 18;    // horizontal gap between items
const ITEM_V_GAP = 22;    // vertical gap between item rows
const ITEM_AREA_TOP_PAD = 24; // space between basket row bottom and first item row
const SNAP_DIST = 82;

// ─── Colour basket (target) ───────────────────────────────────────
interface TargetWithPos extends MatchTarget {
  centerX: number;
  centerY: number;
}

function BasketView({
  target,
  size,
  matchCount,
}: {
  target: TargetWithPos;
  size: number;
  matchCount: number;
}) {
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (matchCount > 0) {
      scale.value = withSequence(
        withSpring(1.18, { damping: 3, stiffness: 500 }),
        withSpring(1.0, { damping: 7 })
      );
      glow.value = withTiming(1, { duration: 200 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchCount]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const borderR = size / 2;
  const isFilled = matchCount > 0;

  return (
    <Reanimated.View style={animStyle}>
      <View
        style={[
          styles.basket,
          {
            width: size,
            height: size,
            borderRadius: borderR,
            backgroundColor: target.color,
            borderWidth: isFilled ? 4 : 3,
            borderColor: isFilled ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)",
            borderStyle: isFilled ? "solid" : "dashed",
            shadowColor: target.color,
            shadowOffset: { width: 0, height: size * 0.08 },
            shadowOpacity: isFilled ? 0.55 : 0.3,
            shadowRadius: size * 0.14,
            elevation: isFilled ? 12 : 6,
          },
        ]}
      >
        {/* Open basket icon — dashed ring when empty, checkmarks when full */}
        <Text style={{ fontSize: size * 0.38, opacity: isFilled ? 1 : 0.55 }}>
          {isFilled ? "✓" : "○"}
        </Text>
        {isFilled && (
          <Text style={{ fontSize: size * 0.2, marginTop: -2 }}>
            {matchCount > 1 ? `×${matchCount}` : ""}
          </Text>
        )}
      </View>
    </Reanimated.View>
  );
}

// ─── Draggable item ───────────────────────────────────────────────
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
  // Scale shrinks to ~0.62 when item lands in basket — stays visible under basket
  const itemScale = useRef(new Animated.Value(1)).current;
  const isMatchedRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  // Reset on new puzzle
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

          const droppedX = posRef.current.x + gs.dx;
          const droppedY = posRef.current.y + gs.dy;
          posRef.current = { x: droppedX, y: droppedY };

          if (isMatchedRef.current) return;

          // Find nearest basket whose color matches this item
          let bestTarget: TargetWithPos | null = null;
          let bestDist = SNAP_DIST;

          for (const t of targets) {
            const dist = Math.hypot(
              droppedX - t.centerX,
              droppedY - t.centerY
            );
            if (dist < bestDist && t.colorKey === item.colorKey) {
              bestDist = dist;
              bestTarget = t;
            }
          }

          if (bestTarget) {
            // ✅ Correct match — snap to basket center, then scale down so it
            //    sits visually "inside" the basket (basket renders on top).
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
            // ❌ Wrong basket or empty space — float back, no punishment
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
    [originX, originY, item.colorKey, item.id, isComplete, ...targets.map((t) => t.id)]
  );

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
          shadowOpacity: isDragging ? 0.5 : 0.28,
          shadowRadius: isDragging ? 16 : 8,
          elevation: isDragging ? 16 : 5,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: item.color,
          justifyContent: "center",
          alignItems: "center",
          borderWidth: 3.5,
          borderColor: "rgba(255,255,255,0.65)",
        }}
      >
        <Text style={{ fontSize: size * 0.45, lineHeight: size * 0.55 }}>
          {item.emoji}
        </Text>
      </View>
    </Animated.View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────
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

  // Tracking for adaptive difficulty
  const startTimeRef = useRef(Date.now());
  const missCountRef = useRef(0);
  const hitCountRef = useRef(0);

  // Regenerate puzzle when difficulty changes
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

  // ── Sound helpers ─────────────────────────────────────────────
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
    // Use pop at reduced volume as a soft neutral cue
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
          // All matched — celebrate!
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

          // Auto-generate next puzzle
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
          // Partial match — brief happy reaction
          setMascotMood("happy");
          setTimeout(() => setMascotMood("idle"), 1000);
        }

        return next;
      });
    },
    [
      totalItems,
      diffLevel,
      recordSignal,
      soundEffects,
      volume,
      completePlayer,
    ]
  );

  const handleMiss = useCallback(() => {
    missCountRef.current += 1;
  }, []);

  // ── Layout computation ────────────────────────────────────────
  const webOff = Platform.OS === "web" ? 67 : 0;
  const topSafe = insets.top + webOff;
  const botSafe = insets.bottom + (Platform.OS === "web" ? 34 : 0);
  const sideSafe = insets.left;

  // Sizes relative to screen — works on both iPad and phone
  const BASKET_SIZE = Math.max(Math.min(Math.floor(SW / 6.2), 130), 70);
  const ITEM_SIZE = Math.max(Math.min(Math.floor(SW / 7.5), 110), 60);

  const headerBottom = topSafe + HEADER_H;
  const basketCenterY =
    headerBottom + BASKET_V_PAD + BASKET_SIZE / 2;
  const basketAreaBottom = headerBottom + BASKET_V_PAD + BASKET_SIZE + BASKET_V_PAD;

  const itemAreaTop = basketAreaBottom + ITEM_AREA_TOP_PAD;
  const itemAreaH = SH - itemAreaTop - botSafe - 16;

  // Basket positions — centered row
  const numTargets = puzzle.targets.length;
  const totalBasketW =
    numTargets * BASKET_SIZE + (numTargets - 1) * BASKET_GAP;
  const basketStartX = sideSafe + (SW - totalBasketW) / 2;

  const targets: TargetWithPos[] = puzzle.targets.map((t, i) => ({
    ...t,
    centerX: basketStartX + i * (BASKET_SIZE + BASKET_GAP) + BASKET_SIZE / 2,
    centerY: basketCenterY,
  }));

  // Item positions — 2-row grid, centered
  const itemPositions: Array<{ x: number; y: number }> = useMemo(() => {
    const n = puzzle.items.length;
    const topCount = Math.ceil(n / 2);
    const botCount = n - topCount;

    // Row Y positions — ensure they fit in itemAreaH
    const twoRowH = 2 * ITEM_SIZE + ITEM_V_GAP;
    const rowsStartY = itemAreaTop + Math.max(0, (itemAreaH - twoRowH) / 2);

    const row1Y = rowsStartY + ITEM_SIZE / 2;
    const row2Y = rowsStartY + ITEM_SIZE + ITEM_V_GAP + ITEM_SIZE / 2;

    const positions: Array<{ x: number; y: number }> = [];

    // Top row
    const topRowW = topCount * ITEM_SIZE + (topCount - 1) * ITEM_H_GAP;
    const topStartX = sideSafe + (SW - topRowW) / 2;
    for (let i = 0; i < topCount; i++) {
      positions.push({
        x: topStartX + i * (ITEM_SIZE + ITEM_H_GAP),
        y: row1Y,
      });
    }

    // Bottom row (offset by half an item width for stagger feel)
    const botRowW = botCount * ITEM_SIZE + (botCount - 1) * ITEM_H_GAP;
    const botStartX = sideSafe + (SW - botRowW) / 2 + ITEM_SIZE * 0.3;
    for (let i = 0; i < botCount; i++) {
      positions.push({
        x: botStartX + i * (ITEM_SIZE + ITEM_H_GAP),
        y: row2Y,
      });
    }

    return positions;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle.items.length, ITEM_SIZE, itemAreaTop, itemAreaH, SW, sideSafe]);

  // ── Progress dots ─────────────────────────────────────────────
  const progressDots = Array.from({ length: totalItems }, (_, i) => (
    <View
      key={i}
      style={[
        styles.progDot,
        i < matchedCount && styles.progDotFilled,
      ]}
    />
  ));

  return (
    <View
      style={[
        styles.root,
        {
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      {/* ── Background blobs ── */}
      <View style={styles.bgBlob1} pointerEvents="none" />
      <View style={styles.bgBlob2} pointerEvents="none" />

      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          { top: topSafe, height: HEADER_H, left: insets.left, right: insets.right },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="arrow-left" size={28} color="#8A7060" />
        </Pressable>

        <View style={styles.progRow}>{progressDots}</View>

        {/* Shuffle / replay button */}
        <Pressable
          onPress={() => {
            const newPuzzle = generateColorPuzzle(diffLevel);
            setPuzzle(newPuzzle);
            setMatchCounts({});
            setMatchedItems({});
            setMascotMood("idle");
            startTimeRef.current = Date.now();
            missCountRef.current = 0;
            hitCountRef.current = 0;
            setResetKey((k) => k + 1);
          }}
          style={styles.headerBtn}
        >
          <Feather name="shuffle" size={24} color="#8A7060" />
        </Pressable>
      </View>

      {/* ── Draggable items — rendered FIRST so baskets appear on top ── */}
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

      {/* ── Baskets row — rendered AFTER items so they appear on top ── */}
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
        <MatchingMascot mood={mascotMood} size={Math.min(BASKET_SIZE * 0.68, 72)} />
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
  progRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
  },
  progDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#E0D0C0",
  },
  progDotFilled: {
    backgroundColor: "#FF9500",
    shadowColor: "#FF9500",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
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
