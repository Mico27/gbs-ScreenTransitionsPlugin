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
    conditions: [{ key: "effect", in: ["mask_grow", "mask_shrink"] }],
  },
  {
    key: "maskSceneId",
    label: "Mask scene (screen-sized)",
    type: "scene",
    defaultValue: "LAST_SCENE",
    conditions: [{ key: "effect", in: ["mask_grow", "mask_shrink"] }],
  },
  {
    type: "label",
    label:
      "Runs as a waitable VM function — the script pauses until the transition finishes. Background transitions track the current scroll automatically. All numeric fields accept variables.",
  },
];

export const compile = (input, helpers) => {
  const {
    options, _stackPushConst, _stackPushScriptValue, _invoke,
    _spritesHide, _addComment,
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
  const layer = input.layer === "overlay" ? 1 : 0;
  const mode = 0; // fill
  const p0 = (effect & 0x1f) | (layer << 5) | (mode << 6);

  // Mask grow/shrink: resolve the mask scene.
  const isMask = input.effect === "mask_grow" || input.effect === "mask_shrink";
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

  // Bit-packed frame (10 slots): value pairs packed via RPN, then invoke.
  _stackPushConst(p0);                                          // 0 p0
  _stackPushScriptValue(pack(V(input.x, 0), V(input.y, 0)));    // 1 x|y
  _stackPushScriptValue(pack(V(input.width, 20), V(input.height, 18))); // 2 w|h
  _stackPushScriptValue(pack(V(input.speed, 1), V(input.hold, 1)));     // 3 speed|hold
  _stackPushScriptValue(pack(fillTile, V(input.cgbPalette, 7)));// 4 fill|palette
  _stackPushConst(0);                                          // 5 src_x|src_y (unused)
  _stackPushConst(0);                                          // 6 scene_bank (unused)
  _stackPushConst(0);                                          // 7 scene_ptr (unused)
  _stackPushConst(maskBank);                                   // 8 mask_bank
  _stackPushConst(maskSym);                                    // 9 mask_ptr
  _invoke("screen_transition_update", 10, -10);
};

// Run after the scene's initial fade-in (named export so the ESM->CJS loader keeps it).
export const waitUntilAfterInitFade = true;
