import { useAudioPlayer } from "expo-audio";
import { useCallback } from "react";

import { useAppSettings } from "@/contexts/SettingsContext";

/**
 * Returns a `play()` function that fires pop.wav.
 * Respects the global `soundEffects` toggle and `volume` setting.
 */
export function usePop() {
  const player = useAudioPlayer(
    require("@/assets/sounds/pop.wav") as number
  );
  const { soundEffects, volume } = useAppSettings();

  const play = useCallback(() => {
    if (!soundEffects) return;
    try {
      player.volume = volume;
      player.seekTo(0);
      player.play();
    } catch {
      // Sound is optional — never crash the app over audio
    }
  }, [player, soundEffects, volume]);

  return play;
}
