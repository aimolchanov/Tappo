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
  ImageBackground,
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

// ─── Assets ──────────────────────────────────────────────────────
const GAMES_BG = require("@/assets/images/games_background.png");

// Rotating pool of 7 puzzle images
const PUZZLE_IMAGES = [
  require("@/assets/images/puzzle_1.png"),
  require("@/assets/images/puzzle_2.png"),
  require("@/assets/images/puzzle_3.png"),
  require("@/assets/images/puzzle_4.png"),
  require("@/assets/images/puzzle_5.png"),
  require("@/assets/images/puzzle_6.png"),
  require("@/assets/images/puzzle_7.png"),
] as const;

// ─── Constants ───────────────────────────────────────────────────
const HEADER_H = 68;
const PIECE_GAP = 6;   // gap between adjacent pieces (visible as thin grid lines)
const TRAY_VPAD = 14;  // vertical padding inside tray dock
const TRAY_HPAD = 22;  // horizontal padding inside tray dock
const PIECE_GAP_TRAY = 12; // spacing between pieces in tray

// ─── Types ───────────────────────────────────────────────────────
interface PieceConfig {
  id: number;
  col: number;
  row: number;
  boardX: number; // absolute screen x when snapped
  boardY: number; // absolute screen y when snapped
  trayX: number;  // absolute screen x in tray (shuffled)
  trayY: number;  // absolute screen y in tray
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

// ─── PuzzlePieceView ─────────────────────────────────────────────
interface PieceProps {
  config: PieceConfig;
  pieceSize: number;
  boardW: number;
  boardH: number;
  snapDist: number;
  source: ReturnType<typeof require>;
  onPlaced: (id: number) => void;
  onMiss: () => void;
  onPlayMiss: () => void;
  resetKey: number;
  isComplete: boolean;
}

function PuzzlePieceView({
  config,
  pieceSize,
  boardW,
  boardH,
  snapDist,
  source,
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

  // Reset whenever puzzle is reshuffled (key change also unmounts/remounts,
  // this effect is a belt-and-suspenders guard)
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

          const tlX = posRef.current.x + gs.dx;
          const tlY = posRef.current.y + gs.dy;
          posRef.current = { x: tlX, y: tlY };

          if (isPlacedRef.current) return;

          // Compare piece center vs target slot center
          const cx = tlX + pieceSize / 2;
          const cy = tlY + pieceSize / 2;
          const tcx = config.boardX + pieceSize / 2;
          const tcy = config.boardY + pieceSize / 2;
          const dist = Math.hypot(cx - tcx, cy - tcy);

          if (dist < snapDist) {
            // ✅ Correct slot — snap & lock
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
            // ❌ Wrong spot — spring back quietly
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
      config.boardX, config.boardY,
      config.trayX, config.trayY,
      config.id,
      pieceSize, snapDist, isComplete,
      onMiss, onPlayMiss,
    ]
  );

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
          shadowOpacity: isDragging ? 0.38 : 0.15,
          shadowRadius: isDragging ? 16 : 6,
          elevation: isDragging ? 14 : 3,
        },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Clipping view — reveals only this piece's region of the full image */}
      <View
        style={{
          width: pieceSize,
          height: pieceSize,
          overflow: "hidden",
          borderRadius: 10,
        }}
      >
        <Image
          source={source}
          style={{
            width: boardW,
            height: boardH,
            position: "absolute",
            left: -config.col * (pieceSize + PIECE_GAP),
            top: -config.row * (pieceSize + PIECE_GAP),
          }}
          resizeMode="cover"
        />
        {/* Subtle gloss border */}
        <View
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: "rgba(255,255,255,0.45)",
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
  const playMissSound = usePop();

  const snapPlayer = useAudioPlayer(
    require("@/assets/sounds/snap.wav") as number
  );
  const completePlayer = useAudioPlayer(
    require("@/assets/sounds/complete.wav") as number
  );

  const { cols, rows } = LEVEL_TO_PUZZLE[diffLevel];
  const totalPieces = cols * rows;

  // ── State ─────────────────────────────────────────────────────
  const [puzzleIdx, setPuzzleIdx] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  // Track each placed piece by its id
  const [placedIds, setPlacedIds] = useState<Record<number, boolean>>({});

  const puzzleImage = PUZZLE_IMAGES[puzzleIdx % PUZZLE_IMAGES.length];
  const placedCount = Object.keys(placedIds).length;
  const isComplete = placedCount === totalPieces && totalPieces > 0;

  const startTimeRef = useRef(Date.now());
  const missCountRef = useRef(0);
  // Guard so completion effect fires exactly once per round
  const completionReportedRef = useRef(false);

  // Celebration scale lives here so diffLevel reset can clear it
  const celebScale = useSharedValue(1);

  // Reset when difficulty level changes
  useEffect(() => {
    setResetKey((k) => k + 1);
    setPlacedIds({});
    startTimeRef.current = Date.now();
    missCountRef.current = 0;
    completionReportedRef.current = false;
    celebScale.value = 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diffLevel]);

  // ── Completion — safely outside render phase ──────────────────
  // recordSignal MUST live here, not inside a setState updater,
  // to avoid "Cannot update a component while rendering another" error.
  useEffect(() => {
    if (!isComplete || completionReportedRef.current) return;
    completionReportedRef.current = true;

    recordSignal({
      screen: "puzzle",
      durationMs: Date.now() - startTimeRef.current,
      missCount: missCountRef.current,
      hitCount: totalPieces,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    celebScale.value = withSequence(
      withSpring(1.05, { damping: 5, stiffness: 140 }),
      withTiming(1.0, { duration: 600 })
    );

    setTimeout(() => {
      if (soundEffects) {
        try {
          completePlayer.volume = volume;
          completePlayer.seekTo(0);
          completePlayer.play();
        } catch {}
      }
    }, 150);

    // After short celebration → advance to next image, fresh puzzle
    setTimeout(() => {
      setPuzzleIdx((i) => i + 1);
      setPlacedIds({});
      startTimeRef.current = Date.now();
      missCountRef.current = 0;
      completionReportedRef.current = false;
      celebScale.value = 1;
      setResetKey((k) => k + 1);
    }, 1500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  // ── Handlers ──────────────────────────────────────────────────
  const handleMiss = useCallback(() => {
    missCountRef.current += 1;
  }, []);

  const handlePiecePlaced = useCallback(
    (id: number) => {
      if (soundEffects) {
        try {
          snapPlayer.volume = volume;
          snapPlayer.seekTo(0);
          snapPlayer.play();
        } catch {}
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Only update count state here — completion side-effects in useEffect above
      setPlacedIds((prev) => ({ ...prev, [id]: true }));
    },
    [snapPlayer, soundEffects, volume]
  );

  const resetPuzzle = useCallback(() => {
    setResetKey((k) => k + 1);
    setPlacedIds({});
    startTimeRef.current = Date.now();
    missCountRef.current = 0;
    completionReportedRef.current = false;
    celebScale.value = 1;
  }, [celebScale]);

  // ── Layout ────────────────────────────────────────────────────
  const webOff = Platform.OS === "web" ? 67 : 0;
  const topSafe = insets.top + webOff;
  const botSafe = insets.bottom + (Platform.OS === "web" ? 34 : 0);
  const contentTop = topSafe + HEADER_H;
  const contentH = SH - contentTop - botSafe - 8;
  const contentW = SW - insets.left - insets.right;

  // Tray row config — try to keep pieces in one row, 2 rows for larger counts
  const piecesPerTrayRow = totalPieces <= 5 ? totalPieces : Math.ceil(totalPieces / 2);
  const trayNumRows = Math.ceil(totalPieces / piecesPerTrayRow);

  // Reserve ~30% of content height for tray area (including dock + gaps)
  const trayAreaH = Math.max(90, contentH * 0.30);
  const boardAreaH = contentH - trayAreaH - 20; // 20px gap between board and tray

  // Piece size = minimum of 4 constraints so nothing overflows
  const pieceSize = Math.max(
    44,
    Math.min(
      // Board height: fit `rows` pieces vertically
      Math.floor((boardAreaH - PIECE_GAP * (rows - 1)) / rows),
      // Board width: board occupies at most 84% of screen width
      Math.floor((contentW * 0.84 - PIECE_GAP * (cols - 1)) / cols),
      // Tray height: fit `trayNumRows` pieces inside tray dock
      Math.floor((trayAreaH - TRAY_VPAD * 2 - PIECE_GAP_TRAY * (trayNumRows - 1)) / trayNumRows),
      // Tray width: fit `piecesPerTrayRow` pieces across full screen width
      Math.floor((contentW - TRAY_HPAD * 2 - PIECE_GAP_TRAY * (piecesPerTrayRow - 1)) / piecesPerTrayRow),
      190 // hard cap
    )
  );

  // Snap threshold: at least 25px, scales gently with piece size
  const snapDist = Math.max(25, Math.round(pieceSize * 0.20));

  // Board dimensions and absolute position
  const boardW = pieceSize * cols + PIECE_GAP * (cols - 1);
  const boardH = pieceSize * rows + PIECE_GAP * (rows - 1);
  const boardX = insets.left + Math.floor((contentW - boardW) / 2);
  const boardY = contentTop + Math.floor((boardAreaH - boardH) / 2);

  // Tray dock dimensions and absolute position
  const trayRowW = piecesPerTrayRow * pieceSize + (piecesPerTrayRow - 1) * PIECE_GAP_TRAY;
  const trayContainerW = Math.min(contentW - 32, trayRowW + TRAY_HPAD * 2);
  const trayContainerH =
    trayNumRows * pieceSize + (trayNumRows - 1) * PIECE_GAP_TRAY + TRAY_VPAD * 2;
  const trayX = insets.left + Math.floor((contentW - trayContainerW) / 2);
  const trayY = contentTop + boardAreaH + 20;

  // Starting X for the first tray piece (centered inside dock)
  const trayPieceStartX = trayX + Math.floor((trayContainerW - trayRowW) / 2);
  const trayPieceStartY = trayY + TRAY_VPAD;

  // ── Piece configs ─────────────────────────────────────────────
  const pieces = useMemo<PieceConfig[]>(() => {
    const all: PieceConfig[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        all.push({
          id: r * cols + c,
          col: c,
          row: r,
          boardX: boardX + c * (pieceSize + PIECE_GAP),
          boardY: boardY + r * (pieceSize + PIECE_GAP),
          trayX: 0,
          trayY: 0,
        });
      }
    }

    // Assign a random shuffled tray slot to each piece
    const order = shuffle(Array.from({ length: all.length }, (_, i) => i));
    order.forEach((pieceIndex, slot) => {
      const slotCol = slot % piecesPerTrayRow;
      const slotRow = Math.floor(slot / piecesPerTrayRow);
      all[pieceIndex].trayX = trayPieceStartX + slotCol * (pieceSize + PIECE_GAP_TRAY);
      all[pieceIndex].trayY = trayPieceStartY + slotRow * (pieceSize + PIECE_GAP_TRAY);
    });

    // ── Strict validation: every piece must have a finite, on-screen position
    const allValid =
      all.length === rows * cols &&
      all.every(
        (p) =>
          Number.isFinite(p.boardX) &&
          Number.isFinite(p.boardY) &&
          Number.isFinite(p.trayX) &&
          Number.isFinite(p.trayY)
      );

    if (!allValid) {
      console.warn(
        "[Puzzle] Piece validation FAILED — check layout constraints.",
        { cols, rows, pieceSize, boardX, boardY, trayX, trayY }
      );
    }

    return all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cols, rows, pieceSize,
    boardX, boardY,
    trayPieceStartX, trayPieceStartY,
    piecesPerTrayRow,
    resetKey,
  ]);

  const celebStyle = useAnimatedStyle(() => ({
    transform: [{ scale: celebScale.value }],
  }));

  return (
    <ImageBackground source={GAMES_BG} style={styles.root} resizeMode="cover">

      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          { top: topSafe, left: insets.left, right: insets.right },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="arrow-left" size={28} color="#6B5B4E" />
        </Pressable>

        {/* Progress dots: one per piece, fill teal as pieces snap */}
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

        <Pressable onPress={resetPuzzle} style={styles.headerBtn}>
          <Feather name="refresh-cw" size={24} color="#6B5B4E" />
        </Pressable>
      </View>

      {/* ── Board card shadow ── */}
      <View
        style={{
          position: "absolute",
          left: boardX - 10,
          top: boardY - 10,
          width: boardW + 20,
          height: boardH + 20,
          borderRadius: 18,
          backgroundColor: "rgba(255,255,255,0.42)",
          shadowColor: "#8B6A50",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.22,
          shadowRadius: 16,
          elevation: 6,
          zIndex: 2,
        }}
      />

      {/* ── Ghost cells — puzzle silhouette at each slot (20% opacity) ──
           Programmatic slicing: each cell renders the correct sub-region
           of the full image using overflow:hidden + negative offset.
           As the child places pieces, the full-opacity pieces gradually
           cover these ghost cells, completing the picture. ── */}
      {pieces.map((p) => (
        <View
          key={`ghost_${p.id}`}
          style={{
            position: "absolute",
            left: p.boardX,
            top: p.boardY,
            width: pieceSize,
            height: pieceSize,
            overflow: "hidden",
            borderRadius: 10,
            opacity: 0.22,
            zIndex: 3,
          }}
        >
          <Image
            source={puzzleImage}
            style={{
              width: boardW,
              height: boardH,
              position: "absolute",
              left: -p.col * (pieceSize + PIECE_GAP),
              top: -p.row * (pieceSize + PIECE_GAP),
            }}
            resizeMode="cover"
          />
        </View>
      ))}

      {/* ── Tray dock ── */}
      <View
        style={{
          position: "absolute",
          left: trayX,
          top: trayY,
          width: trayContainerW,
          height: trayContainerH,
          borderRadius: 22,
          backgroundColor: "rgba(255,247,237,0.72)",
          borderWidth: 2,
          borderColor: "rgba(255,255,255,0.68)",
          shadowColor: "#8B6A50",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.16,
          shadowRadius: 10,
          elevation: 4,
          zIndex: 2,
        }}
      />

      {/* ── Draggable pieces (float over board and tray) ── */}
      <Reanimated.View
        style={[StyleSheet.absoluteFill, celebStyle, { zIndex: 10 }]}
        pointerEvents="box-none"
      >
        {pieces.map((config) => (
          <PuzzlePieceView
            key={`${config.id}-${resetKey}`}
            config={config}
            pieceSize={pieceSize}
            boardW={boardW}
            boardH={boardH}
            snapDist={snapDist}
            source={puzzleImage}
            onPlaced={handlePiecePlaced}
            onMiss={handleMiss}
            onPlayMiss={playMissSound}
            resetKey={resetKey}
            isComplete={isComplete}
          />
        ))}
      </Reanimated.View>

    </ImageBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    position: "absolute",
    height: HEADER_H,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    zIndex: 100,
  },
  headerBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  progressRow: {
    flex: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    paddingHorizontal: 8,
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
  pieceAbsolute: {
    position: "absolute",
    left: 0,
    top: 0,
  },
});
