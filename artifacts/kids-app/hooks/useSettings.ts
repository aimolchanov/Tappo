import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

export type AgeGroup = "2-3" | "4-5" | "auto";
export type AppLanguage = "ru" | "en";

export interface AppSettings {
  soundEffects: boolean;
  backgroundMusic: boolean;
  volume: number;       // 0..1
  ageGroup: AgeGroup;
  language: AppLanguage;
}

const KEY = "@kidsapp_settings_v1";

export const DEFAULTS: AppSettings = {
  soundEffects: true,
  backgroundMusic: false,
  volume: 0.8,
  ageGroup: "auto",
  language: "ru",
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((json) => {
        if (json) {
          try {
            setSettings({ ...DEFAULTS, ...JSON.parse(json) });
          } catch {}
        }
      })
      .finally(() => setReady(true));
  }, []);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const resetAll = useCallback(async () => {
    setSettings(DEFAULTS);
    await AsyncStorage.removeItem(KEY);
  }, []);

  return { settings, update, resetAll, ready };
}
