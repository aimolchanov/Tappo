---
name: RNW Image onLoad DOM access
description: How to get the DOM <img> element from a react-native-web Image's onLoad event in this Expo web build.
---

## The rule

Do NOT rely on `e.nativeEvent.target` or `e.nativeEvent.source.uri` in an `<Image onLoad>` handler on Expo web. Instead, navigate the DOM from a known sibling element.

**Working pattern:**
```tsx
const handleSourceLoad = useCallback((_e: any) => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  // canvas.parentElement is the shared RNW wrapper <div>
  const imgEl = canvas.parentElement?.querySelector<HTMLImageElement>("img");
  if (!imgEl || !imgEl.naturalWidth) return;
  ctx.drawImage(imgEl, 0, 0);
}, [imageId]);
```

**Why:** In this Expo SDK / react-native-web version, the `onLoad` callback receives an event where `nativeEvent.target` is `undefined` (RNW strips it during event synthesis) and `nativeEvent.source.uri` is also undefined. The canvas and the hidden `<RNImage>` share the same parent `<div>` (a RNW View), so `canvas.parentElement.querySelector('img')` reliably finds the hidden img element that has `naturalWidth` set.

**Also:** Do NOT attach `ref` to `<Image>` from react-native on web — it causes the entire Image component (and siblings) to stop rendering.

**How to apply:** Any time you need to read pixel data from an RN Image asset in a web canvas context.
