---
name: Skia on Web
description: react-native-skia crashes on web preview — safe pattern to handle it
---

## Problem
`@shopify/react-native-skia` v2.2.x throws "CanvasKit is not defined" on web (Expo web preview) because WebGL CanvasKit requires specific webpack/metro config that isn't set up.

## Safe Pattern
Split the screen into two components:
```tsx
function ScreenNative() {
  // all hooks + Skia Canvas here
}

function WebStub() {
  return <View>...</View>; // simple fallback, no Skia
}

export default function Screen() {
  if (Platform.OS === 'web') return <WebStub />;
  return <ScreenNative />;
}
```

**Why:** Hooks must never be called conditionally. The wrapper `Screen` has no hooks, so the early return is valid. `ScreenNative` always calls its hooks unconditionally.

**Where:** `app/drawing.tsx` uses this pattern.
