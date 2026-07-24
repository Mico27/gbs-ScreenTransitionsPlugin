# Screen Transitions Plugin (GB Studio 4.3+)

A collection of tile-based screen transitions for GB Studio, provided as two
events under the **Screen** group:

- **Screen Transition Out (to fill)** — dissolves the current scene into a
  solid fill (black / white / any tile).
- **Screen Transition In (reveal scene)** — rebuilds a scene in the same family
  of patterns.

## How it works

Each transition runs at **runtime as a single waitable VM function**
(`screen_transition_update`, driven by `VM_INVOKE`). The engine advances the
effect a few steps per frame and yields in between, so the invoking script
**pauses until the transition finishes** — exactly like the built-in *Wait* or
*Camera Move* events — while music and other threads keep running.

This replaces the previous approach of baking every tile write into GBVM
script. The benefits:

- **Tiny script footprint** — a transition is a handful of `VM_SET_CONST` +
  `VM_INVOKE` bytes regardless of effect, so any number of them fit in one
  script (no bank-overflow, no need to split heavy effects across scenes).
- **Proper waiting** — the script blocks on the transition, no manual `Wait`s.
- **Automatic scroll tracking** — background transitions read the live scroll
  each frame, so they always line up with the visible screen on scrolled scenes
  (no "follow scroll" toggle needed).

This is now a self-contained **engine plugin** — it no longer depends on the
Submapping Ex plugin.

## Transitions

`wipe_right/left/up/down`, horizontal & vertical curtains (`split_*` close /
`open_*` open), iris (`iris_in` / `iris_out`), diagonal (`diag_tl` / `diag_br`),
and a two-pass `checker` dissolve. Pair complements for symmetry (Iris Close out
→ Iris Open in).

## Layers

- **Background** — the *Out* fill, the *this-scene* reveal (refresh), and the
  *background* option of an *another-scene* reveal work on the scene's background
  tilemap and track the current scroll automatically.
- **Overlay (window)** — used by the *Out* overlay fill and the *overlay* option
  of an *another-scene* reveal. The window sits above the background, isn't
  scrolled, and (with its tilemap) survives a Change Scene — which is what makes
  the seamless scene change below possible. Overlay transitions show the window
  covering the screen and leave it open; dismiss it with the stock **Hide
  Overlay** event.

## Revealing across a scene change

### Copy another scene (background or overlay)

**Screen Transition In → Reveal = Another scene** copies a second scene's tiles
in with the chosen pattern. Pick the **Layer**:

- **Background** — morphs the current background into the source scene's tiles,
  in place. Follow with **Change Scene** (fade = None) to that scene.
- **Overlay** — primes the overlay with the *current* scene, shows it covering
  the screen, morphs the target scene in, and **leaves the overlay open**.
  Because the overlay survives a Change Scene, it keeps covering the background
  while the new scene loads underneath — no flash.

Either way the two scenes must share a background tileset, and **Source X /
Source Y** choose where in the source scene to pull tiles from — set them to the
scroll (tile) position the target scene will be entered at, so the switch lines
up.

Seamless A → B workflow using the **overlay** option:

1. On scene **A**: **Screen Transition In**, Reveal = **Another scene**, Layer =
   **Overlay**, Source scene = **B**, Source X/Y = B's entry scroll.
2. **Change Scene** to B with **Fade = None**, positioned at that same scroll.
   B loads behind the still-covering overlay.
3. On scene **B**, dismiss the overlay with the stock **Hide Overlay** event
   (and **Show Sprites** if you hid them). The overlay and the freshly-loaded
   background are identical, so the reveal is seamless.

Sprites draw above both the background and the overlay, so the transition hides
them (option); on the overlay path they stay hidden across the change (engine
`hide_sprites` flag) until you Show Sprites.

### Cover + fade-in on scene entry

For any scenes (no shared tileset needed): Transition Out on scene A, Fade Out,
Change Scene to B (fade = None), and on scene B set *On Init* auto-fade to
**Manual** with the first event **Screen Transition In → Cover + fade in first**.
It fills the screen, does an instant palette fade-in, then reveals B from ROM.

## Fields

**Out**: Transition · Layer · Fill (black `202` / white `201` / custom) · Steps
per frame · Frames per step · Hide sprites · CGB fill palette · Region.

**In**: Transition · Reveal (this scene / another scene) · Layer (another-scene
only: overlay or background) · Source scene · Source X/Y · Steps per frame ·
Frames per step · Cover + fade in first (+ tile, this-scene only) · Hide/Show
sprites · Region.

*Steps per frame* advances more of the effect each frame (faster); *Frames per
step* waits extra frames between batches (slower).

Every numeric field (region X/Y/W/H, steps/frames, source X/Y, fill tile id, CGB
palette) is a **value** field, so it accepts a **variable** or expression as well
as a constant — the transition reads them at runtime.

## Example project

`ScreenTransitionsExample/` opens in GB Studio 4.3 and auto-plays all 13
transitions in a single scene, then a scroll-tracked transition, then a
cross-scene reveal using a Source offset into a second scene. Prebuilt ROM at
`ScreenTransitionsExample/build/rom/game.gb`. Verified to compile with the GB
Studio 4.3 CLI.

## Install

Copy `src/ScreenTransitionsPlugin` into your project's `plugins/` folder, then
restart GB Studio.

## Notes

- Fill tiles `202`/`201` are the UI black/white tiles GB Studio loads into VRAM
  every scene, so they're always available as solid fills.
- Sprites are hidden/shown with the stock `VM_HIDE_SPRITES` / `VM_SHOW_SPRITES`.
- Only one transition runs at a time (shared state); don't invoke two
  concurrently from different threads.

## License

MIT
