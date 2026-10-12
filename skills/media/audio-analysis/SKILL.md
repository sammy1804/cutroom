---
id: media.audio-analysis
name: Audio Analysis
version: 0.0.0
category: media
description: "Detects beats, music sections, SFX, silence and an intensity curve."
runtime: worker
executor: deterministic
cost: low
status: planned
tags: [audio, beat, music, sfx, intensity]
consumes: [AudioAsset]
produces: [AudioAnalysis]
dependencies: [ffmpeg, librosa]
failures: []
---
Planned. Not implemented yet; the registry lists it so discovery and planning know it is coming.
