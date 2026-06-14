/**
 * Mascot for the Matching screen.
 * Three moods:
 *   idle      — gentle float (breathing)
 *   happy     — quick pop-bounce when one item matches
 *   celebrate — big bounce + wiggle when whole puzzle is done
 */
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Reanimated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

export type MascotMood = "idle" | "happy" | "celebrate";

interface Props {
  mood: MascotMood;
  size?: number;
}

export function MatchingMascot({ mood, size = 80 }: Props) {
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(scale);
    cancelAnimation(rotate);
    rotate.value = withTiming(0, { duration: 100 });

    if (mood === "idle") {
      // Slow breathing pulse — never stops
      scale.value = withRepeat(
        withSequence(
          withTiming(1.07, { duration: 1500 }),
          withTiming(1.0, { duration: 1500 })
        ),
        -1,
        true
      );
    } else if (mood === "happy") {
      // Quick energetic pop
      scale.value = withSequence(
        withSpring(1.40, { damping: 3, stiffness: 400 }),
        withSpring(1.0, { damping: 6, stiffness: 220 })
      );
    } else {
      // celebrate: big bounce + wiggle
      scale.value = withSequence(
        withSpring(1.60, { damping: 2, stiffness: 320 }),
        withSpring(1.20, { damping: 5 }),
        withSpring(1.0, { damping: 8 })
      );
      rotate.value = withSequence(
        withTiming(20, { duration: 110 }),
        withTiming(-20, { duration: 110 }),
        withTiming(14, { duration: 90 }),
        withTiming(-14, { duration: 90 }),
        withTiming(0, { duration: 80 })
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Reanimated.View style={[animStyle, { width: size, height: size }]}>
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            shadowRadius: size * 0.12,
            shadowOffset: { width: 0, height: size * 0.06 },
          },
        ]}
      >
        <Text style={{ fontSize: size * 0.56, lineHeight: size * 0.7 }}>🦉</Text>
      </View>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: "#FFF0D8",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#D4A96A",
    shadowOpacity: 0.28,
    elevation: 6,
  },
});
