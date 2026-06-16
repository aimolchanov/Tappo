import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePop } from "@/hooks/usePopSound";

const GAMES_BG = require("@/assets/images/games_background.png");

const SAVE_DIR = (FileSystem.documentDirectory ?? "") + "my_works/";
const ACCENT = "#F59E0B";

interface WorkItem {
  uri: string;
  name: string;
  modTime: number;
}

// ─── Single thumbnail ─────────────────────────────────────────────
function Thumb({
  item,
  size,
  onPress,
}: {
  item: WorkItem;
  size: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[
        styles.thumb,
        { width: size, height: size, borderRadius: size * 0.12 },
      ]}
    >
      <Image
        source={{ uri: item.uri }}
        style={{ width: size, height: size, borderRadius: size * 0.12 }}
        resizeMode="cover"
      />
    </Pressable>
  );
}

// ─── Full-screen viewer modal ────────────────────────────────────
function Viewer({
  item,
  onClose,
  onDelete,
}: {
  item: WorkItem;
  onClose: () => void;
  onDelete: () => void;
}) {
  const { width: W, height: H } = useWindowDimensions();

  const handleShare = async () => {
    if (Platform.OS === "web") return;
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(item.uri);
    } catch {
      // ignore
    }
  };

  const handleDelete = () => {
    Alert.alert("Удалить рисунок?", "Это нельзя отменить.", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: onDelete,
      },
    ]);
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.viewerBg}>
        <Image
          source={{ uri: item.uri }}
          style={{ width: W * 0.82, height: H * 0.78, borderRadius: 20 }}
          resizeMode="contain"
        />

        {/* Close */}
        <Pressable style={[styles.viewerBtn, styles.viewerClose]} onPress={onClose}>
          <Feather name="x" size={28} color="#555" />
        </Pressable>

        {/* Action row */}
        <View style={styles.viewerActions}>
          {Platform.OS !== "web" && (
            <Pressable style={styles.viewerAction} onPress={handleShare}>
              <Feather name="share-2" size={22} color="#555" />
              <Text style={styles.viewerActionLabel}>Поделиться</Text>
            </Pressable>
          )}
          <Pressable style={styles.viewerAction} onPress={handleDelete}>
            <Feather name="trash-2" size={22} color="#EF4444" />
            <Text style={[styles.viewerActionLabel, { color: "#EF4444" }]}>
              Удалить
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main screen ─────────────────────────────────────────────────
export default function MyWorksScreen() {
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const playPop = usePop();

  const [works, setWorks] = useState<WorkItem[]>([]);
  const [selected, setSelected] = useState<WorkItem | null>(null);
  const [loading, setLoading] = useState(true);

  const loadWorks = useCallback(async () => {
    if (Platform.OS === "web") { setLoading(false); return; }
    try {
      await FileSystem.makeDirectoryAsync(SAVE_DIR, { intermediates: true });
      const files = await FileSystem.readDirectoryAsync(SAVE_DIR);
      const pngs = files.filter((f) => f.endsWith(".png")).sort().reverse();
      const items: WorkItem[] = await Promise.all(
        pngs.map(async (name) => {
          const uri = SAVE_DIR + name;
          const info = await FileSystem.getInfoAsync(uri);
          return {
            uri,
            name,
            modTime: info.exists ? (info.modificationTime ?? 0) : 0,
          };
        })
      );
      items.sort((a, b) => b.modTime - a.modTime);
      setWorks(items);
    } catch {
      setWorks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadWorks(); }, [loadWorks]);

  const handleDelete = async (item: WorkItem) => {
    try {
      await FileSystem.deleteAsync(item.uri, { idempotent: true });
    } catch {}
    setSelected(null);
    loadWorks();
  };

  // Grid sizing: 3 columns in landscape
  const COLS = W > 700 ? 3 : 2;
  const GUTTER = 16;
  const thumbSize = Math.floor(
    (W - insets.left - insets.right - GUTTER * (COLS + 1)) / COLS
  );

  return (
    <ImageBackground
      source={GAMES_BG}
      resizeMode="cover"
      style={[
        styles.root,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 60 : 0),
          paddingLeft: insets.left,
          paddingRight: insets.right,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => { playPop(); router.back(); }}
          style={styles.backBtn}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={28} color="#555" />
        </Pressable>
        <Text style={styles.title}>⭐ Мои работы</Text>
        <View style={{ width: 52 }} />
      </View>

      {/* ── Content ── */}
      {loading ? null : works.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🖼️</Text>
          <Text style={styles.emptyTitle}>Пока пусто</Text>
          <Text style={styles.emptySub}>
            Сохрани рисунок в разделе «Рисование» — и он появится здесь
          </Text>
        </View>
      ) : (
        <FlatList
          data={works}
          key={COLS}
          numColumns={COLS}
          keyExtractor={(item) => item.uri}
          contentContainerStyle={{
            padding: GUTTER,
            gap: GUTTER,
          }}
          columnWrapperStyle={COLS > 1 ? { gap: GUTTER } : undefined}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Thumb
              item={item}
              size={thumbSize}
              onPress={() => setSelected(item)}
            />
          )}
        />
      )}

      {/* ── Viewer ── */}
      {selected && (
        <Viewer
          item={selected}
          onClose={() => setSelected(null)}
          onDelete={() => handleDelete(selected)}
        />
      )}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "#EDE8E0",
  },
  backBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#F0EBE3",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 26,
    fontFamily: "Nunito_800ExtraBold",
    color: "#4A3728",
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 60,
  },
  emptyEmoji: {
    fontSize: 72,
  },
  emptyTitle: {
    fontSize: 28,
    fontFamily: "Nunito_800ExtraBold",
    color: "#888",
    textAlign: "center",
  },
  emptySub: {
    fontSize: 17,
    color: "#AAA",
    textAlign: "center",
    lineHeight: 24,
  },
  thumb: {
    backgroundColor: "#E5DDD0",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  viewerBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    justifyContent: "center",
    alignItems: "center",
  },
  viewerClose: {
    position: "absolute",
    top: 48,
    right: 32,
  },
  viewerBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  viewerActions: {
    flexDirection: "row",
    gap: 24,
    marginTop: 24,
  },
  viewerAction: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#FFF",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    minWidth: 100,
  },
  viewerActionLabel: {
    fontSize: 14,
    fontFamily: "Nunito_700Bold",
    color: "#555",
  },
});
