# The board: one simple model

_13 Oct 2026. Replaces the "board + separate stack" design, which asked people to understand two places at once._

## The problem with what we had

The first board had loose cards on a canvas **and** a separate stack of scenes underneath. Dragging a card into the
stack copied it into the video, but the card stayed on the board looking exactly the same. People couldn't tell what
was "in the video" and what was just lying around. Editing a scene meant going to another page. That's the confusion.

## The model (borrowed from Flora, Figma and Riffle)

> **A frame is a scene. Connected frames are the video. The connection is the transition.**

| You see | It is | You can |
|---|---|---|
| **Frame**: a phone-shaped card showing the actual scene | One scene of the video | Edit text right there, drop images/animations/colours on it, change timing |
| **Arrow** from one frame to the next | The order of the video | Click the arrow to pick the transition (or "Cut") |
| A chain of connected frames | **The video** (the longest chain) | Press Play to watch it from the start, or from any frame |
| A frame with no arrows | A draft | Connect it when you want it in |
| Notes, references | Loose thinking material | Drop a note on a frame to make it the frame's text |

There is no second place. What's connected on the board **is** the video, and the preview, quality check, save to
library and export all read from that chain.

## What happens when you drag things in

| Drop… | On empty canvas | On a frame |
|---|---|---|
| Text animation | New frame with "Your text" animated that way | That frame's text animates that way |
| Background animation | New frame with that background | Frame background changes |
| Transition | New frame (nothing to connect yet) | Ignored with a hint: "drop transitions on an arrow" |
| Image / texture / Lottie | New frame with it full-bleed | Added to the frame |
| Note | Stays a note | Becomes the frame's headline (or subtitle) |
| Palette | Stays a palette | Restyles the whole video |
| Reference | Stays a reference (inspiration only) | Refused: references can't be used in videos |

## Editing a frame, in place

Select a frame and its editor opens right next to it: texts (type directly), colours, media, animation per layer,
duration. No page change. Double-click a frame to jump straight to its first text.

## Connecting

Drag from the dot on a frame's right edge to another frame. Each frame has one way in and one way out, so a chain is
always a clear sequence. Connecting into a frame that already has an arrow replaces it. Click the pill on an arrow to
choose a transition; the preview updates immediately.

## Working together

- **Live:** everyone on the board sees each other's cursors and selections, and edits arrive within about a second.
  Each change is a small operation on one frame, arrow or card; the last edit to the same thing wins.
- **Comments:** press C (or the comment button), click anywhere or on a frame, write. Threads have replies and
  resolve. Comments on a frame move with it. The Comments panel lists open threads; click one to jump to it.

The live layer runs on our own database (short polling through one endpoint), so it works on Vercel with no extra
service. If teams grow, swap in a managed realtime service (Liveblocks / PartyKit) behind the same interface.

## Where AI fits

AI never blocks the board. "Draft with AI" (Guide → Story) lays its storyboard out as connected frames on the board;
Brain helps with ideas. Everything on the board itself is instant and deterministic.

## How the Guide relates

The Guide (Idea → Explore → Direction) is for thinking before making. Story, Design and Motion now all happen on the
board. Final stays in the Guide: quality check, save as template, export.
