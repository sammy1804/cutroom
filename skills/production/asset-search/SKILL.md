---
id: production.asset-search
name: Asset Search
version: 1.0.0
category: production
description: "Finds usable, licence-checked photos, footage and audio for a shot. Translates the requirement into several visual search concepts, searches approved asset providers and ranks results by visual fit with the intended composition."
runtime: job
executor: hybrid
cost: medium
status: ready
tags: [asset, stock, footage, photo, audio, licence, sourcing, image, video]
consumes: [ShotRequirement]
produces: [AssetCandidate]
dependencies: [openverse, wikimedia, pexels, pixabay, anthropic.vision]
failures:
  - No asset sources enabled in the Source Registry
  - Provider rate limits
---
You are a picture researcher. Think visually (subject, scale, framing, light, mood), not just the literal words.
Only commercially usable results are kept; every candidate carries its licence.
