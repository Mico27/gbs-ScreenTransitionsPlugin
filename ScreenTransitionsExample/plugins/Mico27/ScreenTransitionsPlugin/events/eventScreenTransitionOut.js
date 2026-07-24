export const id = "PT_EVENT_SCREEN_TRANSITION_OUT";
export const name = "Screen Transition Out (to fill)";
export const groups = ["EVENT_GROUP_SCREEN", "Screen Transitions"];

export const autoLabel = (fetchArg, input) => {
  const layer = input.layer === "overlay" ? "overlay" : "bkg";
  return `Screen Transition Out: ${input.effect || "wipe_right"} (${layer})`;
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
];
const EFFECT_ID = {
  wipe_right: 0, wipe_left: 1, wipe_down: 2, wipe_up: 3,
  split_h: 4, open_h: 5, split_v: 6, open_v: 7,
  iris_in: 8, iris_out: 9, diag_tl: 10, diag_br: 11, checker: 12,
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
      { key: "x", label: "X", type: "value", width: "50%", min: -31, max: 31, defaultValue: num(0) },
      { key: "y", label: "Y", type: "value", width: "50%", min: -31, max: 31, defaultValue: num(0) },
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
      "Runs as a waitable VM function — the script pauses until the transition finishes. Background transitions track the current scroll automatically. All numeric fields accept variables.",
  },
];

export const compile = (input, helpers) => {
  const {
    _stackPushConst, _stackPushScriptValue, _invoke,
    _spritesHide, _addComment,
  } = helpers;

  const V = (v, d) =>
    v === undefined || v === null ? num(d) : typeof v === "number" ? num(v) : v;

  const effect = EFFECT_ID[input.effect] ?? 0;
  const layer = input.layer === "overlay" ? 1 : 0;
  const mode = 0; // fill
  const p0 = (effect & 0x0f) | (layer << 4) | (mode << 5);

  _addComment(`Screen Transition Out: ${input.effect} (${input.layer || "background"})`);
  if (input.hideSprites !== false) _spritesHide();

  // Push one value per arg slot (each may be a script variable), then invoke the
  // waitable transition reading the frame from the stack (idx = -argCount).
  _stackPushConst(p0);                          // 0
  _stackPushScriptValue(V(input.x, 0));         // 1
  _stackPushScriptValue(V(input.y, 0));         // 2
  _stackPushScriptValue(V(input.width, 20));    // 3
  _stackPushScriptValue(V(input.height, 18));   // 4
  _stackPushScriptValue(V(input.speed, 1));     // 5
  _stackPushScriptValue(V(input.hold, 1));      // 6
  if (input.fill === "white") _stackPushConst(201);      // 7 fill tile
  else if (input.fill === "custom") _stackPushScriptValue(V(input.customTile, 0));
  else _stackPushConst(202);
  _stackPushScriptValue(V(input.cgbPalette, 7));// 8 palette
  _stackPushConst(0);                          // 9  src_x (unused)
  _stackPushConst(0);                          // 10 src_y (unused)
  _stackPushConst(0);                          // 11 scene_bank (unused)
  _stackPushConst(0);                          // 12 scene_ptr (unused)
  _invoke("screen_transition_update", 13, -13);
};

// Run after the scene's initial fade-in (named export so the ESM->CJS loader keeps it).
export const waitUntilAfterInitFade = true;
