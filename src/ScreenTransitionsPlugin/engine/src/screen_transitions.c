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
#include "ui.h"    // win_pos_x/y, win_dest_pos_x/y, MENU_CLOSED_Y

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
#define E_SNAKE_H  13
#define E_SNAKE_V  14
#define E_BLINDS_H 15
#define E_BLINDS_V 16
#define E_FOUR_SQ  17
#define E_DIAMOND_IN  18
#define E_DIAMOND_OUT 19
#define E_CLOCK       20
#define E_NOISE       21
#define E_FAN4        22
#define E_X           23
#define E_MASK_GROW   24
#define E_MASK_SHRINK 25
#define E_SPIRAL      26

#define BLIND_BAND 3u   // venetian-blind band size (tiles)
#define NOISE_BINS    32u

// --- modes ---
#define M_FILL    0   // out: solid fill
#define M_REFRESH 1   // in: reload active scene tiles from ROM
#define M_COPY    2   // in: copy tiles from another scene (with source offset)

// --- layers ---
#define L_BKG     0
#define L_OVERLAY 1

// --- global state for the current transition ---
UBYTE tr_effect, tr_layer, tr_mode;
UBYTE tr_x0, tr_y0, tr_w, tr_h; // region (screen-relative tiles)
UBYTE tr_speed, tr_hold; // steps drawn per active frame / frames between batches
UBYTE tr_fill_tile, tr_fill_attr;
UBYTE tr_src_x, tr_src_y; // source offset in the other scene (copy mode)
UBYTE tr_base_x, tr_base_y; // scroll offset in tiles (bkg) so we track the visible screen
UWORD tr_step, tr_total;
UBYTE tr_hold_ctr;
UBYTE tr_noise_seed; // per-run seed for the noise dissolve
UBYTE tr_map_w, tr_mask_w;
const UBYTE * tr_map_ptr, * tr_attr_ptr, * tr_mask_ptr;
UBYTE tr_map_bank, tr_attr_bank, tr_mask_bank;
UWORD tr_mask_ntiles; // = tileset tile count = number of grow/shrink steps


static UWORD tr_perim(void);   // fwd decl (tr_calc_total below uses it before its definition)

// Deterministic per-tile hash (0..255), varied per run by seed.
static UBYTE tr_hash(UBYTE x, UBYTE y, UBYTE seed) {
    UBYTE h = (UBYTE)(x * 37u + y * 101u + seed * 151u);
    h ^= (UBYTE)(h << 3);
    h ^= (UBYTE)(h >> 2);
    h = (UBYTE)(h + (x ^ (UBYTE)(y << 4) ^ seed));
    h ^= (UBYTE)(h << 1);
    return h;
}

static UWORD tr_calc_total(void) {
    UBYTE W = tr_w, H = tr_h;
    switch (tr_effect) {
        case E_WIPE_R: case E_WIPE_L:   return W;
        case E_WIPE_D: case E_WIPE_U:   return H;
        case E_SPLIT_H: case E_OPEN_H:  return (W + 1u) >> 1;
        case E_SPLIT_V: case E_OPEN_V:  return (H + 1u) >> 1;
        case E_IRIS_IN: case E_IRIS_OUT: return (((W < H) ? W : H) + 1u) >> 1;
        case E_DIAG_TL: case E_DIAG_BR: return (UWORD)W + H - 1u;
        case E_CHECKER:                 return (UWORD)W << 1;
        case E_SNAKE_H: case E_SNAKE_V: return (UWORD)W * H;
        case E_SPIRAL:                  return (UWORD)W * H;
        case E_BLINDS_H:                return (H < BLIND_BAND) ? H : BLIND_BAND;
        case E_BLINDS_V:                return (W < BLIND_BAND) ? W : BLIND_BAND;
        case E_FOUR_SQ:                 return (UWORD)((W + 1u) >> 1) * ((H + 1u) >> 1);
        case E_DIAMOND_IN: case E_DIAMOND_OUT: {
            UBYTE cx = W >> 1, cy = H >> 1;
            UBYTE mx = (cx > (UBYTE)(W - 1u - cx)) ? cx : (UBYTE)(W - 1u - cx);
            UBYTE my = (cy > (UBYTE)(H - 1u - cy)) ? cy : (UBYTE)(H - 1u - cy);
            return (UWORD)mx + my + 1u;
        }
        case E_CLOCK:                   return tr_perim();                    // one radius per step
        case E_NOISE:                   return NOISE_BINS;
        case E_FAN4:                    return (UWORD)((tr_perim() + 3u) >> 2); // ceil(perim/4)
        case E_X:                       return (UWORD)((W >> 1) + 1u);   // half the width (linear thicken)
        case E_MASK_GROW: case E_MASK_SHRINK: return tr_mask_ntiles;
        default:                        return W;
    }
}

// Draw a single region-local tile (lx,ly) using the current mode/layer.
static void tr_put(UBYTE lx, UBYTE ly) {
    UBYTE sx = tr_base_x + tr_x0 + lx;
    UBYTE sy = tr_base_y + tr_y0 + ly;
    UBYTE vx = sx & 31u;
    UBYTE vy = sy & 31u;

    if (tr_mode == M_FILL) {
        if (tr_layer == L_OVERLAY) {
#ifdef CGB
            if (_is_CGB) { VBK_REG = 1; set_win_tile_xy(vx, vy, tr_fill_attr); VBK_REG = 0; }
#endif
            set_win_tile_xy(vx, vy, tr_fill_tile);
        } else {
#ifdef CGB
            if (_is_CGB) { VBK_REG = 1; set_bkg_tile_xy(vx, vy, tr_fill_attr); VBK_REG = 0; }
#endif
            set_bkg_tile_xy(vx, vy, tr_fill_tile);
        }
        return;
    }

    if (tr_mode == M_REFRESH) {
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
        UBYTE cx = tr_src_x + tr_x0 + lx;
        UBYTE cy = tr_src_y + tr_y0 + ly;
        UWORD off = (UWORD)cy * (UWORD)tr_map_w + cx;
        UBYTE tile = ReadBankedUBYTE(tr_map_ptr + off, tr_map_bank);
        if (tr_layer == L_OVERLAY) {
#ifdef CGB
            if (_is_CGB && tr_attr_ptr) {
                UBYTE a = ReadBankedUBYTE(tr_attr_ptr + off, tr_attr_bank);
                VBK_REG = 1; set_win_tile_xy(vx, vy, a); VBK_REG = 0;
            }
#endif
            set_win_tile_xy(vx, vy, tile);
        } else {
#ifdef CGB
            if (_is_CGB && tr_attr_ptr) {
                UBYTE a = ReadBankedUBYTE(tr_attr_ptr + off, tr_attr_bank);
                VBK_REG = 1; set_bkg_tile_xy(vx, vy, a); VBK_REG = 0;
            }
#endif
            set_bkg_tile_xy(vx, vy, tile);
        }
    }
}

// Bresenham line between two region-local points (either may lie outside the
// region — off-region tiles are clipped by the tr_put guard). Signed coords so
// the walk is correct even when an endpoint is negative. Shared by the radial
// (clock / fan / X) and diamond effects.
static void tr_line(BYTE x0, BYTE y0, BYTE x1, BYTE y1) {
    BYTE ax = (BYTE)(x1 - x0), ay = (BYTE)(y1 - y0);
    BYTE sx = (ax >= 0) ? 1 : -1, sy = (ay >= 0) ? 1 : -1;
    BYTE dx = (ax >= 0) ? ax : (BYTE)-ax;
    BYTE dy = (ay >= 0) ? ay : (BYTE)-ay;
    BYTE err = (BYTE)(dx - dy);
    BYTE x = x0, y = y0;
    while (1) {
        if ((UBYTE)x < tr_w && (UBYTE)y < tr_h) tr_put((UBYTE)x, (UBYTE)y);
        if (x == x1 && y == y1) break;
        BYTE e2 = (BYTE)(err << 1);
        if (e2 > -dy) { err = (BYTE)(err - dy); x = (BYTE)(x + sx); }
        if (e2 <  dx) { err = (BYTE)(err + dx); y = (BYTE)(y + sy); }
    }
}

// Draw a radius: a Bresenham line from the region centre out to the perimeter
// tile at clockwise walk-index `idx` (index 0 = top-left, walking L->R along the
// top, then down the right, etc.). Callers add their own phase offset to `idx`.
static void tr_ray(UWORD idx) {
    UBYTE W = tr_w, H = tr_h;
    UBYTE cx = W >> 1, cy = H >> 1;
    UWORD perim = (UWORD)2u * W + 2u * H; perim = (perim > 4u) ? (UWORD)(perim - 4u) : 1u;
    UWORD n = idx % perim;
    BYTE ex, ey;
    if (n < W) { ex = (BYTE)n; ey = 0; }                                   // top row  L->R
    else if ((n -= W) < (UWORD)(H - 1u)) { ex = (BYTE)(W - 1u); ey = (BYTE)(n + 1u); }        // right col T->B
    else if ((n -= (UWORD)(H - 1u)) < (UWORD)(W - 1u)) { ex = (BYTE)(W - 2u - n); ey = (BYTE)(H - 1u); } // bottom row R->L
    else { n -= (UWORD)(W - 1u); ex = 0; ey = (BYTE)(H - 2u - n); }        // left col  B->T
    tr_line((BYTE)cx, (BYTE)cy, ex, ey);
}

// Perimeter of the current region (>=1), used by the radial effects.
static UWORD tr_perim(void) {
    UWORD p = (UWORD)2u * tr_w + 2u * tr_h;
    return (p > 4u) ? (UWORD)(p - 4u) : 1u;
}

// Draw all tiles belonging to step `k` of the current effect.
static void tr_draw_step(UWORD k) {
    UBYTE W = tr_w, H = tr_h;
    switch (tr_effect) {
        case E_WIPE_R: { UBYTE c = (UBYTE)k;         for (UBYTE y = 0; y < H; y++) tr_put(c, y); } break;
        case E_WIPE_L: { UBYTE c = W - 1u - (UBYTE)k; for (UBYTE y = 0; y < H; y++) tr_put(c, y); } break;
        case E_WIPE_D: { UBYTE r = (UBYTE)k;         for (UBYTE x = 0; x < W; x++) tr_put(x, r); } break;
        case E_WIPE_U: { UBYTE r = H - 1u - (UBYTE)k; for (UBYTE x = 0; x < W; x++) tr_put(x, r); } break;
        case E_SPLIT_H:
        case E_OPEN_H: {
            UBYTE half = (W + 1u) >> 1;
            UBYTE c = (tr_effect == E_OPEN_H) ? (half - 1u - (UBYTE)k) : (UBYTE)k;
            for (UBYTE y = 0; y < H; y++) { tr_put(c, y); if ((W - 1u - c) != c) tr_put(W - 1u - c, y); }
        } break;
        case E_SPLIT_V:
        case E_OPEN_V: {
            UBYTE half = (H + 1u) >> 1;
            UBYTE r = (tr_effect == E_OPEN_V) ? (half - 1u - (UBYTE)k) : (UBYTE)k;
            for (UBYTE x = 0; x < W; x++) { tr_put(x, r); if ((H - 1u - r) != r) tr_put(x, H - 1u - r); }
        } break;
        case E_IRIS_IN:
        case E_IRIS_OUT: {
            UBYTE maxd = (((W < H) ? W : H) + 1u) >> 1;
            UBYTE d = (tr_effect == E_IRIS_OUT) ? (maxd - 1u - (UBYTE)k) : (UBYTE)k;
            UBYTE left = d, right = W - 1u - d, top = d, bottom = H - 1u - d;
            if (left > right || top > bottom) break;
            for (UBYTE x = left; x <= right; x++) { tr_put(x, top); if (bottom != top) tr_put(x, bottom); }
            if (bottom > top + 1u)
                for (UBYTE y = top + 1u; y < bottom; y++) { tr_put(left, y); if (right != left) tr_put(right, y); }
        } break;
        case E_DIAG_TL:
        case E_DIAG_BR: {
            UWORD smax = (UWORD)W + H - 2u;
            UWORD s = (tr_effect == E_DIAG_BR) ? (smax - k) : k;
            for (UBYTE x = 0; x < W; x++) {
                if (s >= x) { UWORD y = s - x; if (y < H) tr_put(x, (UBYTE)y); }
            }
        } break;
        case E_CHECKER: {
            UBYTE p  = (UBYTE)(k / W);
            UBYTE cx = (UBYTE)(k % W);
            for (UBYTE y = 0; y < H; y++) if (((cx + y) & 1u) == p) tr_put(cx, y);
        } break;
        case E_SNAKE_H: { // serpentine, one tile per step (row L->R, R->L, ...)
            UBYTE row = (UBYTE)(k / W);
            UBYTE i   = (UBYTE)(k % W);
            UBYTE col = (row & 1u) ? (UBYTE)(W - 1u - i) : i;
            tr_put(col, row);
        } break;
        case E_SNAKE_V: {
            UBYTE col = (UBYTE)(k / H);
            UBYTE j   = (UBYTE)(k % H);
            UBYTE row = (col & 1u) ? (UBYTE)(H - 1u - j) : j;
            tr_put(col, row);
        } break;
        case E_SPIRAL: { // serpentine spiral, one tile per step; clockwise, outside -> in.
            //Get the next spiral position based on k
            UBYTE layer = 0;
            UBYTE x = 0, y = 0;
            UBYTE w = W, h = H;
            UWORD n = k;
            while (1) {
                if (n < w) { x = n; y = 0; break; }
                n -= w;
                if (n < h - 1) { x = w - 1; y = n + 1; break; }
                n -= h - 1;
                if (n < w - 1) { x = w - 2 - n; y = h - 1; break; }
                n -= w - 1;
                if (n < h - 2) { x = 0; y = h - 2 - n; break; }
                n -= h - 2;
                w -= 2; h -= 2; layer++; if (w == 0 || h == 0) break;
            }
            x += layer; y += layer;
            if (x < W && y < H) tr_put(x, y);
            
        } break;
        case E_BLINDS_H: { // venetian blinds: every band advances one row per step
            for (UBYTE bs = 0; bs < H; bs += BLIND_BAND) {
                UBYTE r = bs + (UBYTE)k;
                if (r < H && (UBYTE)k < BLIND_BAND) for (UBYTE x = 0; x < W; x++) tr_put(x, r);
            }
        } break;
        case E_BLINDS_V: {
            for (UBYTE bs = 0; bs < W; bs += BLIND_BAND) {
                UBYTE c = bs + (UBYTE)k;
                if (c < W && (UBYTE)k < BLIND_BAND) for (UBYTE y = 0; y < H; y++) tr_put(c, y);
            }
        } break;
        case E_FOUR_SQ: { // chunky 2x2 (16x16px) block wipe
            UBYTE bcols = (W + 1u) >> 1;
            UBYTE by = (UBYTE)(k / bcols);
            UBYTE bx = (UBYTE)(k % bcols);
            UBYTE ox = bx << 1, oy = by << 1;
            for (UBYTE dy = 0; dy < 2u; dy++)
                for (UBYTE dx = 0; dx < 2u; dx++) {
                    UBYTE xx = ox + dx, yy = oy + dy;
                    if (xx < W && yy < H) tr_put(xx, yy);
                }
        } break;
        case E_DIAMOND_IN:
        case E_DIAMOND_OUT: { // diamond iris: draw the ring outline as 4 slope-1 Bresenham edges
            BYTE cx = (BYTE)(W >> 1), cy = (BYTE)(H >> 1);
            UBYTE mx = (cx > (BYTE)(W - 1u - (W >> 1))) ? (UBYTE)cx : (UBYTE)(W - 1u - (W >> 1));
            UBYTE my = (cy > (BYTE)(H - 1u - (H >> 1))) ? (UBYTE)cy : (UBYTE)(H - 1u - (H >> 1));
            UWORD maxd = (UWORD)mx + my;
            BYTE d = (BYTE)((tr_effect == E_DIAMOND_OUT) ? k : (maxd - k));
            // tips: N(cx,cy-d) E(cx+d,cy) S(cx,cy+d) W(cx-d,cy); edges connect them at 45deg
            tr_line(cx, (BYTE)(cy - d), (BYTE)(cx + d), cy);
            tr_line((BYTE)(cx + d), cy, cx, (BYTE)(cy + d));
            tr_line(cx, (BYTE)(cy + d), (BYTE)(cx - d), cy);
            tr_line((BYTE)(cx - d), cy, cx, (BYTE)(cy - d));
        } break;
        case E_CLOCK: { // radial clock sweep: one perimeter point per step, line centre->edge
            tr_ray((UWORD)(k + (W >> 1)));   // +cx phase so step 0 = 12 o'clock, clockwise
        } break;
        case E_FAN4: { // 4-blade fan: 4 radii sweeping contiguous quarter-arcs in parallel
            UWORD perim = tr_perim();
            UWORD total = (UWORD)((perim + 3u) >> 2);   // ceil(perim/4) = steps
            UBYTE cx = W >> 1;
            for (UBYTE b = 0; b < 4u; b++) {
                UWORD idx = k + (UWORD)b * total;        // blade b sweeps its own quarter block
                if (idx < perim) tr_ray(idx + cx);
            }
        } break;
        case E_NOISE: { // random-looking dissolve (hash binned)
            for (UBYTE y = 0; y < H; y++)
                for (UBYTE x = 0; x < W; x++)
                    if ((UBYTE)(tr_hash(x, y, tr_noise_seed) >> 3) == (UBYTE)k) tr_put(x, y);
        } break;
        case E_X: { // an X whose two diagonal arms thicken LINEARLY into uniform bands:
            // draw both full diagonals, translated horizontally by +/-k each step.
            BYTE kk = (BYTE)k;
            BYTE wm = (BYTE)(W - 1u), hm = (BYTE)(H - 1u);
            tr_line(kk, 0, (BYTE)(wm + kk), hm);           // main diagonal (TL->BR), shifted +k
            tr_line((BYTE)(wm + kk), 0, kk, hm);           // anti diagonal (TR->BL), shifted +k
            if (k) {                                       // k==0 is the bare X (2 lines)
                tr_line((BYTE)-kk, 0, (BYTE)(wm - kk), hm);   // main -k
                tr_line((BYTE)(wm - kk), 0, (BYTE)-kk, hm);   // anti -k
            }
        } break;
        case E_MASK_GROW:
        case E_MASK_SHRINK: { // reveal by the mask scene's tile index (one index per step)
            UWORD target = (tr_effect == E_MASK_GROW) ? k : (tr_mask_ntiles - 1u - k);
            for (UBYTE y = 0; y < H; y++) {
                UWORD row = (UWORD)(UBYTE)(tr_y0 + y) * (UWORD)tr_mask_w;
                for (UBYTE x = 0; x < W; x++) {
                    UBYTE mv = ReadBankedUBYTE(tr_mask_ptr + row + (UBYTE)(tr_x0 + x), tr_mask_bank);
                    if ((UWORD)mv == target) tr_put(x, y);
                }
            }
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

// Argument frame, bit-packed (two byte-fields per word where possible, so a
// 15-value frame fits in 10 slots). The event packs the value fields with RPN
// (`(hi & 0xff) << 8 | (lo & 0xff)`); we unpack here.
//   0 p0 = effect | layer<<5 | mode<<6
//   1 x<<8 | y      2 w<<8 | h      3 speed<<8 | hold
//   4 fill_tile<<8 | cgb_palette    5 src_x<<8 | src_y
//   6 scene_bank    7 scene_ptr     8 mask_bank    9 mask_ptr
static void tr_init(UWORD * sf) {
    UWORD p0 = sf[0];
    tr_effect = p0 & 0x1Fu;       // effect 0-31 (5 bits)
    tr_layer  = (p0 >> 5) & 1u;
    tr_mode   = (p0 >> 6) & 3u;
    tr_x0 = (UBYTE)(sf[1] >> 8);   tr_y0 = (UBYTE)(sf[1] & 0xFFu);
    tr_w  = (UBYTE)(sf[2] >> 8);   tr_h  = (UBYTE)(sf[2] & 0xFFu);
    if (!tr_w) tr_w = 1; if (tr_w > 32u) tr_w = 32u;
    if (!tr_h) tr_h = 1; if (tr_h > 32u) tr_h = 32u;
    tr_speed = (UBYTE)(sf[3] >> 8); tr_hold = (UBYTE)(sf[3] & 0xFFu);
    if (!tr_speed) tr_speed = 1;     if (!tr_hold) tr_hold = 1;
    tr_fill_tile = (UBYTE)(sf[4] >> 8);
    tr_fill_attr = 0x80u | (UBYTE)(sf[4] & 0x07u); // CGB priority + palette (low 3 bits)
    tr_src_x = (UBYTE)(sf[5] >> 8); tr_src_y = (UBYTE)(sf[5] & 0xFFu);

    if (tr_layer == L_BKG) { tr_base_x = (UBYTE)(scroll_x >> 3); tr_base_y = (UBYTE)(scroll_y >> 3); }
    else { tr_base_x = 0; tr_base_y = 0; tr_overlay_show(); }

    tr_attr_ptr = 0;
    if (tr_mode == M_COPY) {
        UBYTE sbank = sf[6] & 0xFFu;
        const scene_t * sptr = (const scene_t *)sf[7];
        scene_t scn;
        MemcpyBanked(&scn, sptr, sizeof(scn), sbank);
        background_t bkg;
        MemcpyBanked(&bkg, scn.background.ptr, sizeof(bkg), scn.background.bank);
        tr_map_w = bkg.width;
        tr_map_ptr = bkg.tilemap.ptr; tr_map_bank = bkg.tilemap.bank;
        tr_attr_ptr = bkg.cgb_tilemap_attr.ptr; tr_attr_bank = bkg.cgb_tilemap_attr.bank;
    }

    if (tr_effect == E_NOISE) {
        tr_noise_seed = (UBYTE)DIV_REG;   // vary the dissolve each run
    } else if (tr_effect == E_MASK_GROW || tr_effect == E_MASK_SHRINK) {
        UBYTE mbank = sf[8] & 0xFFu;
        const scene_t * mptr = (const scene_t *)sf[9];
        scene_t scn;
        MemcpyBanked(&scn, mptr, sizeof(scn), mbank);
        background_t bkg;
        MemcpyBanked(&bkg, scn.background.ptr, sizeof(bkg), scn.background.bank);
        tr_mask_w = bkg.width;
        tr_mask_ptr = bkg.tilemap.ptr; tr_mask_bank = bkg.tilemap.bank;
        // grow/shrink over the tileset's tile count (one index per step)
        tr_mask_ntiles = ReadBankedUWORD(&(((const tileset_t *)bkg.tileset.ptr)->n_tiles), bkg.tileset.bank);
        if (tr_mask_ntiles == 0) tr_mask_ntiles = 1;
    }

    tr_step = 0;
    tr_total = tr_calc_total();
    tr_hold_ctr = 0;
}

// Waitable VM function (VM_INVOKE target).
UBYTE screen_transition_update(void * THIS, UBYTE start, UWORD * stack_frame) OLDCALL BANKED {
    if (start) tr_init(stack_frame);

    if (tr_hold_ctr) {
        tr_hold_ctr--;
        ((SCRIPT_CTX *)THIS)->waitable = TRUE;
        return FALSE;
    }

    for (UBYTE s = 0; s < tr_speed && tr_step < tr_total; s++) {
        tr_draw_step(tr_step);
        tr_step++;
    }

    if (tr_step >= tr_total) return TRUE;

    tr_hold_ctr = tr_hold - 1u;
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
