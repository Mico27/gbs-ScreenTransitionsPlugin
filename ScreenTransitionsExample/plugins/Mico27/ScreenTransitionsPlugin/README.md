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

This replaces the approach of baking every tile write into GBVM
script. The benefits:

- **Tiny script footprint** — a transition is a handful of `VM_SET_CONST` +
  `VM_INVOKE` bytes regardless of effect, so any number of them fit in one
  script (no bank-overflow, no need to split heavy effects across scenes).
- **Proper waiting** — the script blocks on the transition, no manual `Wait`s.
- **Automatic scroll tracking** — background transitions read the live scroll
  each frame, so they always line up with the visible screen on scrolled scenes
  (no "follow scroll" toggle needed).

This is a self-contained **engine plugin**

## Transitions

Only one effect per reverse-pair is listed — the complement (opposite side,
close instead of open, shrink instead of grow, counter-clockwise) is the same
effect with **Direction = Reversed** (see below).

- `wipe_right` — horizontal wipe (reversed = leftward).
- `wipe_down` — vertical wipe (reversed = upward).
- `open_h` / `open_v` — horizontal / vertical curtain, opening from the centre
  (reversed = curtain close).
- `iris_out` — box iris opening from the centre (reversed = close).
- `diag_tl` — **Diagonal (vertical range)**: a straight front line spanning
  top↔bottom, swept sideways (one Bresenham line per step). **Initial angle**
  tilts it: 0 = "/", 128 = vertical, 255 = "\".
- `diag_h` — **Diagonal (horizontal range)**: the transpose — a front line
  spanning left↔right, swept downward. **Initial angle**: 0 = "/", 128 =
  horizontal, 255 = "\". Between the two effects you can aim the diagonal at any
  orientation. Both reverse to sweep from the opposite side.
- `checker` — two-pass checkerboard dissolve.
- `snake_h` / `snake_v` — serpentine sweep, one tile per step (use a higher
  *Steps per frame*, e.g. 6–12, as it covers every tile).
- `spiral` — serpentine spiral, one tile per step, clockwise from the top-left
  corner winding inward to the centre.
- `blinds_h` / `blinds_v` — venetian blinds: several bars close at once.
- `four_sq` — chunky 16×16-pixel (2×2 tile) block wipe.
- `diamond_out` — diamond iris opening from the centre (reversed = close).
- `clock` — radial sweep from the centre, clockwise from 12 o'clock (reversed =
  counter-clockwise).
- `fan4` — four-blade fan / pinwheel (reversed = counter-clockwise).
- `x` — an X (both diagonals) that thickens outward.
- `noise` — random dissolve, seeded differently each run.
- `mask_grow` — the reveal order is driven by a **screen-sized mask scene**: each
  screen tile is revealed by the tile *index* at the matching position in the
  mask scene, one distinct index per step — so the number of steps equals the
  mask background's **tileset tile count**. Grow reveals the lowest indices first
  (reversed = shrink, highest first). Draw a gradient in a scene (each step a
  different tile) and it becomes the transition shape. The mask is independent of
  the fill/reveal content, so it can drive a fill, a this-scene reveal, or a
  scene copy — just pick the **Mask scene**.

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

### Direction, angle & centre

Three extra parameters (on both events) let you retarget most effects:

- **Direction** — *Normal* or *Reversed / Counter-clockwise*. Reversed plays the
  effect's steps back-to-front, so it flips a wipe to the opposite side, an iris
  *close* to *open*, and a clock / fan / spiral to counter-clockwise. Works on
  every effect.
- **Initial angle (0-255)** — rotates where a **clock** / **fan** sweep starts
  (0 = 12 o'clock), or tilts the **diagonal**'s front line (0 = "/" down-right,
  128 = vertical, 255 = "\" down-left).
- **Custom centre point** — moves the pivot of **iris**, **diamond**, **clock**
  and **fan** off the region centre (tick *Custom centre point*, then set
  *Centre X / Y* in region-relative tiles). Left unticked, the pivot auto-centres
  the region. All three accept variables/expressions.

Every numeric field (region X/Y/W/H, steps/frames, source X/Y, fill tile id, CGB
palette) is a **value** field, so it accepts a **variable** or expression as well
as a constant — the transition reads them at runtime.

## Enabling / disabling transition types (ROM size)

Each transition type has an on/off toggle under **Settings → Engine → Screen
Transitions** (all on by default). Turning one off removes that effect's code
from the compiled ROM, so you only pay for what you use. If a script still uses a
transition whose type is disabled, the project fails to build with a clear error
naming the effect — enable the type (or pick another effect) and rebuild.

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
