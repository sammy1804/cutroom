---
id: media.scene-detection
name: Scene Detection
version: 0.0.0
category: media
description: "Finds cuts and shot boundaries in a video with timestamps."
runtime: worker
executor: deterministic
cost: low
status: planned
tags: [video, scenes, cuts, shots]
consumes: [VideoAsset]
produces: [Scenes]
dependencies: [ffmpeg, pyscenedetect]
failures: []
---
Planned. Not implemented yet; the registry lists it so discovery and planning know it is coming.
