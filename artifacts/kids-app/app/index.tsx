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

// Note: Fredoka_700Bold is loaded once in _layout.tsx via useFonts — no need to
// load it here again. The root layout returns null while fonts are not ready, so
// by the time this screen renders, fontFamily: "Fredoka_700Bold" is guaranteed.

const BG_IMAGE = require("@/assets/images/home_bg.png");

type Route = "/coloring" | "/drawing" | "/music" | "/puzzles" | "/my-works" | "/matching";

interface Activity {
  image: ReturnType<typeof require>;
  label: string;
  route: Route;
}

const ACTIVITIES: Activity[] = [
  { image: require("@/assets/images/icon_coloring.png"),  label: "Раскраски",  route: "/coloring"  },
  { image: require("@/assets/images/icon_drawing.png"),   label: "Рисование",  route: "/drawing"   },
  { image: require("@/assets/images/icon_music.png"),     label: "Музыка",     route: "/music"     },
  { image: require("@/assets/images/icon_puzzle.png"),    label: "Пазлы",      route: "/puzzles"   },
  { image: require("@/assets/images/icon_matching.png"),  label: "Найди пару", route: "/matching"  },
  { image: require("@/assets/images/icon_myworks.png"),   label: "Мои работы", route: "/my-works"  },
];

// ─── Single activity button ───────────────────────────────────────
function ActivityButton({
  activity,
  imgSize,
  colWidth,
  labelFontSize,
}: {
  activity: Activity;
  imgSize: number;
  colWidth: number;
  labelFontSize: number;
}) {
  const scale = useSharedValue(1);
  const playPop = usePop();

  const pressed = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Reanimated.View style={[pressed, { width: colWidth, alignItems: "center" }]}>
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.88, { damping: 10, stiffness: 600 });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 4, stiffness: 220 });
        }}
        onPress={() => { playPop(); router.push(activity.route); }}
        style={styles.btn}
      >
        <Image
          source={activity.image}
          style={{ width: imgSize, height: imgSize }}
          resizeMode="contain"
        />
        <Text style={[styles.label, { fontSize: labelFontSize, maxWidth: colWidth - 16 }]} numberOfLines={2}>
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

  const webTop      = Platform.OS === "web" ? 60 : 0;
  const topSafe     = insets.top + webTop;
  const botSafe     = insets.bottom;
  const gearH       = 52;
  const hillReserve = H * 0.16;          // keep buttons above the green hill
  const padH        = 12;

  const usableW = W - insets.left - insets.right - padH * 2;
  const usableH = H - topSafe - botSafe - gearH - hillReserve;

  // Column slot width each button owns — prevents text overflow
  const colSlotW = usableW / 3;

  // Each row gets half of usable height; each column a third of usable width.
  // On iPad landscape (1024×768) → ~180 px icons. Narrow web preview → ~115 px.
  const imgSize = Math.max(
    90,
    Math.floor(
      Math.min(
        (usableH / 2) * 0.78,   // row height constraint
        colSlotW * 0.92,         // column width constraint
      ) * btnScale
    )
  );

  // Font size scales with column width so text never wraps on any screen size.
  // ~22 px on iPad landscape, auto-shrinks proportionally on narrower screens.
  const labelFontSize = Math.min(22, Math.max(14, Math.floor(colSlotW * 0.145)));

  // ── Parent lock ───────────────────────────────────────────────
  const holdProgress = useRef(new Animated.Value(0)).current;
  const holdAnim     = useRef<Animated.CompositeAnimation | null>(null);
  const navigated    = useRef(false);

  const ringScale   = holdProgress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.4] });
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
        <View style={styles.row}>
          {topRow.map((a) => (
            <ActivityButton key={a.route} activity={a} imgSize={imgSize} colWidth={colSlotW} labelFontSize={labelFontSize} />
          ))}
        </View>
        <View style={styles.row}>
          {bottomRow.map((a) => (
            <ActivityButton key={a.route} activity={a} imgSize={imgSize} colWidth={colSlotW} labelFontSize={labelFontSize} />
          ))}
        </View>
      </View>

      {/* Parent lock — hold 3 s */}
      <View style={[styles.gearCorner, { top: topSafe + 10, right: insets.right + 18 }]}>
        <Animated.View style={[styles.gearRing, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
        <Pressable onPressIn={handleGearIn} onPressOut={handleGearOut} style={styles.gearBtn} hitSlop={12}>
          <Feather name="settings" size={22} color="#A09080" />
        </Pressable>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1 },
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
  // Pressable island — tight icon + label, generous touch area via padding
  btn: {
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 12,
    gap: 8,
  },
  label: {
    fontFamily: "Fredoka_700Bold",   // registered in _layout.tsx before this screen renders
    color: "#4A3728",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  gearCorner: { position: "absolute", width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  gearRing:   { position: "absolute", width: 44, height: 44, borderRadius: 22, borderWidth: 2.5, borderColor: "#B0A090" },
  gearBtn:    { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
});
