import { AbsoluteFill, Composition, Sequence } from "remotion";
import { AnimationStack, type AnimationLayer } from "@/lib/animations/composition";
import { CATEGORY_LABEL, getPreset } from "@/lib/animations/presets";

/**
 * Reference reels rendered from the animation library with @remotion/renderer
 * (scripts/render-reels.ts). Everything here is assembled from library presets,
 * the same way the editor will assemble a campaign's creative spec.
 */

const FPS = 30;
const sans = "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

interface Shot {
  layers: AnimationLayer[];
  frames: number;
  text?: string;
  label?: string;
}

function Label({ title, kind }: { title: string; kind: string }) {
  return (
    <div style={{ position: "absolute", left: 16, bottom: 14, display: "flex", gap: 6, alignItems: "center", background: "rgba(255,255,255,.92)", color: "#37352f", borderRadius: 6, padding: "4px 9px", fontFamily: sans, fontSize: 12, fontWeight: 600 }}>
      {title}
      <span style={{ color: "#6f6e69", fontWeight: 500 }}>{kind}</span>
    </div>
  );
}

function Reel({ shots, labels = true }: { shots: Shot[]; labels?: boolean }) {
  let from = 0;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {shots.map((s, i) => {
        const start = from;
        from += s.frames;
        const first = getPreset(s.layers[s.layers.length - 1]!.presetId);
        return (
          <Sequence key={i} from={start} durationInFrames={s.frames}>
            <AnimationStack layers={s.layers} text={s.text} />
            {labels && first && <Label title={s.label ?? s.layers.map((l) => getPreset(l.presetId)?.name).join(" + ")} kind={CATEGORY_LABEL[first.category]} />}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

const total = (shots: Shot[]) => shots.reduce((n, s) => n + s.frames, 0);
const one = (presetId: string, frames = 75, params?: Record<string, unknown>, text?: string): Shot => ({ layers: [{ presetId, params }], frames, text });

export const LIBRARY_REEL: Shot[] = [
  one("text-kinetic-scale"),
  one("text-mask-reveal"),
  one("text-glitch"),
  one("text-highlight-marker"),
  one("text-flicker"),
  one("text-scramble"),
  { layers: [{ presetId: "text-character-stagger" }, { presetId: "text-blur-in" }, { presetId: "text-tracking-reveal" }], frames: 75, label: "Character Stagger + Blur In + Tracking Reveal" },
  one("image-ken-burns", 75),
  one("image-parallax", 75),
  one("image-duotone", 75),
  one("object-squash-stretch", 60),
  one("object-follow-path", 75),
  one("background-aurora", 75),
  one("background-mesh", 75),
  one("3d-product-spin", 75),
  one("3d-depth-tunnel", 75),
  one("component-lower-third", 90),
  one("component-metric-counter", 90),
  one("component-cta-button", 120),
];

export const TRANSITIONS_REEL: Shot[] = [
  "shape-wipe", "mask-wipe", "whip-pan", "zoom-through", "liquid", "split-doors", "stripes", "iris", "pixel", "camera-push", "film", "light-leak",
].map((id) => one(`transition-${id}`, 60));

export const CAPTIONS_PACK: Shot[] = [
  one("component-captions-word-pop", 120),
  one("component-captions-karaoke", 120),
  one("component-captions-serif-keyword", 90),
  one("component-captions-two-speaker", 90),
];

/** A 15-second vertical ad for the demo brand, built only from library components. */
export const HALDEN_AD: Shot[] = [
  one("component-notification-toast", 60),
  { layers: [{ presetId: "background-gradient-flow", params: { from: "#2a1b0f", to: "#c8823a" } }, { presetId: "text-kinetic-scale" }], frames: 60, text: "ROASTED MONDAY" },
  one("component-captions-word-pop", 105, { text: "We roast every bean the week you order it" }),
  one("component-lower-third", 75),
  one("component-metric-counter", 75),
  one("component-rating-badge", 60),
  one("component-offer-tag", 75),
  one("component-end-card", 90),
];

export function Root() {
  return (
    <>
      <Composition id="LibraryReel" component={Reel} defaultProps={{ shots: LIBRARY_REEL }} durationInFrames={total(LIBRARY_REEL)} fps={FPS} width={640} height={360} />
      <Composition id="TransitionsReel" component={Reel} defaultProps={{ shots: TRANSITIONS_REEL }} durationInFrames={total(TRANSITIONS_REEL)} fps={FPS} width={640} height={360} />
      <Composition id="CaptionsPack" component={Reel} defaultProps={{ shots: CAPTIONS_PACK }} durationInFrames={total(CAPTIONS_PACK)} fps={FPS} width={720} height={1280} />
      <Composition id="HaldenAd" component={Reel} defaultProps={{ shots: HALDEN_AD, labels: false }} durationInFrames={total(HALDEN_AD)} fps={FPS} width={720} height={1280} />
    </>
  );
}
