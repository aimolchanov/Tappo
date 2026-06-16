import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePop } from "@/hooks/usePopSound";
import { useDifficulty } from "@/contexts/DifficultyContext";
import { LEVEL_TO_BTN_SCALE } from "@/constants/difficulty";

// ─── Design tokens ────────────────────────────────────────────────
const BG = "#FFF7ED";

type Route =
  | "/coloring"
  | "/drawing"
  | "/music"
  | "/puzzles"
  | "/my-works"
  | "/matching";

interface Activity {
  emoji: string;
  label: string;
  gradient: [string, string];
  shadow: string;
  route: Route;
  /** When true, the button gets a subtle ring to signal it's a "viewer", not a creator */
  isGallery?: boolean;
}

// Top row  — «создавать»: Раскраски · Рисование · Музыка
// Bottom row — «играть»:  Пазлы · Найди пару · Мои работы (gallery, visually distinct)
const ACTIVITIES: Activity[] = [
  {
    emoji: "🎨",
    label: "Раскраски",
    gradient: ["#FF9898", "#FF6B6B"],
    shadow: "#FF6B6B",
    route: "/coloring",
  },
  {
    emoji: "✏️",
    label: "Рисование",
    gradient: ["#C4ADFF", "#A78BFA"],
    shadow: "#A78BFA",
    route: "/drawing",
  },
  {
    emoji: "🎵",
    label: "Музыка",
    gradient: ["#FFE87A", "#FFD93D"],
    shadow: "#FFD93D",
    route: "/music",
  },
  {
    emoji: "🧩",
    label: "Пазлы",
    gradient: ["#80E0DA", "#4ECDC4"],
    shadow: "#4ECDC4",
    route: "/puzzles",
  },
  {
    emoji: "🌈",
    label: "Найди пару",
    gradient: ["#FFB3C6", "#FF6B9D"],
    shadow: "#FF6B9D",
    route: "/matching",
  },
  {
    emoji: "⭐",
    label: "Мои работы",
    // Softer, cooler gradient — reads as "passive / gallery", not "active / create"
    gradient: ["#C8E6D8", "#8BBDA8"],
    shadow: "#8BBDA8",
    route: "/my-works",
    isGallery: true,
  },
];

// ─── Single activity button ───────────────────────────────────────
function ActivityButton({
  activity,
  size,
}: {
  activity: Activity;
  size: number;
}) {
  const scaleX = useSharedValue(1);
  const scaleY = useSharedValue(1);
  const playPop = usePop();

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: scaleX.value }, { scaleY: scaleY.value }],
  }));

  const handlePressIn = () => {
    scaleX.value = withSpring(1.10, { damping: 12, stiffness: 500 });
    scaleY.value = withSpring(0.90, { damping: 12, stiffness: 500 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    scaleX.value = withSpring(1, { damping: 4, stiffness: 180 });
    scaleY.value = withSpring(1, { damping: 4, stiffness: 180 });
  };

  const fontSize = Math.max(13, size * 0.118);
  const emojiSize = size * 0.36;

  // "Мои работы" gets a visible dashed ring — unmistakably a gallery, not a maker
  const ringWidth = activity.isGallery ? 3 : 0;
  const ringPad = ringWidth + 3; // space between ring and button edge

  return (
    <Reanimated.View
      style={[
        animStyle,
        {
          margin: size * 0.055,
          // Ring wrapper — only visible for gallery button
          borderRadius: size / 2 + ringPad,
          borderWidth: ringWidth,
          borderColor: activity.isGallery ? "rgba(139,189,168,0.55)" : "transparent",
          borderStyle: activity.isGallery ? "dashed" : "solid",
          padding: activity.isGallery ? ringPad : 0,
          // Colored shadow
          shadowColor: activity.shadow,
          shadowOffset: { width: 0, height: size * 0.09 },
          shadowOpacity: activity.isGallery ? 0.32 : 0.48,
          shadowRadius: size * 0.14,
          elevation: activity.isGallery ? 8 : 14,
        },
      ]}
    >
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => {
          playPop();
          router.push(activity.route);
        }}
        style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden" }}
      >
        <LinearGradient
          colors={activity.gradient}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={[styles.buttonInner, { borderRadius: size / 2 }]}
        >
          <Text style={{ fontSize: emojiSize, lineHeight: emojiSize * 1.2 }}>
            {activity.emoji}
          </Text>
          <Text
            style={[styles.label, { fontSize }]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {activity.label}
          </Text>
        </LinearGradient>
      </Pressable>
    </Reanimated.View>
  );
}

// ─── Home screen ──────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const { difficulty } = useDifficulty();
  const btnScale = LEVEL_TO_BTN_SCALE[difficulty];

  // ── Layout — works in both portrait and landscape ─────────────
  const padH = 28;
  const padV = 20;
  const gearZone = 48;
  const rowGap = 16;

  const usableW = W - insets.left - insets.right - padH * 2;
  const usableH =
    H - insets.top - insets.bottom - padV * 2 - gearZone - rowGap;

  const rowH = usableH / 2;
  const colW = usableW / 3;

  const btnSize = Math.floor(
    Math.min(rowH * 0.88, colW * 0.80, 220) * btnScale
  );

  // ── Parent lock (gear) ────────────────────────────────────────
  const holdProgress = useRef(new Animated.Value(0)).current;
  const holdAnim = useRef<Animated.CompositeAnimation | null>(null);
  const navigated = useRef(false);

  const ringScale = holdProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 2.4],
  });
  const ringOpacity = holdProgress.interpolate({
    inputRange: [0, 0.15, 0.85, 1],
    outputRange: [0, 0.5, 0.5, 0],
  });

  const handleGearIn = () => {
    navigated.current = false;
    holdProgress.setValue(0);
    holdAnim.current = Animated.timing(holdProgress, {
      toValue: 1,
      duration: 3000,
      useNativeDriver: true,
    });
    holdAnim.current.start(({ finished }) => {
      if (finished && !navigated.current) {
        navigated.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.push({
          pathname: "/settings",
          params: { exp: String(Date.now() + 15_000) },
        });
      }
    });
  };

  const handleGearOut = () => {
    holdAnim.current?.stop();
    holdProgress.setValue(0);
  };

  const topRow = ACTIVITIES.slice(0, 3); // Раскраски · Рисование · Музыка
  const bottomRow = ACTIVITIES.slice(3); // Пазлы · Найди пару · Мои работы

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + padV + (Platform.OS === "web" ? 60 : 0),
          paddingBottom: insets.bottom + padV,
          paddingLeft: insets.left + padH,
          paddingRight: insets.right + padH,
        },
      ]}
    >
      {/* ── Subtle background blobs ── */}
      <View style={styles.bgCircle1} pointerEvents="none" />
      <View style={styles.bgCircle2} pointerEvents="none" />

      {/* ── Top row: create ── */}
      <View style={styles.row}>
        {topRow.map((a) => (
          <ActivityButton key={a.route} activity={a} size={btnSize} />
        ))}
      </View>

      {/* ── Row separator — thin line, clearly NOT pagination dots ── */}
      <View style={styles.rowSeparator} pointerEvents="none">
        <View style={styles.separatorLine} />
      </View>

      {/* ── Bottom row: play + gallery ── */}
      <View style={styles.row}>
        {bottomRow.map((a) => (
          <ActivityButton key={a.route} activity={a} size={btnSize} />
        ))}
      </View>

      {/* ── Parent lock gear (top-right, discreet) ── */}
      <View
        style={[
          styles.gearCorner,
          {
            top: insets.top + 14 + (Platform.OS === "web" ? 60 : 0),
            right: insets.right + 18,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.gearRing,
            { transform: [{ scale: ringScale }], opacity: ringOpacity },
          ]}
        />
        <Pressable
          onPressIn={handleGearIn}
          onPressOut={handleGearOut}
          style={styles.gearBtn}
          hitSlop={10}
        >
          <Feather name="settings" size={21} color="#C5B5A8" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  bgCircle1: {
    position: "absolute",
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: "#FFE5C8",
    opacity: 0.38,
    top: -80,
    left: -100,
  },
  bgCircle2: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#C8EFE8",
    opacity: 0.3,
    bottom: -60,
    right: -60,
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  rowSeparator: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 8,
  },
  separatorLine: {
    width: 64,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#E8D5C4",
    opacity: 0.7,
  },
  buttonInner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 6,
  },
  label: {
    fontFamily: "Fredoka_700Bold",
    color: "#FFFFFF",
    letterSpacing: 0.2,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.15)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  gearCorner: {
    position: "absolute",
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  gearRing: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    borderColor: "#B0A090",
  },
  gearBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
});
