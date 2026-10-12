---
id: production.export
name: Export
version: 0.0.0
category: production
description: "Renders a CreativeSpec to MP4 in each requested format and stores versions."
runtime: worker
executor: deterministic
cost: medium
status: planned
tags: [render, export, mp4, formats]
consumes: [CreativeSpec]
produces: [VideoFile]
dependencies: [remotion, ffmpeg]
failures: []
---
Planned. Not implemented yet; the registry lists it so discovery and planning know it is coming.
