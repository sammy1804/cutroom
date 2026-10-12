---
id: media.transcription
name: Transcription
version: 0.0.0
category: media
description: "Transcribes speech with speakers and word timings."
runtime: worker
executor: deterministic
cost: low
status: planned
tags: [audio, speech, transcript, captions]
consumes: [AudioAsset]
produces: [Transcript]
dependencies: [whisper]
failures: []
---
Planned. Not implemented yet; the registry lists it so discovery and planning know it is coming.
