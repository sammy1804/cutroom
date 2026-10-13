# Motion tools: how they work, and how Cutroom stays simpler

_14 Oct 2026. Research notes behind the board design ([BOARD.md](BOARD.md))._

## How each tool works

| Tool | Core model | Strengths | What it costs the user |
|---|---|---|---|
| **After Effects** | Layers × keyframes on a timeline, effects stack, expressions | Unlimited control; the industry standard; exports Lottie via Bodymovin | Steep learning curve; every move is hand-keyed; no collaboration |
| **Jitter** | Figma-like canvas + simple timeline; text presets by line/word/letter; 300+ templates; Figma import | Fast for UI/social motion; exports MP4/ProRes/GIF/Lottie | Still a timeline per artboard; templates are one-off copies |
| **Rive** | Editor + **state machines** (states, inputs, transitions) with a runtime | Interactive UI that reacts to input; small files | Built for apps, not for social video |
| **Lottie** | JSON playback format (authored in AE); dotLottie adds state machines | Tiny, crisp, plays everywhere | Authoring still happens elsewhere |
| **Canva** | Pages = scenes; drag templates; Magic Animate; Beat Sync; auto captions | Anyone can make something on-brand in minutes | Motion is shallow; brand control is loose |
| **CapCut** | Clip timeline; templates; auto captions; script-to-video | Best for talking-head and trend formats | Timeline editing; per-video manual work |
| **Figma Motion** (Config 2026) | Motion mode on the canvas: timeline beside layers, presets, spring curves, component-level motion, AI starting point | Motion lives where design lives; animate a component once, reuse everywhere | UI motion, not storytelling video |
| **FLORA** | Infinite canvas of **blocks connected by links**: text → image → video; saved workflows | Visual flow is obvious; branching and reuse | Generation-first: every block is an AI call |

## What we take, and what we leave out

| From | We take | We leave out |
|---|---|---|
| FLORA | Blocks connected by links read as a flow: **frames → arrows → final video** | AI as the default for every block |
| Figma Motion | Motion on the canvas, presets first, AI only as a starting point | A per-layer keyframe timeline |
| Jitter | Text presets by word/line/letter, templates, clean exports | Artboard-by-artboard timelines |
| Canva | Templates anyone can fill; Beat Sync and auto captions (next) | Loose brand control |
| Rive / Lottie | Lottie playback for small, crisp motion | State machines: social video doesn't need them |
| After Effects | Its presets, as named, tunable recipes | Keyframes, expressions, effect stacks |

## The Cutroom rule

> Nobody should ever need a timeline to make a good 20-second video.

- **Time comes from structure.** Each frame has a length; the arrows set the order; the transition lives on the arrow.
- **Motion comes from presets** with a few readable parameters, not keyframes.
- **The final video is always visible**, playing at the end of the chain.
- **Sous chef** fixes the common mistakes (reading time, a slow hook, contrast, a missing CTA, credits) as keep-or-cut suggestions.

## Next, in order (each keeps it simple)

1. **Templates from boards.** Save a connected chain as a template ("Entrepreneur Speedrun", "Myth-buster"), then fill a new one by swapping text and photos. Covers Jitter templates and Canva Magic Design.
2. **Auto captions + beat sync.** Upload a voiceover or track: captions become text layers with the caption presets, and frame lengths snap to beats (Web Audio onset detection, no AI).
3. **Cutouts.** One-click background removal for collage formats like Career Speedrun.
4. **Video clips in frames.** Trim a clip into a frame, for vox-pops and founder Q&A.
5. **Render to MP4** from the final node.

## Sources

[Jitter product](https://jitter.video/product/) · [What is Jitter](https://help.jitter.video/en/articles/12089209-what-is-jitter) ·
[Rive on Lottie imports](https://rive.app/blog/why-importing-lotties-isn-t-the-workflow-rive-was-built-for) ·
[LottieFiles: best motion tools 2026](https://lottiefiles.com/blog/design-guides-and-tips/best-motion-design-tools-ranked-by-use-case) ·
[Lottie vs Rive](https://www.motiontheagency.com/blog/lottie-vs-rive) · [Canva vs CapCut](https://www.canva.com/create/capcut-alternative/) ·
[FLORA canvas docs](https://docs.florafauna.ai/editor/canvas) · [Figma Motion at Config 2026](https://designcompass.org/en/2026/06/26/figma-motion-config-2026/) ·
[CMSWire on Figma Motion](https://www.cmswire.com/digital-experience/figma-launches-code-layers-motion-at-config-2026/)
