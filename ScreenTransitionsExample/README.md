# Screen Transitions — Example Project

A GB Studio 4.3 project that showcases the **Screen Transitions Plugin**. Open
`ScreenTransitionsExample.gbsproj`, or run the prebuilt ROM at
`build/rom/game.gb`. The plugin is bundled under
`plugins/Mico27/ScreenTransitionsPlugin`.

## What it shows

Because transitions now run as waitable VM functions (not baked script), the
whole showcase fits in **one scene**:

- **Scene A** auto-plays through all 13 transitions (Out → In on the
  background), each labelled. Then it moves the camera and runs a
  **scroll-tracked** transition (background transitions follow the live scroll
  automatically). Finally it does a **seamless cross-scene** move: viewing A at
  scroll 40, it morphs **Scene B**'s columns 0–19 onto the **overlay** (Source
  X = 0), keeps the overlay covering, then Change Scene to B (fade = None).
- **Scene B** dismisses the overlay (**Hide Overlay**) to reveal its identical
  background — a seamless arrival — then loops back to Scene A.

## Notable

- All 13 transitions in a single Init script — impossible with the old
  compile-time-baked approach (it overflowed a 16 KB bank); trivial now.
- The cross-scene demo exercises the **Source X/Y offset**: Scene A and Scene B
  share a background, and the reveal pulls Scene B's column-40 slice so the
  following scene change lines up.

## Building from the CLI

```bash
cd /path/to/gb-studio
$(yarn bin gb-studio-cli) make:rom "/path/to/ScreenTransitionsExample/ScreenTransitionsExample.gbsproj" out/game.gb
```

Derived from Mico27's Submapping Ex example project (backgrounds, fonts,
palettes). Verified to compile with the GB Studio 4.3 CLI.
