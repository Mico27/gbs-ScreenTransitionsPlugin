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

// One canonical effect per reverse-pair; use Direction = Reversed for the
// complement (e.g. Wipe reversed = left/up, Curtain reversed = close, Iris
// reversed = close, Diagonal reversed = from bottom-right, Mask reversed = shrink).
const EFFECTS = [
  ["wipe_right", "Wipe (horizontal)"],
  ["wipe_down", "Wipe (vertical)"],
  ["open_h", "Curtain (horizontal)"],
  ["open_v", "Curtain (vertical)"],
  ["iris_out", "Iris (box)"],
  ["diag_tl", "Diagonal (vertical)"],
  ["diag_h", "Diagonal (horizontal)"],
  ["checker", "Checkerboard"],
  ["snake_h", "Snake (horizontal)"],
  ["snake_v", "Snake (vertical)"],
  ["spiral", "Spiral (snake)"],
  ["blinds_h", "Blinds (horizontal bars)"],
  ["blinds_v", "Blinds (vertical bars)"],
  ["four_sq", "4-Square (chunky blocks)"],
  ["diamond_out", "Diamond"],
  ["clock", "Clock (radial sweep)"],
  ["noise", "Random Noise"],
  ["fan4", "4-Blade Fan"],
  ["x", "X (cross)"],
  ["mask_grow", "Mask (scene as mask)"],
];
// Ids are stable (gaps left where reverse-pair complements were removed).
const EFFECT_ID = {
  wipe_right: 0, wipe_down: 2,
  open_h: 5, open_v: 7,
  iris_out: 9, diag_tl: 10, diag_h: 11, checker: 12,
  snake_h: 13, snake_v: 14, spiral: 26,
  blinds_h: 15, blinds_v: 16, four_sq: 17,
  diamond_out: 19,
  clock: 20, noise: 21, fan4: 22, x: 23, mask_grow: 24,
};

const num = (value) => ({ type: "number", value });

// Effects that support an angular start offset / a custom centre point.
const ANGLE_FX = ["clock", "fan4", "diag_tl", "diag_h"];
const CENTER_FX = ["iris_out", "diamond_out", "clock", "fan4"];

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
    key: "direction",
    label: "Direction",
    description:
      "Plays the effect in reverse — flips a wipe to the opposite side, an iris close to open, and a clock/fan/spiral to counter-clockwise.",
    type: "select",
    options: [
      ["forward", "Normal / Clockwise"],
      ["reverse", "Reversed / Counter-clockwise"],
    ],
    defaultValue: "forward",
  },
  {
    key: "angle",
    label: "Initial angle (0-255)",
    description:
      "Rotates the sweep direction. Clock/fan: 0 = 12 o'clock. Diagonal: 0 = down-right, 128 = vertical, 255 = down-left.",
    type: "value",
    min: 0,
    max: 255,
    defaultValue: num(0),
    conditions: [{ key: "effect", in: ANGLE_FX }],
  },
  {
    key: "customCenter",
    label: "Custom centre point",
    description: "Move the pivot/centre of the effect off the region centre.",
    type: "checkbox",
    defaultValue: false,
    conditions: [{ key: "effect", in: CENTER_FX }],
  },
  {
    type: "group",
    fields: [
      { key: "centerX", label: "Centre X", type: "value", width: "50%", min: 0, max: 31, defaultValue: num(10) },
      { key: "centerY", label: "Centre Y", type: "value", width: "50%", min: 0, max: 31, defaultValue: num(9) },
    ],
    conditions: [
      { key: "customCenter", eq: true },
      { key: "effect", in: CENTER_FX },
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
    conditions: [{ key: "effect", in: ["mask_grow"] }],
  },
  {
    key: "maskSceneId",
    label: "Mask scene (screen-sized)",
    type: "scene",
    defaultValue: "LAST_SCENE",
    conditions: [{ key: "effect", in: ["mask_grow"] }],
  },
];

export const compile = (input, helpers) => {
  const {
    options,
    _stackPushConst, _setConstMemInt16, engineFieldSetToScriptValue, _stackPop,
    _invoke, _callNative, _spritesHide, _spritesShow, _setConstMemInt8, _fadeIn,
    _addComment,
  } = helpers;

  const V = (v, d) =>
    v === undefined || v === null ? num(d) : typeof v === "number" ? num(v) : v;

  const effect = EFFECT_ID[input.effect] ?? 0;
  const isScene = input.source === "scene";
  const layer = isScene ? (input.layer === "background" ? 0 : 1) : 0;
  const mode = isScene ? 2 : 1; // 2 copy, 1 refresh

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
  const isMask = input.effect === "mask_grow";
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

  // Set the transition state globals directly (control words as consts, value
  // fields via engineFieldSetToScriptValue so they accept variables/expressions).
  _setConstMemInt8("tr_effect", effect);
  _setConstMemInt8("tr_layer", layer);
  _setConstMemInt8("tr_mode", mode);
  engineFieldSetToScriptValue("tr_x0", V(input.x, 0));
  engineFieldSetToScriptValue("tr_y0", V(input.y, 0));
  engineFieldSetToScriptValue("tr_w", V(input.width, 20));
  engineFieldSetToScriptValue("tr_h", V(input.height, 18));
  engineFieldSetToScriptValue("tr_speed", V(input.speed, 1));
  engineFieldSetToScriptValue("tr_hold", V(input.hold, 1));
  // direction (reverse step order), angle offset, and centre point
  _setConstMemInt8("tr_reverse", input.direction === "reverse" ? 1 : 0);
  if (ANGLE_FX.includes(input.effect)) {
    engineFieldSetToScriptValue("tr_angle", V(input.angle, 0));
  }
  if (CENTER_FX.includes(input.effect) && input.customCenter) {
    engineFieldSetToScriptValue("tr_cx", V(input.centerX, 10));
    engineFieldSetToScriptValue("tr_cy", V(input.centerY, 9));
  } else {
    _setConstMemInt8("tr_cx", 0xff); // auto centre
    _setConstMemInt8("tr_cy", 0xff);
  }
  if (isScene) {
    engineFieldSetToScriptValue("tr_src_x", V(input.srcX, 0));
    engineFieldSetToScriptValue("tr_src_y", V(input.srcY, 0));
    _setConstMemInt16("tr_scene_ptr", sceneSym);
    _setConstMemInt8("tr_scene_bank", sceneBank);
  }
  if (isMask) {
    _setConstMemInt16("tr_maskscene_ptr", maskSym);
    _setConstMemInt8("tr_maskscene_bank", maskBank);
  }
  _invoke("screen_transition_update", 0, 0);

  if (coverFirst) {
    _setConstMemInt8("fade_frames_per_step", 3); // restore a sane fade speed
  }
  if (!isScene && input.showSprites !== false) _spritesShow();
};

// Run after the scene's initial fade-in (named export so the ESM->CJS loader keeps it).
export const waitUntilAfterInitFade = true;
