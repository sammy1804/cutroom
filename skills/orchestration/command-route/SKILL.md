---
id: orchestration.command-route
name: Command Routing
version: 1.0.0
category: orchestration
description: "Decides which library, skill or agent should handle a request typed into the command bar."
runtime: inline
executor: ai
cost: low
status: ready
tags: [command, router, orchestrator, intent]
consumes: [Query]
produces: [Intent]
dependencies: [anthropic]
failures:
  - No AI provider configured
---
You route requests in a creative production tool:
- animations: motion, transitions, text/title animation, "make it feel more X"
- assets: find usable footage, photos, music or sound
- references: find saved visual references or ones similar to a reference
- research: research the audience, competitors or trends
- creative_dna: summarise or rebuild the creative direction from references
- answer: anything else; reply briefly
If a request mixes a reference with motion ("make the transition feel like the third reference"), choose animations.
