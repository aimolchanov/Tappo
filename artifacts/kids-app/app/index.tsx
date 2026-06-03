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
} from "react-native";
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { usePop } from "@/hooks/usePopSound";

interface Activity {
  emoji: string;
  label: string;
  color: string;
  route: "/coloring" | "/music" | "/puzzles" | "/drawing";
}

const ACTIVITIES: Activity[] = [
  { emoji: "🎨", label: "Раскраски", color: "#FF5C5C", route: "/coloring" },
  { emoji: "🎵", label: "Музыка", color: "#FFD93D", route: "/music" },
  { emoji: "🧩", label: "Пазлы", color: "#4ECDC4", route: "/puzzles" },
  { emoji: "🖌️", label: "Рисование", color: "#A78BFA", route: "/drawing" },
];

function ActivityButton({ activity }: { activity: Activity }) {
  const scale = useSharedValue(1);
  const playPop = usePop();

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Reanimated.View style={[styles.buttonWrap, animStyle]}>
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.88, { damping: 12, stiffness: 400 });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 6, stiffness: 180 });
        }}
        onPress={() => {
          playPop();
          router.push(activity.route);
        }}
        style={[styles.button, { backgroundColor: activity.color }]}
      >
        <Text style={styles.emoji}>{activity.emoji}</Text>
        <Text style={styles.label}>{activity.label}</Text>
      </Pressable>
    </Reanimated.View>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const holdProgress = useRef(new Animated.Value(0)).current;
  const holdAnim = useRef<Animated.CompositeAnimation | null>(null);
  const navigated = useRef(false);

  const ringScale = holdProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 2.2],
  });
  const ringOpacity = holdProgress.interpolate({
    inputRange: [0, 0.2, 0.9, 1],
    outputRange: [0, 0.6, 0.6, 0],
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
        // Pass an expiry token so settings screen can verify it was opened via the lock
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

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0),
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      <View style={styles.row}>
        {ACTIVITIES.map((a) => (
          <ActivityButton key={a.route} activity={a} />
        ))}
      </View>

      <View
        style={[
          styles.gearCorner,
          { bottom: insets.bottom + 16, right: insets.right + 16 },
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
          hitSlop={12}
        >
          <Feather name="settings" size={22} color="#BBBBBB" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    paddingHorizontal: 24,
  },
  buttonWrap: {
    width: "44%",
    maxWidth: 260,
    aspectRatio: 1,
  },
  button: {
    flex: 1,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
    gap: 10,
  },
  emoji: {
    fontSize: 72,
    lineHeight: 86,
  },
  label: {
    fontSize: 26,
    fontFamily: "Nunito_800ExtraBold",
    color: "#FFFFFF",
    letterSpacing: 0.5,
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
    borderWidth: 3,
    borderColor: "#AAAAAA",
  },
  gearBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
});
