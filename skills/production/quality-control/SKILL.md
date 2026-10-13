---
id: production.quality-control
name: Quality Control
version: 1.2.0
category: production
description: "Checks a CreativeSpec before preview or render: reading time per shot, hook timing, total length for the format, text contrast, missing images and unknown presets. Deterministic; returns issues with suggested fixes."
runtime: inline
executor: deterministic
cost: free
status: ready
tags: [quality, qc, check, validate, readability, contrast, timing]
consumes: [CreativeSpec]
produces: [QualityReport]
dependencies: []
failures: []
---
Flags placeholder text like "[Your hook]". Reading speed assumes 0.3s per word + 0.5s. Hook should land within 3s. Social formats aim for 6–30s.
