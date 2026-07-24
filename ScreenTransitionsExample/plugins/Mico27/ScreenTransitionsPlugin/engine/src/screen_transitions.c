#pragma bank 255

// Screen Transitions — runtime, waitable transition engine.
//
// Instead of baking hundreds of tile writes into GBVM script at compile time,
// each transition runs here in C as a single *waitable* VM function driven by
// VM_INVOKE: `screen_transition_update` is called once per frame (with
// `start` TRUE on the first call) until it returns TRUE. It advances the
// effect a few steps per frame and yields (waitable = TRUE) in between, so the
// invoking script pauses until the transition finishes while other threads keep
// running. The whole thing costs a handful of script bytes regardless of effect.

#include <gbdk/platform.h>
#include "system.h"
#include "vm.h"
#include "gbs_types.h"
#include "scroll.h"
#include "bankdata.h"
#include "data_manager.h"
#include "ui.h"   // win_pos_x/y, win_dest_pos_x/y, MENU_CLOSED_Y

// --- effects ---
#define E_WIPE_R   0
#define E_WIPE_L   1
#define E_WIPE_D   2
#define E_WIPE_U   3
#define E_SPLIT_H  4
#define E_OPEN_H   5
#define E_SPLIT_V  6
#define E_OPEN_V   7
#define E_IRIS_IN  8
#define E_IRIS_OUT 9
#define E_DIAG_TL  10
#define E_DIAG_BR  11
#define E_CHECKER  12

// --- modes ---
#define M_FILL    0   // out: solid fill
#define M_REFRESH 1   // in: reload active scene tiles from ROM
#define M_COPY    2   // in: copy tiles from another scene (with source offset)

// --- layers ---
#define L_BKG     0
#define L_OVERLAY 1

typedef struct tr_t {
    UBYTE effect, layer, mode;
    UBYTE x0, y0, w, h;     // region (screen-relative tiles)
    UBYTE speed, hold;      // steps drawn per active frame / frames between batches
    UBYTE fill_tile, fill_attr;
    UBYTE src_x, src_y;     // source offset in the other scene (copy mode)
    UBYTE base_x, base_y;   // scroll offset in tiles (bkg) so we track the visible screen
    UWORD step, total;
    UBYTE hold_ctr;
    // cached source scene (copy mode)
    UBYTE map_w;
    const UBYTE * map_ptr; UBYTE map_bank;
    const UBYTE * attr_ptr; UBYTE attr_bank;
} tr_t;

static tr_t T;

static UWORD tr_total(void) {
    UBYTE W = T.w, H = T.h;
    switch (T.effect) {
        case E_WIPE_R: case E_WIPE_L:   return W;
        case E_WIPE_D: case E_WIPE_U:   return H;
        case E_SPLIT_H: case E_OPEN_H:  return (W + 1u) >> 1;
        case E_SPLIT_V: case E_OPEN_V:  return (H + 1u) >> 1;
        case E_IRIS_IN: case E_IRIS_OUT: return (((W < H) ? W : H) + 1u) >> 1;
        case E_DIAG_TL: case E_DIAG_BR: return (UWORD)W + H - 1u;
        case E_CHECKER:                 return (UWORD)W << 1;
        default:                        return W;
    }
}

// Draw a single region-local tile (lx,ly) using the current mode/layer.
static void tr_put(UBYTE lx, UBYTE ly) {
    UBYTE sx = T.base_x + T.x0 + lx;
    UBYTE sy = T.base_y + T.y0 + ly;
    UBYTE vx = sx & 31u;
    UBYTE vy = sy & 31u;

    if (T.mode == M_FILL) {
        if (T.layer == L_OVERLAY) {
#ifdef CGB
            if (_is_CGB) { VBK_REG = 1; set_win_tile_xy(vx, vy, T.fill_attr); VBK_REG = 0; }
#endif
            set_win_tile_xy(vx, vy, T.fill_tile);
        } else {
#ifdef CGB
            if (_is_CGB) { VBK_REG = 1; set_bkg_tile_xy(vx, vy, T.fill_attr); VBK_REG = 0; }
#endif
            set_bkg_tile_xy(vx, vy, T.fill_tile);
        }
        return;
    }

    if (T.mode == M_REFRESH) {
        UWORD off = (UWORD)sy * (UWORD)image_tile_width + sx;
        UBYTE tile = ReadBankedUBYTE(image_ptr + off, image_bank);
#ifdef CGB
        if (_is_CGB) {
            UBYTE a = ReadBankedUBYTE(image_attr_ptr + off, image_attr_bank);
            VBK_REG = 1; set_bkg_tile_xy(vx, vy, a); VBK_REG = 0;
        }
#endif
        set_bkg_tile_xy(vx, vy, tile);
        return;
    }

    // M_COPY: pull from the other scene at (src + region-local)
    {
        UBYTE cx = T.src_x + T.x0 + lx;
        UBYTE cy = T.src_y + T.y0 + ly;
        UWORD off = (UWORD)cy * (UWORD)T.map_w + cx;
        UBYTE tile = ReadBankedUBYTE(T.map_ptr + off, T.map_bank);
        if (T.layer == L_OVERLAY) {
#ifdef CGB
            if (_is_CGB && T.attr_ptr) {
                UBYTE a = ReadBankedUBYTE(T.attr_ptr + off, T.attr_bank);
                VBK_REG = 1; set_win_tile_xy(vx, vy, a); VBK_REG = 0;
            }
#endif
            set_win_tile_xy(vx, vy, tile);
        } else {
#ifdef CGB
            if (_is_CGB && T.attr_ptr) {
                UBYTE a = ReadBankedUBYTE(T.attr_ptr + off, T.attr_bank);
                VBK_REG = 1; set_bkg_tile_xy(vx, vy, a); VBK_REG = 0;
            }
#endif
            set_bkg_tile_xy(vx, vy, tile);
        }
    }
}

// Draw all tiles belonging to step `k` of the current effect.
static void tr_draw_step(UWORD k) {
    UBYTE W = T.w, H = T.h;
    switch (T.effect) {
        case E_WIPE_R: { UBYTE c = (UBYTE)k;         for (UBYTE y = 0; y < H; y++) tr_put(c, y); } break;
        case E_WIPE_L: { UBYTE c = W - 1u - (UBYTE)k; for (UBYTE y = 0; y < H; y++) tr_put(c, y); } break;
        case E_WIPE_D: { UBYTE r = (UBYTE)k;         for (UBYTE x = 0; x < W; x++) tr_put(x, r); } break;
        case E_WIPE_U: { UBYTE r = H - 1u - (UBYTE)k; for (UBYTE x = 0; x < W; x++) tr_put(x, r); } break;
        case E_SPLIT_H:
        case E_OPEN_H: {
            UBYTE half = (W + 1u) >> 1;
            UBYTE c = (T.effect == E_OPEN_H) ? (half - 1u - (UBYTE)k) : (UBYTE)k;
            for (UBYTE y = 0; y < H; y++) { tr_put(c, y); if ((W - 1u - c) != c) tr_put(W - 1u - c, y); }
        } break;
        case E_SPLIT_V:
        case E_OPEN_V: {
            UBYTE half = (H + 1u) >> 1;
            UBYTE r = (T.effect == E_OPEN_V) ? (half - 1u - (UBYTE)k) : (UBYTE)k;
            for (UBYTE x = 0; x < W; x++) { tr_put(x, r); if ((H - 1u - r) != r) tr_put(x, H - 1u - r); }
        } break;
        case E_IRIS_IN:
        case E_IRIS_OUT: {
            UBYTE maxd = (((W < H) ? W : H) + 1u) >> 1;
            UBYTE d = (T.effect == E_IRIS_OUT) ? (maxd - 1u - (UBYTE)k) : (UBYTE)k;
            UBYTE left = d, right = W - 1u - d, top = d, bottom = H - 1u - d;
            if (left > right || top > bottom) break;
            for (UBYTE x = left; x <= right; x++) { tr_put(x, top); if (bottom != top) tr_put(x, bottom); }
            if (bottom > top + 1u)
                for (UBYTE y = top + 1u; y < bottom; y++) { tr_put(left, y); if (right != left) tr_put(right, y); }
        } break;
        case E_DIAG_TL:
        case E_DIAG_BR: {
            UWORD smax = (UWORD)W + H - 2u;
            UWORD s = (T.effect == E_DIAG_BR) ? (smax - k) : k;
            for (UBYTE x = 0; x < W; x++) {
                if (s >= x) { UWORD y = s - x; if (y < H) tr_put(x, (UBYTE)y); }
            }
        } break;
        case E_CHECKER: {
            UBYTE p  = (UBYTE)(k / W);
            UBYTE cx = (UBYTE)(k % W);
            for (UBYTE y = 0; y < H; y++) if (((cx + y) & 1u) == p) tr_put(cx, y);
        } break;
    }
}

// Prime the overlay (window) with the current scene's visible tiles and show it
// covering the screen. The transition then draws over the window, so the screen
// looks unchanged until the effect touches a tile — and the overlay is left
// OPEN afterwards so a following Change Scene is seamless (the window keeps
// covering the background repaint; win_pos + the window tilemap both survive a
// scene change). Dismiss it later with the stock "Hide Overlay" event.
static void tr_overlay_show(void) {
    UBYTE bx = (UBYTE)(scroll_x >> 3);
    UBYTE by = (UBYTE)(scroll_y >> 3);
    for (UBYTE ly = 0; ly < 18u; ly++) {
        for (UBYTE lx = 0; lx < 20u; lx++) {
            UWORD off = (UWORD)(UBYTE)(by + ly) * (UWORD)image_tile_width + (UBYTE)(bx + lx);
            UBYTE tile = ReadBankedUBYTE(image_ptr + off, image_bank);
#ifdef CGB
            if (_is_CGB) {
                UBYTE a = ReadBankedUBYTE(image_attr_ptr + off, image_attr_bank);
                VBK_REG = 1; set_win_tile_xy(lx, ly, a); VBK_REG = 0;
            }
#endif
            set_win_tile_xy(lx, ly, tile);
        }
    }
    win_pos_x = win_dest_pos_x = 0;
    win_pos_y = win_dest_pos_y = 0; // show at top-left, instantly
}

// Argument frame (one value per slot, so each can be a script variable):
//   0 p0 = effect | layer<<4 | mode<<5   (compile-time selects)
//   1 x   2 y   3 w   4 h   5 speed   6 hold
//   7 fill_tile      8 cgb_palette   (fill mode)
//   9 src_x   10 src_y   11 scene_bank   12 scene_ptr   (copy mode)
static void tr_init(UWORD * sf) {
    UWORD p0 = sf[0];
    T.effect = p0 & 0x0Fu;
    T.layer  = (p0 >> 4) & 1u;
    T.mode   = (p0 >> 5) & 3u;
    T.x0 = sf[1] & 0xFFu;
    T.y0 = sf[2] & 0xFFu;
    T.w  = sf[3] & 0xFFu; if (!T.w) T.w = 1; if (T.w > 32u) T.w = 32u;
    T.h  = sf[4] & 0xFFu; if (!T.h) T.h = 1; if (T.h > 32u) T.h = 32u;
    T.speed = sf[5] & 0xFFu; if (!T.speed) T.speed = 1;
    T.hold  = sf[6] & 0xFFu; if (!T.hold) T.hold = 1;
    T.fill_tile = sf[7] & 0xFFu;
    T.fill_attr = 0x80u | (sf[8] & 0x07u); // CGB priority + palette
    T.src_x = sf[9] & 0xFFu;
    T.src_y = sf[10] & 0xFFu;

    if (T.layer == L_BKG) { T.base_x = (UBYTE)(scroll_x >> 3); T.base_y = (UBYTE)(scroll_y >> 3); }
    else { T.base_x = 0; T.base_y = 0; tr_overlay_show(); }

    T.attr_ptr = 0;
    if (T.mode == M_COPY) {
        UBYTE sbank = sf[11] & 0xFFu;
        const scene_t * sptr = (const scene_t *)sf[12];
        scene_t scn;
        MemcpyBanked(&scn, sptr, sizeof(scn), sbank);
        background_t bkg;
        MemcpyBanked(&bkg, scn.background.ptr, sizeof(bkg), scn.background.bank);
        T.map_w = bkg.width;
        T.map_ptr = bkg.tilemap.ptr; T.map_bank = bkg.tilemap.bank;
        T.attr_ptr = bkg.cgb_tilemap_attr.ptr; T.attr_bank = bkg.cgb_tilemap_attr.bank;
    }

    T.step = 0;
    T.total = tr_total();
    T.hold_ctr = 0;
}

// Waitable VM function (VM_INVOKE target).
UBYTE screen_transition_update(void * THIS, UBYTE start, UWORD * stack_frame) OLDCALL BANKED {
    if (start) tr_init(stack_frame);

    if (T.hold_ctr) {
        T.hold_ctr--;
        ((SCRIPT_CTX *)THIS)->waitable = TRUE;
        return FALSE;
    }

    for (UBYTE s = 0; s < T.speed && T.step < T.total; s++) {
        tr_draw_step(T.step);
        T.step++;
    }

    if (T.step >= T.total) return TRUE;

    T.hold_ctr = T.hold - 1u;
    ((SCRIPT_CTX *)THIS)->waitable = TRUE;
    return FALSE;
}

// One-shot: fill the whole background tilemap with a tile (+CGB attr). Used to
// cover the screen before an instant fade-in on scene entry.
//   VM_PUSH_CONST attr
//   VM_PUSH_CONST tile
//   VM_CALL_NATIVE b_vm_screen_cover, _vm_screen_cover
//   VM_POP 2
void vm_screen_cover(SCRIPT_CTX * THIS) OLDCALL BANKED {
    UBYTE tile = *(uint8_t *) VM_REF_TO_PTR(FN_ARG0);
    (void)tile;
#ifdef CGB
    if (_is_CGB) {
        UBYTE attr = *(uint8_t *) VM_REF_TO_PTR(FN_ARG1);
        VBK_REG = 1; fill_bkg_rect(0, 0, 32, 32, attr); VBK_REG = 0;
    }
#endif
    fill_bkg_rect(0, 0, 32, 32, tile);
    (void)THIS;
}
