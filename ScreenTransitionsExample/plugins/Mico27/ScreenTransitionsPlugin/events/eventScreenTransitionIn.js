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
];

export const compile = (input, helpers) => {
  const {
    options,
    _stackPushConst, _stackPushScriptValue, _stackPop, _invoke,
    _callNative, _spritesHide, _spritesShow, _setConstMemInt8, _fadeIn, _addComment,
  } = helpers;

  const V = (v, d) =>
    v === undefined || v === null ? num(d) : typeof v === "number" ? num(v) : v;

  const effect = EFFECT_ID[input.effect] ?? 0;
  const isScene = input.source === "scene";
  const layer = isScene ? (input.layer === "background" ? 0 : 1) : 0;
  const mode = isScene ? 2 : 1; // 2 copy, 1 refresh
  const p0 = (effect & 0x0f) | (layer << 4) | (mode << 5);

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

  // Push one value per arg slot (each may be a script variable), then invoke.
  _stackPushConst(p0);                       // 0
  _stackPushScriptValue(V(input.x, 0));      // 1
  _stackPushScriptValue(V(input.y, 0));      // 2
  _stackPushScriptValue(V(input.width, 20)); // 3
  _stackPushScriptValue(V(input.height, 18));// 4
  _stackPushScriptValue(V(input.speed, 1));  // 5
  _stackPushScriptValue(V(input.hold, 1));   // 6
  _stackPushConst(0);                        // 7  fill tile (unused for reveal)
  _stackPushConst(0);                        // 8  palette (unused)
  if (isScene) {
    _stackPushScriptValue(V(input.srcX, 0)); // 9  src_x
    _stackPushScriptValue(V(input.srcY, 0)); // 10 src_y
  } else {
    _stackPushConst(0);                      // 9
    _stackPushConst(0);                      // 10
  }
  _stackPushConst(sceneBank);                // 11 scene_bank
  _stackPushConst(sceneSym);                 // 12 scene_ptr
  _invoke("screen_transition_update", 13, -13);

  if (coverFirst) {
    _setConstMemInt8("fade_frames_per_step", 3); // restore a sane fade speed
  }
  if (!isScene && input.showSprites !== false) _spritesShow();
};

// Run after the scene's initial fade-in (named export so the ESM->CJS loader keeps it).
export const waitUntilAfterInitFade = true;
