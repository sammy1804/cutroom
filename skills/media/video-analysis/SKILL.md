---
id: media.video-analysis
name: Video Analysis
version: 0.0.0
category: media
description: "Turns an MP4 into structured VideoAnalysis: scenes, shot lengths, camera, motion, typography and transitions per scene."
runtime: worker
executor: hybrid
cost: medium
status: planned
tags: [video, analysis, scenes, pacing, reference]
consumes: [VideoAsset]
produces: [VideoAnalysis, MotionDNA]
dependencies: [ffmpeg, pyscenedetect, opencv]
failures: []
---
Planned. Not implemented yet; the registry lists it so discovery and planning know it is coming.
