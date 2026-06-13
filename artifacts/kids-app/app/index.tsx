import { Feather } from "@expo/vector-icons";
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

type Route = "/coloring" | "/drawing" | "/music" | "/puzzles" | "/my-works";

interface Activity {
  emoji: string;
  label: string;
  color: string;
  route: Route;
  isGallery?: boolean;
}

const ACTIVITIES: Activity[] = [
  { emoji: "🎨", label: "Раскраски", color: "#FF6B6B", route: "/coloring" },
  { emoji: "✏️",  label: "Рисование",  color: "#A78BFA", route: "/drawing" },
  { emoji: "🎵", label: "Музыка",     color: "#FFD93D", route: "/music" },
  { emoji: "🧩", label: "Пазлы",      color: "#4ECDC4", route: "/puzzles" },
  {
    emoji: "⭐",
    label: "Мои работы",
    color: "#F59E0B",
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
  const scale = useSharedValue(1);
  const playPop = usePop();

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Reanimated.View
      style={[
        animStyle,
        {
          width: size,
          height: size,
          margin: 8,
        },
      ]}
    >
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.87, { damping: 12, stiffness: 400 });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 6, stiffness: 180 });
        }}
        onPress={() => {
          playPop();
          router.push(activity.route);
        }}
        style={[
          styles.button,
          {
            backgroundColor: activity.color,
            borderRadius: size / 2,
            width: size,
            height: size,
            opacity: activity.isGallery ? 0.9 : 1,
          },
        ]}
      >
        <Text style={[styles.emoji, { fontSize: size * 0.34 }]}>
          {activity.emoji}
        </Text>
        <Text
          style={[styles.label, { fontSize: Math.max(12, size * 0.115) }]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {activity.label}
        </Text>
      </Pressable>
    </Reanimated.View>
  );
}

// ─── Home screen ─────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const { difficulty } = useDifficulty();
  const btnScale = LEVEL_TO_BTN_SCALE[difficulty];

  // ── Layout maths ──────────────────────────────────────────────
  // Available space after safe area + padding
  const padH = 40;
  const padV = 32;
  const gearZone = 48; // top-right gear area
  const rowGap = 16;

  const usableW = W - insets.left - insets.right - padH * 2;
  const usableH =
    H - insets.top - insets.bottom - padV * 2 - gearZone - rowGap;

  // Two rows: 3 top + 2 bottom. Button is a circle → same diameter both rows.
  // Constrain by: row height AND column width of the narrower (top) row.
  const rowH = usableH / 2;
  const colWTop = usableW / 3; // 3 columns
  const colWBot = usableW / 2; // 2 columns, but we keep same size as top row

  const btnSize = Math.floor(
    Math.min(rowH * 0.92, colWTop * 0.82, colWBot * 0.6, 230) * btnScale
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
    outputRange: [0, 0.55, 0.55, 0],
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

  const topRow = ACTIVITIES.slice(0, 3);
  const bottomRow = ACTIVITIES.slice(3);

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop:
            insets.top + padV + (Platform.OS === "web" ? 60 : 0),
          paddingBottom: insets.bottom + padV,
          paddingLeft: insets.left + padH,
          paddingRight: insets.right + padH,
        },
      ]}
    >
      {/* ── Top row: 3 creation sections ── */}
      <View style={styles.row}>
        {topRow.map((a) => (
          <ActivityButton key={a.route} activity={a} size={btnSize} />
        ))}
      </View>

      {/* ── Divider hint: gallery is separate ── */}
      <View style={styles.separator} />

      {/* ── Bottom row: 2 items (puzzle + gallery) ── */}
      <View style={styles.row}>
        {bottomRow.map((a) => (
          <ActivityButton key={a.route} activity={a} size={btnSize} />
        ))}
      </View>

      {/* ── Parent lock gear (top-right) ── */}
      <View
        style={[
          styles.gearCorner,
          {
            top: insets.top + 12 + (Platform.OS === "web" ? 60 : 0),
            right: insets.right + 16,
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
          hitSlop={8}
        >
          <Feather name="settings" size={20} color="#C8C8C8" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFF8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  separator: {
    height: 12,
    width: "60%",
    alignSelf: "center",
    borderBottomWidth: 1.5,
    borderColor: "#E5DDD0",
    marginVertical: 4,
    opacity: 0.6,
  },
  button: {
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 8,
    gap: 6,
  },
  emoji: {
    lineHeight: undefined,
  },
  label: {
    fontFamily: "Nunito_800ExtraBold",
    color: "#FFFFFF",
    letterSpacing: 0.3,
    paddingHorizontal: 8,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.18)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  gearCorner: {
    position: "absolute",
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  gearRing: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: "#AAAAAA",
  },
  gearBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
});
