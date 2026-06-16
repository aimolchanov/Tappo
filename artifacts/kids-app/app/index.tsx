import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef } from "react";
import {
  Animated,
  Image,
  ImageBackground,
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

// ─── Assets ───────────────────────────────────────────────────────
const BG_IMAGE = require("@/assets/images/home_bg.png");

type Route =
  | "/coloring"
  | "/drawing"
  | "/music"
  | "/puzzles"
  | "/my-works"
  | "/matching";

interface Activity {
  image: ReturnType<typeof require>;
  label: string;
  route: Route;
}

const ACTIVITIES: Activity[] = [
  { image: require("@/assets/images/icon_coloring.png"),  label: "Раскраски",  route: "/coloring" },
  { image: require("@/assets/images/icon_drawing.png"),   label: "Рисование",  route: "/drawing" },
  { image: require("@/assets/images/icon_music.png"),     label: "Музыка",     route: "/music" },
  { image: require("@/assets/images/icon_puzzle.png"),    label: "Пазлы",      route: "/puzzles" },
  { image: require("@/assets/images/icon_matching.png"),  label: "Найди пару", route: "/matching" },
  { image: require("@/assets/images/icon_myworks.png"),   label: "Мои работы", route: "/my-works" },
];

// ─── Single activity button ───────────────────────────────────────
function ActivityButton({
  activity,
  imgSize,
  labelSize,
  colWidth,
}: {
  activity: Activity;
  imgSize: number;
  labelSize: number;
  colWidth: number;
}) {
  const scale = useSharedValue(1);
  const playPop = usePop();

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Each button fills its column slot so text never overflows
  const btnW = colWidth;
  // Generous inner padding to guarantee ≥ 100pt touch target
  const innerPad = Math.max(12, (100 - imgSize) / 2);

  return (
    <Reanimated.View style={[animStyle, { width: btnW, alignItems: "center" }]}>
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.88, { damping: 10, stiffness: 600 });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 4, stiffness: 220 });
        }}
        onPress={() => { playPop(); router.push(activity.route); }}
        style={[styles.btn, { paddingHorizontal: innerPad, paddingVertical: 10 }]}
      >
        <Image
          source={activity.image}
          style={{ width: imgSize, height: imgSize }}
          resizeMode="contain"
        />
        <Text
          style={[styles.label, { fontSize: labelSize, width: btnW - 16 }]}
          numberOfLines={2}
        >
          {activity.label}
        </Text>
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

  const webTop  = Platform.OS === "web" ? 60 : 0;
  const topSafe = insets.top + webTop;
  const botSafe = insets.bottom;
  const gearH   = 52;
  // Reserve bottom area for the green hill + flowers
  const hillReserve = H * 0.16;

  const padH = 20;
  const usableW = W - insets.left - insets.right - padH * 2;
  const usableH = H - topSafe - botSafe - gearH - hillReserve;

  // Column slot each button occupies
  const colSlotW = usableW / 3;

  // Image fills most of each row/column; no upper cap so it's truly large on iPad.
  const rawImgSize = Math.min(
    (usableH / 2) * 0.76,     // height: 76% of each row
    colSlotW * 0.80,           // width: 80% of each column
  );
  // At least 110px so it's never tiny; scale with difficulty
  const imgSize = Math.max(110, Math.floor(rawImgSize * btnScale));

  // Font size is FIXED — not tied to icon size — clean and readable on tablet.
  // Clamp between 16 and 24.
  const labelSize = Math.round(Math.min(24, Math.max(16, W * 0.022)));

  // ── Parent lock (gear) ────────────────────────────────────────
  const holdProgress = useRef(new Animated.Value(0)).current;
  const holdAnim     = useRef<Animated.CompositeAnimation | null>(null);
  const navigated    = useRef(false);

  const ringScale   = holdProgress.interpolate({ inputRange: [0,1], outputRange: [0.4, 2.4] });
  const ringOpacity = holdProgress.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 0.5, 0.5, 0] });

  const handleGearIn = () => {
    navigated.current = false;
    holdProgress.setValue(0);
    holdAnim.current = Animated.timing(holdProgress, { toValue: 1, duration: 3000, useNativeDriver: true });
    holdAnim.current.start(({ finished }) => {
      if (finished && !navigated.current) {
        navigated.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.push({ pathname: "/settings", params: { exp: String(Date.now() + 15_000) } });
      }
    });
  };
  const handleGearOut = () => { holdAnim.current?.stop(); holdProgress.setValue(0); };

  const topRow    = ACTIVITIES.slice(0, 3);
  const bottomRow = ACTIVITIES.slice(3);

  return (
    <ImageBackground source={BG_IMAGE} style={styles.root} resizeMode="cover">
      <View
        style={[
          styles.inner,
          {
            paddingTop:    topSafe + gearH + 4,
            paddingBottom: botSafe + hillReserve,
            paddingLeft:   insets.left  + padH,
            paddingRight:  insets.right + padH,
          },
        ]}
      >
        {/* ── Row 1: Раскраски · Рисование · Музыка ── */}
        <View style={styles.row}>
          {topRow.map((a) => (
            <ActivityButton key={a.route} activity={a} imgSize={imgSize} labelSize={labelSize} colWidth={colSlotW} />
          ))}
        </View>

        {/* ── Row 2: Пазлы · Найди пару · Мои работы ── */}
        <View style={styles.row}>
          {bottomRow.map((a) => (
            <ActivityButton key={a.route} activity={a} imgSize={imgSize} labelSize={labelSize} colWidth={colSlotW} />
          ))}
        </View>
      </View>

      {/* ── Parent lock (hold 3 s) ── */}
      <View style={[styles.gearCorner, { top: topSafe + 10, right: insets.right + 18 }]}>
        <Animated.View style={[styles.gearRing, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
        <Pressable onPressIn={handleGearIn} onPressOut={handleGearOut} style={styles.gearBtn} hitSlop={12}>
          <Feather name="settings" size={22} color="#A09080" />
        </Pressable>
      </View>
    </ImageBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: {
    flex: 1,
    justifyContent: "space-evenly",
    alignItems: "stretch",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
  },
  // Pressable wrapper — padding ensures ≥ 100pt touch target around the icon+label island
  btn: {
    alignItems: "center",
    gap: 6,
  },
  label: {
    fontFamily: "Fredoka_700Bold",
    color: "#4A3728",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  gearCorner: { position: "absolute", width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  gearRing:   { position: "absolute", width: 44, height: 44, borderRadius: 22, borderWidth: 2.5, borderColor: "#B0A090" },
  gearBtn:    { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
});
