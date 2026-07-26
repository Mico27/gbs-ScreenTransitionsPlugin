export const id = "PT_EVENT_SCREEN_TRANSITION_OUT";
export const name = "Screen Transition Out (to fill)";
export const groups = ["EVENT_GROUP_SCREEN", "Screen Transitions"];

export const autoLabel = (fetchArg, input) => {
  const layer = input.layer === "overlay" ? "overlay" : "bkg";
  return `Screen Transition Out: ${input.effect || "wipe_right"} (${layer})`;
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
        key: "layer",
        label: "Layer",
        type: "select",
        width: "50%",
        options: [
          ["background", "Background"],
          ["overlay", "Overlay (window)"],
        ],
        defaultValue: "background",
      },
      {
        key: "fill",
        label: "Fill",
        type: "select",
        width: "50%",
        options: [
          ["black", "Black"],
          ["white", "White"],
          ["custom", "Custom tile id"],
        ],
        defaultValue: "black",
      },
    ],
  },
  {
    key: "customTile",
    label: "Fill tile id",
    type: "value",
    min: 0,
    max: 255,
    defaultValue: num(0),
    conditions: [{ key: "fill", eq: "custom" }],
  },
  {
    type: "group",
    fields: [
      {
        key: "speed",
        label: "Steps per frame",
        description: "Effect steps advanced each frame. Higher = faster.",
        type: "value",
        width: "50%",
        min: 1,
        max: 32,
        defaultValue: num(1),
      },
      {
        key: "hold",
        label: "Frames per step",
        description: "Frames to wait between step batches. Higher = slower.",
        type: "value",
        width: "50%",
        min: 1,
        max: 60,
        defaultValue: num(1),
      },
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
    type: "checkbox",
    defaultValue: true,
  },
  {
    key: "cgbPalette",
    label: "CGB fill palette (0-7)",
    description:
      "On Color, the fill tile uses this background palette with priority set (covers sprites). Ignored on DMG.",
    type: "value",
    min: 0,
    max: 7,
    defaultValue: num(7),
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
      "Mask Grow/Shrink: the mask scene's tile values (0-255) set the reveal order — darker/lower tiles first (Grow) so any drawn gradient becomes the transition shape.",
    conditions: [{ key: "effect", in: ["mask_grow"] }],
  },
  {
    key: "maskSceneId",
    label: "Mask scene (screen-sized)",
    type: "scene",
    defaultValue: "LAST_SCENE",
    conditions: [{ key: "effect", in: ["mask_grow"] }],
  },
  {
    type: "label",
    label:
      "Runs as a waitable VM function — the script pauses until the transition finishes. Background transitions track the current scroll automatically. All numeric fields accept variables.",
  },
];

export const compile = (input, helpers) => {
  const {
    options, _setConstMemInt8, _setConstMemInt16, engineFieldSetToScriptValue,
    _invoke, _spritesHide, _addComment,
  } = helpers;

  const V = (v, d) =>
    v === undefined || v === null ? num(d) : typeof v === "number" ? num(v) : v;
  const bAND = (a, b) => ({ type: "bAND", valueA: a, valueB: b });
  const bOR = (a, b) => ({ type: "bOR", valueA: a, valueB: b });

  const effect = EFFECT_ID[input.effect] ?? 0;
  const layer = input.layer === "overlay" ? 1 : 0;
  const mode = 0; // fill

  // Mask grow/shrink: resolve the mask scene.
  const isMask = input.effect === "mask_grow";
  let maskSym = 0;
  let maskBank = 0;
  if (isMask) {
    const scenes = (options && options.scenes) || [];
    const scene = scenes.find((s) => s.id === input.maskSceneId);
    if (!scene) {
      throw new Error(
        "Screen Transition Out: Mask Grow/Shrink needs a valid Mask scene.",
      );
    }
    maskSym = `_${scene.symbol}`;
    maskBank = `___bank_${scene.symbol}`;
  }

  _addComment(`Screen Transition Out: ${input.effect} (${input.layer || "background"})`);
  if (input.hideSprites !== false) _spritesHide();

  // Fill tile as a script value (black/white are consts, custom is a value field).
  const fillTile =
    input.fill === "white" ? num(201)
    : input.fill === "custom" ? V(input.customTile, 0)
    : num(202);

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
  engineFieldSetToScriptValue("tr_fill_tile", fillTile);
  // fill attr = CGB priority (0x80) | (palette & 7)
  engineFieldSetToScriptValue("tr_fill_attr", bOR(num(0x80), bAND(V(input.cgbPalette, 7), num(7))));
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
  if (isMask) {
    _setConstMemInt16("tr_maskscene_ptr", maskSym);
    _setConstMemInt8("tr_maskscene_bank", maskBank);
  }
  _invoke("screen_transition_update", 0, 0);
};

// Run after the scene's initial fade-in (named export so the ESM->CJS loader keeps it).
export const waitUntilAfterInitFade = true;
