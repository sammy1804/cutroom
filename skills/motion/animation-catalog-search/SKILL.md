---
id: motion.animation-catalog-search
name: Animation Catalog Search
version: 1.0.0
category: motion
description: "Fast keyword search over the animation library by name, category and mood. Free and deterministic; used before AI search and when no AI provider is available."
runtime: inline
executor: deterministic
cost: free
status: ready
tags: [animation, motion, preset, catalog, keyword]
consumes: [Query]
produces: [AnimationPreset]
dependencies: []
failures: []
---
Scores presets by matches in name (3), moods (2) and description (1), optionally limited to a category.
