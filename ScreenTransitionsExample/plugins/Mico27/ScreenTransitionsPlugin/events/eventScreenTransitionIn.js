export const id = "PT_EVENT_SCREEN_TRANSITION_IN";
export const name = "Screen Transition In (reveal scene)";
export const groups = ["EVENT_GROUP_SCREEN", "Screen Transitions"];

export const autoLabel = (fetchArg, input) => {
  if (input.source === "scene") {
    const layer = input.layer === "background" ? "bkg" : "overlay";
    return `Screen Transition In: ${input.effect || "wipe_right"} (${layer} from ${fetchArg("sceneId")})`;
  }
  return `Screen Transition In: ${input.effect || "wipe_right"} (this scene)`;
};

const EFFECTS = [
  ["wipe_right", "Wipe → Right"],
  ["wipe_left", "Wipe ← Left"],
  ["wipe_down", "Wipe ↓ Down"],
  ["wipe_up", "Wipe ↑ Up"],
  ["split_h", "Curtain Close (horizontal)"],
  ["open_h", "Curtain Open (horizontal)"],
  ["split_v", "Curtain Close (vertical)"],
  ["open_v", "Curtain Open (vertical)"],
  ["iris_in", "Iris Close (box in)"],
  ["iris_out", "Iris Open (box out)"],
  ["diag_tl", "Diagonal ↘"],
  ["diag_br", "Diagonal ↖"],
  ["checker", "Checkerboard"],
  ["snake_h", "Snake (horizontal)"],
  ["snake_v", "Snake (vertical)"],
  ["spiral", "Spiral (snake, inward)"],
  ["blinds_h", "Blinds (horizontal bars)"],
  ["blinds_v", "Blinds (vertical bars)"],
  ["four_sq", "4-Square (chunky blocks)"],
  ["diamond_in", "Diamond Close"],
  ["diamond_out", "Diamond Open"],
  ["clock", "Clock (radial sweep)"],
  ["noise", "Random Noise"],
  ["fan4", "4-Blade Fan"],
  ["x", "X (cross)"],
  ["mask_grow", "Mask Grow (scene as mask)"],
  ["mask_shrink", "Mask Shrink (scene as mask)"],
];
const EFFECT_ID = {
  wipe_right: 0, wipe_left: 1, wipe_down: 2, wipe_up: 3,
  split_h: 4, open_h: 5, split_v: 6, open_v: 7,
  iris_in: 8, iris_out: 9, diag_tl: 10, diag_br: 11, checker: 12,
  snake_h: 13, snake_v: 14, blinds_h: 15, blinds_v: 16, four_sq: 17,
  diamond_in: 18, diamond_out: 19,
  clock: 20, noise: 21, fan4: 22, x: 23, mask_grow: 24, mask_shrink: 25,
  spiral: 26,
};

const num = (value) => ({ type: "number", value });

export const fields = [
  {
    key: "effect",
    label: "Transition",
    type: "select",
    options: EFFECTS,
    defaultValue: "wipe_right",
  },
  {
    type: "group",
    fields: [
      {
        key: "source",
        label: "Reveal",
        type: "select",
        width: "50%",
        options: [
          ["current", "This scene (reload)"],
          ["scene", "Another scene (copy)"],
        ],
        defaultValue: "current",
      },
      {
        key: "layer",
        label: "Layer",
        type: "select",
        width: "50%",
        options: [
          ["overlay", "Overlay (window)"],
          ["background", "Background"],
        ],
        defaultValue: "overlay",
        conditions: [{ key: "source", eq: "scene" }],
      },
    ],
  },
  {
    type: "label",
    label:
      "Overlay: draws the source scene onto the window and leaves it open, so a following Change Scene (fade None) is seamless — dismiss it with \"Hide Overlay\" on the target scene.",
    conditions: [
      { key: "source", eq: "scene" },
      { key: "layer", eq: "overlay" },
    ],
  },
  {
    type: "label",
    label:
      "Background: morphs the current background into the source scene's tiles in place. Follow with Change Scene (fade None) to that scene.",
    conditions: [
      { key: "source", eq: "scene" },
      { key: "layer", eq: "background" },
    ],
  },
  {
    type: "label",
    label: "The two scenes must share a background tileset.",
    conditions: [{ key: "source", eq: "scene" }],
  },
  {
    key: "sceneId",
    label: "Source scene",
    type: "scene",
    defaultValue: "LAST_SCENE",
    conditions: [{ key: "source", eq: "scene" }],
  },
  {
    type: "group",
    fields: [
      {
        key: "srcX",
        label: "Source X (tiles)",
        description:
          "Tile offset in the source scene to pull from — set to the scroll position the target scene will be entered at, so the switch lines up.",
        type: "value",
        width: "50%",
        min: 0,
        max: 255,
        defaultValue: num(0),
      },
      {
        key: "srcY",
        label: "Source Y (tiles)",
        type: "value",
        width: "50%",
        min: 0,
        max: 255,
        defaultValue: num(0),
      },
    ],
    conditions: [{ key: "source", eq: "scene" }],
  },
  {
    type: "group",
    fields: [
      {
        key: "speed",
        label: "Steps per frame",
        type: "value",
        width: "50%",
        min: 1,
        max: 32,
        defaultValue: num(1),
      },
      {
        key: "hold",
        label: "Frames per step",
        type: "value",
        width: "50%",
        min: 1,
        max: 60,
        defaultValue: num(1),
      },
    ],
  },
  {
    key: "coverFirst",
    label: "Cover + fade in first (scene entry)",
    description:
      "Fills the screen, then does an instant palette fade-in, before revealing. Use as the first event of a scene entered with Change Scene fade = None and On Init auto-fade = Manual.",
    type: "checkbox",
    defaultValue: false,
    conditions: [{ key: "source", eq: "current" }],
  },
  {
    key: "coverTile",
    label: "Cover tile id",
    type: "select",
    options: [
      [202, "Black"],
      [201, "White"],
    ],
    defaultValue: 202,
    conditions: [
      { key: "source", eq: "current" },
      { key: "coverFirst", eq: true },
    ],
  },
  {
    key: "hideSprites",
    label: "Hide sprites during transition",
    description:
      "Sprites draw above the background and overlay, so hide them while the transition covers the screen.",
    type: "checkbox",
    defaultValue: true,
  },
  {
    key: "showSprites",
    label: "Show sprites after transition",
    type: "checkbox",
    defaultValue: true,
    conditions: [{ key: "source", eq: "current" }],
  },
  {
    type: "label",
    label: "Region (tiles, screen-relative)",
    isHeading: true,
  },
  {
    type: "group",
    fields: [
      { key: "x", label: "X", type: "value", width: "50%", min: 0, max: 31, defaultValue: num(0) },
      { key: "y", label: "Y", type: "value", width: "50%", min: 0, max: 31, defaultValue: num(0) },
    ],
  },
  {
    type: "group",
    fields: [
      { key: "width", label: "Width", type: "value", width: "50%", min: 1, max: 32, defaultValue: num(20) },
      { key: "height", label: "Height", type: "value", width: "50%", min: 1, max: 32, defaultValue: num(18) },
    ],
  },
  {
    type: "label",
    label:
      "Mask Grow/Shrink: the mask scene's tile values (0-255) set the reveal order — lower tiles first (Grow), so a drawn gradient becomes the transition shape. This is separate from the reveal content above.",
    conditions: [{ key: "effect", in: ["mask_grow", "mask_shrink"] }],
  },
  {
    key: "maskSceneId",
    label: "Mask scene (screen-sized)",
    type: "scene",
    defaultValue: "LAST_SCENE",
    conditions: [{ key: "effect", in: ["mask_grow", "mask_shrink"] }],
  },
];

export const compile = (input, helpers) => {
  const {
    options,
    _stackPushConst, _stackPushScriptValue, _stackPop, _invoke,
    _callNative, _spritesHide, _spritesShow, _setConstMemInt8, _fadeIn, _addComment,
  } = helpers;

  const V = (v, d) =>
    v === undefined || v === null ? num(d) : typeof v === "number" ? num(v) : v;

  // Bit-pack two byte-sized script values into one word via RPN:
  // (hi & 0xff) << 8 | (lo & 0xff). _stackPushScriptValue compiles the tree to
  // RPN (or folds to a constant when both are constant).
  const bAND = (a, b) => ({ type: "bAND", valueA: a, valueB: b });
  const bOR = (a, b) => ({ type: "bOR", valueA: a, valueB: b });
  const shl = (a, b) => ({ type: "shl", valueA: a, valueB: b });
  const byte = (v) => bAND(v, num(0xff));
  const pack = (hi, lo) => bOR(shl(byte(hi), num(8)), byte(lo));

  const effect = EFFECT_ID[input.effect] ?? 0;
  const isScene = input.source === "scene";
  const layer = isScene ? (input.layer === "background" ? 0 : 1) : 0;
  const mode = isScene ? 2 : 1; // 2 copy, 1 refresh
  const p0 = (effect & 0x1f) | (layer << 5) | (mode << 6);

  // Resolve scene symbol for copy mode.
  let sceneSym = 0;
  let sceneBank = 0;
  if (mode === 2) {
    const scenes = (options && options.scenes) || [];
    const scene = scenes.find((s) => s.id === input.sceneId);
    if (!scene) {
      throw new Error(
        "Screen Transition In: select a valid Source scene to copy tiles from.",
      );
    }
    sceneSym = `_${scene.symbol}`;
    sceneBank = `___bank_${scene.symbol}`;
  }

  // Mask grow/shrink: resolve the mask scene (separate from the copy source).
  const isMask = input.effect === "mask_grow" || input.effect === "mask_shrink";
  let maskSym = 0;
  let maskBank = 0;
  if (isMask) {
    const scenes = (options && options.scenes) || [];
    const scene = scenes.find((s) => s.id === input.maskSceneId);
    if (!scene) {
      throw new Error(
        "Screen Transition In: Mask Grow/Shrink needs a valid Mask scene.",
      );
    }
    maskSym = `_${scene.symbol}`;
    maskBank = `___bank_${scene.symbol}`;
  }

  const coverFirst = !isScene && !!input.coverFirst;
  const coverTile = input.coverTile === 201 ? 201 : 202;

  _addComment(
    `Screen Transition In: ${input.effect} (${
      isScene
        ? (layer ? "overlay" : "background") + " from scene " + input.sceneId
        : "this scene"
    })`,
  );

  if (input.hideSprites !== false) _spritesHide();

  // Cover the screen and instantly restore the palette before revealing, so
  // the transition survives a scene change (screen was faded out).
  if (coverFirst) {
    _stackPushConst(0x80 | 7); // cover attr (CGB priority + palette 7)
    _stackPushConst(coverTile);
    _callNative("vm_screen_cover");
    _stackPop(2);
    _setConstMemInt8("fade_frames_per_step", 0);
    _fadeIn(true);
  }

  // Bit-packed frame (10 slots): value pairs packed via RPN, then invoke.
  _stackPushConst(p0);                                          // 0 p0
  _stackPushScriptValue(pack(V(input.x, 0), V(input.y, 0)));    // 1 x|y
  _stackPushScriptValue(pack(V(input.width, 20), V(input.height, 18))); // 2 w|h
  _stackPushScriptValue(pack(V(input.speed, 1), V(input.hold, 1)));     // 3 speed|hold
  _stackPushConst(0);                                          // 4 fill|palette (unused for reveal)
  if (isScene) {
    _stackPushScriptValue(pack(V(input.srcX, 0), V(input.srcY, 0)));    // 5 src_x|src_y
  } else {
    _stackPushConst(0);                                        // 5 (unused)
  }
  _stackPushConst(sceneBank);                                  // 6 scene_bank
  _stackPushConst(sceneSym);                                   // 7 scene_ptr
  _stackPushConst(maskBank);                                   // 8 mask_bank
  _stackPushConst(maskSym);                                    // 9 mask_ptr
  _invoke("screen_transition_update", 10, -10);

  if (coverFirst) {
    _setConstMemInt8("fade_frames_per_step", 3); // restore a sane fade speed
  }
  if (!isScene && input.showSprites !== false) _spritesShow();
};

// Run after the scene's initial fade-in (named export so the ESM->CJS loader keeps it).
export const waitUntilAfterInitFade = true;
