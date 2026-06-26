import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
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
import { copyToUserPuzzles } from "@/utils/userPuzzles";

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
  manageMode,
  onPress,
  onClone,
  onDelete,
}: {
  item: WorkItem;
  size: number;
  manageMode: boolean;
  onPress: () => void;
  onClone: () => void;
  onDelete: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        if (manageMode) return;
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

      {manageMode && (
        <>
          {/* Clone to puzzles (top-left) */}
          <Pressable
            onPress={onClone}
            style={[styles.cardAction, styles.cardActionClone]}
            hitSlop={8}
          >
            <Feather name="grid" size={20} color="#FFF" />
          </Pressable>

          {/* Delete (top-right) */}
          <Pressable
            onPress={onDelete}
            style={[styles.cardAction, styles.cardActionDelete]}
            hitSlop={8}
          >
            <Feather name="trash-2" size={20} color="#FFF" />
          </Pressable>
        </>
      )}
    </Pressable>
  );
}

// ─── Parental hold-to-unlock button (manage mode toggle) ───────────
function ManageLockButton({
  active,
  onUnlock,
  onLock,
}: {
  active: boolean;
  onUnlock: () => void;
  onLock: () => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const fired = useRef(false);

  const ringScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 2.2],
  });
  const ringOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0],
  });

  const handleIn = () => {
    if (active) return;
    fired.current = false;
    progress.setValue(0);
    anim.current = Animated.timing(progress, {
      toValue: 1,
      duration: 3000,
      useNativeDriver: true,
    });
    anim.current.start(({ finished }) => {
      if (finished && !fired.current) {
        fired.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onUnlock();
      }
    });
  };

  const handleOut = () => {
    anim.current?.stop();
    Animated.timing(progress, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={styles.lockWrap}>
      {!active && (
        <Animated.View
          style={[
            styles.lockRing,
            { transform: [{ scale: ringScale }], opacity: ringOpacity },
          ]}
        />
      )}
      <Pressable
        onPressIn={active ? undefined : handleIn}
        onPressOut={active ? undefined : handleOut}
        onPress={active ? onLock : undefined}
        style={[styles.backBtn, active && styles.lockBtnActive]}
        hitSlop={12}
      >
        <Feather
          name={active ? "check" : "lock"}
          size={24}
          color={active ? "#FFF" : "#555"}
        />
      </Pressable>
    </View>
  );
}

// ─── Clone confirmation flash ──────────────────────────────────────
function CloneFlash({ visible }: { visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      opacity.setValue(0);
      translateY.setValue(0);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.delay(550),
          Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
        Animated.timing(translateY, { toValue: -40, duration: 1000, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, opacity, translateY]);

  if (!visible) return null;

  return (
    <View style={styles.cloneFlashWrap} pointerEvents="none">
      <Animated.View
        style={[styles.cloneFlashCard, { opacity, transform: [{ translateY }] }]}
      >
        <Feather name="grid" size={44} color="#4ECDC4" />
      </Animated.View>
    </View>
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
  const [manageMode, setManageMode] = useState(false);
  const [cloneFlash, setCloneFlash] = useState(false);
  const cloneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (cloneTimer.current) clearTimeout(cloneTimer.current);
    };
  }, []);

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

  const handleClone = useCallback((item: WorkItem) => {
    copyToUserPuzzles(item.uri)
      .then(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCloneFlash(true);
        if (cloneTimer.current) clearTimeout(cloneTimer.current);
        cloneTimer.current = setTimeout(() => setCloneFlash(false), 1000);
      })
      .catch(() => {
        Alert.alert("Ошибка", "Не удалось добавить в пазлы.");
      });
  }, []);

  const handleCardDelete = useCallback((item: WorkItem) => {
    Alert.alert("Удалить рисунок?", "Это нельзя отменить.", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: async () => {
          try {
            await FileSystem.deleteAsync(item.uri, { idempotent: true });
          } catch {}
          loadWorks();
        },
      },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadWorks]);

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
        {works.length > 0 ? (
          <ManageLockButton
            active={manageMode}
            onUnlock={() => setManageMode(true)}
            onLock={() => setManageMode(false)}
          />
        ) : (
          <View style={{ width: 52 }} />
        )}
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
              manageMode={manageMode}
              onPress={() => setSelected(item)}
              onClone={() => handleClone(item)}
              onDelete={() => handleCardDelete(item)}
            />
          )}
        />
      )}

      {/* ── Clone confirmation ── */}
      <CloneFlash visible={cloneFlash} />

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
  cardAction: {
    position: "absolute",
    top: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  cardActionClone: {
    left: 8,
    backgroundColor: "#4ECDC4",
  },
  cardActionDelete: {
    right: 8,
    backgroundColor: "#EF4444",
  },
  lockWrap: {
    width: 52,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  lockRing: {
    position: "absolute",
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#F59E0B",
  },
  lockBtnActive: {
    backgroundColor: "#4ECDC4",
  },
  cloneFlashWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  cloneFlashCard: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#4ECDC4",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
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
