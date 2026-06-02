import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const { width, height } = Dimensions.get("window");

interface ActivityButton {
  icon: keyof typeof Feather.glyphMap;
  color: string;
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const activities: ActivityButton[] = [
    { icon: "edit-2", color: colors.activity1 },
    { icon: "grid", color: colors.activity2 },
    { icon: "music", color: colors.activity3 },
    { icon: "star", color: colors.activity4 },
    { icon: "sun", color: colors.activity5 },
    { icon: "heart", color: colors.activity6 },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 16,
          paddingLeft: insets.left + 24,
          paddingRight: insets.right + 24,
        },
      ]}
    >
      <View style={styles.grid}>
        {activities.map((activity, index) => (
          <TouchableOpacity
            key={index}
            activeOpacity={0.8}
            style={[
              styles.button,
              { backgroundColor: activity.color },
            ]}
          >
            <Feather name={activity.icon} size={52} color="#FFFFFF" />
          </TouchableOpacity>
        ))}
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
    maxWidth: width * 0.9,
  },
  button: {
    width: 130,
    height: 130,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
});
