---
id: library.harvest-noto-emoji
name: Harvest Animated Noto Emoji
version: 1.0.0
category: library
description: "Syncs Google's Animated Noto Emoji (Lottie, CC BY 4.0) into the open library from the published index. Deterministic and incremental; every item carries the required credit."
runtime: job
executor: deterministic
cost: free
status: ready
tags: [library, harvest, lottie, emoji, noto, animation, sticker, sync]
consumes: []
produces: [LibraryItem]
dependencies: []
failures: [SOURCE_UNREACHABLE, EMPTY_INDEX]
---
# Harvest Animated Noto Emoji

Reads the index at `googlefonts.github.io/noto-emoji-animation/data/api.json` (about 880 animated emoji) and stores
each one as a `lottie` library item:

- name = the emoji character plus its first tag ("😀 Smile")
- tags and categories from the index, plus `emoji`
- static 128px PNG thumbnail, animated 512px WebP preview, and the Lottie JSON from `fonts.gstatic.com`
- popularity rank from the index

## Licence

CC BY 4.0. **Attribution is required.** Every item's rights record carries the credit
"Animated Noto Emoji by Google, CC BY 4.0". When the animation is used in a CreativeSpec the credit is copied onto the
element, and quality control lists it so it reaches the post caption or end card.

## Why not LottieFiles

LottieFiles has no official public API for bulk access, and its licence forbids redistribution as a library and
competing services. It stays out of the harvester; people can still upload Lottie files they have rights to.
