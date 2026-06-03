---
name: expo-audio volume control
description: How to set volume and respect soundEffects toggle with expo-audio AudioPlayer
---

## API
```tsx
player.volume = 0.8;  // set before play (0.0 – 1.0)
player.seekTo(0);
player.play();
```

## Pattern for settings-aware playback
```tsx
const { soundEffects, volume } = useAppSettings();

// In callbacks / PanResponder / setTimeout closures — use refs:
const soundEffectsRef = useRef(soundEffects);
const volumeRef = useRef(volume);
useEffect(() => { soundEffectsRef.current = soundEffects; }, [soundEffects]);
useEffect(() => { volumeRef.current = volume; }, [volume]);

// Play:
if (soundEffectsRef.current) {
  player.volume = volumeRef.current;
  player.seekTo(0);
  player.play();
}
```

**Why:** `useCallback` closures close over the initial value. Using refs ensures setTimeout/useCallback always sees the current setting even after parent component re-renders.

**Where:** `app/music.tsx` (8 note players), `app/puzzles.tsx` (snap + complete), `hooks/usePopSound.ts` (pop).
