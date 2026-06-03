import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useLocalSearchParams, router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSettings } from "@/hooks/useSettings";

const SAVE_DIR = (FileSystem.documentDirectory ?? "") + "my_works/";

// ─── Translations ────────────────────────────────────────────────
const TR = {
  ru: {
    title: "Настройки",
    parentOnly: "Раздел для родителей",
    sectionSound: "Звук",
    soundEffects: "Звуковые эффекты",
    soundEffectsSub: "Щелчки и сигналы на действия ребёнка",
    bgMusic: "Фоновая музыка",
    bgMusicSub: "Тихая музыка во время игры",
    volume: "Общая громкость",
    sectionDifficulty: "Сложность",
    ageGroup: "Возраст ребёнка",
    age23: "2–3 года",
    age45: "4–5 лет",
    ageAuto: "Авто",
    autoHint:
      "Приложение подстраивается само: следит за временем реакции и успехами ребёнка.",
    sectionWorks: "Мои работы",
    manageWorks: "Управление сохранёнными работами",
    noWorksTitle: "Пока пусто",
    noWorksSub: "Рисунки, которые ребёнок сохранит, появятся здесь.",
    deleteWork: "Удалить",
    deleteAllWorks: "Удалить все работы",
    deleteWorksConfirm: "Удалить все работы?",
    deleteWorksMsg: "Это действие нельзя отменить.",
    shareWork: "Поделиться",
    deleteOneConfirm: "Удалить этот рисунок?",
    deleteOneMsg: "Это действие нельзя отменить.",
    worksCount: (n: number) => `${n} ${n === 1 ? "рисунок" : n < 5 ? "рисунка" : "рисунков"}`,
    sectionLanguage: "Язык интерфейса",
    sectionPrivacy: "Данные и приватность",
    privacyPolicy: "Политика конфиденциальности",
    privacyPolicyTitle: "Политика конфиденциальности",
    privacyPolicyText:
      "Это приложение создано для детей в возрасте 2–5 лет.\n\n" +
      "Мы не собираем никаких персональных данных.\n" +
      "Мы не используем аналитику или отслеживание.\n" +
      "Мы не отправляем никакие данные на серверы.\n" +
      "Приложение работает полностью в автономном режиме.\n\n" +
      "Все данные (сохранённые рисунки и настройки) хранятся исключительно на вашем устройстве.\n\n" +
      "⚠️ Этот текст является заглушкой. Замените его финальным текстом политики конфиденциальности перед публикацией в App Store.",
    offlineNote:
      "Это приложение работает полностью офлайн и не собирает никаких данных о пользователях.",
    deleteAll: "Удалить все данные приложения",
    deleteAll1Title: "Удалить все данные?",
    deleteAll1Msg:
      "Это сотрёт все сохранённые работы ребёнка и сбросит все настройки на значения по умолчанию.",
    deleteAll2Title: "Вы уверены?",
    deleteAll2Msg:
      "Это действие нельзя отменить. Все данные будут удалены навсегда.",
    deleteAllBtn: "Да, удалить всё",
    cancel: "Отмена",
    close: "Закрыть",
    sectionAbout: "О приложении",
    appName: "Детское приложение",
    appVersion: "Версия 1.0.0",
    appBuild: "Для iPad · iOS",
    done: "Готово",
  },
  en: {
    title: "Settings",
    parentOnly: "Parents only",
    sectionSound: "Sound",
    soundEffects: "Sound Effects",
    soundEffectsSub: "Clicks and signals for child's actions",
    bgMusic: "Background Music",
    bgMusicSub: "Quiet music during play",
    volume: "Master Volume",
    sectionDifficulty: "Difficulty",
    ageGroup: "Child's Age",
    age23: "2–3 years",
    age45: "4–5 years",
    ageAuto: "Auto",
    autoHint:
      "The app adapts automatically by monitoring reaction time and progress.",
    sectionWorks: "My Works",
    manageWorks: "Manage Saved Works",
    noWorksTitle: "Nothing here yet",
    noWorksSub: "Drawings the child saves will appear here.",
    deleteWork: "Delete",
    deleteAllWorks: "Delete All Works",
    deleteWorksConfirm: "Delete all works?",
    deleteWorksMsg: "This action cannot be undone.",
    shareWork: "Share",
    deleteOneConfirm: "Delete this drawing?",
    deleteOneMsg: "This action cannot be undone.",
    worksCount: (n: number) => `${n} ${n === 1 ? "drawing" : "drawings"}`,
    sectionLanguage: "Interface Language",
    sectionPrivacy: "Data & Privacy",
    privacyPolicy: "Privacy Policy",
    privacyPolicyTitle: "Privacy Policy",
    privacyPolicyText:
      "This app is designed for children aged 2–5.\n\n" +
      "We do not collect any personal data.\n" +
      "We do not use analytics or tracking.\n" +
      "We do not send any data to servers.\n" +
      "The app works completely offline.\n\n" +
      "All data (saved drawings and settings) is stored exclusively on your device.\n\n" +
      "⚠️ This is placeholder text. Replace with your final privacy policy before submitting to the App Store.",
    offlineNote:
      "This app works completely offline and does not collect any user data.",
    deleteAll: "Delete All App Data",
    deleteAll1Title: "Delete all data?",
    deleteAll1Msg:
      "This will erase all saved works and reset all settings to defaults.",
    deleteAll2Title: "Are you absolutely sure?",
    deleteAll2Msg:
      "This cannot be undone. All data will be permanently deleted.",
    deleteAllBtn: "Yes, delete everything",
    cancel: "Cancel",
    close: "Close",
    sectionAbout: "About",
    appName: "Kids App",
    appVersion: "Version 1.0.0",
    appBuild: "For iPad · iOS",
    done: "Done",
  },
} as const;

// ─── Sub-components ──────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionHeader}>{label.toUpperCase()}</Text>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function Row({
  label,
  sublabel,
  right,
  onPress,
  chevron = false,
  last = false,
  destructive = false,
}: {
  label: string;
  sublabel?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  last?: boolean;
  destructive?: boolean;
}) {
  const inner = (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={styles.rowLeft}>
        <Text style={[styles.rowLabel, destructive && styles.destructive]}>
          {label}
        </Text>
        {sublabel ? <Text style={styles.rowSub}>{sublabel}</Text> : null}
      </View>
      <View style={styles.rowRight}>
        {right}
        {chevron && (
          <Feather name="chevron-right" size={16} color="#C7C7CC" style={{ marginLeft: 4 }} />
        )}
      </View>
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} android_ripple={{ color: "#eee" }}>
      {inner}
    </Pressable>
  ) : (
    inner
  );
}

function SegmentedPicker<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((opt) => (
        <Pressable
          key={opt.value}
          style={[styles.segment, opt.value === value && styles.segmentActive]}
          onPress={() => onChange(opt.value)}
        >
          <Text
            style={[
              styles.segmentText,
              opt.value === value && styles.segmentTextActive,
            ]}
          >
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const THUMB = 22;

function VolumeSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const trackWidth = useSharedValue(300);
  const pos = useSharedValue(value);

  useEffect(() => {
    pos.value = value;
  }, [value, pos]);

  const fillStyle = useAnimatedStyle(() => ({
    width: pos.value * trackWidth.value,
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: pos.value * (trackWidth.value - THUMB) },
    ],
  }));

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const v = Math.max(
            0,
            Math.min(1, e.nativeEvent.locationX / trackWidth.value)
          );
          pos.value = v;
          onChange(v);
        },
        onPanResponderMove: (e) => {
          const v = Math.max(
            0,
            Math.min(1, e.nativeEvent.locationX / trackWidth.value)
          );
          pos.value = v;
          onChange(v);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <View
      style={styles.sliderOuter}
      onLayout={(e) => {
        trackWidth.value = e.nativeEvent.layout.width;
      }}
      {...pan.panHandlers}
    >
      <View style={styles.sliderTrack}>
        <Reanimated.View style={[styles.sliderFill, fillStyle]} />
        <Reanimated.View style={[styles.sliderThumb, thumbStyle]} />
      </View>
    </View>
  );
}

// ─── Privacy modal ───────────────────────────────────────────────
function PrivacyModal({
  visible,
  onClose,
  t,
}: {
  visible: boolean;
  onClose: () => void;
  t: (typeof TR)["ru"];
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View
        style={[
          styles.modalContainer,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
        ]}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t.privacyPolicyTitle}</Text>
          <Pressable onPress={onClose} style={styles.modalClose}>
            <Feather name="x" size={22} color="#555" />
          </Pressable>
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
        >
          <Text style={styles.privacyText}>{t.privacyPolicyText}</Text>
        </ScrollView>
        <View style={{ paddingHorizontal: 24 }}>
          <Pressable style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneBtnText}>{t.close}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── My Works modal ──────────────────────────────────────────────
interface WorkFile {
  filename: string;
  uri: string;
  createdAt: Date;
}

async function loadWorks(): Promise<WorkFile[]> {
  try {
    const info = await FileSystem.getInfoAsync(SAVE_DIR);
    if (!info.exists) return [];
    const files = await FileSystem.readDirectoryAsync(SAVE_DIR);
    return files
      .filter((f) => f.endsWith(".png"))
      .map((filename) => {
        const ts = parseInt(filename.replace("drawing_", "").replace(".png", ""), 10);
        return { filename, uri: SAVE_DIR + filename, createdAt: new Date(isNaN(ts) ? 0 : ts) };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch {
    return [];
  }
}

function formatDate(d: Date, lang: "ru" | "en"): string {
  if (!d.getTime()) return "";
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };
  try {
    return d.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", opts);
  } catch {
    return d.toLocaleDateString();
  }
}

function WorksModal({
  visible,
  onClose,
  t,
  lang,
}: {
  visible: boolean;
  onClose: () => void;
  t: (typeof TR)["ru"];
  lang: "ru" | "en";
}) {
  const insets = useSafeAreaInsets();
  const [works, setWorks] = useState<WorkFile[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const items = await loadWorks();
    setWorks(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (visible) reload();
  }, [visible, reload]);

  const handleDeleteOne = useCallback(
    (item: WorkFile) => {
      Alert.alert(t.deleteOneConfirm, t.deleteOneMsg, [
        { text: t.cancel, style: "cancel" },
        {
          text: t.deleteWork,
          style: "destructive",
          onPress: async () => {
            await FileSystem.deleteAsync(item.uri, { idempotent: true });
            setWorks((prev) => prev.filter((w) => w.filename !== item.filename));
          },
        },
      ]);
    },
    [t]
  );

  const handleShare = useCallback(async (item: WorkFile) => {
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("", "Sharing not available on this device.");
        return;
      }
      await Sharing.shareAsync(item.uri, { mimeType: "image/png", dialogTitle: t.shareWork });
    } catch {
      Alert.alert("", "Could not share the file.");
    }
  }, [t]);

  const handleDeleteAll = useCallback(() => {
    Alert.alert(t.deleteWorksConfirm, t.deleteWorksMsg, [
      { text: t.cancel, style: "cancel" },
      {
        text: t.deleteAllWorks,
        style: "destructive",
        onPress: async () => {
          await Promise.all(works.map((w) => FileSystem.deleteAsync(w.uri, { idempotent: true })));
          setWorks([]);
        },
      },
    ]);
  }, [works, t]);

  const isEmpty = works.length === 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View
        style={[
          styles.modalContainer,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
        ]}
      >
        {/* Header */}
        <View style={styles.modalHeader}>
          <View>
            <Text style={styles.modalTitle}>{t.manageWorks}</Text>
            {!isEmpty && (
              <Text style={styles.worksCount}>{t.worksCount(works.length)}</Text>
            )}
          </View>
          <Pressable onPress={onClose} style={styles.modalClose}>
            <Feather name="x" size={22} color="#555" />
          </Pressable>
        </View>

        {/* Content */}
        {isEmpty ? (
          <View style={styles.emptyState}>
            <Feather name="image" size={52} color="#C7C7CC" />
            <Text style={styles.emptyTitle}>{t.noWorksTitle}</Text>
            <Text style={styles.emptySub}>{t.noWorksSub}</Text>
          </View>
        ) : (
          <FlatList
            data={works}
            numColumns={3}
            keyExtractor={(item) => item.filename}
            contentContainerStyle={styles.worksGrid}
            columnWrapperStyle={{ gap: 10 }}
            renderItem={({ item }) => (
              <View style={styles.workCard}>
                <Image
                  source={{ uri: item.uri }}
                  style={styles.workThumb}
                  resizeMode="cover"
                />
                <Text style={styles.workDate} numberOfLines={1}>
                  {formatDate(item.createdAt, lang)}
                </Text>
                {/* Actions overlay */}
                <View style={styles.workActions}>
                  <Pressable
                    style={[styles.workActionBtn, { backgroundColor: "#4ECDC4" }]}
                    onPress={() => handleShare(item)}
                    hitSlop={4}
                  >
                    <Feather name="share" size={14} color="#FFF" />
                  </Pressable>
                  <Pressable
                    style={[styles.workActionBtn, { backgroundColor: "#FF3B30" }]}
                    onPress={() => handleDeleteOne(item)}
                    hitSlop={4}
                  >
                    <Feather name="trash-2" size={14} color="#FFF" />
                  </Pressable>
                </View>
              </View>
            )}
          />
        )}

        {/* Footer buttons */}
        <View style={{ paddingHorizontal: 24, gap: 12 }}>
          {!isEmpty && (
            <Pressable style={[styles.doneBtn, styles.dangerBtn]} onPress={handleDeleteAll}>
              <Text style={styles.doneBtnText}>{t.deleteAllWorks}</Text>
            </Pressable>
          )}
          <Pressable style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneBtnText}>{t.close}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { exp } = useLocalSearchParams<{ exp?: string }>();
  const { settings, update, resetAll, ready } = useSettings();

  // ── Security: validate parent lock token ──────────────────────
  // Settings can only be opened right after the 3-second gear hold.
  // If the token is missing or expired, the user goes back immediately.
  const authorized = useRef(false);
  useEffect(() => {
    const expiry = Number(exp ?? 0);
    if (expiry && Date.now() <= expiry) {
      authorized.current = true;
    } else {
      // Not opened via the lock — redirect immediately
      router.replace("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [worksVisible, setWorksVisible] = useState(false);

  const t = TR[settings.language];

  // ── Delete all data (double confirmation) ──────────────────────
  const handleDeleteAll = useCallback(() => {
    Alert.alert(t.deleteAll1Title, t.deleteAll1Msg, [
      { text: t.cancel, style: "cancel" },
      {
        text: t.deleteAllBtn,
        style: "destructive",
        onPress: () => {
          Alert.alert(t.deleteAll2Title, t.deleteAll2Msg, [
            { text: t.cancel, style: "cancel" },
            {
              text: t.deleteAllBtn,
              style: "destructive",
              onPress: async () => {
                await resetAll();
                await AsyncStorage.clear();
                router.replace("/");
              },
            },
          ]);
        },
      },
    ]);
  }, [t, resetAll]);

  if (!ready) return null;

  return (
    <>
      <View
        style={[
          styles.screen,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
            paddingBottom: 0,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>{t.title}</Text>
            <View style={styles.parentBadge}>
              <Feather name="lock" size={11} color="#888" />
              <Text style={styles.parentBadgeText}>{t.parentOnly}</Text>
            </View>
          </View>
        </View>

        {/* ── Content ── */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom:
                insets.bottom + (Platform.OS === "web" ? 34 : 0) + 120,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── SOUND ── */}
          <SectionHeader label={t.sectionSound} />
          <Card>
            <Row
              label={t.soundEffects}
              sublabel={t.soundEffectsSub}
              right={
                <Switch
                  value={settings.soundEffects}
                  onValueChange={(v) => update({ soundEffects: v })}
                  trackColor={{ false: "#E0E0E0", true: "#4ECDC4" }}
                  thumbColor="#fff"
                />
              }
            />
            <Row
              label={t.bgMusic}
              sublabel={t.bgMusicSub}
              right={
                <Switch
                  value={settings.backgroundMusic}
                  onValueChange={(v) => update({ backgroundMusic: v })}
                  trackColor={{ false: "#E0E0E0", true: "#4ECDC4" }}
                  thumbColor="#fff"
                />
              }
            />
            <Row
              label={t.volume}
              last
              right={
                <Text style={styles.volPct}>
                  {Math.round(settings.volume * 100)}%
                </Text>
              }
            />
            <VolumeSlider
              value={settings.volume}
              onChange={(v) => update({ volume: v })}
            />
          </Card>

          {/* ── DIFFICULTY ── */}
          <SectionHeader label={t.sectionDifficulty} />
          <Card>
            <Row label={t.ageGroup} last />
            <SegmentedPicker
              options={[
                { label: t.age23, value: "2-3" as const },
                { label: t.age45, value: "4-5" as const },
                { label: t.ageAuto, value: "auto" as const },
              ]}
              value={settings.ageGroup}
              onChange={(v) => update({ ageGroup: v })}
            />
            <Text style={styles.hint}>{t.autoHint}</Text>
          </Card>

          {/* ── MY WORKS ── */}
          <SectionHeader label={t.sectionWorks} />
          <Card>
            <Row
              label={t.manageWorks}
              chevron
              last
              onPress={() => setWorksVisible(true)}
            />
          </Card>

          {/* ── LANGUAGE ── */}
          <SectionHeader label={t.sectionLanguage} />
          <Card>
            <Row label="" last />
            <SegmentedPicker
              options={[
                { label: "Русский", value: "ru" as const },
                { label: "English", value: "en" as const },
              ]}
              value={settings.language}
              onChange={(v) => update({ language: v })}
            />
          </Card>

          {/* ── DATA & PRIVACY ── */}
          <SectionHeader label={t.sectionPrivacy} />
          <Card>
            <Row
              label={t.privacyPolicy}
              chevron
              last
              onPress={() => setPrivacyVisible(true)}
            />
          </Card>
          <Text style={styles.offlineNote}>
            <Feather name="wifi-off" size={12} color="#888" />
            {"  "}
            {t.offlineNote}
          </Text>
          <Card>
            <Row
              label={t.deleteAll}
              chevron
              last
              destructive
              onPress={handleDeleteAll}
            />
          </Card>

          {/* ── ABOUT ── */}
          <SectionHeader label={t.sectionAbout} />
          <Card>
            <Row
              label={t.appName}
              right={<Text style={styles.aboutValue}>{t.appVersion}</Text>}
            />
            <Row
              label={t.appBuild}
              last
              right={
                <View style={styles.kidsKat}>
                  <Text style={styles.kidsKatText}>Kids Category</Text>
                </View>
              }
            />
          </Card>
        </ScrollView>

        {/* ── Done button (fixed bottom) ── */}
        <View
          style={[
            styles.bottomBar,
            {
              paddingBottom:
                insets.bottom + (Platform.OS === "web" ? 34 : 0) + 16,
            },
          ]}
        >
          <Pressable style={styles.doneBtn} onPress={() => router.replace("/")}>
            <Text style={styles.doneBtnText}>{t.done}</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Modals ── */}
      <PrivacyModal
        visible={privacyVisible}
        onClose={() => setPrivacyVisible(false)}
        t={t}
      />
      <WorksModal
        visible={worksVisible}
        onClose={() => setWorksVisible(false)}
        t={t}
        lang={settings.language}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const TEAL = "#4ECDC4";
const ACCENT = "#007AFF";

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1C1C1E",
    letterSpacing: 0.2,
  },
  parentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  parentBadgeText: {
    fontSize: 12,
    color: "#888",
    fontWeight: "500",
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  // Section
  sectionHeader: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8E8E93",
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
  },

  // Card
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  // Row
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
    minHeight: 50,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  rowLeft: {
    flex: 1,
    paddingRight: 12,
  },
  rowLabel: {
    fontSize: 16,
    color: "#1C1C1E",
    fontWeight: "400",
  },
  rowSub: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 2,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  destructive: {
    color: "#FF3B30",
  },
  chevron: {
    marginLeft: 4,
  },

  // Segmented control
  segmented: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: "#F2F2F7",
    borderRadius: 9,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 7,
    alignItems: "center",
  },
  segmentActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    color: "#8E8E93",
    fontWeight: "500",
  },
  segmentTextActive: {
    color: "#1C1C1E",
    fontWeight: "600",
  },

  // Hint text
  hint: {
    fontSize: 12,
    color: "#8E8E93",
    marginHorizontal: 16,
    marginBottom: 14,
    lineHeight: 17,
  },

  // Volume slider
  sliderOuter: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 18,
  },
  sliderTrack: {
    height: 4,
    backgroundColor: "#E5E5EA",
    borderRadius: 2,
    justifyContent: "center",
  },
  sliderFill: {
    position: "absolute",
    left: 0,
    height: 4,
    backgroundColor: TEAL,
    borderRadius: 2,
  },
  sliderThumb: {
    position: "absolute",
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: "#FFFFFF",
    top: -9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  volPct: {
    fontSize: 14,
    color: "#8E8E93",
    minWidth: 36,
    textAlign: "right",
  },

  // Offline note
  offlineNote: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 8,
    marginBottom: 16,
    marginHorizontal: 4,
    lineHeight: 17,
  },

  // About
  aboutValue: {
    fontSize: 14,
    color: "#8E8E93",
  },
  kidsKat: {
    backgroundColor: "#E8F9F8",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  kidsKatText: {
    fontSize: 11,
    color: TEAL,
    fontWeight: "600",
  },

  // Bottom bar
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: "#F2F2F7",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#C6C6C8",
  },
  doneBtn: {
    backgroundColor: TEAL,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  dangerBtn: {
    backgroundColor: "#FF3B30",
  },
  doneBtnText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },

  // Modals
  modalContainer: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#C6C6C8",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E5E5EA",
    justifyContent: "center",
    alignItems: "center",
  },

  // Privacy text
  privacyText: {
    fontSize: 15,
    color: "#3C3C43",
    lineHeight: 22,
    marginTop: 20,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#3C3C43",
  },
  emptySub: {
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 20,
  },

  // Works grid
  worksCount: {
    fontSize: 13,
    color: "#8E8E93",
    marginTop: 2,
  },
  worksGrid: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 10,
  },
  workCard: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#F2F2F7",
  },
  workThumb: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#E5E5EA",
  },
  workDate: {
    fontSize: 10,
    color: "#8E8E93",
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  workActions: {
    position: "absolute",
    top: 6,
    right: 6,
    flexDirection: "row",
    gap: 4,
  },
  workActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
});
