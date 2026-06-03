---
name: Settings Context
description: How global app settings are shared across all screens
---

## Pattern
- `hooks/useSettings.ts` — AsyncStorage persistence, exports `useSettings()` (read + write)
- `contexts/SettingsContext.tsx` — wraps `useSettings`, exposes read-only `useAppSettings()`
- `app/_layout.tsx` — wraps entire app in `<SettingsProvider>`

## Reading settings in any screen/hook
```tsx
import { useAppSettings } from "@/contexts/SettingsContext";
const { soundEffects, volume, ageGroup, language } = useAppSettings();
```

## Writing settings (Settings screen only)
```tsx
import { useSettings } from "@/hooks/useSettings";
const { settings, update, resetAll } = useSettings();
update({ volume: 0.5 });
```

**Why:** Avoids prop drilling across unrelated screens. Only one source of truth (AsyncStorage via useSettings). Settings screen gets its own `useSettings()` instance so it can write; all other screens read from context singleton.

**How to apply:** Any new screen that needs to check sound/volume/difficulty calls `useAppSettings()`. Never call `useSettings()` outside the SettingsProvider or the settings screen.
