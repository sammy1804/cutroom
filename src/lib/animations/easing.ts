import type { EasingName } from "./types";

/** Pure easing functions: every animation is a deterministic function of the frame. */

export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function ease(name: EasingName | string, t: number, bounciness = 60): number {
  const x = clamp01(t);
  switch (name) {
    case "linear":
      return x;
    case "easeOut":
      return 1 - (1 - x) ** 3;
    case "easeInOut":
      return x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
    case "expoOut":
      return x === 1 ? 1 : 1 - 2 ** (-10 * x);
    case "backOut": {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
    }
    case "spring": {
      const damping = 9 - bounciness * 0.065;
      const freq = 9 + bounciness * 0.12;
      return x === 1 ? 1 : 1 - Math.exp(-damping * x) * Math.cos(freq * x);
    }
    default:
      return x;
  }
}

/** A ball dropping and bouncing to rest: 0 → 1 with diminishing bounces. */
export function bounceDrop(t: number, bounciness = 60): number {
  const x = clamp01(t);
  const decay = 7 - bounciness * 0.045;
  return 1 - Math.exp(-decay * x) * Math.abs(Math.cos(3.5 * Math.PI * x));
}

/** Local progress (0–1) of an animation that starts at `delay` seconds and lasts `duration` seconds. */
export function localProgress(frame: number, fps: number, delay: number, duration: number) {
  return clamp01((frame / fps - delay) / Math.max(0.0001, duration));
}
