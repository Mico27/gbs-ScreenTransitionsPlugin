# gbs-ScreenTransitionsPlugin

**Version 1.1.0. Requires GB Studio 4.3.0 or newer.**

Seventeen screen transitions in place of a plain fade: wipes, irises, curtains, checkerboards, spirals, blinds, clock sweeps, a pinwheel, random dissolves, and the quadrant shift Pokémon uses when a battle starts.

Two events under the **Screen** group:

- **Screen Transition Out (to fill)** dissolves the scene into black, white or any tile you choose.
- **Screen Transition In (reveal scene)** brings a scene back the same way, and can reveal a different scene entirely for a change of scene with no flash.

The script that starts a transition waits for it, the way **Wait** and **Camera Move** do, while music and other scripts keep running. Background transitions follow the scroll every frame, so they line up on a scrolling scene.

https://github.com/user-attachments/assets/f7456ac3-d21e-49d4-be9c-52976a9532c2

https://github.com/user-attachments/assets/448a32b9-21ad-4d8c-aacb-99ae302bcca1

---

## Table of Contents

1. [Concepts](#concepts)
2. [Project Setup](#project-setup)
3. [Engine Settings](#engine-settings)
4. [Size Limits and Restrictions](#size-limits-and-restrictions)
5. [Events Reference](#events-reference)
6. [FAQ](#faq)
7. [Memory Footprint](#memory-footprint)
8. [License](#license)
9. [Bank 0 (HOME) Usage](#bank-0-home-usage)
10. [Changelog](#changelog)

---

## Concepts

### Transition types

Only one of each pair is listed. The opposite side, closing instead of opening, shrinking instead of growing and counter-clockwise are all the same effect with **Direction** set to **Reversed**.

| Effect | Description |
|---|---|
| **Wipe right** | Horizontal wipe (reversed = leftward). |
| **Wipe down** | Vertical wipe (reversed = upward). |
| **Open horizontal / vertical** | Curtain opening from the centre (reversed = curtain close). |
| **Iris out** | Box iris opening from the centre (reversed = close). |
| **Diagonal (vertical range)** | A straight line from top to bottom, swept sideways. **Initial angle** tilts it: 0 leans one way, 128 is vertical, 255 leans the other. |
| **Diagonal (horizontal range)** | The same turned on its side, a line from left to right swept downward, with the same angle control. Between the two you can aim a diagonal any way you like. |
| **Checker** | Two-pass checkerboard dissolve. |
| **Snake horizontal / vertical** | A back and forth sweep, one tile per step. Raise **Steps per frame** to 6 or 12, since it visits every tile. |
| **Spiral** | Serpentine spiral, one tile per step, clockwise from the top-left corner winding inward. |
| **Blinds horizontal / vertical** | Venetian blinds, with several bars closing at once. |
| **Four square** | A chunky wipe in blocks of 2 by 2 tiles. |
| **Diamond out** | Diamond iris opening from the centre (reversed = close). |
| **Clock** | Radial sweep from the centre, clockwise from 12 o'clock (reversed = counter-clockwise). |
| **Fan** | Four-blade fan / pinwheel (reversed = counter-clockwise). |
| **X** | An X (both diagonals) that thickens outward. |
| **Noise** | Random dissolve, seeded differently each run. |
| **Mask grow** | The order comes from a screen-sized **mask scene** you draw. See below. |
| **Shrink** | The screen is cut into four quarters that slide towards the centre, with the fill growing around the outside. See below. |
| **Split** | The same four quarters slide away from the centre, with the fill growing along the cross between them. See below. |

### Mask transitions

**Mask grow** reveals each tile in the order given by a scene you draw. It works through the mask scene's tiles one at a time, lowest first, so the number of steps is the mask's tile count. Reversed, it starts from the highest.

Draw a shape in a scene, using a different tile for each step, and that becomes the transition. It works with a fill, a reveal of the current scene or a copy of another scene. Just pick the **Mask scene**.

### Quadrant transitions: Shrink and Split

**Shrink** and **Split** move what is already on screen rather than painting over it. Each step redraws all four quarters a tile nearer the centre, for Shrink, or a tile further from it, for Split, and covers the strip each quarter has left behind with the fill tile.

|  | Content moves | Fill grows at |
|---|---|---|
| **Shrink** | inward, towards the centre | around the outside |
| **Split** | outward, away from the centre | along the cross between the quarters |

Reversed, they become reveals. **Shrink reversed** opens the scene out from the centre and **Split reversed** closes it in from the edges. Because they redraw moving content they work in every mode: a fill, a reveal of the current scene, or a copy from another scene. The **In** event grows a **Rim tile** field for them, since it otherwise fills nothing.

Two things to keep in mind:

- **The centre point is where the screen is cut into quarters**, not a pivot it turns around. Left on automatic it lands in the middle, column 10 and row 9 on a full screen. Move it and the quarters become uneven, which is how you aim the effect at a doorway or at the player.
- **They cost far more per step than any other effect**, because a step redraws every tile still showing content rather than one row or ring. Start at 4 or 6 in **Frames per step** and lower it only if your scene keeps up.

### Layers

- **Background** is used by the fill, the reveal of the current scene, and the background option when revealing another scene. It follows the scroll on its own.
- **Overlay** is used by the overlay fill and the overlay option when revealing another scene. The overlay sits above the background, does not scroll, and survives a change of scene, which is what makes a seamless scene change possible. An overlay transition leaves it covering the screen, so dismiss it with the stock **Hide Overlay** event.

### Direction, angle and centre

- **Direction** is **Normal** or **Reversed**. Reversed plays the steps back to front, so a wipe comes from the other side, an iris closes instead of opening, and a clock, fan or spiral turns the other way. It works on every effect.
- **Initial angle**, 0 to 255, sets where a **clock** or **fan** sweep starts, with 0 at twelve o'clock, or tilts a **diagonal**'s line.
- **Custom centre point** moves the middle of an **iris**, **diamond**, **clock**, **fan** or **mask**, and the split point of **shrink** and **split**. Tick it and set **Centre X** and **Centre Y** in tiles from the corner of the region. Left unticked, the middle of the region is used. A value outside the region snaps to its nearest edge.
  - **Centre is absolute (world) position**, with a custom centre on the background, takes **Centre X** and **Centre Y** as map tiles rather than screen tiles, subtracting the current scroll. That is how you centre an effect on a fixed point of a scrolling map. It is offered only for background transitions, since the overlay does not scroll.

### Timing and framing

**Steps per frame** advances more of the effect each frame, making it faster. **Frames per step** waits extra frames in between, making it slower.

**Start frame** and **End frame** play only part of the effect. Start frame skips the earlier steps, so the screen begins partly transitioned, and End frame stops early. Both are limited to the effect's own length, and **0** means run to the end. How many steps an effect has depends on the type: a wipe is one per column, a snake or spiral one per tile. The same slice is drawn whichever **Direction** is set, so both directions cover exactly the same tiles.

---

## Project Setup

Copy `src/ScreenTransitionsPlugin` into your project's `plugins` folder, then restart GB Studio. Compatibility variants ship with it and are selected automatically.

Add **Screen Transition Out** and **Screen Transition In** to your scripts wherever you would use a fade.

### Revealing across a scene change: copy another scene

**Screen Transition In** with **Reveal** set to **Another scene** brings a second scene's tiles in with the chosen pattern. Pick the **Layer**:

- **Background** turns the current background into the other scene's tiles, where it stands. Follow it with **Change Scene** to that scene, with the fade set to None.
- **Overlay** fills the overlay with the current scene, shows it covering the screen, brings the target scene in, and leaves the overlay in place. Because the overlay survives a change of scene, it keeps covering the background while the new scene loads underneath, so there is no flash.

Either way the two scenes must share a background tileset, and **Source X** and **Source Y** choose where in the other scene to take tiles from. Set them to the scroll position the target scene will be entered at, so the two line up.

Seamless A → B workflow using the **overlay** option:

1. On scene **A**: **Screen Transition In**, Reveal = **Another scene**, Layer = **Overlay**, Source scene = **B**, Source X/Y = B's entry scroll.
2. **Change Scene** to B with **Fade = None**, positioned at that same scroll. B loads behind the still-covering overlay.
3. On scene **B**, dismiss the overlay with the stock **Hide Overlay** event, and **Show Sprites** if you hid them. The overlay and the freshly-loaded background are identical, so the reveal is seamless.

Sprites draw above both the background and the overlay, so the transition can hide them. On the overlay route they stay hidden across the change until you show them again.

### Revealing across a scene change: cover + fade-in

This works for any pair of scenes, with no shared tileset. On scene A run **Screen Transition Out**, then **Fade Out**, then **Change Scene** to B with the fade set to None. On scene B set the **On Init** fade to **Manual** and make the first event **Screen Transition In** with **Cover + fade in first** ticked. It fills the screen, brings the palette back instantly, then reveals B.

---

## Engine Settings

Found under **Settings → Engine → Screen Transitions**.

Each transition has its own tickbox, all on by default. Turning one off leaves its code out of the ROM, so you only pay for what you use. A script that still uses a transition you turned off stops the build with a message naming the effect. Turn it back on, or pick another effect.

---

## Size Limits and Restrictions

- **Only one transition runs at a time.** Do not start two from different scripts at once.
- **Copying another scene needs both scenes to share a background tileset.**
- **Draw a mask scene larger than the screen** when using a custom centre, so it still covers everything at the chosen offset. The size is not checked.
- Fill tiles **202**, black, and **201**, white, are interface tiles GB Studio loads in every scene, so they are always available.
- Compatibility variants ship for the **Screen Scroll**, **Continuous Scene** and **Metatile** plugins, and for Metatile combined with either of the other two, and are selected automatically.
- With the **Metatile** plugin, copy and mask sources should be ordinary scenes rather than metatile scenes. Filling and revealing the current metatile scene both work.
- **Shrink and Split share code**, so turning only one off frees just that effect's own share. The shared part comes out when both are off.
- Combinations of three other plugins are not shipped as variants.

---

## Events Reference

Both events appear under the **Screen** group in the script editor.

Every number field accepts a variable or an expression as well as a fixed value: the region, the steps and frames, the source position, the fill tile and the palette.

---

### Screen Transition Out (to fill)

Dissolves the current screen into a solid fill using the chosen pattern.

| Field | Description |
|-------|-------------|
| Transition | Which effect to play. |
| Layer | Background or overlay. |
| Fill | The tile to fill with: black, which is 202, white, which is 201, or a tile of your own. For Shrink and Split it is the tile the sliding quarters uncover. |
| Steps per frame | How much of the effect advances each frame. Higher is faster. |
| Frames per step | Extra frames waited in between. Higher is slower. |
| Hide sprites | Hide sprites for the duration of the transition. |
| CGB fill palette | Palette applied to the fill tiles on Game Boy Color. |
| Region | The X/Y/W/H tile rectangle the effect covers. |
| Direction | Normal, or Reversed / Counter-clockwise. |
| Initial angle | Where a clock or fan starts, or the tilt of a diagonal, from 0 to 255. |
| Custom centre point, Centre X, Centre Y | Move the middle away from the centre of the region. |
| Centre is absolute (world) position | Treat Centre X and Y as map tiles on the background. |
| Start frame / End frame | Play only part of the effect. 0 runs to the end. |

---

### Screen Transition In (reveal scene)

Rebuilds a scene from a filled screen using the chosen pattern.

| Field | Description |
|-------|-------------|
| Transition | Which effect to play. |
| Reveal | This scene, or another scene. |
| Layer | Overlay or background (another-scene reveals only). |
| Source scene | The scene to copy tiles from (another-scene reveals only). |
| Source X / Source Y | Where in the other scene to take tiles from, normally the scroll position that scene will be entered at. |
| Steps per frame | How much of the effect advances each frame. Higher is faster. |
| Frames per step | Extra frames waited in between. Higher is slower. |
| Cover + fade in first | Fill the screen and bring the palette back before revealing. Only when revealing the current scene, and it adds a fill tile field. |
| Hide sprites / Show sprites | Control sprite visibility across the transition. |
| Region | The X/Y/W/H tile rectangle the effect covers. |
| Direction | Normal, or Reversed / Counter-clockwise. |
| Initial angle | Where a clock or fan starts, or the tilt of a diagonal, from 0 to 255. |
| Custom centre point, Centre X, Centre Y | Move the middle away from the centre of the region. |
| Centre is absolute (world) position | Treat Centre X and Y as map tiles on the background. |
| Start frame / End frame | Play only part of the effect. 0 runs to the end. |
| Rim tile, CGB rim palette, Rim tile id | The tile drawn where a quarter has slid away. Shrink and Split only, since the other reveals fill nothing. |
| Mask scene | The scene whose tiles set the order of a mask transition. |

---

## FAQ

**How do I get a Pokémon style battle transition?**
Use **Screen Transition Out** with **Shrink** or **Split**, which slide the screen apart in four
quarters. Set **Frames per step** to about 4 to start with, since those two cost more per step
than the rest.

**How do I change scene with no flash of the wrong picture?**
Use **Screen Transition In** with **Reveal** set to **Another scene** and **Layer** set to
**Overlay**, pointing at the destination scene. Then **Change Scene** with the fade set to None,
and dismiss the overlay in the new scene with **Hide Overlay**.

**How do I make a transition in a shape of my own?**
Draw the shape in a scene, using a different tile for each step, then use the **Mask grow**
transition with that scene as the **Mask scene**. Lowest tiles are revealed first.

**Can I centre the iris on the player rather than the screen?**
Yes. Tick **Custom centre point** and set **Centre X** and **Centre Y** from the player's position.
On a scrolling background, tick **Centre is absolute (world) position** to give map tiles instead.

**Does the game keep running during a transition?**
Only the script that started it waits. Music, actors and other scripts carry on.

**My transition is too fast or too slow.**
Raise **Steps per frame** to speed it up, or **Frames per step** to slow it down. The snake and
spiral effects need a higher steps per frame, around 6 to 12, because they visit every tile.

**My build failed naming a transition.**
That transition's engine setting is turned off, so its code is not in the ROM. Turn it back on
under **Settings**, then **Engine**, then **Screen Transitions**, or pick a different effect.

**How do I keep the ROM cost down?**
Turn off the transitions you do not use. All seventeen together are 2,572 bytes, and each one's
share is listed under [What each engine setting costs](#what-each-engine-setting-costs).

**Do I need a separate event for a wipe from the left and a wipe from the right?**
No. Set **Direction** to **Reversed** and the same effect runs the other way, including irises
closing instead of opening and clocks turning the other way.

**My transition drifts out of line on a scrolling scene.**
It should not. Background transitions follow the scroll every frame. If you set a custom centre in
map tiles, tick **Centre is absolute (world) position** so the scroll is accounted for.

**Can I start a transition halfway through?**
Yes. **Start frame** skips the earlier steps and **End frame** stops it early, so you can hold the
screen part way covered.

**Does it work with the ScreenScroll, ContinuousScene or MetaTile plugins?**
Yes, and with MetaTile combined with either of the other two. Copy and mask source scenes should
be ordinary scenes rather than metatile ones.

---

<!-- SETTINGCOST:BEGIN -->
### What each engine setting costs

Each setting changes what gets compiled. Figures are what you **get back by turning
the setting off**. Rows marked *off by default* show what turning it **on** costs, and
sliders show the cost per step. "none" means that budget does not move.

| Setting | Bank 0 | WRAM | Banked ROM |
|---|---|---|---|
| Wipe | none | none | **60 B** |
| Curtain | none | none | **268 B** |
| Iris | none | none | **397 B** |
| Diagonal | none | none | **132 B** |
| Checkerboard | none | none | **88 B** |
| Snake | none | none | **110 B** |
| Spiral | none | none | **324 B** |
| Blinds | none | none | **136 B** |
| 4-Square | none | none | **120 B** |
| Diamond | none | none | **118 B** |
| Clock | none | none | **46 B** |
| Random Noise | none | none | **148 B** |
| 4-Blade Fan | none | none | **154 B** |
| X (cross) | none | none | **94 B** |
| Mask (scene as mask) | none | none | **234 B** |
| Shrink (quadrants inward) | none | none | **64 B** |
| Split (quadrants outward) | none | none | **79 B** |

Turning off every on-by-default switch above frees **2,572 B** of banked ROM. That is the
span between the plugin at its fullest and stripped to nothing, so treat it as a
ceiling. You keep whatever your game actually uses.

<details><summary>How these were measured</summary>

GB Studio 4.3.0-e1. This plugin's engine code was compiled with the toolchain and
flags GB Studio itself uses, and the size of each part of the result was read back and
sorted into the three budgets: the fixed bank 0, work RAM, and switchable ROM banks.

Two caveats. Only this plugin's own engine sources are measured, so a setting that also
changes a shared data structure can move a few more bytes elsewhere. And each setting is
toggled on its own, so a few measure slightly *negative* when enabling their code lets
the compiler drop a fallback path, and a setting that gates other settings shows only
its own contribution.

</details>
<!-- SETTINGCOST:END -->

## Memory Footprint

Measured against the stock GB Studio **4.3.0-e1** engine at default engine settings, report of 2026-08-20. Figures are the difference against a stock project: a file that replaces a stock engine file counts only the change, which is why a plugin can come out negative. Each event you use also compiles a few bytes of script into your project, on top of the fixed cost below.

| Budget | Cost |
|---|---|
| Bank 0 (HOME) | 0 bytes |
| WRAM | +51 bytes |
| Banked ROM | +4,831 bytes |

- **Bank 0:** nothing. Everything the plugin adds is compiled into a switchable ROM bank.
- **WRAM:** 51 bytes, one block of state shared by every effect, which is why only one transition runs at a time. It does not grow with the number of transitions you enable.
- **Banked ROM:** 4,831 bytes with all seventeen transitions built in. Each one you turn off removes its own code, between 46 and 397 bytes, and 2,572 bytes for all of them. See [What each engine setting costs](#what-each-engine-setting-costs).
- **Engine WRAM headroom:** a stock GB Studio 4.3.0 project leaves about **854 bytes** of WRAM free (the engine has 7,776 bytes to work with and uses 6,922 of them). With this plugin installed roughly **803 bytes** remain. Adding more global variables to your project does not change that figure, because script memory is a fixed 3,584 byte block at stock engine settings.
- **SRAM:** not used.

---

## License

MIT

---

<!-- BANK0:BEGIN -->
## Bank 0 (HOME) Usage

Bank 0 is the 16 KB fixed ROM bank shared by the GB Studio engine core, the
interrupt handlers and the GBDK runtime. Extra banked ROM is cheap to add,
bank 0 is not, so bank 0 is usually the first thing a project runs out of.

| | Bytes |
|---|---|
| Bank 0 used by this plugin | **0** |

**This plugin costs nothing in bank 0.** Everything it adds is compiled into a
switchable ROM bank.
<!-- BANK0:END -->

## Changelog

Grouped by the date each change was merged into the official
[gb-studio-plugins](https://github.com/gb-studio-dev/gb-studio-plugins) repository.

Only bug fixes, new features and feature changes are listed. Engine version
bumps, patch regeneration, packaging fixes and documentation edits are omitted.

### 2026-08-20

- Added the **Shrink** and **Split** quadrant-shift transitions, each with its own engine setting.
- The *Screen Transition In* event gained a **Rim tile** field, used by those two transitions.
- Shrink and Split work on the overlay as well as the background, so they can still leave it covering the screen for a seamless change of scene.

### 2026-07-26

- Initial release.
- Transitions take a Direction, an angle and a centre point, and the mask transitions accept a custom centre too.
- Per-transition-type enable/disable engine settings, so unused transitions cost no ROM.
- Start step and end step parameters for compositing.
- Support for the ContinuousScene, ScreenScroll and Metatile plugins.
- Fixed copying a metatile scene to the overlay.
