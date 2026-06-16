/**
 * Free Drawing Screen
 *
 * To change colours: edit PALETTE array below (12 hex strings).
 * To change brush sizes: edit BRUSH_SIZES array below (3 pixel values).
 */
import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
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
  Alert,
  Animated,
  ImageBackground,
  Platform,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  Canvas,
  Path,
  Skia,
  SkPath,
  useCanvasRef,
} from "@shopify/react-native-skia";
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const GAMES_BG = require("@/assets/images/games_background.png");

// ─── Configuration ────────────────────────────────────────────────────────────
// Edit these to change the palette and brush sizes.

/** 12 colours shown in the palette row */
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

/** Brush stroke widths in pixels: [small, medium, large] */
const BRUSH_SIZES = [5, 14, 26] as const;
type BrushSize = (typeof BRUSH_SIZES)[number];

// ─── Saves directory ─────────────────────────────────────────────────────────
const SAVE_DIR = FileSystem.documentDirectory + "my_works/";

async function ensureSaveDir() {
  const info = await FileSystem.getInfoAsync(SAVE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(SAVE_DIR, { intermediates: true });
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Stroke {
  path: SkPath;
  color: string;
  width: BrushSize;
}

// ─── Colour Circle ────────────────────────────────────────────────────────────
function ColorCircle({
  color,
  selected,
  onPress,
}: {
  color: string;
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(selected ? 1.3 : 1);

  useEffect(() => {
    scale.value = withSpring(selected ? 1.3 : 1, { damping: 12, stiffness: 300 });
  }, [selected, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable onPress={onPress} hitSlop={6}>
      <Reanimated.View
        style={[
          styles.colorCircle,
          { backgroundColor: color },
          color === "#FFFFFF" && styles.colorCircleWhite,
          style,
        ]}
      />
    </Pressable>
  );
}

// ─── Brush Size Button ────────────────────────────────────────────────────────
function BrushBtn({
  size,
  dotPx,
  selected,
  onPress,
}: {
  size: BrushSize;
  dotPx: number;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.brushBtn, selected && styles.brushBtnSelected]}
      hitSlop={8}
    >
      <View
        style={{
          width: dotPx,
          height: dotPx,
          borderRadius: dotPx / 2,
          backgroundColor: selected ? "#333" : "#AAA",
        }}
      />
    </Pressable>
  );
}

// ─── Erase Confirmation Overlay ───────────────────────────────────────────────
function EraseConfirm({
  visible,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, damping: 14, stiffness: 300, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scale, { toValue: 0.7, damping: 14, stiffness: 300, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, opacity, scale]);

  if (!visible) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.confirmBackdrop, { opacity }]}>
      <Animated.View style={[styles.confirmCard, { transform: [{ scale }] }]}>
        {/* Trash icon */}
        <View style={styles.confirmIconWrap}>
          <Feather name="trash-2" size={40} color="#FF3B30" />
        </View>

        {/* Buttons: ✗ cancel | ✓ confirm */}
        <View style={styles.confirmBtns}>
          <Pressable style={[styles.confirmBtn, styles.confirmBtnCancel]} onPress={onCancel}>
            <Feather name="x" size={36} color="#FFF" />
          </Pressable>
          <Pressable style={[styles.confirmBtn, styles.confirmBtnOk]} onPress={onConfirm}>
            <Feather name="check" size={36} color="#FFF" />
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Save Flash ───────────────────────────────────────────────────────────────
function SaveFlash({ visible }: { visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.delay(600),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, opacity]);

  if (!visible) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.saveFlash, { opacity }]}>
      <View style={styles.saveFlashCard}>
        <Feather name="check-circle" size={52} color="#4ECDC4" />
      </View>
    </Animated.View>
  );
}

// ─── Web stub ─────────────────────────────────────────────────────────────────
// Skia uses native GPU rendering — works perfectly in Expo Go on iPad.
// The web preview cannot initialise WebGL CanvasKit, so show a placeholder.
function WebStub() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F2F2F7", gap: 16 }}>
      <Feather name="tablet" size={64} color="#C7C7CC" />
      <Text style={{ fontSize: 18, color: "#8E8E93", textAlign: "center", paddingHorizontal: 40, lineHeight: 26 }}>
        {"Экран рисования работает в Expo Go на iPad.\nВ браузерном превью Skia недоступен."}
      </Text>
      <Pressable
        onPress={() => router.replace("/")}
        style={{ marginTop: 8, backgroundColor: "#4ECDC4", paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 }}
      >
        <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "600" }}>← Назад</Text>
      </Pressable>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
function DrawingScreenNative() {
  const insets = useSafeAreaInsets();
  const canvasRef = useCanvasRef();

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [, setTick] = useState(0); // forces canvas re-render on move
  const [selectedColor, setSelectedColor] = useState(PALETTE[0]);
  const [brushSize, setBrushSize] = useState<BrushSize>(BRUSH_SIZES[1]);
  const [showErase, setShowErase] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [saving, setSaving] = useState(false);

  // Refs for PanResponder closures (avoid stale state)
  const selectedColorRef = useRef(selectedColor);
  const brushSizeRef = useRef(brushSize);
  const currentPathRef = useRef<SkPath | null>(null);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const isDrawingRef = useRef(false);

  useEffect(() => { selectedColorRef.current = selectedColor; }, [selectedColor]);
  useEffect(() => { brushSizeRef.current = brushSize; }, [brushSize]);

  // ── PanResponder ────────────────────────────────────────────────────────────
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !showErase,
        onMoveShouldSetPanResponder: () => !showErase,
        onPanResponderGrant: (e) => {
          if (showErase) return;
          const { locationX: x, locationY: y } = e.nativeEvent;

          const p = Skia.Path.Make();
          p.moveTo(x, y);
          // Add a tiny first lineTo so a tap dot renders
          p.lineTo(x + 0.01, y + 0.01);
          currentPathRef.current = p;
          lastPtRef.current = { x, y };
          isDrawingRef.current = true;

          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

          setTick((t) => t + 1);
        },
        onPanResponderMove: (e) => {
          if (!isDrawingRef.current || !currentPathRef.current || !lastPtRef.current) return;
          const { locationX: x, locationY: y } = e.nativeEvent;
          const { x: lx, y: ly } = lastPtRef.current;

          // Midpoint quadratic bezier → smooth rounded lines
          const mx = (lx + x) / 2;
          const my = (ly + y) / 2;
          currentPathRef.current.quadTo(lx, ly, mx, my);
          lastPtRef.current = { x, y };

          // Throttle re-renders to once per animation frame
          if (!rafRef.current) {
            rafRef.current = requestAnimationFrame(() => {
              setTick((t) => t + 1);
              rafRef.current = null;
            });
          }
        },
        onPanResponderRelease: () => {
          if (!isDrawingRef.current) return;
          isDrawingRef.current = false;
          if (currentPathRef.current) {
            const committed: Stroke = {
              path: currentPathRef.current,
              color: selectedColorRef.current,
              width: brushSizeRef.current,
            };
            setStrokes((prev) => [...prev, committed]);
          }
          currentPathRef.current = null;
          lastPtRef.current = null;
          setTick((t) => t + 1);
        },
        onPanResponderTerminate: () => {
          isDrawingRef.current = false;
          currentPathRef.current = null;
          lastPtRef.current = null;
        },
      }),
    // showErase intentionally excluded — guard is on isDrawingRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ── Undo ────────────────────────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    setStrokes((prev) => {
      if (!prev.length) return prev;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return prev.slice(0, -1);
    });
  }, []);

  // ── Erase all ───────────────────────────────────────────────────────────────
  const handleEraseConfirm = useCallback(() => {
    setStrokes([]);
    currentPathRef.current = null;
    setShowErase(false);
    setTick((t) => t + 1);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, []);

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const snapshot = canvasRef.current?.makeImageSnapshot();
      if (!snapshot) throw new Error("No snapshot");

      const bytes = snapshot.encodeToBytes();
      if (!bytes) throw new Error("No bytes");

      // Convert Uint8Array → base64
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      await ensureSaveDir();
      const filename = `drawing_${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(SAVE_DIR + filename, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowSave(true);
      setTimeout(() => setShowSave(false), 1200);
    } catch (err) {
      Alert.alert("Ошибка", "Не удалось сохранить рисунок.");
    } finally {
      setSaving(false);
    }
  }, [saving, canvasRef]);

  // ── Layout ──────────────────────────────────────────────────────────────────
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  return (
    <ImageBackground
      source={GAMES_BG}
      resizeMode="cover"
      style={[
        styles.screen,
        {
          paddingTop: topPad,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          paddingBottom: bottomPad,
        },
      ]}
    >
      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <Pressable style={styles.iconBtn} onPress={() => router.replace("/")} hitSlop={12}>
          <Feather name="arrow-left" size={28} color="#444" />
        </Pressable>

        <View style={styles.topActions}>
          {/* Undo */}
          <Pressable
            style={[styles.iconBtn, !strokes.length && styles.iconBtnDisabled]}
            onPress={handleUndo}
            disabled={!strokes.length}
            hitSlop={12}
          >
            <Feather name="corner-up-left" size={26} color={strokes.length ? "#444" : "#CCC"} />
          </Pressable>

          {/* Erase all */}
          <Pressable
            style={[styles.iconBtn, !strokes.length && styles.iconBtnDisabled]}
            onPress={() => { if (strokes.length) setShowErase(true); }}
            disabled={!strokes.length}
            hitSlop={12}
          >
            <Feather name="trash-2" size={26} color={strokes.length ? "#FF3B30" : "#CCC"} />
          </Pressable>

          {/* Save */}
          <Pressable
            style={[styles.iconBtn, styles.saveBtn, !strokes.length && styles.iconBtnDisabled]}
            onPress={handleSave}
            disabled={!strokes.length || saving}
            hitSlop={12}
          >
            <Feather name="check" size={26} color="#FFF" />
          </Pressable>
        </View>
      </View>

      {/* ── Canvas ── */}
      <View style={styles.canvasWrap}>
        <Canvas ref={canvasRef} style={StyleSheet.absoluteFill}>
          {/* Completed strokes */}
          {strokes.map((s, i) => (
            <Path
              key={i}
              path={s.path}
              color={s.color}
              style="stroke"
              strokeWidth={s.width}
              strokeCap="round"
              strokeJoin="round"
            />
          ))}
          {/* Live stroke (reads from ref, re-renders on tick) */}
          {currentPathRef.current && (
            <Path
              path={currentPathRef.current}
              color={selectedColorRef.current}
              style="stroke"
              strokeWidth={brushSizeRef.current}
              strokeCap="round"
              strokeJoin="round"
            />
          )}
        </Canvas>

        {/* Touch capture overlay */}
        <View style={StyleSheet.absoluteFill} {...pan.panHandlers} />

        {/* Erase confirmation */}
        <EraseConfirm
          visible={showErase}
          onCancel={() => setShowErase(false)}
          onConfirm={handleEraseConfirm}
        />

        {/* Save flash */}
        <SaveFlash visible={showSave} />
      </View>

      {/* ── Bottom toolbar ── */}
      <View style={styles.bottomBar}>
        {/* Brush sizes */}
        <View style={styles.brushRow}>
          <BrushBtn size={BRUSH_SIZES[0]} dotPx={9}  selected={brushSize === BRUSH_SIZES[0]} onPress={() => setBrushSize(BRUSH_SIZES[0])} />
          <BrushBtn size={BRUSH_SIZES[1]} dotPx={16} selected={brushSize === BRUSH_SIZES[1]} onPress={() => setBrushSize(BRUSH_SIZES[1])} />
          <BrushBtn size={BRUSH_SIZES[2]} dotPx={24} selected={brushSize === BRUSH_SIZES[2]} onPress={() => setBrushSize(BRUSH_SIZES[2])} />
        </View>

        <View style={styles.divider} />

        {/* Palette */}
        <View style={styles.palette}>
          {PALETTE.map((c) => (
            <ColorCircle
              key={c}
              color={c}
              selected={selectedColor === c}
              onPress={() => setSelectedColor(c)}
            />
          ))}
        </View>
      </View>
    </ImageBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  iconBtnDisabled: {
    backgroundColor: "#F0F0F0",
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtn: {
    backgroundColor: "#4ECDC4",
    width: 52,
    height: 52,
    borderRadius: 26,
  },

  // Canvas
  canvasWrap: {
    flex: 1,
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },

  // Bottom bar
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFF",
    marginHorizontal: 12,
    marginBottom: 6,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    gap: 8,
  },
  brushRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  brushBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  brushBtnSelected: {
    backgroundColor: "#F0F0F0",
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: "#E0E0E0",
    marginHorizontal: 4,
  },
  palette: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-around",
    gap: 6,
  },
  colorCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  colorCircleWhite: {
    borderWidth: 1.5,
    borderColor: "#DDD",
  },

  // Erase confirmation
  confirmBackdrop: {
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  confirmCard: {
    backgroundColor: "#FFF",
    borderRadius: 28,
    padding: 32,
    alignItems: "center",
    gap: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
    minWidth: 200,
  },
  confirmIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFF0EF",
    justifyContent: "center",
    alignItems: "center",
  },
  confirmBtns: {
    flexDirection: "row",
    gap: 20,
  },
  confirmBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  confirmBtnCancel: {
    backgroundColor: "#FF3B30",
  },
  confirmBtnOk: {
    backgroundColor: "#34C759",
  },

  // Save flash
  saveFlash: {
    backgroundColor: "rgba(255,255,255,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  saveFlashCard: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#4ECDC4",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
});

// ─── Router entry point ───────────────────────────────────────────────────────
// Skia needs native GPU — show a stub on the web preview.
export default function DrawingScreen() {
  if (Platform.OS === "web") return <WebStub />;
  return <DrawingScreenNative />;
}
