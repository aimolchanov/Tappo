import { Feather } from "@expo/vector-icons";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Note definitions ──────────────────────────────────────────
// Звуковые файлы лежат в artifacts/kids-app/assets/sounds/
// Чтобы заменить звук ноты — замените соответствующий .wav файл
// на любой другой .wav (или .mp3) и обновите require() ниже.
const NOTES = [
  { name: "c4", color: "#FF5555", file: require("@/assets/sounds/note_c4.wav") as number },
  { name: "d4", color: "#FF9500", file: require("@/assets/sounds/note_d4.wav") as number },
  { name: "e4", color: "#FFD700", file: require("@/assets/sounds/note_e4.wav") as number },
  { name: "f4", color: "#6BCB50", file: require("@/assets/sounds/note_f4.wav") as number },
  { name: "g4", color: "#4ECDC4", file: require("@/assets/sounds/note_g4.wav") as number },
  { name: "a4", color: "#45B7FF", file: require("@/assets/sounds/note_a4.wav") as number },
  { name: "b4", color: "#9B59B6", file: require("@/assets/sounds/note_b4.wav") as number },
  { name: "c5", color: "#FF6FC8", file: require("@/assets/sounds/note_c5.wav") as number },
] as const;

interface GlowTrigger {
  noteIndex: number;
  seq: number;
}

interface RecordedNote {
  noteIndex: number;
  time: number;
}

// ─── Single note button ────────────────────────────────────────
function MusicNoteButton({
  index,
  color,
  onPress,
  glowTrigger,
}: {
  index: number;
  color: string;
  onPress: () => void;
  glowTrigger: GlowTrigger | null;
}) {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  const triggerAnim = useCallback(() => {
    glowOpacity.value = 0.65;
    glowOpacity.value = withTiming(0, { duration: 550 });
    scale.value = withSequence(
      withSpring(1.1, { damping: 7, stiffness: 320 }),
      withDelay(80, withSpring(1.0, { damping: 10, stiffness: 200 }))
    );
  }, [glowOpacity, scale]);

  useEffect(() => {
    if (glowTrigger?.noteIndex === index) {
      triggerAnim();
    }
  }, [glowTrigger, index, triggerAnim]);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <Reanimated.View style={[styles.noteWrap, scaleStyle]}>
      <Pressable
        onPress={() => {
          triggerAnim();
          onPress();
        }}
        style={[styles.noteButton, { backgroundColor: color }]}
      >
        <Reanimated.View
          style={[StyleSheet.absoluteFill, styles.noteGlow, glowStyle]}
        />
      </Pressable>
    </Reanimated.View>
  );
}

// ─── Main screen ───────────────────────────────────────────────
export default function MusicScreen() {
  const insets = useSafeAreaInsets();

  // All 8 players must be declared at the top level (hook rules)
  const p0 = useAudioPlayer(NOTES[0].file);
  const p1 = useAudioPlayer(NOTES[1].file);
  const p2 = useAudioPlayer(NOTES[2].file);
  const p3 = useAudioPlayer(NOTES[3].file);
  const p4 = useAudioPlayer(NOTES[4].file);
  const p5 = useAudioPlayer(NOTES[5].file);
  const p6 = useAudioPlayer(NOTES[6].file);
  const p7 = useAudioPlayer(NOTES[7].file);

  // Keep players in a ref so setTimeout closures always see the latest
  const playersRef = useRef([p0, p1, p2, p3, p4, p5, p6, p7]);
  useEffect(() => {
    playersRef.current = [p0, p1, p2, p3, p4, p5, p6, p7];
  }, [p0, p1, p2, p3, p4, p5, p6, p7]);

  const [isRecording, setIsRecording] = useState(false);
  const [glowTrigger, setGlowTrigger] = useState<GlowTrigger | null>(null);

  const recordingRef = useRef<RecordedNote[]>([]);
  const recordStartRef = useRef(0);
  const playbackTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isRecordingRef = useRef(false);

  // Keep ref in sync with state (so closures don't see stale value)
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // ── Record button pulse animation ──
  const recPulse = useSharedValue(1);
  useEffect(() => {
    if (isRecording) {
      recPulse.value = withRepeat(
        withSequence(
          withTiming(1.18, { duration: 550 }),
          withTiming(1.0, { duration: 550 })
        ),
        -1,
        false
      );
    } else {
      recPulse.value = withSpring(1.0, { damping: 10 });
    }
  }, [isRecording, recPulse]);

  const recPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: recPulse.value }],
  }));

  // ── Core: play a note ──
  const playNote = useCallback((idx: number) => {
    try {
      playersRef.current[idx].seekTo(0);
      playersRef.current[idx].play();
    } catch {
      // Never crash on audio failure
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setGlowTrigger({ noteIndex: idx, seq: Date.now() });
  }, []);

  // ── Button press handler ──
  const handleNotePress = useCallback(
    (idx: number) => {
      playNote(idx);
      if (isRecordingRef.current) {
        recordingRef.current.push({
          noteIndex: idx,
          time: Date.now() - recordStartRef.current,
        });
      }
    },
    [playNote]
  );

  // ── Record / Stop+Playback ──
  const handleRecordPress = () => {
    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const recorded = [...recordingRef.current];
      if (recorded.length === 0) return;

      // Cancel any previous playback
      playbackTimers.current.forEach(clearTimeout);
      playbackTimers.current = [];

      // Schedule playback with original timing
      recorded.forEach(({ noteIndex, time }) => {
        const t = setTimeout(() => playNote(noteIndex), time);
        playbackTimers.current.push(t);
      });
    } else {
      // Start recording
      playbackTimers.current.forEach(clearTimeout);
      recordingRef.current = [];
      recordStartRef.current = Date.now();
      setIsRecording(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0),
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Feather name="arrow-left" size={30} color="#FFFFFF" />
        </Pressable>

        <Reanimated.View style={recPulseStyle}>
          <Pressable
            onPress={handleRecordPress}
            style={[styles.recBtn, isRecording && styles.recBtnActive]}
          >
            <Feather
              name={isRecording ? "square" : "mic"}
              size={28}
              color="#FFFFFF"
            />
          </Pressable>
        </Reanimated.View>
      </View>

      {/* ── 2×4 note grid ── */}
      <View style={styles.grid}>
        <View style={styles.row}>
          {NOTES.slice(0, 4).map((note, i) => (
            <MusicNoteButton
              key={note.name}
              index={i}
              color={note.color}
              onPress={() => handleNotePress(i)}
              glowTrigger={glowTrigger}
            />
          ))}
        </View>
        <View style={styles.row}>
          {NOTES.slice(4, 8).map((note, i) => (
            <MusicNoteButton
              key={note.name}
              index={i + 4}
              color={note.color}
              onPress={() => handleNotePress(i + 4)}
              glowTrigger={glowTrigger}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#16162A",
  },

  // ── Header ──
  header: {
    height: 76,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  backBtn: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  recBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2.5,
    borderColor: "rgba(255,255,255,0.25)",
  },
  recBtnActive: {
    backgroundColor: "#FF3B3B",
    borderColor: "#FF6060",
  },

  // ── Grid ──
  grid: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
    justifyContent: "center",
  },
  row: {
    flex: 1,
    flexDirection: "row",
    gap: 16,
  },

  // ── Note button ──
  noteWrap: {
    flex: 1,
  },
  noteButton: {
    flex: 1,
    borderRadius: 36,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
  noteGlow: {
    borderRadius: 36,
    backgroundColor: "#FFFFFF",
  },
});
