---
id: production.spec-compile
name: Spec Compile
version: 1.0.0
category: production
description: "Compiles a storyboard and a direction's palette into a valid CreativeSpec (scenes and elements with stable ids) that drives the Remotion preview and render. Deterministic."
runtime: inline
executor: deterministic
cost: free
status: ready
tags: [creativespec, compile, storyboard, scenes, remotion, timeline]
consumes: [Storyboard, CreativeDirection]
produces: [CreativeSpec]
dependencies: []
failures:
  - Storyboard references preset ids that don't exist (they fall back to safe defaults)
---
Maps each shot to a scene; headline/subtitle/image become elements with ids like scene_01.headline. Unknown presets
fall back to defaults; colours are chosen for readable contrast.
