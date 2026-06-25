import { Feather } from "@expo/vector-icons";
import { useAudioPlayer } from "expo-audio";
import * as FileSystem from "expo-file-system";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useAppSettings } from "@/contexts/SettingsContext";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { captureRef } from "react-native-view-shot";

import Reanimated, {
  Easing,
  FadeOut,
  LinearTransition,
  SlideInRight,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const GAMES_BG = require("@/assets/images/games_background.png");

// ─── Saves directory (shared with the "Мои работы" gallery) ─────
const SAVE_DIR = (FileSystem.documentDirectory ?? "") + "my_works/";

async function ensureSaveDir() {
  const info = await FileSystem.getInfoAsync(SAVE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(SAVE_DIR, { intermediates: true });
  }
}

const H_MARGIN = 24;
const V_MARGIN = 20;
const NOTE_GAP = 22;
const ANIMAL_SIZE_MAX = 150;
const ANIMAL_SIZE_MIN = 104;
const ANIMAL_SIZE_PREFERRED = 134;
const BACK_SIZE = 64;
const CONTROLS_H = 72;
const THREAD_H = 80;
const LABEL_H = 26;
const MAX_BEADS = 16;
const PLAY_GAP_MS = 400;

type AnimalDef = {
  name: string;
  label: string;
  emoji: string;
  gradientTop: string;
  gradientBottom: string;
  shadow: string;
  file: number;
};

// ─── Animal musicians (low → high pitch) ───────────────────────
// Звуковые файлы лежат в artifacts/kids-app/assets/sounds/
const ANIMALS: readonly AnimalDef[] = [
  {
    name: "frog",
    label: "ЛЯГУШКА",
    emoji: "🐸",
    gradientTop: "#C5E1A5",
    gradientBottom: "#9CCC65",
    shadow: "#9CCC65",
    file: require("@/assets/sounds/note_c4.wav") as number,
  },
  {
    name: "cat",
    label: "КОТИК",
    emoji: "🐱",
    gradientTop: "#FFCC80",
    gradientBottom: "#FFA726",
    shadow: "#FFA726",
    file: require("@/assets/sounds/note_d4.wav") as number,
  },
  {
    name: "chick",
    label: "ЦЫПЛЁНОК",
    emoji: "🐥",
    gradientTop: "#FFE082",
    gradientBottom: "#FFD54F",
    shadow: "#FFD54F",
    file: require("@/assets/sounds/note_e4.wav") as number,
  },
  {
    name: "elephant",
    label: "СЛОНЁНОК",
    emoji: "🐘",
    gradientTop: "#B0BEC5",
    gradientBottom: "#90A4AE",
    shadow: "#90A4AE",
    file: require("@/assets/sounds/note_f4.wav") as number,
  },
  {
    name: "fox",
    label: "ЛИСЁНОК",
    emoji: "🦊",
    gradientTop: "#FFAB91",
    gradientBottom: "#FF8A65",
    shadow: "#FF8A65",
    file: require("@/assets/sounds/note_g4.wav") as number,
  },
  {
    name: "bunny",
    label: "ЗАЙЧИК",
    emoji: "🐰",
    gradientTop: "#D1C4E9",
    gradientBottom: "#B39DDB",
    shadow: "#B39DDB",
    file: require("@/assets/sounds/note_a4.wav") as number,
  },
  {
    name: "penguin",
    label: "ПИНГВИН",
    emoji: "🐧",
    gradientTop: "#BBDEFB",
    gradientBottom: "#90CAF9",
    shadow: "#90CAF9",
    file: require("@/assets/sounds/note_b4.wav") as number,
  },
  {
    name: "owl",
    label: "СОВЁНОК",
    emoji: "🦉",
    gradientTop: "#D7A86E",
    gradientBottom: "#B07D4E",
    shadow: "#B07D4E",
    file: require("@/assets/sounds/note_c5.wav") as number,
  },
];

interface PressTrigger {
  animalIndex: number;
  seq: number;
}

interface Bead {
  id: number;
  animalIndex: number;
}

function useAnimalDiameter(
  width: number,
  height: number,
  insets: { top: number; bottom: number; left: number; right: number },
) {
  return useMemo(() => {
    const availableW =
      width - insets.left - insets.right - H_MARGIN * 2 - NOTE_GAP * 3;
    const availableH =
      height -
      insets.top -
      insets.bottom -
      V_MARGIN * 2 -
      BACK_SIZE -
      CONTROLS_H -
      THREAD_H -
      LABEL_H -
      48;

    const byWidth = availableW / 4;
    const byHeight = (availableH - NOTE_GAP) / 2;
    const fit = Math.min(byWidth, byHeight, ANIMAL_SIZE_MAX);

    if (fit >= ANIMAL_SIZE_PREFERRED) return ANIMAL_SIZE_PREFERRED;
    if (fit >= ANIMAL_SIZE_MIN) return Math.floor(fit);
    return ANIMAL_SIZE_MIN;
  }, [width, height, insets.top, insets.bottom, insets.left, insets.right]);
}

// ─── Single animal-musician button ─────────────────────────────
function AnimalButton({
  index,
  animal,
  size,
  onPress,
  trigger,
}: {
  index: number;
  animal: AnimalDef;
  size: number;
  onPress: () => void;
  trigger: PressTrigger | null;
}) {
  const scale = useSharedValue(1);
  const hop = useSharedValue(0);
  const sparkleY = useSharedValue(0);
  const sparkleOpacity = useSharedValue(0);
  const sparkleScale = useSharedValue(0.5);
  const [labelVisible, setLabelVisible] = useState(false);
  const labelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const radius = size / 2;
  const emojiSize = size * 0.5;

  const showLabel = useCallback(() => {
    setLabelVisible(true);
    if (labelTimer.current) clearTimeout(labelTimer.current);
    labelTimer.current = setTimeout(() => setLabelVisible(false), 650);
  }, []);

  useEffect(() => {
    return () => {
      if (labelTimer.current) clearTimeout(labelTimer.current);
    };
  }, []);

  const triggerAnim = useCallback(() => {
    scale.value = withSequence(
      withSpring(0.88, { damping: 15, stiffness: 450 }),
      withSpring(1.0, { damping: 8, stiffness: 260 }),
    );
    hop.value = withSequence(
      withTiming(-size * 0.12, { duration: 140, easing: Easing.out(Easing.quad) }),
      withSpring(0, { damping: 7, stiffness: 220 }),
    );
    sparkleOpacity.value = 1;
    sparkleScale.value = 0.5;
    sparkleY.value = 0;
    sparkleScale.value = withTiming(1.2, { duration: 500 });
    sparkleY.value = withTiming(-size * 0.7, {
      duration: 550,
      easing: Easing.out(Easing.quad),
    });
    sparkleOpacity.value = withTiming(0, { duration: 550 });
    runOnJS(showLabel)();
  }, [scale, hop, sparkleOpacity, sparkleScale, sparkleY, size, showLabel]);

  useEffect(() => {
    if (trigger?.animalIndex === index) {
      triggerAnim();
    }
  }, [trigger, index, triggerAnim]);

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: hop.value }, { scale: scale.value }],
  }));

  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: sparkleOpacity.value,
    transform: [{ translateY: sparkleY.value }, { scale: sparkleScale.value }],
  }));

  return (
    <View style={{ width: size, alignItems: "center" }}>
      <View style={{ width: size, height: size }}>
        <Reanimated.View
          pointerEvents="none"
          style={[styles.sparkle, { top: -size * 0.1 }, sparkleStyle]}
        >
          <Text style={[styles.sparkleText, { fontSize: size * 0.3 }]}>♪</Text>
        </Reanimated.View>

        <Reanimated.View
          style={[
            {
              width: size,
              height: size,
              borderRadius: radius,
              shadowColor: animal.shadow,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.4,
              shadowRadius: 12,
              elevation: 10,
            },
            circleStyle,
          ]}
        >
          <Pressable
            onPress={() => {
              triggerAnim();
              onPress();
            }}
            style={{
              width: size,
              height: size,
              borderRadius: radius,
              overflow: "hidden",
            }}
          >
            <LinearGradient
              colors={[animal.gradientTop, animal.gradientBottom]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.animalGradient}
            >
              <Text style={{ fontSize: emojiSize }}>{animal.emoji}</Text>
            </LinearGradient>
          </Pressable>
        </Reanimated.View>
      </View>

      <View style={styles.labelSlot} pointerEvents="none">
        {labelVisible && (
          <Text style={[styles.animalLabel, { color: animal.shadow }]}>
            {animal.label}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Single bead on the thread ─────────────────────────────────
function BeadView({
  bead,
  size,
  active,
  celebrate,
  index,
}: {
  bead: Bead;
  size: number;
  active: boolean;
  celebrate: boolean;
  index: number;
}) {
  const animal = ANIMALS[bead.animalIndex];
  const hop = useSharedValue(0);
  const scale = useSharedValue(1);
  const fly = useSharedValue(0);
  const flyOpacity = useSharedValue(1);

  useEffect(() => {
    if (active) {
      hop.value = withSequence(
        withTiming(-14, { duration: 130, easing: Easing.out(Easing.quad) }),
        withSpring(0, { damping: 6, stiffness: 240 }),
      );
      scale.value = withSequence(
        withSpring(1.25, { damping: 8, stiffness: 320 }),
        withSpring(1.0, { damping: 9 }),
      );
    }
  }, [active, hop, scale]);

  useEffect(() => {
    if (celebrate) {
      const delay = index * 45;
      fly.value = withDelay(
        delay,
        withSequence(
          withSpring(-22, { damping: 6, stiffness: 260 }),
          withTiming(-180, { duration: 480, easing: Easing.in(Easing.quad) }),
        ),
      );
      scale.value = withDelay(delay, withTiming(1.4, { duration: 520 }));
      flyOpacity.value = withDelay(
        delay + 180,
        withTiming(0, { duration: 420 }),
      );
    }
  }, [celebrate, index, fly, flyOpacity, scale]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: flyOpacity.value,
    transform: [
      { translateY: hop.value + fly.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Reanimated.View
      entering={SlideInRight.springify().damping(16)}
      exiting={FadeOut.duration(280)}
      layout={LinearTransition.springify().damping(18)}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          shadowColor: animal.shadow,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.4,
          shadowRadius: 5,
          elevation: 5,
        },
        animStyle,
      ]}
    >
      <LinearGradient
        colors={[animal.gradientTop, animal.gradientBottom]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[
          styles.beadGradient,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        <Text style={{ fontSize: size * 0.46 }}>{animal.emoji}</Text>
      </LinearGradient>
    </Reanimated.View>
  );
}

type OwlMode = "idle" | "conduct" | "play" | "celebrate";

// ─── Owl conductor mascot ──────────────────────────────────────
function OwlConductor({ mode }: { mode: OwlMode }) {
  const rotate = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    // reset before applying the new behaviour
    rotate.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(0, { duration: 200 });
    scale.value = withTiming(1, { duration: 200 });

    if (mode === "idle") {
      // gentle dozing sway
      rotate.value = withRepeat(
        withSequence(
          withTiming(-5, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(5, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
    } else if (mode === "conduct") {
      // rhythmic head nodding
      translateY.value = withRepeat(
        withSequence(
          withTiming(-4, { duration: 220 }),
          withTiming(2, { duration: 220 }),
        ),
        -1,
        true,
      );
      rotate.value = withRepeat(
        withSequence(
          withTiming(-8, { duration: 220 }),
          withTiming(8, { duration: 220 }),
        ),
        -1,
        true,
      );
    } else if (mode === "play") {
      // active wing flapping to the beat
      rotate.value = withRepeat(
        withSequence(
          withTiming(-14, { duration: 160 }),
          withTiming(14, { duration: 160 }),
        ),
        -1,
        true,
      );
      scale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 160 }),
          withTiming(1.0, { duration: 160 }),
        ),
        -1,
        true,
      );
    } else if (mode === "celebrate") {
      // happy jump
      translateY.value = withSequence(
        withSpring(-22, { damping: 5, stiffness: 280 }),
        withSpring(0, { damping: 7, stiffness: 200 }),
      );
      scale.value = withSequence(
        withSpring(1.3, { damping: 6 }),
        withSpring(1.0, { damping: 8 }),
      );
    }
  }, [mode, rotate, translateY, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <Reanimated.View style={[styles.owl, animStyle]}>
      <Text style={styles.owlEmoji}>🦉</Text>
    </Reanimated.View>
  );
}

// ─── Main screen ───────────────────────────────────────────────
export default function MusicScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const animalSize = useAnimalDiameter(width, height, insets);

  const { soundEffects, volume } = useAppSettings();
  const soundEffectsRef = useRef(soundEffects);
  const volumeRef = useRef(volume);
  useEffect(() => {
    soundEffectsRef.current = soundEffects;
  }, [soundEffects]);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  const p0 = useAudioPlayer(ANIMALS[0].file);
  const p1 = useAudioPlayer(ANIMALS[1].file);
  const p2 = useAudioPlayer(ANIMALS[2].file);
  const p3 = useAudioPlayer(ANIMALS[3].file);
  const p4 = useAudioPlayer(ANIMALS[4].file);
  const p5 = useAudioPlayer(ANIMALS[5].file);
  const p6 = useAudioPlayer(ANIMALS[6].file);
  const p7 = useAudioPlayer(ANIMALS[7].file);

  const playersRef = useRef([p0, p1, p2, p3, p4, p5, p6, p7]);
  useEffect(() => {
    playersRef.current = [p0, p1, p2, p3, p4, p5, p6, p7];
  }, [p0, p1, p2, p3, p4, p5, p6, p7]);

  const [trigger, setTrigger] = useState<PressTrigger | null>(null);
  const [beads, setBeads] = useState<Bead[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingBeadId, setPlayingBeadId] = useState<number | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [owlMode, setOwlMode] = useState<OwlMode>("idle");

  const beadCounter = useRef(0);
  const playbackTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const otherTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const owlConductTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const owlIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const threadRef = useRef<View>(null);
  const beadsRef = useRef<Bead[]>([]);
  useEffect(() => {
    beadsRef.current = beads;
  }, [beads]);

  const clearTimers = useCallback(() => {
    playbackTimers.current.forEach(clearTimeout);
    playbackTimers.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
      otherTimers.current.forEach(clearTimeout);
      if (owlConductTimer.current) clearTimeout(owlConductTimer.current);
      if (owlIdleTimer.current) clearTimeout(owlIdleTimer.current);
    };
  }, [clearTimers]);

  // ── Owl mood helpers ──
  const owlToIdleAfter = useCallback((ms: number) => {
    if (owlIdleTimer.current) clearTimeout(owlIdleTimer.current);
    owlIdleTimer.current = setTimeout(() => setOwlMode("idle"), ms);
  }, []);

  const pokeOwlConduct = useCallback(() => {
    setOwlMode("conduct");
    if (owlConductTimer.current) clearTimeout(owlConductTimer.current);
    owlConductTimer.current = setTimeout(() => {
      setOwlMode((prev) => (prev === "conduct" ? "idle" : prev));
    }, 1500);
  }, []);

  const playNote = useCallback((idx: number) => {
    if (soundEffectsRef.current) {
      try {
        playersRef.current[idx].volume = volumeRef.current;
        playersRef.current[idx].seekTo(0);
        playersRef.current[idx].play();
      } catch {
        // Never crash on audio failure
      }
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTrigger({ animalIndex: idx, seq: Date.now() });
  }, []);

  const handleAnimalPress = useCallback(
    (idx: number) => {
      if (isPlaying || celebrate) return;
      playNote(idx);
      pokeOwlConduct();
      setBeads((prev) => {
        const next = [...prev, { id: beadCounter.current++, animalIndex: idx }];
        if (next.length > MAX_BEADS) next.shift();
        return next;
      });
    },
    [isPlaying, celebrate, playNote, pokeOwlConduct],
  );

  const stopPlayback = useCallback(() => {
    clearTimers();
    setIsPlaying(false);
    setPlayingBeadId(null);
    setOwlMode("idle");
  }, [clearTimers]);

  const handlePlayPress = useCallback(() => {
    if (isPlaying) {
      stopPlayback();
      return;
    }
    const seq = beadsRef.current;
    if (seq.length === 0) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPlaying(true);
    setOwlMode("play");
    clearTimers();

    seq.forEach((bead, i) => {
      const t = setTimeout(() => {
        playNote(bead.animalIndex);
        setPlayingBeadId(bead.id);
        if (i === seq.length - 1) {
          const end = setTimeout(() => {
            setIsPlaying(false);
            setPlayingBeadId(null);
            setOwlMode("idle");
          }, PLAY_GAP_MS);
          playbackTimers.current.push(end);
        }
      }, i * PLAY_GAP_MS);
      playbackTimers.current.push(t);
    });
  }, [isPlaying, stopPlayback, clearTimers, playNote]);

  const handleClear = useCallback(() => {
    if (isPlaying) stopPlayback();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBeads([]);
  }, [isPlaying, stopPlayback]);

  const handleSave = useCallback(async () => {
    if (saving || celebrate || isPlaying) return;
    if (beadsRef.current.length < 4) return;

    setSaving(true);
    try {
      if (Platform.OS !== "web") {
        const base64 = await captureRef(threadRef, {
          format: "png",
          quality: 1,
          result: "base64",
        });
        await ensureSaveDir();
        const filename = `music_${Date.now()}.png`;
        await FileSystem.writeAsStringAsync(SAVE_DIR + filename, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Celebration: beads fly up & burst, owl jumps, then thread resets
      setCelebrate(true);
      setOwlMode("celebrate");
      const t = setTimeout(() => {
        setBeads([]);
        setCelebrate(false);
        setOwlMode("idle");
      }, 1100);
      otherTimers.current.push(t);
    } catch {
      // Saving must never crash the screen
    } finally {
      setSaving(false);
    }
  }, [saving, celebrate, isPlaying]);

  // ── Dozing: drift owl to idle when nothing happens for >5s ──
  useEffect(() => {
    if (owlMode === "idle" || owlMode === "play" || owlMode === "celebrate") {
      return;
    }
    owlToIdleAfter(5000);
  }, [owlMode, owlToIdleAfter]);

  const webTopPad = Platform.OS === "web" ? 67 : 0;
  const webBottomPad = Platform.OS === "web" ? 34 : 0;

  const threadInnerW =
    width - insets.left - insets.right - H_MARGIN * 2 - 16 - 52 - 12;
  const beadSize = Math.min(
    THREAD_H - 20,
    Math.floor((threadInnerW - (MAX_BEADS - 1) * 8) / MAX_BEADS),
  );

  return (
    <ImageBackground
      source={GAMES_BG}
      resizeMode="cover"
      style={[
        styles.container,
        {
          paddingTop: insets.top + webTopPad,
          paddingBottom: insets.bottom + webBottomPad,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={34} color="#FFFFFF" />
        </Pressable>

        <OwlConductor mode={owlMode} />
      </View>

      {/* Animal grid */}
      <View style={styles.gridArea}>
        <View style={[styles.row, { gap: NOTE_GAP, marginBottom: NOTE_GAP }]}>
          {ANIMALS.slice(0, 4).map((animal, i) => (
            <AnimalButton
              key={animal.name}
              index={i}
              animal={animal}
              size={animalSize}
              onPress={() => handleAnimalPress(i)}
              trigger={trigger}
            />
          ))}
        </View>
        <View style={[styles.row, { gap: NOTE_GAP }]}>
          {ANIMALS.slice(4, 8).map((animal, i) => (
            <AnimalButton
              key={animal.name}
              index={i + 4}
              animal={animal}
              size={animalSize}
              onPress={() => handleAnimalPress(i + 4)}
              trigger={trigger}
            />
          ))}
        </View>
      </View>

      {/* Play / Save controls */}
      <View style={styles.controls}>
        <Pressable
          onPress={handlePlayPress}
          style={[styles.playBtn, isPlaying && styles.playBtnActive]}
        >
          <Feather
            name={isPlaying ? "square" : "play"}
            size={32}
            color="#FFFFFF"
            style={!isPlaying ? { marginLeft: 4 } : undefined}
          />
        </Pressable>

        {beads.length >= 4 && (
          <Pressable
            onPress={handleSave}
            style={styles.saveBtn}
            disabled={saving || celebrate}
          >
            <Feather name="star" size={30} color="#FFFFFF" />
          </Pressable>
        )}
      </View>

      {/* Bead thread */}
      <View style={styles.threadRow}>
        <View ref={threadRef} collapsable={false} style={styles.thread}>
          <View style={styles.threadLine} />
          <View style={styles.beadsRow}>
            {beads.map((bead, i) => (
              <BeadView
                key={bead.id}
                bead={bead}
                index={i}
                size={beadSize}
                active={playingBeadId === bead.id}
                celebrate={celebrate}
              />
            ))}
          </View>
        </View>

        <Pressable
          onPress={handleClear}
          style={styles.clearBtn}
          hitSlop={8}
          disabled={beads.length === 0}
        >
          <Feather
            name="trash-2"
            size={22}
            color={beads.length === 0 ? "rgba(255,255,255,0.4)" : "#FFFFFF"}
          />
        </Pressable>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: H_MARGIN,
    paddingBottom: 2,
  },
  backBtn: {
    width: BACK_SIZE,
    height: BACK_SIZE,
    borderRadius: BACK_SIZE / 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.28)",
  },
  owl: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.28)",
  },
  owlEmoji: {
    fontSize: 38,
  },

  gridArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: H_MARGIN,
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-start",
  },

  animalGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  sparkle: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 5,
  },
  sparkleText: {
    color: "#FFE27A",
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  labelSlot: {
    height: LABEL_H,
    marginTop: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  animalLabel: {
    fontFamily: "Fredoka_700Bold",
    fontWeight: "700",
    fontSize: 17,
    textShadowColor: "rgba(255,255,255,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  controls: {
    height: CONTROLS_H,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 18,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#43A047",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.45)",
    shadowColor: "#43A047",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  playBtnActive: {
    backgroundColor: "#E53935",
    shadowColor: "#E53935",
  },
  saveBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F5A623",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.5)",
    shadowColor: "#F5A623",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },

  threadRow: {
    height: THREAD_H,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: H_MARGIN,
    gap: 12,
    marginBottom: V_MARGIN,
  },
  thread: {
    flex: 1,
    height: THREAD_H,
    justifyContent: "center",
    borderRadius: THREAD_H / 2,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  threadLine: {
    position: "absolute",
    left: 16,
    right: 16,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  beadsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  beadGradient: {
    justifyContent: "center",
    alignItems: "center",
  },
  clearBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(120,120,120,0.45)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },
});
