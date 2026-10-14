import { EASINGS, type AnimationCategory, type AnimationPreset, type ElementKind, type ParamDef } from "./types";

/* Parameter building blocks */
const duration = (d: number, max = 4): ParamDef => ({ type: "number", label: "Duration", default: d, min: 0.1, max, step: 0.05, unit: "s" });
const delay: ParamDef = { type: "number", label: "Delay", default: 0.1, min: 0, max: 2, step: 0.05, unit: "s" };
const easing = (d: (typeof EASINGS)[number] = "expoOut"): ParamDef => ({ type: "select", label: "Easing", default: d, options: EASINGS });
const intensity = (d = 60): ParamDef => ({ type: "number", label: "Intensity", default: d, min: 0, max: 100, step: 1 });
const stagger = (d = 40): ParamDef => ({ type: "number", label: "Stagger", default: d, min: 0, max: 300, step: 5, unit: "ms" });
const direction = (d = "up"): ParamDef => ({ type: "select", label: "Direction", default: d, options: ["up", "down", "left", "right"] });
const color = (d: string, label = "Colour"): ParamDef => ({ type: "color", label, default: d });
const speed = (d = 50): ParamDef => ({ type: "number", label: "Speed", default: d, min: 0, max: 100, step: 1 });

const ACCENT = "#e8a33d";

interface Def {
  id: string;
  name: string;
  description: string;
  moods: string[];
  renderer: string;
  params: Record<string, ParamDef>;
  config?: Record<string, unknown>;
  elements?: ElementKind[];
}

function build(category: AnimationCategory, defs: Def[], elements: ElementKind[], frames = 90): AnimationPreset[] {
  return defs.map((d) => ({
    id: `${category}-${d.id}`,
    name: d.name,
    category,
    description: d.description,
    moods: d.moods,
    version: 1,
    compatibleElements: d.elements ?? elements,
    parameters: d.params,
    // Exit animations look best as a still just before they leave.
    preview: { sample: category, durationInFrames: frames, posterFrame: d.config?.out ? 24 : category === "transition" ? 40 : category === "component" ? 80 : 70 },
    implementation: { renderer: d.renderer, config: d.config },
  }));
}

const textBase = (dur: number, ease: (typeof EASINGS)[number] = "expoOut", st = 40, int = 60) => ({
  duration: duration(dur),
  delay,
  easing: easing(ease),
  intensity: intensity(int),
  stagger: stagger(st),
});

const TEXT = build("text", [
  { id: "typewriter", name: "Typewriter", description: "Characters type on one at a time with a blinking caret.", moods: ["documentary", "honest", "terminal", "diary", "simple", "subtle"], renderer: "typewriter", params: { ...textBase(1.6, "linear", 0, 0), caret: { type: "boolean", label: "Caret", default: true } } },
  { id: "character-stagger", name: "Character Stagger", description: "Each character rises and fades in, one after another.", moods: ["refined", "editorial", "premium", "subtle", "elegant"], renderer: "units", config: { unit: "char", y: 0.6, opacity: true }, params: textBase(0.7, "expoOut", 28) },
  { id: "word-stagger", name: "Word Stagger", description: "Words arrive in sequence with a soft lift.", moods: ["clear", "narrative", "calm", "subtle", "readable"], renderer: "units", config: { unit: "word", y: 0.5, opacity: true }, params: textBase(0.6, "expoOut", 90) },
  { id: "blur-in", name: "Blur In", description: "Text resolves from a soft blur into focus.", moods: ["dreamy", "cinematic", "luxury", "soft", "subtle", "atmospheric"], renderer: "units", config: { unit: "all", blur: 18, opacity: true, scale: 1.06 }, params: textBase(1.1, "easeOut", 0, 60) },
  { id: "blur-out", name: "Blur Out", description: "Text dissolves out of focus. Good for exits.", moods: ["dreamy", "exit", "fade", "soft", "cinematic"], renderer: "units", config: { unit: "all", blur: 18, opacity: true, scale: 1.06, out: true }, params: textBase(0.9, "easeInOut", 0, 60) },
  { id: "split-reveal", name: "Split Reveal", description: "The line splits horizontally and slides apart to reveal itself.", moods: ["bold", "graphic", "editorial", "fashion", "punchy"], renderer: "split", params: textBase(0.9, "expoOut", 0, 70) },
  { id: "mask-reveal", name: "Mask Reveal", description: "Words slide up from behind an invisible mask line.", moods: ["editorial", "magazine", "clean", "premium", "classic"], renderer: "units", config: { unit: "word", mask: true }, params: textBase(0.8, "expoOut", 70) },
  { id: "kinetic-scale", name: "Kinetic Scale", description: "Characters punch in from oversized scale with momentum.", moods: ["energetic", "bold", "loud", "sport", "hype", "punchy"], renderer: "units", config: { unit: "char", scale: 3, opacity: true }, params: textBase(0.8, "backOut", 40, 70) },
  { id: "slide", name: "Slide", description: "The whole line slides in from a direction.", moods: ["simple", "clean", "corporate", "subtle"], renderer: "units", config: { unit: "all", travel: 0.35, opacity: true }, params: { ...textBase(0.7, "expoOut", 0, 60), direction: direction("left") } },
  { id: "bounce", name: "Bounce", description: "Letters drop in and bounce to rest.", moods: ["playful", "fun", "kids", "friendly", "energetic"], renderer: "units", config: { unit: "char", y: -1.4, opacity: true, forceEasing: "spring" }, params: textBase(0.9, "spring", 35, 60) },
  { id: "scramble", name: "Scramble", description: "Random glyphs decode into the final text.", moods: ["tech", "glitch", "cyber", "hacker", "futuristic", "energetic"], renderer: "scramble", params: { ...textBase(1.2, "linear", 30, 50), glyphs: { type: "select", label: "Glyphs", default: "symbols", options: ["symbols", "binary", "letters"] } } },
  { id: "tracking-reveal", name: "Tracking Reveal", description: "Letter spacing closes from wide to set while fading in.", moods: ["luxury", "fashion", "minimal", "premium", "editorial", "subtle"], renderer: "units", config: { unit: "all", tracking: 0.8, opacity: true }, params: textBase(1.3, "expoOut", 0, 60) },
  { id: "glitch", name: "Glitch", description: "RGB-split slices jitter and settle into clean type.", moods: ["glitch", "tech", "edgy", "energetic", "music", "cyber"], renderer: "textFx", config: { fx: "glitch" }, params: textBase(1, "easeOut", 0, 60) },
  { id: "wave", name: "Wave", description: "Characters ripple in a continuous wave.", moods: ["playful", "music", "fun", "loop", "friendly"], renderer: "textFx", config: { fx: "wave" }, params: { ...textBase(1.2, "linear", 60, 50), loop: { type: "boolean", label: "Loop", default: true } } },
  { id: "flicker", name: "Neon Flicker", description: "Flickers on like a neon sign, then glows steady.", moods: ["neon", "night", "retro", "nightlife", "bold"], renderer: "textFx", config: { fx: "flicker" }, params: { ...textBase(1.2, "linear", 0, 60), glow: color("#ff4fd8", "Glow") } },
  { id: "shadow-pop", name: "Shadow Pop", description: "Text lifts off the page as a long shadow extends.", moods: ["bold", "retro", "graphic", "poster", "punchy"], renderer: "textFx", config: { fx: "shadowPop" }, params: { ...textBase(0.7, "backOut", 0, 60), shadow: color("#1f6fd1", "Shadow") } },
  { id: "highlight-marker", name: "Highlight Marker", description: "A marker stroke sweeps behind the words.", moods: ["explainer", "emphasis", "educational", "friendly", "editorial"], renderer: "textFx", config: { fx: "marker" }, params: { ...textBase(0.8, "easeInOut", 0, 60), marker: color("#ffd84d", "Marker") } },
  { id: "strike-through", name: "Strike Through", description: "A line crosses out the text: before/after, myth vs fact.", moods: ["contrast", "myth", "before after", "editorial", "humour"], renderer: "textFx", config: { fx: "strike" }, params: { ...textBase(0.6, "easeOut", 0, 60), line: color("#e5484d", "Line") } },
  { id: "underline-draw", name: "Underline Draw", description: "A hand-drawn underline scribbles in under the line.", moods: ["handmade", "emphasis", "friendly", "explainer"], renderer: "textFx", config: { fx: "underline" }, params: { ...textBase(0.8, "easeInOut", 0, 60), line: color("#1f6fd1", "Line") } },
  { id: "gradient-sweep", name: "Gradient Sweep", description: "A shimmering gradient passes through the letters.", moods: ["premium", "shiny", "tech", "launch", "luxury"], renderer: "textFx", config: { fx: "sweep" }, params: { ...textBase(1.6, "easeInOut", 0, 60), tint: color("#7cc4ff", "Shine") } },
  { id: "line-reveal", name: "Line Reveal", description: "Each line wipes up from a mask with a rule drawn underneath.", moods: ["editorial", "magazine", "structured", "classic", "news"], renderer: "units", config: { unit: "line", mask: true, rule: true }, params: textBase(0.9, "expoOut", 160) },
  { id: "stamp", name: "Stamp", description: "Text thumps on like a rubber stamp, slightly crooked, then holds with a hand-made boil.", moods: ["stop-motion", "tactile", "analog", "handmade", "paper", "collage", "playful"], renderer: "stopMotion", config: { kind: "stamp" }, params: { delay: { ...delay, default: 0 }, intensity: intensity(45), boilRate: { type: "number", label: "Drawings per second", default: 8, min: 4, max: 24, step: 1 }, tilt: { type: "number", label: "Tilt", default: 0, min: -12, max: 12, step: 0.5, unit: "°" }, leave: { type: "number", label: "Leave at", default: 0, min: 0, max: 20, step: 0.1, unit: "s" } } },
], ["text"]);

const imgBase = (dur: number, ease: (typeof EASINGS)[number] = "easeInOut", int = 50) => ({ duration: duration(dur, 10), delay: { ...delay, default: 0 }, easing: easing(ease), intensity: intensity(int) });

const IMAGE = build("image", [
  { id: "ken-burns", name: "Ken Burns", description: "Slow zoom combined with a gentle drift across the frame.", moods: ["documentary", "nostalgic", "storytelling", "calm", "cinematic"], renderer: "imageTransform", config: { zoom: 0.18, drift: 0.06 }, params: { ...imgBase(3), direction: direction("right") } },
  { id: "slow-zoom", name: "Slow Zoom", description: "A steady push into the image.", moods: ["calm", "tension", "luxury", "subtle", "cinematic"], renderer: "imageTransform", config: { zoom: 0.22 }, params: imgBase(3, "linear") },
  { id: "pan", name: "Pan", description: "The frame travels across a wide image.", moods: ["landscape", "reveal", "calm", "travel"], renderer: "imageTransform", config: { zoom: 0.25, drift: 0.18 }, params: { ...imgBase(3, "easeInOut", 60), direction: direction("left") } },
  { id: "parallax", name: "Parallax", description: "Image layers move at different speeds for depth.", moods: ["depth", "immersive", "cinematic", "dimensional", "premium"], renderer: "imageParallax", params: { ...imgBase(3, "easeInOut", 60), direction: direction("left") } },
  { id: "image-reveal", name: "Image Reveal", description: "A clean wipe uncovers the image.", moods: ["editorial", "clean", "graphic", "magazine"], renderer: "imageReveal", params: { ...imgBase(1.1, "expoOut"), direction: direction("up") } },
  { id: "depth-shift", name: "Depth Shift", description: "Background softens and recedes while the subject sharpens forward.", moods: ["focus", "cinematic", "product", "dimensional"], renderer: "imageDepth", params: imgBase(2, "easeInOut", 60) },
  { id: "zoom-punch", name: "Zoom Punch", description: "A fast punch-in with motion blur, made for beats and hooks.", moods: ["energetic", "beat", "hook", "punchy", "music"], renderer: "imageFx", config: { fx: "punch" }, params: imgBase(0.5, "expoOut", 70) },
  { id: "rgb-split", name: "RGB Split", description: "Colour channels separate and snap back together.", moods: ["glitch", "music", "edgy", "tech"], renderer: "imageFx", config: { fx: "rgb" }, params: imgBase(1, "easeOut", 60) },
  { id: "duotone", name: "Duotone Fade", description: "Fades from a brand-colour duotone into full colour.", moods: ["brand", "editorial", "graphic", "spotify"], renderer: "imageFx", config: { fx: "duotone" }, params: { ...imgBase(1.6, "easeInOut", 60), tint: color("#1f6fd1", "Tone") } },
  { id: "blur-transition", name: "Blur Transition", description: "Image arrives from an out-of-focus wash.", moods: ["dreamy", "soft", "atmospheric", "subtle"], renderer: "imageBlur", params: imgBase(1.2, "easeOut", 60) },
  { id: "cutout-pop", name: "Cutout Pop", description: "A paper cutout snaps into place with no tween, then boils like a hand-placed piece between photographed frames. Stagger delays to build a collage piece by piece; set Leave at to take it apart.", moods: ["stop-motion", "paper", "collage", "cutout", "tactile", "analog", "handmade", "scrapbook"], renderer: "stopMotion", config: { kind: "cutout" }, params: { delay: { ...delay, default: 0 }, intensity: intensity(45), boilRate: { type: "number", label: "Drawings per second", default: 8, min: 4, max: 24, step: 1 }, tilt: { type: "number", label: "Tilt", default: 0, min: -12, max: 12, step: 0.5, unit: "°" }, leave: { type: "number", label: "Leave at", default: 0, min: 0, max: 20, step: 0.1, unit: "s" } } },
], ["image", "video"]);

const objBase = (dur: number, ease: (typeof EASINGS)[number] = "easeInOut", int = 50) => ({ duration: duration(dur, 8), delay: { ...delay, default: 0 }, easing: easing(ease), intensity: intensity(int) });

const OBJECT = build("object", [
  { id: "float", name: "Float", description: "Weightless up-and-down hover.", moods: ["calm", "dreamy", "product", "subtle", "soft"], renderer: "objectLoop", config: { mode: "float" }, params: { ...objBase(3), loop: { type: "boolean", label: "Loop", default: true } } },
  { id: "drift", name: "Drift", description: "Slow wandering motion with a slight tilt.", moods: ["ambient", "calm", "organic", "subtle"], renderer: "objectLoop", config: { mode: "drift" }, params: objBase(3) },
  { id: "bounce", name: "Bounce", description: "Drops in and bounces to rest.", moods: ["playful", "fun", "energetic", "friendly"], renderer: "objectSpring", config: { mode: "drop" }, params: { ...objBase(1.2, "spring"), bounciness: { type: "number", label: "Bounciness", default: 60, min: 0, max: 100 } } },
  { id: "elastic", name: "Elastic", description: "Snaps into place with an elastic overshoot.", moods: ["playful", "springy", "energetic", "ui"], renderer: "objectSpring", config: { mode: "elastic" }, params: { ...objBase(1.2, "spring"), bounciness: { type: "number", label: "Bounciness", default: 75, min: 0, max: 100 } } },
  { id: "rotate", name: "Rotate", description: "Turns around its centre.", moods: ["dynamic", "loading", "product", "simple"], renderer: "objectRotate", params: { ...objBase(2, "easeInOut"), turns: { type: "number", label: "Turns", default: 1, min: 0.25, max: 4, step: 0.25 } } },
  { id: "scale", name: "Scale", description: "Grows in from nothing, or pulses.", moods: ["pop", "simple", "punchy", "ui"], renderer: "objectScale", params: { ...objBase(0.8, "backOut"), pulse: { type: "boolean", label: "Pulse after", default: false } } },
  { id: "magnetic", name: "Magnetic", description: "Leans toward a moving point of attention with spring lag.", moods: ["interactive", "playful", "tech", "premium"], renderer: "objectMagnetic", params: objBase(3) },
  { id: "pulse", name: "Pulse", description: "A steady heartbeat pulse that draws the eye.", moods: ["attention", "cta", "subtle", "loop", "ui"], renderer: "objectFx", config: { fx: "pulse" }, params: objBase(1.2) },
  { id: "wiggle", name: "Wiggle", description: "A quick shake that settles: notifications, errors, 'look here'.", moods: ["playful", "attention", "fun", "ui"], renderer: "objectFx", config: { fx: "wiggle" }, params: objBase(0.8, "easeOut", 60) },
  { id: "squash-stretch", name: "Squash & Stretch", description: "Cartoon drop with squash on impact.", moods: ["playful", "cartoon", "fun", "bouncy", "kids"], renderer: "objectFx", config: { fx: "squash" }, params: objBase(1.2, "linear", 60) },
  { id: "flip", name: "Flip", description: "Flips over in 3D to reveal its back.", moods: ["reveal", "card", "playful", "product"], renderer: "objectFx", config: { fx: "flip" }, params: objBase(0.9, "backOut", 50) },
  { id: "follow-path", name: "Follow Path", description: "Travels along a curved path, turning with it.", moods: ["journey", "explainer", "playful", "map"], renderer: "objectPath", params: { ...objBase(2.5), showPath: { type: "boolean", label: "Show path", default: true } } },
], ["shape", "image", "text"]);

const trBase = (dur: number, ease: (typeof EASINGS)[number] = "easeInOut") => ({ duration: duration(dur, 3), easing: easing(ease) });

const TRANSITION = build("transition", [
  { id: "shape-wipe", name: "Shape Wipe", description: "The next scene grows out of a shape.", moods: ["graphic", "bold", "playful", "clean"], renderer: "transition", config: { kind: "shape" }, params: { ...trBase(0.9, "expoOut"), shape: { type: "select", label: "Shape", default: "circle", options: ["circle", "diamond", "square"] } } },
  { id: "mask-wipe", name: "Mask Wipe", description: "A soft-edged mask sweeps across.", moods: ["clean", "smooth", "corporate", "subtle"], renderer: "transition", config: { kind: "mask" }, params: { ...trBase(0.9), direction: direction("right"), softness: intensity(40) } },
  { id: "blur", name: "Blur", description: "Out of focus, into the next scene.", moods: ["dreamy", "soft", "subtle", "cinematic"], renderer: "transition", config: { kind: "blur" }, params: { ...trBase(0.8), intensity: intensity(60) } },
  { id: "camera-push", name: "Camera Push", description: "Push through the current scene into the next.", moods: ["energetic", "cinematic", "momentum", "bold"], renderer: "transition", config: { kind: "push" }, params: { ...trBase(0.7, "expoOut"), intensity: intensity(60) } },
  { id: "camera-pull", name: "Camera Pull", description: "Pull back out of the scene to reveal the next.", moods: ["reveal", "cinematic", "calm", "big"], renderer: "transition", config: { kind: "pull" }, params: { ...trBase(0.8, "expoOut"), intensity: intensity(60) } },
  { id: "liquid", name: "Liquid", description: "Scenes melt into each other through a fluid distortion.", moods: ["liquid", "fluid", "organic", "dreamy", "experimental", "smooth"], renderer: "transition", config: { kind: "liquid" }, params: { ...trBase(1.1), intensity: intensity(65) } },
  { id: "morph", name: "Morph", description: "The frame morphs shape into the next scene.", moods: ["smooth", "playful", "ui", "modern"], renderer: "transition", config: { kind: "morph" }, params: trBase(1, "easeInOut") },
  { id: "pixel", name: "Pixel", description: "The next scene builds up in pixel blocks.", moods: ["retro", "gaming", "digital", "glitch", "tech"], renderer: "transition", config: { kind: "pixel" }, params: { ...trBase(0.9, "linear"), size: { type: "number", label: "Block size", default: 12, min: 4, max: 32, step: 1 } } },
  { id: "grain", name: "Grain", description: "Film grain swells and carries the cut.", moods: ["analog", "film", "texture", "raw", "editorial"], renderer: "transition", config: { kind: "grain" }, params: { ...trBase(0.8), intensity: intensity(70) } },
  { id: "film", name: "Film", description: "Gate weave, flash frame and jump: a hand-spliced cut.", moods: ["vintage", "film", "analog", "nostalgic", "raw"], renderer: "transition", config: { kind: "film" }, params: { ...trBase(0.6, "linear"), intensity: intensity(60) } },
  { id: "whip-pan", name: "Whip Pan", description: "A fast camera whip with motion blur into the next shot.", moods: ["energetic", "travel", "vlog", "fast", "momentum"], renderer: "transition", config: { kind: "whip" }, params: { ...trBase(0.45, "easeInOut"), direction: direction("left") } },
  { id: "zoom-through", name: "Zoom Through", description: "Zoom deep into the frame and out the other side.", moods: ["energetic", "hook", "tech", "bold"], renderer: "transition", config: { kind: "zoomThrough" }, params: { ...trBase(0.7, "easeInOut"), intensity: intensity(60) } },
  { id: "iris", name: "Iris", description: "Classic iris close to a point, then open on the next scene.", moods: ["retro", "cinema", "playful", "vintage"], renderer: "transition", config: { kind: "iris" }, params: trBase(1, "easeInOut") },
  { id: "split-doors", name: "Split Doors", description: "The frame splits down the middle and slides open.", moods: ["reveal", "launch", "bold", "graphic"], renderer: "transition", config: { kind: "doors" }, params: trBase(0.9, "expoOut") },
  { id: "stripes", name: "Stripes Wipe", description: "Staggered bars sweep the next scene in.", moods: ["graphic", "bold", "sport", "energetic", "modern"], renderer: "transition", config: { kind: "stripes" }, params: { ...trBase(0.9, "expoOut"), count: { type: "number", label: "Stripes", default: 6, min: 2, max: 16, step: 1 } } },
  { id: "light-leak", name: "Light Leak", description: "A warm light leak washes over the cut.", moods: ["warm", "nostalgic", "summer", "cinematic", "dreamy"], renderer: "transition", config: { kind: "leak" }, params: { ...trBase(1.2), color: color("#ff8a3d", "Leak colour") } },
], ["scene"]);

const bgBase = (spd = 40) => ({ speed: speed(spd), intensity: intensity(50) });

const BACKGROUND = build("background", [
  { id: "grain", name: "Grain", description: "Fine animated film grain over a flat colour.", moods: ["analog", "film", "texture", "editorial", "subtle"], renderer: "background", config: { kind: "grain" }, params: { ...bgBase(70), base: color("#1b1916", "Base") } },
  { id: "noise", name: "Noise", description: "Soft flowing noise field.", moods: ["organic", "ambient", "texture", "calm"], renderer: "background", config: { kind: "noise" }, params: { ...bgBase(30), base: color("#20314a", "Base"), tint: color(ACCENT, "Tint") } },
  { id: "gradient-flow", name: "Gradient Flow", description: "Colours flow slowly through a large gradient.", moods: ["modern", "calm", "tech", "brand", "smooth"], renderer: "background", config: { kind: "gradient" }, params: { ...bgBase(30), from: color("#2a1b4f", "From"), to: color(ACCENT, "To") } },
  { id: "particle-field", name: "Particle Field", description: "Drifting particles across depth.", moods: ["space", "tech", "ambient", "magical", "dreamy"], renderer: "background", config: { kind: "particles" }, params: { ...bgBase(40), count: { type: "number", label: "Particles", default: 60, min: 10, max: 200, step: 5 }, tint: color("#f4e9d8", "Particle") } },
  { id: "grid", name: "Grid", description: "A perspective grid scrolling toward the horizon.", moods: ["tech", "retro", "synthwave", "structured", "futuristic"], renderer: "background", config: { kind: "grid" }, params: { ...bgBase(50), tint: color(ACCENT, "Line") } },
  { id: "wave", name: "Wave", description: "Layered sine waves rolling across the frame.", moods: ["audio", "calm", "ocean", "flow", "music"], renderer: "background", config: { kind: "wave" }, params: { ...bgBase(40), tint: color("#6db3c9", "Wave") } },
  { id: "liquid", name: "Liquid", description: "Gooey blobs merging and separating.", moods: ["liquid", "fluid", "playful", "organic", "experimental"], renderer: "background", config: { kind: "liquid" }, params: { ...bgBase(35), tint: color("#ff6b6b", "Blob") } },
  { id: "glow", name: "Glow", description: "Breathing soft glows behind the content.", moods: ["premium", "calm", "luxury", "night", "subtle"], renderer: "background", config: { kind: "glow" }, params: { ...bgBase(30), tint: color(ACCENT, "Glow") } },
  { id: "aurora", name: "Aurora", description: "Soft bands of light drift like the northern lights.", moods: ["calm", "dreamy", "premium", "night", "ambient"], renderer: "background2", config: { kind: "aurora" }, params: { ...bgBase(30), a: color("#38d6a5", "Colour A"), b: color("#6d5bff", "Colour B") } },
  { id: "halftone", name: "Halftone", description: "Pulsing halftone dots, print and pop-art.", moods: ["retro", "print", "pop", "graphic", "comic"], renderer: "background2", config: { kind: "halftone" }, params: { ...bgBase(40), tint: color("#1f6fd1", "Dots"), base: color("#f6f1e7", "Paper") } },
  { id: "scanlines", name: "Scanlines", description: "CRT scanlines with a rolling bar and vignette.", moods: ["retro", "vhs", "tech", "glitch", "nostalgic"], renderer: "background2", config: { kind: "scanlines" }, params: { ...bgBase(50), base: color("#0f1a12", "Screen") } },
  { id: "mesh", name: "Mesh", description: "A multi-point mesh gradient that slowly orbits.", moods: ["modern", "brand", "soft", "tech", "colorful"], renderer: "background", config: { kind: "mesh" }, params: { ...bgBase(30), a: color("#e8a33d", "Colour A"), b: color("#6d8bc4", "Colour B"), c: color("#b07bac", "Colour C") } },
  { id: "paper", name: "Paper", description: "Scanned paper stock with fibre and a soft scanner falloff that shifts slightly each drawing.", moods: ["paper", "stop-motion", "tactile", "analog", "print", "collage", "craft"], renderer: "stopMotion", config: { kind: "paper" }, params: { intensity: intensity(45), boilRate: { type: "number", label: "Drawings per second", default: 8, min: 4, max: 24, step: 1 }, base: color("#ede6d6", "Paper") } },
], ["background"]);

const ADVANCED = build("3d", [
  { id: "camera-orbit", name: "Camera Orbit", description: "The camera orbits a set of cards in 3D space.", moods: ["dimensional", "showcase", "premium", "tech"], renderer: "three", config: { kind: "orbit" }, params: { ...objBase(3), intensity: intensity(55) } },
  { id: "product-spin", name: "Product Spin", description: "A product object spins on a turntable.", moods: ["product", "ecommerce", "showcase", "clean"], renderer: "three", config: { kind: "spin" }, params: { ...objBase(3, "linear"), tint: color(ACCENT, "Product") } },
  { id: "depth-tunnel", name: "Depth Tunnel", description: "Frames rush toward the camera through a tunnel.", moods: ["energetic", "hypnotic", "tech", "intense", "music"], renderer: "three", config: { kind: "tunnel" }, params: { ...objBase(3, "linear"), intensity: intensity(60), tint: color(ACCENT, "Line") } },
  { id: "particle-field-3d", name: "3D Particle Field", description: "Particles stream past the camera in depth.", moods: ["space", "warp", "magical", "tech", "energetic"], renderer: "three", config: { kind: "particles" }, params: { ...objBase(3, "linear"), intensity: intensity(60) } },
  { id: "parallax-3d", name: "3D Parallax", description: "Stacked planes separate in depth as the camera tilts.", moods: ["dimensional", "editorial", "immersive", "premium"], renderer: "three", config: { kind: "planes" }, params: objBase(3) },
  { id: "object-reveal", name: "Object Reveal", description: "An object swings up out of depth with a light sweep.", moods: ["reveal", "product", "premium", "launch", "cinematic"], renderer: "three", config: { kind: "reveal" }, params: { ...objBase(1.4, "expoOut"), tint: color(ACCENT, "Object") } },
], ["shape", "image", "scene"]);

const txt = (label: string, d: string, maxLength = 120): ParamDef => ({ type: "text", label, default: d, maxLength });
const compBase = (dur = 0.8) => ({ duration: duration(dur), delay: { ...delay, default: 0.2 }, accent: color("#1f6fd1", "Accent") });

/** Ready-made video components for short-form social: captions, overlays, CTAs. */
const COMPONENT = build("component", [
  { id: "captions-word-pop", name: "Word Pop Captions", description: "TikTok-style captions: one word at a time, the active word pops.", moods: ["captions", "tiktok", "reels", "subtitles", "energetic", "creator"], renderer: "component", config: { kind: "wordPop" }, params: { text: txt("Caption", "Coffee this good should not be this easy"), wordsPerSecond: { type: "number", label: "Words / second", default: 4, min: 1, max: 8, step: 0.5 }, uppercase: { type: "boolean", label: "Uppercase", default: true }, accent: color("#ffd84d", "Highlight") } },
  { id: "captions-karaoke", name: "Karaoke Captions", description: "Full line visible; a highlight follows the spoken word.", moods: ["captions", "subtitles", "podcast", "readable", "clean"], renderer: "component", config: { kind: "karaoke" }, params: { text: txt("Caption", "We roast every bean the week you order it"), wordsPerSecond: { type: "number", label: "Words / second", default: 3.5, min: 1, max: 8, step: 0.5 }, accent: color("#1f6fd1", "Highlight") } },
  { id: "captions-serif-keyword", name: "Serif Keyword Caption", description: "Clean sans captions with one keyword in italic serif.", moods: ["editorial", "captions", "premium", "magazine", "elegant"], renderer: "component", config: { kind: "serifKeyword" }, params: { text: txt("Caption", "Small batches, slow roast, big flavour"), keyword: txt("Keyword", "slow", 30), accent: color("#c4362c", "Keyword colour") } },
  { id: "captions-two-speaker", name: "Two Speaker Captions", description: "Colour-coded captions for interviews and conversations.", moods: ["interview", "podcast", "conversation", "captions"], renderer: "component", config: { kind: "twoSpeaker" }, params: { a: txt("Speaker A line", "How long does shipping take?"), b: txt("Speaker B line", "Roasted Monday, at your door by Wednesday."), accent: color("#1f6fd1", "Speaker A"), accent2: color("#0f7b6c", "Speaker B") } },
  { id: "lower-third", name: "Lower Third", description: "Name and role slide in on an accent bar.", moods: ["interview", "corporate", "news", "documentary", "clean"], renderer: "component", config: { kind: "lowerThird" }, params: { ...compBase(0.7), name: txt("Name", "Ines Varga", 40), role: txt("Role", "Head roaster, Halden", 60), style: { type: "select", label: "Style", default: "bar", options: ["bar", "minimal", "boxed"] } } },
  { id: "name-tag", name: "Name Tag", description: "A minimal pill with a live dot, for creators and UGC.", moods: ["ugc", "creator", "minimal", "friendly"], renderer: "component", config: { kind: "nameTag" }, params: { ...compBase(0.5), name: txt("Name", "@haldencoffee", 40) } },
  { id: "quote-card", name: "Quote Card", description: "A testimonial card with the quote revealed word by word.", moods: ["testimonial", "proof", "review", "editorial", "trust"], renderer: "component", config: { kind: "quote" }, params: { ...compBase(0.6), quote: txt("Quote", "The best cup I've made at home, by a mile."), author: txt("Author", "Maya R., subscriber since 2024", 60) } },
  { id: "callout-arrow", name: "Callout Arrow", description: "A hand-drawn arrow points at something with a label.", moods: ["explainer", "tutorial", "emphasis", "handmade"], renderer: "component", config: { kind: "callout" }, params: { ...compBase(0.7), label: txt("Label", "Roast date on every bag", 40) } },
  { id: "metric-counter", name: "Metric Counter", description: "A number rolls up to its value with a label: proof in one glance.", moods: ["proof", "stats", "data", "growth", "corporate"], renderer: "component", config: { kind: "counter" }, params: { ...compBase(1.4), value: { type: "number", label: "Value", default: 48000, min: 0, max: 1000000, step: 100 }, prefix: txt("Prefix", "", 4), suffix: txt("Suffix", "+", 6), label: txt("Label", "cups brewed this month", 40) } },
  { id: "chapter-marker", name: "Chapter Marker", description: "Numbered chapter title with a drawn rule, for tutorials and long cuts.", moods: ["tutorial", "chapter", "structured", "youtube", "educational"], renderer: "component", config: { kind: "chapter" }, params: { ...compBase(0.8), number: txt("Number", "02", 4), title: txt("Title", "Dial in the grind", 40) } },
  { id: "progress-bar", name: "Progress Bar", description: "A labelled bar fills to a percentage.", moods: ["data", "progress", "goal", "explainer", "ui"], renderer: "component", config: { kind: "progress" }, params: { ...compBase(1.4), percent: { type: "number", label: "Percent", default: 82, min: 0, max: 100, step: 1 }, label: txt("Label", "Beans sold out", 40) } },
  { id: "cta-button", name: "CTA Button", description: "A call-to-action button pops in, gets tapped and pulses.", moods: ["cta", "conversion", "ad", "shop", "subscribe"], renderer: "component", config: { kind: "cta" }, params: { ...compBase(0.6), label: txt("Label", "Start your subscription", 40), cursor: { type: "boolean", label: "Show tap", default: true } } },
  { id: "notification-toast", name: "Notification", description: "A phone notification slides down: perfect for hooks.", moods: ["hook", "ugc", "phone", "app", "social"], renderer: "component", config: { kind: "toast" }, params: { ...compBase(0.6), app: txt("App", "Halden", 20), title: txt("Title", "Your beans just shipped ☕", 50), body: txt("Body", "Roasted this morning. Arriving Wednesday.", 70) } },
  { id: "chat-bubbles", name: "Chat Bubbles", description: "A short message thread types itself out.", moods: ["dm", "conversation", "ugc", "social", "story"], renderer: "component", config: { kind: "chat" }, params: { ...compBase(0.5), a: txt("Message 1", "which beans for oat milk?", 60), b: txt("Reply", "Try the Brazil Cerrado. Chocolatey, low acid", 70), c: txt("Message 3", "ordering now 🙌", 60) } },
  { id: "offer-tag", name: "Offer Tag", description: "A price tag swings in, crosses out the old price and shows the new one.", moods: ["sale", "offer", "ecommerce", "promo", "ad"], renderer: "component", config: { kind: "offer" }, params: { ...compBase(0.7), was: txt("Was", "£18", 10), now: txt("Now", "£12", 10), note: txt("Note", "First bag", 24) } },
  { id: "rating-badge", name: "Rating Badge", description: "Stars fill one by one with a review count.", moods: ["proof", "reviews", "trust", "ecommerce"], renderer: "component", config: { kind: "rating" }, params: { ...compBase(1), rating: { type: "number", label: "Rating", default: 4.9, min: 1, max: 5, step: 0.1 }, label: txt("Label", "from 2,300 reviews", 40) } },
  { id: "logo-reveal", name: "Logo Reveal", description: "The mark draws itself, fills, and the wordmark tracks in.", moods: ["intro", "brand", "logo", "outro", "premium"], renderer: "component", config: { kind: "logo" }, params: { ...compBase(1.4), name: txt("Wordmark", "HALDEN", 24) } },
  { id: "end-card", name: "End Card", description: "Closing frame: headline, CTA and handle stagger in.", moods: ["outro", "cta", "end", "ad", "subscribe"], renderer: "component", config: { kind: "endCard" }, params: { ...compBase(0.7), title: txt("Title", "Fresh roast, every week.", 50), cta: txt("CTA", "haldencoffee.com", 40), handle: txt("Handle", "@haldencoffee", 30) } },
], ["overlay", "text"], 150);

export const ANIMATION_PRESETS: AnimationPreset[] = [...TEXT, ...IMAGE, ...OBJECT, ...TRANSITION, ...BACKGROUND, ...ADVANCED, ...COMPONENT];

export const CATEGORY_LABEL: Record<AnimationCategory, string> = {
  text: "Text",
  image: "Image",
  object: "Object",
  transition: "Transitions",
  background: "Background",
  "3d": "3D / Advanced",
  component: "Components",
};

export function getPreset(id: string) {
  return ANIMATION_PRESETS.find((p) => p.id === id);
}
