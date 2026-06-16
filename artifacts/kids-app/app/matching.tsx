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
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDifficulty } from "@/contexts/DifficultyContext";
import { useAppSettings } from "@/contexts/SettingsContext";
import {
  generateColorPuzzle,
  type MatchItem,
  type MatchTarget,
} from "@/data/matchingData";
import { usePop } from "@/hooks/usePopSound";

const GAMES_BG = require("@/assets/images/games_background.png");
const HEADER_H = 68;

// ─── Target + computed center ─────────────────────────────────────
interface TargetWithPos extends MatchTarget {
  centerX: number;
  centerY: number;
}

// ─── Solid colored rounded-rect target slot ───────────────────────
function TargetSlot({
  target,
  w,
  h,
  isMatched,
}: {
  target: TargetWithPos;
  w: number;
  h: number;
  isMatched: boolean;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isMatched) {
      scale.value = withSequence(
        withSpring(1.15, { damping: 3, stiffness: 500 }),
        withSpring(1.0, { damping: 7 })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMatched]);

  const R = Math.round(h * 0.32);
  const checkR = Math.round(h * 0.25);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Reanimated.View style={animStyle}>
      <View
        style={{
          width: w,
          height: h,
          borderRadius: R,
          backgroundColor: target.color,
          justifyContent: "center",
          alignItems: "center",
          shadowColor: target.color,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.5,
          shadowRadius: 14,
          elevation: 10,
        }}
      >
        {isMatched && (
          <View
            style={{
              width: checkR * 2,
              height: checkR * 2,
              borderRadius: checkR,
              backgroundColor: "rgba(255,255,255,0.32)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Feather name="check" size={Math.round(h * 0.28)} color="#fff" />
          </View>
        )}
      </View>
    </Reanimated.View>
  );
}

// ─── Draggable cream-card token ───────────────────────────────────
interface DraggableTokenProps {
  item: MatchItem;
  cardSize: number;
  innerSize: number;
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

function DraggableToken({
  item,
  cardSize,
  innerSize,
  originX,
  originY,
  targets,
  onMatch,
  onMiss,
  onPlaySnap,
  onPlayMiss,
  isComplete,
  resetKey,
}: DraggableTokenProps) {
  const { PanResponder } = require("react-native");

  const posRef = useRef({ x: originX, y: originY });
  const animPos = useRef(
    new Animated.ValueXY({ x: originX, y: originY })
  ).current;
  const isMatchedRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    isMatchedRef.current = false;
    posRef.current = { x: originX, y: originY };
    animPos.setValue({ x: originX, y: originY });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, originX, originY]);

  const snapDist = Math.max(80, cardSize * 0.9);

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

          const cx = posRef.current.x + gs.dx + cardSize / 2;
          const cy = posRef.current.y + gs.dy + cardSize / 2;
          posRef.current = {
            x: posRef.current.x + gs.dx,
            y: posRef.current.y + gs.dy,
          };

          if (isMatchedRef.current) return;

          let bestTarget: TargetWithPos | null = null;
          let bestDist = snapDist;

          for (const t of targets) {
            if (t.colorKey !== item.colorKey) continue;
            const dist = Math.hypot(cx - t.centerX, cy - t.centerY);
            if (dist < bestDist) {
              bestDist = dist;
              bestTarget = t;
            }
          }

          if (bestTarget) {
            isMatchedRef.current = true;
            Animated.spring(animPos, {
              toValue: {
                x: bestTarget.centerX - cardSize / 2,
                y: bestTarget.centerY - cardSize / 2,
              },
              tension: 220,
              friction: 7,
              useNativeDriver: false,
            }).start();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onPlaySnap();
            onMatch(item.id, bestTarget.id);
          } else {
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
      cardSize,
      snapDist,
      ...targets.map((t) => t.id),
    ]
  );

  return (
    <Animated.View
      style={[
        styles.tokenAbsolute,
        {
          width: cardSize,
          height: cardSize,
          borderRadius: cardSize / 2,
          zIndex: isDragging ? 300 : 20,
          transform: animPos.getTranslateTransform(),
          shadowColor: "#000",
          shadowOffset: { width: 0, height: isDragging ? 12 : 4 },
          shadowOpacity: isDragging ? 0.28 : 0.12,
          shadowRadius: isDragging ? 20 : 8,
          elevation: isDragging ? 20 : 4,
        },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Cream card outer */}
      <View
        style={{
          width: cardSize,
          height: cardSize,
          borderRadius: cardSize / 2,
          backgroundColor: "#FFF7ED",
          justifyContent: "center",
          alignItems: "center",
          borderWidth: 3,
          borderColor: "rgba(255,255,255,0.85)",
        }}
      >
        {/* Solid colored disk */}
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
  // matchedItemIds: set of item IDs that have been successfully matched
  const [matchedItemIds, setMatchedItemIds] = useState<Record<string, boolean>>({});
  // matchedTargetIds: which target IDs have been filled
  const [matchedTargetIds, setMatchedTargetIds] = useState<Record<string, boolean>>({});

  const startTimeRef = useRef(Date.now());
  const missCountRef = useRef(0);
  const hitCountRef = useRef(0);
  // Guard so completion effect fires exactly once per round
  const completionReportedRef = useRef(false);

  // Reset puzzle when difficulty level changes
  useEffect(() => {
    const newPuzzle = generateColorPuzzle(diffLevel);
    setPuzzle(newPuzzle);
    setMatchedItemIds({});
    setMatchedTargetIds({});
    startTimeRef.current = Date.now();
    missCountRef.current = 0;
    hitCountRef.current = 0;
    completionReportedRef.current = false;
    setResetKey((k) => k + 1);
  }, [diffLevel]);

  const totalItems = puzzle.items.length;
  const matchedCount = Object.keys(matchedItemIds).length;
  const isComplete = matchedCount === totalItems && totalItems > 0;

  // ── Completion effect — safely OUTSIDE render phase ────────────
  // This is the ONLY place recordSignal is called, inside useEffect,
  // after React has committed the state update. No setState-during-render.
  useEffect(() => {
    if (!isComplete || completionReportedRef.current) return;
    completionReportedRef.current = true;

    // Report to adaptive difficulty engine
    recordSignal({
      screen: "matching",
      durationMs: Date.now() - startTimeRef.current,
      missCount: missCountRef.current,
      hitCount: hitCountRef.current,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Play complete sound slightly after snap settles
    setTimeout(() => {
      if (soundEffects) {
        try {
          completePlayer.volume = volume;
          completePlayer.seekTo(0);
          completePlayer.play();
        } catch {}
      }
    }, 180);

    // After a short celebration, start a fresh round
    setTimeout(() => {
      const newPuzzle = generateColorPuzzle(diffLevel);
      setPuzzle(newPuzzle);
      setMatchedItemIds({});
      setMatchedTargetIds({});
      startTimeRef.current = Date.now();
      missCountRef.current = 0;
      hitCountRef.current = 0;
      completionReportedRef.current = false;
      setResetKey((k) => k + 1);
    }, 1400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

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

  // ── Match handler — only updates local state, no side effects ──
  const handleMatch = useCallback(
    (itemId: string, targetId: string) => {
      hitCountRef.current += 1;
      setMatchedItemIds((prev) => ({ ...prev, [itemId]: true }));
      setMatchedTargetIds((prev) => ({ ...prev, [targetId]: true }));
    },
    []
  );

  const handleMiss = useCallback(() => {
    missCountRef.current += 1;
  }, []);

  const reshufflePuzzle = useCallback(() => {
    const newPuzzle = generateColorPuzzle(diffLevel);
    setPuzzle(newPuzzle);
    setMatchedItemIds({});
    setMatchedTargetIds({});
    startTimeRef.current = Date.now();
    missCountRef.current = 0;
    hitCountRef.current = 0;
    completionReportedRef.current = false;
    setResetKey((k) => k + 1);
  }, [diffLevel]);

  // ── Layout dimensions ─────────────────────────────────────────
  const webOff = Platform.OS === "web" ? 67 : 0;
  const topSafe = insets.top + webOff;
  const botSafe = insets.bottom + (Platform.OS === "web" ? 34 : 0);
  const sideSafe = insets.left;

  const contentTop = topSafe + HEADER_H;
  const contentH = SH - contentTop - botSafe;

  // Target: solid colored wide rounded-rect
  const TARGET_W = Math.max(Math.min(Math.floor(SW / 5.2), 170), 90);
  const TARGET_H = Math.round(TARGET_W * 0.65);
  const TARGET_GAP = Math.max(18, Math.floor(SW * 0.038));

  // Token: cream circle card
  const CARD_SIZE = Math.max(Math.min(Math.floor(SW / 6.5), 140), 78);
  const INNER_SIZE = Math.round(CARD_SIZE * 0.66);
  const CARD_GAP = Math.max(22, Math.floor(SW * 0.045));

  // Target row centered at 26% of content height
  const numTargets = puzzle.targets.length;
  const totalTargetW = numTargets * TARGET_W + (numTargets - 1) * TARGET_GAP;
  const usableW = SW - sideSafe * 2;
  const targetStartX = sideSafe + (usableW - totalTargetW) / 2;
  const targetCenterY = contentTop + contentH * 0.26;

  const targets: TargetWithPos[] = puzzle.targets.map((t, i) => ({
    ...t,
    centerX: targetStartX + i * (TARGET_W + TARGET_GAP) + TARGET_W / 2,
    centerY: targetCenterY,
  }));

  // ── Token positions — always a single horizontal row ──────────
  // Exactly puzzle.items.length tokens (always equals numTargets since itemsPerColor=1).
  const tokenPositions = useMemo(() => {
    const n = puzzle.items.length;
    const totalRowW = n * CARD_SIZE + (n - 1) * CARD_GAP;
    const rowX = sideSafe + (usableW - totalRowW) / 2;
    // Center vertically around 73% of content height
    const rowY = contentTop + contentH * 0.73 - CARD_SIZE / 2;
    return puzzle.items.map((_, i) => ({
      x: rowX + i * (CARD_SIZE + CARD_GAP),
      y: rowY,
    }));
  }, [
    puzzle.items.length,
    CARD_SIZE,
    CARD_GAP,
    contentTop,
    contentH,
    usableW,
    sideSafe,
  ]);

  return (
    <ImageBackground source={GAMES_BG} style={styles.root} resizeMode="cover">
      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          {
            top: topSafe,
            height: HEADER_H,
            left: insets.left,
            right: insets.right,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="arrow-left" size={28} color="#6B5B4E" />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={reshufflePuzzle} style={styles.headerBtn}>
          <Feather name="shuffle" size={24} color="#6B5B4E" />
        </Pressable>
      </View>

      {/* ── Tokens rendered first (lower z-order, draggable) ── */}
      {puzzle.items.map((item, idx) => {
        const pos = tokenPositions[idx] ?? { x: 40, y: contentTop + 20 };
        return (
          <DraggableToken
            key={`${item.id}-${resetKey}`}
            item={item}
            cardSize={CARD_SIZE}
            innerSize={INNER_SIZE}
            originX={pos.x}
            originY={pos.y}
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

      {/* ── Target slots rendered above tokens ── */}
      {targets.map((t) => (
        <View
          key={t.id}
          style={{
            position: "absolute",
            left: t.centerX - TARGET_W / 2,
            top: t.centerY - TARGET_H / 2,
            zIndex: 50,
          }}
        >
          <TargetSlot
            target={t}
            w={TARGET_W}
            h={TARGET_H}
            isMatched={!!matchedTargetIds[t.id]}
          />
        </View>
      ))}
    </ImageBackground>
  );
}

// ─── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
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
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  tokenAbsolute: {
    position: "absolute",
  },
});
