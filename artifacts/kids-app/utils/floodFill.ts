/**
 * Shared flood-fill utilities.
 *
 * Used by:
 *  - Coloring screen (web <canvas> pixel fill)
 *  - Drawing screen (Skia snapshot → readPixels → fill → re-draw)
 */

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/**
 * Span-based scanline flood-fill on a raw RGBA pixel buffer.
 * Returns true if any pixels were changed (valid hit), false for an outline
 * tap or when the target already matches the fill color.
 * Complexity: O(filled pixels).
 */
export function scanlineFill(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  sx: number,
  sy: number,
  [fr, fg, fb]: [number, number, number]
): boolean {
  const gi = (x: number, y: number) => (y * width + x) * 4;
  const i0 = gi(sx, sy);
  const tr = data[i0], tg = data[i0 + 1], tb = data[i0 + 2];

  // Tapped on dark outline → miss
  if (tr < 60 && tg < 60 && tb < 60) return false;
  // Already the fill color
  if (Math.abs(tr - fr) < 10 && Math.abs(tg - fg) < 10 && Math.abs(tb - fb) < 10)
    return false;

  const isFillable = (x: number, y: number): boolean => {
    const i = gi(x, y);
    return (
      Math.abs(data[i] - tr) < 40 &&
      Math.abs(data[i + 1] - tg) < 40 &&
      Math.abs(data[i + 2] - tb) < 40
    );
  };

  const visited = new Uint8Array(width * height);
  const stack: number[] = [sy * width + sx];
  visited[sy * width + sx] = 1;

  while (stack.length > 0) {
    const pos = stack.pop()!;
    const py = Math.floor(pos / width);
    const px = pos % width;

    // Extend span left then right
    let lx = px;
    while (lx > 0 && !visited[py * width + lx - 1] && isFillable(lx - 1, py)) lx--;
    let rx = px;
    while (rx < width - 1 && !visited[py * width + rx + 1] && isFillable(rx + 1, py))
      rx++;

    // Fill and mark span
    for (let x = lx; x <= rx; x++) {
      const i = gi(x, py);
      data[i] = fr;
      data[i + 1] = fg;
      data[i + 2] = fb;
      data[i + 3] = 255;
      visited[py * width + x] = 1;
    }

    // Enqueue one seed per connected run in rows above / below
    for (const ny of [py - 1, py + 1]) {
      if (ny < 0 || ny >= height) continue;
      let inSpan = false;
      for (let x = lx; x <= rx; x++) {
        const eligible = !visited[ny * width + x] && isFillable(x, ny);
        if (eligible && !inSpan) {
          stack.push(ny * width + x);
          inSpan = true;
        } else if (!eligible) {
          inSpan = false;
        }
      }
    }
  }

  return true;
}
