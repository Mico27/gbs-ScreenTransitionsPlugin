# gbs-ScreenTransitionsPlugin

**Version 1.0.0 — Requires GB Studio ≥ 4.3.0**

A collection of tile-based screen transitions for GB Studio, provided as two events under the **Screen** group:

- **Screen Transition Out (to fill)** — dissolves the current scene into a solid fill (black, white, or any tile).
- **Screen Transition In (reveal scene)** — rebuilds a scene in the same family of patterns.

A transition **blocks the script that started it** until it finishes, exactly like the built-in *Wait* or *Camera Move* events, while music and other threads keep running. Background transitions track the live scroll every frame, so they always line up with the visible screen on scrolled scenes.

https://github.com/user-attachments/assets/f7456ac3-d21e-49d4-be9c-52976a9532c2

https://github.com/user-attachments/assets/448a32b9-21ad-4d8c-aacb-99ae302bcca1

---

## Table of Contents

1. [Concepts](#concepts)
2. [Project Setup](#project-setup)
3. [Engine Settings](#engine-settings)
4. [Size Limits and Restrictions](#size-limits-and-restrictions)
5. [Events Reference](#events-reference)
6. [Memory Footprint](#memory-footprint)
7. [License](#license)

---

## Concepts

### Transition types

Only one effect per reverse-pair is listed — the complement (opposite side, close instead of open, shrink instead of grow, counter-clockwise) is the same effect with **Direction = Reversed**.

| Effect | Description |
|---|---|
| **Wipe right** | Horizontal wipe (reversed = leftward). |
| **Wipe down** | Vertical wipe (reversed = upward). |
| **Open horizontal / vertical** | Curtain opening from the centre (reversed = curtain close). |
| **Iris out** | Box iris opening from the centre (reversed = close). |
| **Diagonal (vertical range)** | A straight front line spanning top↔bottom, swept sideways. **Initial angle** tilts it: 0 = "/", 128 = vertical, 255 = "\". |
| **Diagonal (horizontal range)** | The transpose — a front line spanning left↔right, swept downward. **Initial angle**: 0 = "/", 128 = horizontal, 255 = "\". Between the two you can aim the diagonal at any orientation. |
| **Checker** | Two-pass checkerboard dissolve. |
| **Snake horizontal / vertical** | Serpentine sweep, one tile per step. Use a higher *Steps per frame* (6–12) as it covers every tile. |
| **Spiral** | Serpentine spiral, one tile per step, clockwise from the top-left corner winding inward. |
| **Blinds horizontal / vertical** | Venetian blinds — several bars close at once. |
| **Four square** | Chunky 16×16-pixel (2×2 tile) block wipe. |
| **Diamond out** | Diamond iris opening from the centre (reversed = close). |
| **Clock** | Radial sweep from the centre, clockwise from 12 o'clock (reversed = counter-clockwise). |
| **Fan** | Four-blade fan / pinwheel (reversed = counter-clockwise). |
| **X** | An X (both diagonals) that thickens outward. |
| **Noise** | Random dissolve, seeded differently each run. |
| **Mask grow** | The reveal order is driven by a screen-sized **mask scene** — see below. |

### Mask transitions

**Mask grow** reveals each screen tile according to the tile *index* at the matching position in a mask scene, one distinct index per step, so the number of steps equals the mask background's tileset tile count. Grow reveals the lowest indices first; reversed (shrink) reveals the highest first.

Draw a gradient in a scene — each step a different tile — and it becomes the transition shape. The mask is independent of the fill or reveal content, so it can drive a fill, a this-scene reveal, or a scene copy; just pick the **Mask scene**.

### Layers

- **Background** — used by the *Out* fill, the *this-scene* reveal, and the *background* option of an *another-scene* reveal. Tracks the current scroll automatically.
- **Overlay (window)** — used by the *Out* overlay fill and the *overlay* option of an *another-scene* reveal. The window sits above the background, isn't scrolled, and survives a Change Scene, which is what makes seamless scene changes possible. Overlay transitions leave the window covering the screen; dismiss it with the stock **Hide Overlay** event.

### Direction, angle and centre

- **Direction** — *Normal* or *Reversed / Counter-clockwise*. Reversed plays the effect's steps back-to-front, flipping a wipe to the opposite side, an iris close to open, and a clock / fan / spiral to counter-clockwise. Works on every effect.
- **Initial angle (0–255)** — rotates where a **clock** or **fan** sweep starts (0 = 12 o'clock), or tilts the **diagonal**'s front line (0 = "/" down-right, 128 = vertical, 255 = "\" down-left).
- **Custom centre point** — moves the pivot of **iris**, **diamond**, **clock**, **fan** and **mask** off the region centre. Tick *Custom centre point*, then set *Centre X / Y* in region-relative tiles; left unticked, the pivot auto-centres the region. The resolved centre is clamped to the region, so an out-of-range value snaps to the nearest edge.
  - **Centre is absolute (world) position** — with a custom centre on the **background** layer, tick this to give *Centre X / Y* as world/map tiles; the current scroll is subtracted at runtime. Handy for centring an effect on a fixed point of a scrolled background. Only offered for background transitions, since the overlay isn't scrolled.

### Timing and framing

*Steps per frame* advances more of the effect each frame (faster); *Frames per step* waits extra frames between batches (slower).

*Start frame* / *End frame* select the slice of the effect's steps to play. **Start frame** skips the earlier steps, so the region starts partly transitioned, and **End frame** stops it early — both clamped to the effect's own length, with **0** meaning "run to the end". An effect's length in steps varies by type: a wipe is one step per column, a snake or spiral one per tile. The same window is drawn regardless of **Direction** — *Reversed* just plays it back-to-front, so both directions cover exactly the same tiles.

---

## Project Setup

Copy `src/ScreenTransitionsPlugin` into your project's `plugins/` folder, then restart GB Studio. Compatibility variants ship inside that folder and are selected automatically.

Add **Screen Transition Out** and **Screen Transition In** to your scripts wherever you would use a fade.

### Revealing across a scene change: copy another scene

**Screen Transition In → Reveal = Another scene** copies a second scene's tiles in with the chosen pattern. Pick the **Layer**:

- **Background** — morphs the current background into the source scene's tiles, in place. Follow with **Change Scene** (fade = None) to that scene.
- **Overlay** — primes the overlay with the *current* scene, shows it covering the screen, morphs the target scene in, and **leaves the overlay open**. Because the overlay survives a Change Scene, it keeps covering the background while the new scene loads underneath — no flash.

Either way the two scenes must share a background tileset, and **Source X / Source Y** choose where in the source scene to pull tiles from. Set them to the scroll (tile) position the target scene will be entered at, so the switch lines up.

Seamless A → B workflow using the **overlay** option:

1. On scene **A**: **Screen Transition In**, Reveal = **Another scene**, Layer = **Overlay**, Source scene = **B**, Source X/Y = B's entry scroll.
2. **Change Scene** to B with **Fade = None**, positioned at that same scroll. B loads behind the still-covering overlay.
3. On scene **B**, dismiss the overlay with the stock **Hide Overlay** event, and **Show Sprites** if you hid them. The overlay and the freshly-loaded background are identical, so the reveal is seamless.

Sprites draw above both the background and the overlay, so the transition can hide them; on the overlay path they stay hidden across the change until you Show Sprites.

### Revealing across a scene change: cover + fade-in

This works for any pair of scenes, with no shared tileset needed. Transition Out on scene A, Fade Out, Change Scene to B with fade = None, and on scene B set *On Init* auto-fade to **Manual** with the first event **Screen Transition In → Cover + fade in first**. It fills the screen, does an instant palette fade-in, then reveals B.

---

## Engine Settings

Found under **Settings → Engine → Screen Transitions**.

Each transition type has its own on/off toggle, all on by default. Turning one off removes that effect's code from the compiled ROM, so you only pay for what you use. If a script still uses a transition whose type is disabled, the project fails to build with a clear error naming the effect — enable the type, or pick another effect, and rebuild.

---

## Size Limits and Restrictions

- **Only one transition runs at a time.** Don't invoke two concurrently from different threads.
- **Copying another scene requires a shared background tileset** between the two scenes.
- **Mask scenes should be drawn larger than the screen** when using a custom centre, so the mask still covers everything at the chosen offset. The mask size is not validated.
- Fill tiles **202** (black) and **201** (white) are the UI tiles GB Studio loads into VRAM every scene, so they are always available as solid fills.
- Compatibility variants are included and selected automatically when **Screen Scroll Plugin**, **Continuous Scene Plugin**, **Metatile Plugin**, or Metatile combined with either of the first two, is installed alongside this plugin. No configuration is needed.
- With **Metatile Plugin**, copy and mask *sources* should be **normal** scenes, not metatile scenes. Fill and revealing the current (metatile) scene are fully supported.
- Triple combinations of other plugins are not shipped as dedicated variants.

---

## Events Reference

Both events appear under the **Screen** group in the script editor.

Every numeric field — region X/Y/W/H, steps and frames, source X/Y, fill tile id, CGB palette — is a **value** field, so it accepts a variable or expression as well as a constant, read at runtime.

---

### Screen Transition Out (to fill)

Dissolves the current screen into a solid fill using the chosen pattern.

| Field | Description |
|-------|-------------|
| Transition | Which effect to play. |
| Layer | Background or overlay. |
| Fill | The tile to fill with: black (202), white (201), or a custom tile id. |
| Steps per frame | How much of the effect advances each frame — higher is faster. |
| Frames per step | Extra frames waited between batches — higher is slower. |
| Hide sprites | Hide sprites for the duration of the transition. |
| CGB fill palette | Palette applied to the fill tiles on Game Boy Color. |
| Region | The X/Y/W/H tile rectangle the effect covers. |
| Direction | Normal, or Reversed / Counter-clockwise. |
| Initial angle | Start angle for clock and fan, or tilt for the diagonals (0–255). |
| Custom centre point / Centre X / Y | Move the pivot off the region centre. |
| Centre is absolute (world) position | Treat Centre X/Y as world tiles on the background layer. |
| Start frame / End frame | Play only a slice of the effect's steps; 0 = run to the end. |

---

### Screen Transition In (reveal scene)

Rebuilds a scene from a filled screen using the chosen pattern.

| Field | Description |
|-------|-------------|
| Transition | Which effect to play. |
| Reveal | This scene, or another scene. |
| Layer | Overlay or background (another-scene reveals only). |
| Source scene | The scene to copy tiles from (another-scene reveals only). |
| Source X / Source Y | Where in the source scene to pull tiles from — normally the target scene's entry scroll position. |
| Steps per frame | How much of the effect advances each frame — higher is faster. |
| Frames per step | Extra frames waited between batches — higher is slower. |
| Cover + fade in first | Fill the screen and fade the palette in before revealing (this-scene reveals only, with a fill tile field). |
| Hide sprites / Show sprites | Control sprite visibility across the transition. |
| Region | The X/Y/W/H tile rectangle the effect covers. |
| Direction | Normal, or Reversed / Counter-clockwise. |
| Initial angle | Start angle for clock and fan, or tilt for the diagonals (0–255). |
| Custom centre point / Centre X / Y | Move the pivot off the region centre. |
| Centre is absolute (world) position | Treat Centre X/Y as world tiles on the background layer. |
| Start frame / End frame | Play only a slice of the effect's steps; 0 = run to the end. |
| Mask scene | The scene whose tile indices drive a mask transition. |

---

<!-- SETTINGCOST:BEGIN -->
### What each engine setting costs

Every setting here changes what gets compiled. Figures are what you **get back by
turning the setting off**; rows marked *off by default* show what turning it **on**
costs instead, and sliders show the cost per step. A dash means that budget does not
move.

| Setting | Bank 0 | WRAM | Banked ROM |
|---|---|---|---|
| Wipe | — | — | **59 B** |
| Curtain | — | — | **267 B** |
| Iris | — | — | **390 B** |
| Diagonal | — | — | **391 B** |
| Checkerboard | — | — | **88 B** |
| Snake | — | — | **110 B** |
| Spiral | — | — | **331 B** |
| Blinds | — | — | **135 B** |
| 4-Square | — | — | **122 B** |
| Diamond | — | — | **11 B** |
| Clock | — | — | **46 B** |
| Random Noise | — | — | **145 B** |
| 4-Blade Fan | — | — | **156 B** |
| X (cross) | — | — | **95 B** |
| Mask (scene as mask) | — | — | **243 B** |

Turning off every on-by-default switch above frees **2,589 B** of banked ROM — the full
span between this plugin at its fullest and stripped to nothing. Treat it as a
ceiling rather than a recipe: you keep whatever your game actually uses.

<details><summary>How these were measured</summary>

GB Studio 4.3.0-e1. This plugin's `engine/src/**/*.c` was compiled with the
toolchain and flags GB Studio itself uses (`lcc -msm83:gb -Wf--max-allocs-per-node 3000
-DHUGE_TRACKER -DRUMBLE_ENABLE=0x08u`) against a merged include tree, and the SDCC object
files' area records were read: `_HOME` is bank 0, `_DATA`/`_INITIALIZED`/`_BSS` are WRAM,
and `_CODE*`/`_CONST`/`_LIT`/`_INITIALIZER` are banked ROM.

Two caveats. Only this plugin's own engine sources are measured, so a setting that also
changes a struct shared with stock engine files can move a few more bytes in files the
plugin does not ship. And each setting is toggled on its own: a handful measure slightly
*negative* because enabling their code lets the compiler drop a fallback path elsewhere,
and settings that gate other settings only show their own contribution.

</details>
<!-- SETTINGCOST:END -->

## Memory Footprint

- **WRAM:** a single small block of transition state, shared by all effects — which is why only one transition can run at a time. It does not scale with the number of transition types enabled.
- **SRAM added:** 0 bytes.
- **ROM:** depends on which transition types are enabled — each type you switch off under Engine Settings removes its code from the build. All effects live in banked ROM.
- Using the plugin's events additionally compiles a small, fixed amount of GBVM script per call into your project's script banks, regardless of which effect is chosen.

---

## License

MIT

---

<!-- BANK0:BEGIN -->
## Bank 0 (HOME) Usage

Bank 0 is the 16 KB non-switchable ROM bank that the GB Studio engine core,
the interrupt handlers and the GBDK runtime all share. Banked ROM is cheap
(add another bank), bank 0 is not, so it is usually the first thing a project
runs out of.

| | Bytes |
|---|---|
| Bank 0 used by this plugin | **0** |
| Bank 0 free with this plugin installed | **1,451** of 16,384 (91% used) |

**This plugin costs nothing in bank 0.** All of its code lives in a switchable
ROM bank; nothing it adds is resident in bank 0.

<details><summary>How this was measured</summary>

GB Studio 4.3.2, DMG target, default engine settings. Each module's bank 0
contribution is the `A _HOME size` record that SDCC writes into its `.rel`
object, summed over the engine sources this plugin provides. Stock sizes come
from building projects whose only plugin ships no engine C, so every module in
them is the untouched engine; two such builds were compared and agreed on all
73 shared modules.

The "free" figure is a stock project with this plugin and nothing else. Your
own number will differ: other plugins, and any engine settings that change what
the core compiles, move it independently of this plugin.

</details>
<!-- BANK0:END -->
