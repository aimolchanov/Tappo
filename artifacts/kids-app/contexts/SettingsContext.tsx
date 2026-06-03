import React, { createContext, useContext } from "react";

import { AppSettings, DEFAULTS, useSettings } from "@/hooks/useSettings";

// ─── Context ──────────────────────────────────────────────────────
// Provides the current settings to every screen and hook without prop drilling.
// Only the Settings screen can write; all other screens read.

const SettingsContext = createContext<AppSettings>(DEFAULTS);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  );
}

/** Read current app settings from any component or hook */
export function useAppSettings(): AppSettings {
  return useContext(SettingsContext);
}
