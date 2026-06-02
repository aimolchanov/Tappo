import { useAudioPlayer } from "expo-audio";
import { useCallback } from "react";

export function usePop() {
  const player = useAudioPlayer(
    require("@/assets/sounds/pop.wav") as number
  );

  const play = useCallback(() => {
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // Sound is optional — never crash the app over audio
    }
  }, [player]);

  return play;
}
