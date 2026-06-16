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
  {
    image: require("@/assets/images/icon_coloring.png"),
    label: "Раскраски",
    route: "/coloring",
  },
  {
    image: require("@/assets/images/icon_drawing.png"),
    label: "Рисование",
    route: "/drawing",
  },
  {
    image: require("@/assets/images/icon_music.png"),
    label: "Музыка",
    route: "/music",
  },
  {
    image: require("@/assets/images/icon_puzzle.png"),
    label: "Пазлы",
    route: "/puzzles",
  },
  {
    image: require("@/assets/images/icon_matching.png"),
    label: "Найди пару",
    route: "/matching",
  },
  {
    image: require("@/assets/images/icon_myworks.png"),
    label: "Мои работы",
    route: "/my-works",
  },
];

// ─── Single activity button ───────────────────────────────────────
function ActivityButton({
  activity,
  imgSize,
  fontSize,
}: {
  activity: Activity;
  imgSize: number;
  fontSize: number;
}) {
  const scale = useSharedValue(1);
  const scaleY = useSharedValue(1);
  const playPop = usePop();

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: scale.value }, { scaleY: scaleY.value }],
  }));

  const handlePressIn = () => {
    // Squish down on press
    scale.value = withSpring(0.88, { damping: 10, stiffness: 600 });
    scaleY.value = withSpring(0.88, { damping: 10, stiffness: 600 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    // Bouncy release
    scale.value = withSpring(1, { damping: 4, stiffness: 220 });
    scaleY.value = withSpring(1, { damping: 4, stiffness: 220 });
  };

  // Minimum touch target: 90pt as required
  const hitArea = Math.max(imgSize + 24, 90);

  return (
    <Reanimated.View style={[animStyle, styles.btnWrapper]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => {
          playPop();
          router.push(activity.route);
        }}
        style={{ alignItems: "center" }}
        hitSlop={(hitArea - imgSize) / 2}
      >
        <Image
          source={activity.image}
          style={{ width: imgSize, height: imgSize }}
          resizeMode="contain"
        />
        <Text style={[styles.label, { fontSize }]} numberOfLines={2}>
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

  // Reserve ~18% at the bottom for the green hill + flowers decoration
  const hillReserve = H * 0.18;

  const padH = 16;
  const webTop = Platform.OS === "web" ? 60 : 0;
  const topSafe = insets.top + webTop;
  const botSafe = insets.bottom;
  const gearH = 48;

  // Usable area for the 2-row button grid (above the hill)
  const usableW = W - insets.left - insets.right - padH * 2;
  const usableH = H - topSafe - botSafe - gearH - hillReserve;

  const colCount = 3;
  const rowCount = 2;
  const colW = usableW / colCount;
  const rowH = usableH / rowCount;

  // Icons fill most of their column + row. Cap at 200 for large iPads.
  const imgSize = Math.floor(
    Math.min(rowH * 0.72, colW * 0.84, 200) * btnScale
  );
  const fontSize = Math.max(13, imgSize * 0.185);

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

  const topRow = ACTIVITIES.slice(0, 3);
  const bottomRow = ACTIVITIES.slice(3);

  return (
    <ImageBackground
      source={BG_IMAGE}
      style={styles.root}
      resizeMode="cover"
    >
      <View
        style={[
          styles.inner,
          {
            paddingTop: topSafe + gearH + 8,
            paddingBottom: botSafe + hillReserve,
            paddingLeft: insets.left + padH,
            paddingRight: insets.right + padH,
          },
        ]}
      >
        {/* ── Top row ── */}
        <View style={styles.row}>
          {topRow.map((a) => (
            <ActivityButton
              key={a.route}
              activity={a}
              imgSize={imgSize}
              fontSize={fontSize}
            />
          ))}
        </View>

        {/* ── Bottom row ── */}
        <View style={styles.row}>
          {bottomRow.map((a) => (
            <ActivityButton
              key={a.route}
              activity={a}
              imgSize={imgSize}
              fontSize={fontSize}
            />
          ))}
        </View>
      </View>

      {/* ── Parent lock gear ── */}
      <View
        style={[
          styles.gearCorner,
          {
            top: topSafe + 10,
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
          <Feather name="settings" size={21} color="#A09080" />
        </Pressable>
      </View>
    </ImageBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  btnWrapper: {
    alignItems: "center",
    marginHorizontal: 14,
    marginVertical: 8,
  },
  label: {
    fontFamily: "Fredoka_700Bold",
    color: "#4A3728",
    letterSpacing: 0.2,
    textAlign: "center",
    marginTop: 8,
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
