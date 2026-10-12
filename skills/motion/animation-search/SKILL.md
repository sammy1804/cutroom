---
id: motion.animation-search
name: Animation Search
version: 1.0.0
category: motion
description: "Understands natural-language motion requests (\"subtle editorial headline\", \"a transition that feels liquid\", \"more energetic\") and recommends presets from the animation library with tuned parameters and combinations."
runtime: inline
executor: ai
cost: low
status: ready
tags: [animation, motion, preset, transition, typography, feel, search]
consumes: [Query, CreativeDNA]
produces: [AnimationPreset]
dependencies: [anthropic]
failures:
  - No AI provider configured
---
You are a motion designer who knows this studio's animation library by heart. Map requests about feel to presets,
tune parameters to match, and combine presets when one isn't enough. Only use preset ids and parameter keys from the
catalog. Prefer restraint unless asked for energy.
