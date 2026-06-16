import { Feather } from "@expo/vector-icons";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useAppSettings } from "@/contexts/SettingsContext";
import { useDifficulty } from "@/contexts/DifficultyContext";
import { LEVEL_TO_PUZZLE } from "@/constants/difficulty";
import { usePop } from "@/hooks/usePopSound";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
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
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Config ──────────────────────────────────────────────────────
const PUZZLE_IMAGE = require("@/assets/images/puzzle_1.png");

const GAP = 10;
const HEADER_H = 76;
// Snap distance is capped — computed relative to pieceSize inside the screen
const BASE_SNAP_RATIO = 0.55; // piece must be within 55% of its own size to snap

// ─── Types ───────────────────────────────────────────────────────
interface PieceConfig {
  id: number;
  col: number;
  row: number;
  boardX: number;
  boardY: number;
  trayX: number;
  trayY: number;
}

// ─── Helpers ─────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Difficulty grid icon ─────────────────────────────────────────
function DiffIcon({ cols, rows, active }: { cols: number; rows: number; active: boolean }) {
  return (
    <View style={{ gap: 4 }}>
      {Array.from({ length: rows }, (_, r) => (
        <View key={r} style={{ flexDirection: "row", gap: 4 }}>
          {Array.from({ length: cols }, (_, c) => (
            <View
              key={c}
              style={{
                width: 9,
                height: 9,
                borderRadius: 5,
                backgroundColor: active ? "#FFFFFF" : "#777",
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── One puzzle piece ─────────────────────────────────────────────
interface PieceProps {
  config: PieceConfig;
  pieceSize: number;
  snapDist: number;
  cols: number;
  rows: number;
  onPlaced: (id: number) => void;
  onMiss: () => void;
  onPlayMiss: () => void;
  resetKey: number;
  isComplete: boolean;
}

function PuzzlePieceView({
  config,
  pieceSize,
  snapDist,
  cols,
  rows,
  onPlaced,
  onMiss,
  onPlayMiss,
  resetKey,
  isComplete,
}: PieceProps) {
  const posRef = useRef({ x: config.trayX, y: config.trayY });
  const animPos = useRef(
    new Animated.ValueXY({ x: config.trayX, y: config.trayY })
  ).current;
  const isPlacedRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  // Reset on difficulty change or puzzle reset
  useEffect(() => {
    isPlacedRef.current = false;
    posRef.current = { x: config.trayX, y: config.trayY };
    animPos.setValue({ x: config.trayX, y: config.trayY });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, config.trayX, config.trayY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !isPlacedRef.current && !isComplete,
        onMoveShouldSetPanResponder: () => !isPlacedRef.current && !isComplete,
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
        onPanResponderRelease: (_, gs) => {
          setIsDragging(false);
          animPos.flattenOffset();

          // Use PIECE CENTER for distance check (same as matching screen)
          const tlX = posRef.current.x + gs.dx;
          const tlY = posRef.current.y + gs.dy;
          posRef.current = { x: tlX, y: tlY };

          if (isPlacedRef.current) return;

          const centerX = tlX + pieceSize / 2;
          const centerY = tlY + pieceSize / 2;
          const targetCX = config.boardX + pieceSize / 2;
          const targetCY = config.boardY + pieceSize / 2;
          const dist = Math.hypot(centerX - targetCX, centerY - targetCY);

          if (dist < snapDist) {
            // ✅ Correct slot — snap and lock
            isPlacedRef.current = true;
            posRef.current = { x: config.boardX, y: config.boardY };
            Animated.spring(animPos, {
              toValue: { x: config.boardX, y: config.boardY },
              tension: 200,
              friction: 7,
              useNativeDriver: false,
            }).start();
            onPlaced(config.id);
          } else {
            // ❌ Wrong spot — gentle spring back to tray, no punishment
            onMiss();
            onPlayMiss();
            Animated.spring(animPos, {
              toValue: { x: config.trayX, y: config.trayY },
              tension: 110,
              friction: 11,
              useNativeDriver: false,
            }).start(() => {
              posRef.current = { x: config.trayX, y: config.trayY };
            });
          }
        },
        onPanResponderTerminate: (_, gs) => {
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
      config.boardX,
      config.boardY,
      config.trayX,
      config.trayY,
      config.id,
      pieceSize,
      snapDist,
      isComplete,
      onMiss,
      onPlayMiss,
    ]
  );

  const totalW = pieceSize * cols;
  const totalH = pieceSize * rows;

  return (
    <Animated.View
      style={[
        styles.pieceAbsolute,
        {
          width: pieceSize,
          height: pieceSize,
          zIndex: isDragging ? 200 : 10,
          transform: animPos.getTranslateTransform(),
          shadowColor: "#000",
          shadowOffset: { width: 0, height: isDragging ? 10 : 3 },
          shadowOpacity: isDragging ? 0.42 : 0.18,
          shadowRadius: isDragging ? 14 : 6,
          elevation: isDragging ? 12 : 3,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View
        style={{
          width: pieceSize,
          height: pieceSize,
          overflow: "hidden",
          borderRadius: 10,
        }}
      >
        <Image
          source={PUZZLE_IMAGE}
          style={{
            width: totalW,
            height: totalH,
            position: "absolute",
            left: -config.col * pieceSize,
            top: -config.row * pieceSize,
          }}
          resizeMode="cover"
        />
        <View
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 10,
            borderWidth: 2.5,
            borderColor: "rgba(255,255,255,0.5)",
          }}
        />
      </View>
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────
export default function PuzzlesScreen() {
  const insets = useSafeAreaInsets();
  const { width: SW, height: SH } = Dimensions.get("window");

  const { soundEffects, volume } = useAppSettings();
  const { difficulty: diffLevel, recordSignal } = useDifficulty();
  // Shared miss sound — same pop.wav used by the matching screen
  const playMissSound = usePop();

  const snapPlayer = useAudioPlayer(
    require("@/assets/sounds/snap.wav") as number
  );
  const completePlayer = useAudioPlayer(
    require("@/assets/sounds/complete.wav") as number
  );

  const { cols, rows } = LEVEL_TO_PUZZLE[diffLevel];
  const totalPieces = cols * rows;

  const [resetKey, setResetKey] = useState(0);
  const [placedCount, setPlacedCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const startTimeRef = useRef(Date.now());
  const missCountRef = useRef(0);

  useEffect(() => {
    setResetKey((k) => k + 1);
    setPlacedCount(0);
    setIsComplete(false);
    celebScale.value = 1;
    startTimeRef.current = Date.now();
    missCountRef.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diffLevel]);

  const handleMiss = useCallback(() => {
    missCountRef.current += 1;
  }, []);

  // ── Layout math ──────────────────────────────────────────────
  const topPad = HEADER_H + insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);
  const availH = SH - topPad - botPad - 24;
  const totalW = SW - insets.left - insets.right - 32;
  const boardW = totalW * 0.60;
  const trayLeft = insets.left + 16 + boardW + 24;
  const trayW = totalW - boardW - 24;

  // Tray layout: 2 columns; trayRows = how many vertical rows the tray needs
  const trayColCount = 2;
  const trayRows = Math.ceil(totalPieces / trayColCount);

  // pieceSize constrained by BOTH board AND tray dimensions.
  // Without the tray-height constraint, the bottom tray row(s) can render
  // off-screen, making those pieces invisible and their board slots unfillable.
  const pieceSize = Math.max(
    30,
    Math.min(
      Math.floor((boardW - GAP * (cols - 1)) / cols),           // board column width
      Math.floor((availH - GAP * (rows - 1)) / rows),           // board row height
      Math.floor((trayW - GAP * (trayColCount - 1)) / trayColCount) - 4, // tray column width
      Math.floor((availH - GAP * (trayRows - 1)) / trayRows),   // ← NEW: tray row height
      190
    )
  );

  // Snap distance scales with piece size so it feels consistent on all screen sizes
  const snapDist = Math.round(pieceSize * BASE_SNAP_RATIO);

  const boardActW = pieceSize * cols + GAP * (cols - 1);
  const boardActH = pieceSize * rows + GAP * (rows - 1);
  const boardX0 = insets.left + 16 + (boardW - boardActW) / 2;
  const boardY0 = topPad + (availH - boardActH) / 2;

  // ── Piece configs ─────────────────────────────────────────────
  const pieces = useMemo<PieceConfig[]>(() => {
    const all: PieceConfig[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        all.push({
          id: r * cols + c,
          col: c,
          row: r,
          boardX: boardX0 + c * (pieceSize + GAP),
          boardY: boardY0 + r * (pieceSize + GAP),
          trayX: 0,
          trayY: 0,
        });
      }
    }

    // Assign each piece a unique random tray slot
    const slotOrder = shuffle(Array.from({ length: all.length }, (_, i) => i));
    slotOrder.forEach((pieceIdx, slot) => {
      const trayCol = slot % trayColCount;
      const trayRow = Math.floor(slot / trayColCount);
      all[pieceIdx].trayX = trayLeft + trayCol * (pieceSize + GAP);
      all[pieceIdx].trayY = topPad + 8 + trayRow * (pieceSize + GAP);
    });

    // Safety check: validate that every piece has a valid tray position.
    // With the tray-height constraint above this should never fire, but
    // belt-and-suspenders guarantees a complete, solvable puzzle.
    const allValid = all.every(
      (p) =>
        p.trayX >= trayLeft &&
        p.trayY >= topPad &&
        p.trayY + pieceSize <= topPad + availH + botPad + 24
    );
    if (!allValid || all.length !== rows * cols) {
      // Regeneration would normally not be needed; this is a safeguard
      console.warn("[Puzzle] piece set invalid — check layout constraints");
    }

    return all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols, rows, pieceSize, boardX0, boardY0, trayLeft, topPad, trayColCount, resetKey]);

  // ── Celebration animation ─────────────────────────────────────
  const celebScale = useSharedValue(1);
  const celebStyle = useAnimatedStyle(() => ({
    transform: [{ scale: celebScale.value }],
  }));

  const handlePiecePlaced = (id: number) => {
    if (soundEffects) {
      try {
        snapPlayer.volume = volume;
        snapPlayer.seekTo(0);
        snapPlayer.play();
      } catch {}
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setPlacedCount((prev) => {
      const next = prev + 1;
      if (next === totalPieces) {
        setIsComplete(true);
        recordSignal({
          screen: "puzzle",
          durationMs: Date.now() - startTimeRef.current,
          missCount: missCountRef.current,
          hitCount: next,
        });
        setTimeout(() => {
          if (soundEffects) {
            try {
              completePlayer.volume = volume;
              completePlayer.seekTo(0);
              completePlayer.play();
            } catch {}
          }
        }, 150);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        celebScale.value = withSequence(
          withSpring(1.05, { damping: 5, stiffness: 140 }),
          withTiming(1.0, { duration: 500 })
        );
      }
      return next;
    });
  };

  const resetPuzzle = useCallback(() => {
    setResetKey((k) => k + 1);
    setPlacedCount(0);
    setIsComplete(false);
    celebScale.value = 1;
    startTimeRef.current = Date.now();
    missCountRef.current = 0;
  }, [celebScale]);

  // ── Board slot outlines ───────────────────────────────────────
  const slots = useMemo(() => {
    const result = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        result.push({
          key: `${r}-${c}`,
          left: boardX0 + c * (pieceSize + GAP),
          top: boardY0 + r * (pieceSize + GAP),
        });
      }
    }
    return result;
  }, [rows, cols, boardX0, boardY0, pieceSize]);

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
          paddingBottom: botPad,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={28} color="#555" />
        </Pressable>

        <View style={styles.progressRow}>
          {Array.from({ length: totalPieces }, (_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                i < placedCount && styles.progressDotFilled,
              ]}
            />
          ))}
        </View>

        <Pressable onPress={resetPuzzle} style={styles.backBtn}>
          <Feather name="refresh-cw" size={24} color="#555" />
        </Pressable>
      </View>

      {/* ── Board slot outlines ── */}
      {slots.map((slot) => (
        <View
          key={slot.key}
          style={[
            styles.slot,
            {
              left: slot.left,
              top: slot.top,
              width: pieceSize,
              height: pieceSize,
            },
          ]}
        />
      ))}

      {/* ── Tray separator line ── */}
      <View
        style={[
          styles.trayLine,
          { left: trayLeft - 14, top: topPad, height: availH },
        ]}
      />

      {/* ── Puzzle pieces ── */}
      <Reanimated.View
        style={[StyleSheet.absoluteFill, celebStyle]}
        pointerEvents="box-none"
      >
        {pieces.map((config) => (
          <PuzzlePieceView
            key={`${config.id}-${resetKey}`}
            config={config}
            pieceSize={pieceSize}
            snapDist={snapDist}
            cols={cols}
            rows={rows}
            onPlaced={handlePiecePlaced}
            onMiss={handleMiss}
            onPlayMiss={playMissSound}
            resetKey={resetKey}
            isComplete={isComplete}
          />
        ))}
      </Reanimated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F0E8",
  },
  header: {
    height: HEADER_H,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 14,
  },
  backBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.07)",
    justifyContent: "center",
    alignItems: "center",
  },
  progressRow: {
    flexDirection: "row",
    gap: 7,
    marginLeft: "auto",
    marginRight: 8,
    flexWrap: "wrap",
    justifyContent: "center",
    maxWidth: "60%",
  },
  progressDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: "rgba(0,0,0,0.14)",
  },
  progressDotFilled: {
    backgroundColor: "#4ECDC4",
  },
  slot: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.18)",
    borderRadius: 10,
    borderStyle: "dashed",
    backgroundColor: "rgba(0,0,0,0.03)",
  },
  pieceAbsolute: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  trayLine: {
    position: "absolute",
    width: 2,
    backgroundColor: "rgba(0,0,0,0.08)",
    borderRadius: 1,
  },
});
