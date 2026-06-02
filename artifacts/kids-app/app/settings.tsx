import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0),
          paddingLeft: insets.left + 32,
          paddingRight: insets.right + 32,
        },
      ]}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>
        ⚙️ Настройки
      </Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Здесь будут настройки для родителей
      </Text>
      <Pressable
        onPress={() => router.back()}
        style={[styles.backBtn, { backgroundColor: colors.primary }]}
      >
        <Feather name="arrow-left" size={28} color="#FFFFFF" />
        <Text style={styles.backText}>Назад</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  title: {
    fontSize: 36,
    fontFamily: "Nunito_800ExtraBold",
  },
  subtitle: {
    fontSize: 18,
    fontFamily: "Nunito_700Bold",
    textAlign: "center",
  },
  backBtn: {
    marginTop: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 20,
  },
  backText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontFamily: "Nunito_700Bold",
  },
});
