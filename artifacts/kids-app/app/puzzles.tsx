import { Feather } from "@expo/vector-icons";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useAppSettings } from "@/contexts/SettingsContext";
import { useDifficulty } from "@/contexts/DifficultyContext";
import { LEVEL_TO_PUZZLE } from "@/constants/difficulty";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
// Картинка для пазла лежит в assets/images/puzzle_1.png
// Чтобы заменить — положите новый файл вместо неё (любой .png/.jpg)
const PUZZLE_IMAGE = require("@/assets/images/puzzle_1.png");

const SNAP_DIST = 60;
const HEADER_H = 76;
const GAP = 10;

const DIFFICULTY = {
  easy:   { cols: 2, rows: 2 },
  medium: { cols: 3, rows: 2 },
  hard:   { cols: 3, rows: 3 },
} as const;

type Difficulty = keyof typeof DIFFICULTY;

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

// ─── Difficulty icon ──────────────────────────────────────────────
function DiffIcon({
  cols,
  rows,
  active,
}: {
  cols: number;
  rows: number;
  active: boolean;
}) {
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
// React Native's View overflow:hidden clips the image exactly —
// Animated.ValueXY moves the piece; GPU-composited on iOS (smooth).
interface PieceProps {
  config: PieceConfig;
  pieceSize: number;
  cols: number;
  rows: number;
  onPlaced: (id: number) => void;
  onMiss: () => void;
  resetKey: number;
  isComplete: boolean;
}

function PuzzlePieceView({
  config,
  pieceSize,
  cols,
  rows,
  onPlaced,
  onMiss,
  resetKey,
  isComplete,
}: PieceProps) {
  const posRef = useRef({ x: config.trayX, y: config.trayY });
  const animPos = useRef(
    new Animated.ValueXY({ x: config.trayX, y: config.trayY })
  ).current;
  const isPlacedRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  // Reset on difficulty change
  useEffect(() => {
    isPlacedRef.current = false;
    posRef.current = { x: config.trayX, y: config.trayY };
    animPos.setValue({ x: config.trayX, y: config.trayY });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, config.trayX, config.trayY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () =>
          !isPlacedRef.current && !isComplete,
        onMoveShouldSetPanResponder: () =>
          !isPlacedRef.current && !isComplete,
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
          const x = posRef.current.x + gs.dx;
          const y = posRef.current.y + gs.dy;
          posRef.current = { x, y };

          if (!isPlacedRef.current) {
            const dist = Math.hypot(
              x - config.boardX,
              y - config.boardY
            );
            if (dist < SNAP_DIST) {
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
              onMiss();
            }
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
    [config.boardX, config.boardY, config.id, isComplete, onMiss]
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
      {/* Clip the full image to show only this piece's portion */}
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
        {/* Subtle white border frame */}
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

  // Tracking refs for adaptive difficulty signal
  const startTimeRef = useRef(Date.now());
  const missCountRef = useRef(0);

  // Reset puzzle when difficulty level changes externally
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

  // ── Layout math ──
  const topPad = HEADER_H + insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);
  const availH = SH - topPad - botPad - 24;
  const totalW = SW - insets.left - insets.right - 32;
  const boardW = totalW * 0.60;
  const trayLeft = insets.left + 16 + boardW + 24;
  const trayW = totalW - boardW - 24;

  const pieceSize = Math.min(
    Math.floor((boardW - GAP * (cols - 1)) / cols),
    Math.floor((availH - GAP * (rows - 1)) / rows),
    Math.floor((trayW - GAP) / 2) - 4,
    190
  );

  const boardActW = pieceSize * cols + GAP * (cols - 1);
  const boardActH = pieceSize * rows + GAP * (rows - 1);
  const boardX0 = insets.left + 16 + (boardW - boardActW) / 2;
  const boardY0 = topPad + (availH - boardActH) / 2;

  // ── Piece configs ──
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
    const order = shuffle(Array.from({ length: all.length }, (_, i) => i));
    order.forEach((origIdx, slot) => {
      const trayCol = slot % 2;
      const trayRow = Math.floor(slot / 2);
      all[origIdx].trayX =
        trayLeft + trayCol * (pieceSize + GAP);
      all[origIdx].trayY =
        topPad + 8 + trayRow * (pieceSize + GAP);
    });
    return all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols, rows, pieceSize, boardX0, boardY0, trayLeft, topPad, resetKey]);

  // ── Celebration animation ──
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
        // Record adaptive difficulty signal — silently, never shown to child
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

  // ── Board slot outlines ──
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

        {/* Progress dots — count changes with adaptive difficulty */}
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

        {/* Replay button — resets current puzzle at same difficulty */}
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
            cols={cols}
            rows={rows}
            onPlaced={handlePiecePlaced}
            onMiss={handleMiss}
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
  diffRow: {
    flexDirection: "row",
    gap: 8,
  },
  diffBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.06)",
    justifyContent: "center",
    alignItems: "center",
    minWidth: 54,
    minHeight: 52,
  },
  diffBtnActive: {
    backgroundColor: "#4ECDC4",
  },
  progressRow: {
    flexDirection: "row",
    gap: 7,
    marginLeft: "auto",
    marginRight: 8,
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
