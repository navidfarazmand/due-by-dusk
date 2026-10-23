#!/usr/bin/env python3
"""
Due by Dusk · v0.6.00 — Authored Artwork, Sprite-Sheet & Phaser Texture Atlas Pipeline
======================================================================================
Processes the illustrated character sheet and regional background panoramas into:
1. `public/assets/source/arthur_poses/*.png` — 5 high-res RGBA cutouts extracted via
   dark-outline barrier connected-component matting.
2. `public/assets/source/arthur_character_sheet.svg` — Editable layered SVG source wrapper
   referencing the segmented character layers and regions.
3. `public/assets/atlases/arthur_atlas.png` + `public/assets/atlases/arthur_atlas.json` —
   30-frame (5 animations × 6 frames) Phaser 3 Texture Atlas generated via localized
   2D mesh deformation (cv2.remap) for breathing, watch-ticking, hand-rubbing,
   Foreclosure Writ waving, finger jabbing, fist stomping, steam puffs, and flying top hat!
4. `public/assets/environments/env_<CODE>.png` & `env_<CODE>_fg.png` — Illustrated
   regional panoramas for Canada (CA), Brazil (BR), France (FR), and Japan (JP),
   with sky-alpha matting on `*_fg.png` so Phaser's dynamic sun, god-rays, clouds,
   and stars render behind the illustrated mountain ridges and architecture!
"""

import json
import math
import os
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

PROJ_DIR = "artifacts/file_generation/ttl=63d/intermediate/due-by-dusk-phaser"
ASSETS_DIR = os.path.join(PROJ_DIR, "public/assets")
os.makedirs(os.path.join(ASSETS_DIR, "source/arthur_poses"), exist_ok=True)
os.makedirs(os.path.join(ASSETS_DIR, "atlases"), exist_ok=True)
os.makedirs(os.path.join(ASSETS_DIR, "environments"), exist_ok=True)

TOOL_GEN_DIR = "/working_dir/c_e31e0b7d12bf6ee9/user_uploaded_files/ttl=63d/tool_generated"
ARTHUR_RAW = os.path.join(TOOL_GEN_DIR, "watermarked_img_15099265160984460573.jpg")
ENV_RAW = {
    "CA": os.path.join(TOOL_GEN_DIR, "watermarked_img_17993956929820344883.jpg"),
    "BR": os.path.join(TOOL_GEN_DIR, "watermarked_img_451104648936936225.jpg"),
    "FR": os.path.join(TOOL_GEN_DIR, "watermarked_img_1607474335613115240.jpg"),
    "JP": os.path.join(TOOL_GEN_DIR, "watermarked_img_5675676105377841881.jpg"),
}


def extract_arthur_poses():
    img_bgr = cv2.imread(ARTHUR_RAW)
    h, w, _ = img_bgr.shape
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    # Dark ink outlines around Arthur's poses form a closed barrier; background is near-white (>= 242)
    white_candidates = (gray >= 242).astype(np.uint8)
    num_w, w_labels, w_stats, _ = cv2.connectedComponentsWithStats(white_candidates)
    bg_mask = np.zeros((h, w), np.uint8)
    for i in range(1, num_w):
        x, y, bw, bh, area = w_stats[i]
        touches_border = (x == 0) or (y == 0) or (x + bw >= w) or (y + bh >= h)
        if touches_border or area > 2500:
            bg_mask[w_labels == i] = 255

    fg_mask = 255 - bg_mask
    # Soft 1px anti-aliased alpha edge
    fg_eroded = cv2.erode(fg_mask, np.ones((2, 2), np.uint8), iterations=1)
    alpha = cv2.GaussianBlur(fg_eroded, (3, 3), 0.6)

    img_rgba = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGBA)
    img_rgba[:, :, 3] = alpha

    num_fg, fg_labels, fg_stats, fg_centroids = cv2.connectedComponentsWithStats(fg_mask)
    # Identify the 5 main body components sorted left-to-right by centroid X, plus the flying hat in Pose 5
    main_comps = []
    hat_comp = None
    for i in range(1, num_fg):
        x, y, bw, bh, area = fg_stats[i]
        cx, cy = fg_centroids[i]
        if area > 40000:
            main_comps.append((cx, i, x, y, bw, bh))
        elif 5000 < area <= 40000 and cx > 1000:
            hat_comp = (i, x, y, bw, bh)

    main_comps.sort(key=lambda t: t[0])
    assert len(main_comps) == 5, f"Expected 5 main Arthur poses, found {len(main_comps)}"

    pose_names = ["idle", "smug", "demand", "anger", "shock"]
    extracted = {}

    # Standardize each pose onto a 320x420 RGBA canvas with feet anchored at (160, 402)
    CANVAS_W, CANVAS_H = 320, 420
    FOOT_Y = 402

    for idx, (cx, comp_id, x, y, bw, bh) in enumerate(main_comps):
        pname = pose_names[idx]
        comp_mask = (fg_labels == comp_id)

        # Extract body crop
        crop = img_rgba[y:y+bh, x:x+bw].copy()
        local_mask = comp_mask[y:y+bh, x:x+bw]
        crop[~local_mask, 3] = 0

        # Scale so standing height is ~310px (leaving headroom for flying hat in shock)
        scale = 310.0 / 630.0
        new_w = max(1, int(round(bw * scale)))
        new_h = max(1, int(round(bh * scale)))
        crop_resized = cv2.resize(crop, (new_w, new_h), interpolation=cv2.INTER_AREA)

        canvas = np.zeros((CANVAS_H, CANVAS_W, 4), dtype=np.uint8)
        dst_x = (CANVAS_W - new_w) // 2
        dst_y = FOOT_Y - new_h
        canvas[dst_y:dst_y+new_h, dst_x:dst_x+new_w] = crop_resized

        hat_canvas = None
        if pname == "shock" and hat_comp is not None:
            h_id, hx, hy, hbw, hbh = hat_comp
            h_crop = img_rgba[hy:hy+hbh, hx:hx+hbw].copy()
            h_local = (fg_labels[hy:hy+hbh, hx:hx+hbw] == h_id)
            h_crop[~h_local, 3] = 0
            hw_new = max(1, int(round(hbw * scale)))
            hh_new = max(1, int(round(hbh * scale)))
            h_resized = cv2.resize(h_crop, (hw_new, hh_new), interpolation=cv2.INTER_AREA)
            hat_canvas = (h_resized, dst_x + int(round((hx - x) * scale)), dst_y + int(round((hy - y) * scale)))

        extracted[pname] = (canvas, hat_canvas)
        # Save source cutout
        pose_img = Image.fromarray(canvas)
        pose_img.save(os.path.join(ASSETS_DIR, f"source/arthur_poses/pose_{idx}_{pname}.png"))

    return extracted, CANVAS_W, CANVAS_H


def deform_pose_frame(base_rgba, hat_info, state, frame_idx, num_frames=6):
    """
    Applies localized 2D mesh deformation (cv2.remap) to animate specific anatomical
    regions of Arthur's illustrated pose (head, arms/watch/writ, chest, coat tails, legs)
    without merely bouncing or rotating the whole sprite!
    """
    h, w, _ = base_rgba.shape
    phase = (frame_idx / float(num_frames)) * 2.0 * math.pi
    s = math.sin(phase)
    c = math.cos(phase)
    s2 = math.sin(phase * 2.0)

    grid_x, grid_y = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    dx = np.zeros_like(grid_x)
    dy = np.zeros_like(grid_y)

    # Normalized coordinates (0..1)
    nx = grid_x / float(w)
    ny = grid_y / float(h)

    if state == "idle":
        # 1. Left hand holding gold pocket watch (nx < 0.36, ny: 0.32..0.60) ticks/tilts
        watch_w = np.exp(-((nx - 0.22) / 0.14) ** 2 - ((ny - 0.45) / 0.12) ** 2)
        dy -= watch_w * s * 6.5
        dx -= watch_w * c * 3.0
        # 2. Head & monocle glance toward pocket watch (ny: 0.10..0.42)
        head_w = np.exp(-((nx - 0.50) / 0.20) ** 2 - ((ny - 0.28) / 0.12) ** 2)
        dx += head_w * s * 3.5
        dy += head_w * abs(s) * 2.5
        # 3. Chest breathing expansion (ny: 0.42..0.65)
        chest_w = np.exp(-((nx - 0.48) / 0.18) ** 2 - ((ny - 0.52) / 0.12) ** 2)
        dx -= (nx - 0.48) * chest_w * s * 14.0
        dy += chest_w * s * 2.2
        # 4. Swallowtail coat tails secondary sway (ny: 0.60..0.85)
        tail_w = np.exp(-((ny - 0.72) / 0.12) ** 2) * (np.abs(nx - 0.50) > 0.08).astype(np.float32)
        dx += tail_w * c * 5.5

    elif state == "smug":
        # 1. Gloved hands rubbing together in front of waistcoat (nx: 0.34..0.68, ny: 0.44..0.64)
        hands_w = np.exp(-((nx - 0.52) / 0.14) ** 2 - ((ny - 0.53) / 0.09) ** 2)
        dy += hands_w * math.sin(phase * 2.0) * 7.5
        dx += hands_w * math.cos(phase * 1.0) * 4.5
        # 2. Greedy shoulder/head chuckle hunch (ny: 0.18..0.46)
        hunch_w = np.exp(-((nx - 0.50) / 0.22) ** 2 - ((ny - 0.34) / 0.14) ** 2)
        dy += hunch_w * abs(s) * 5.5
        dx -= hunch_w * s * 3.0
        # 3. Coat tails flare in counter-phase
        tail_w = np.exp(-((ny - 0.72) / 0.12) ** 2)
        dx += (nx - 0.50) * tail_w * s * 18.0

    elif state == "demand":
        # 1. Left hand + Foreclosure Writ scroll waving aggressively (nx < 0.44, ny: 0.35..0.72)
        writ_w = np.exp(-((nx - 0.26) / 0.16) ** 2 - ((ny - 0.52) / 0.16) ** 2)
        dy += writ_w * s * 9.5
        dx += writ_w * c * 5.0
        # 2. Right pointing finger jabbing toward the player (nx: 0.44..0.68, ny: 0.46..0.64)
        point_w = np.exp(-((nx - 0.54) / 0.12) ** 2 - ((ny - 0.55) / 0.08) ** 2)
        dx += point_w * s * 9.0
        dy += point_w * s2 * 3.0
        # 3. Barking lower jaw / moustache motion (nx: 0.42..0.58, ny: 0.34..0.45)
        jaw_w = np.exp(-((nx - 0.49) / 0.09) ** 2 - ((ny - 0.40) / 0.05) ** 2)
        dy -= jaw_w * max(0.0, s) * 6.5

    elif state == "anger":
        # 1. Stomping left leg & foot (nx < 0.48, ny > 0.66)
        stomp_w = np.exp(-((nx - 0.32) / 0.16) ** 2 - ((ny - 0.82) / 0.14) ** 2)
        dy += stomp_w * s * 11.0
        # 2. Both clenched fists pumping at sides (ny: 0.50..0.72)
        lfist_w = np.exp(-((nx - 0.24) / 0.11) ** 2 - ((ny - 0.62) / 0.10) ** 2)
        rfist_w = np.exp(-((nx - 0.74) / 0.11) ** 2 - ((ny - 0.62) / 0.10) ** 2)
        dy += (lfist_w - rfist_w * 0.8) * s * 9.5
        dx -= (lfist_w - rfist_w) * abs(s) * 5.0
        # 3. Seething head & torso tremor
        head_w = np.exp(-((nx - 0.48) / 0.20) ** 2 - ((ny - 0.34) / 0.14) ** 2)
        dx += head_w * math.sin(phase * 3.0) * 3.5
        dy += head_w * abs(s) * 4.5

    elif state == "shock":
        # 1. Recoiling upper body & raised hands trembling (ny: 0.25..0.65)
        hands_w = np.exp(-((nx - 0.52) / 0.24) ** 2 - ((ny - 0.50) / 0.14) ** 2)
        dx -= hands_w * s * 6.5
        dy += hands_w * s2 * 5.0
        # 2. Popping monocle on right side (nx > 0.62, ny: 0.20..0.42) swinging wildly
        mono_w = np.exp(-((nx - 0.74) / 0.12) ** 2 - ((ny - 0.30) / 0.10) ** 2)
        dx += mono_w * c * 8.5
        dy += mono_w * s * 8.5
        # 3. Dropped jaw gasp
        jaw_w = np.exp(-((nx - 0.52) / 0.10) ** 2 - ((ny - 0.40) / 0.06) ** 2)
        dy -= jaw_w * abs(s) * 5.5

    map_x = (grid_x + dx).astype(np.float32)
    map_y = (grid_y + dy).astype(np.float32)
    warped = cv2.remap(base_rgba, map_x, map_y, interpolation=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))

    pil_frame = Image.fromarray(warped)
    draw = ImageDraw.Draw(pil_frame)

    # Composite secondary animated props / FX per state
    if state == "shock" and hat_info is not None:
        h_img, hx, hy = hat_info
        # Animate flying top hat bobbing & tilting high above his bald head!
        hat_pil = Image.fromarray(h_img).rotate(s * 14.0, resample=Image.BICUBIC, expand=True)
        bob_y = int(round(hy - 8 - abs(s) * 14.0))
        bob_x = int(round(hx + c * 6.0))
        pil_frame.alpha_composite(hat_pil, (max(0, bob_x), max(0, bob_y)))
        # Animated blue panic sweat droplets spraying from temples
        for side, sx_off in [(-1, 108), (1, 218)]:
            drop_t = ((frame_idx / float(num_frames)) + (0.0 if side < 0 else 0.5)) % 1.0
            px = int(sx_off + side * drop_t * 22)
            py = int(122 - math.sin(drop_t * math.pi) * 14 + drop_t * 18)
            alpha_d = int(230 * (1.0 - drop_t))
            draw.ellipse([px - 4, py - 6, px + 4, py + 6], fill=(56, 189, 248, alpha_d), outline=(12, 74, 110, alpha_d))

    elif state == "anger":
        # Animated white steam puffs rising from collar/temples in anger
        for side, sx_off in [(-1, 96), (1, 206)]:
            puff_t = ((frame_idx / float(num_frames)) + (0.0 if side < 0 else 0.5)) % 1.0
            px = int(sx_off + side * puff_t * 26)
            py = int(146 - puff_t * 34)
            rad = int(6 + puff_t * 10)
            alpha_p = int(220 * (1.0 - puff_t))
            draw.ellipse([px - rad, py - rad, px + rad, py + rad], fill=(255, 255, 255, alpha_p), outline=(148, 163, 184, alpha_p))

    elif state == "smug" and frame_idx in (1, 2, 4):
        # Golden lens glint on his monocle
        draw.line([(172, 134), (186, 148)], fill=(254, 240, 138, 235), width=3)
        draw.line([(179, 131), (179, 151)], fill=(255, 255, 255, 235), width=2)

    return pil_frame


def build_arthur_texture_atlas(extracted, fw, fh):
    """
    Packs 30 frames (5 states × 6 frames) into a 6×5 sprite sheet (`arthur_atlas.png`)
    and writes a standard Phaser 3 JSON Hash Texture Atlas (`arthur_atlas.json`).
    """
    states = ["idle", "smug", "demand", "anger", "shock"]
    num_frames = 6
    atlas_w = fw * num_frames
    atlas_h = fh * len(states)
    atlas_img = Image.new("RGBA", (atlas_w, atlas_h), (0, 0, 0, 0))
    frames_meta = {}

    for row, st in enumerate(states):
        base_rgba, hat_info = extracted[st]
        for col in range(num_frames):
            frame_pil = deform_pose_frame(base_rgba, hat_info, st, col, num_frames)
            x = col * fw
            y = row * fh
            atlas_img.paste(frame_pil, (x, y))
            fname = f"{st}_{col}"
            frames_meta[fname] = {
                "frame": {"x": x, "y": y, "w": fw, "h": fh},
                "rotated": False,
                "trimmed": False,
                "spriteSourceSize": {"x": 0, "y": 0, "w": fw, "h": fh},
                "sourceSize": {"w": fw, "h": fh},
                "anchor": {"x": 0.5, "y": 0.95}
            }

    atlas_png_path = os.path.join(ASSETS_DIR, "atlases/arthur_atlas.png")
    atlas_json_path = os.path.join(ASSETS_DIR, "atlases/arthur_atlas.json")
    atlas_img.save(atlas_png_path, optimize=True)

    atlas_json = {
        "frames": frames_meta,
        "meta": {
            "app": "Due by Dusk Asset Pipeline",
            "version": "0.6.00",
            "image": "arthur_atlas.png",
            "format": "RGBA8888",
            "size": {"w": atlas_w, "h": atlas_h},
            "scale": "1"
        }
    }
    with open(atlas_json_path, "w", encoding="utf-8") as f:
        json.dump(atlas_json, f, indent=2)
    print(f"Built Arthur Texture Atlas: {atlas_w}x{atlas_h} ({len(frames_meta)} frames)")


def build_editable_arthur_svg():
    """
    Writes an editable SVG document (`public/assets/source/arthur_character_sheet.svg`)
    containing the 5 segmented high-resolution character pose layers and rig metadata.
    """
    svg = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 420" width="1600" height="420">
  <title>Arthur Grumble — Editable 5-Pose Layered Character Sheet (v0.6.00)</title>
  <desc>Separated RGBA character layers for Idle, Smug, Demand, Anger, and Shocked Defeat states.</desc>
  <g id="pose_0_idle" transform="translate(0,0)">
    <image href="arthur_poses/pose_0_idle.png" width="320" height="420"/>
  </g>
  <g id="pose_1_smug" transform="translate(320,0)">
    <image href="arthur_poses/pose_1_smug.png" width="320" height="420"/>
  </g>
  <g id="pose_2_demand" transform="translate(640,0)">
    <image href="arthur_poses/pose_2_demand.png" width="320" height="420"/>
  </g>
  <g id="pose_3_anger" transform="translate(960,0)">
    <image href="arthur_poses/pose_3_anger.png" width="320" height="420"/>
  </g>
  <g id="pose_4_shock" transform="translate(1280,0)">
    <image href="arthur_poses/pose_4_shock.png" width="320" height="420"/>
  </g>
</svg>
"""
    with open(os.path.join(ASSETS_DIR, "source/arthur_character_sheet.svg"), "w", encoding="utf-8") as f:
        f.write(svg)


def process_regional_environments():
    """
    Processes the 4 illustrated 21:9 regional background panoramas (CA, BR, FR, JP):
    1. Saves the full panorama (`env_<CODE>.png`, 1200x300)
    2. Creates a sky-keyed foreground/midground layer (`env_<CODE>_fg.png`, 1200x300)
       by flood-filling the top sky region so Phaser's dynamic sun arc, mountain-occluded
       god-rays, drifting clouds, and night stars render behind the illustrated mountains
       and buildings!
    """
    for code, raw_p in ENV_RAW.items():
        img_bgr = cv2.imread(raw_p)
        resized_bgr = cv2.resize(img_bgr, (1200, 300), interpolation=cv2.INTER_AREA)
        rgb = cv2.cvtColor(resized_bgr, cv2.COLOR_BGR2RGB)
        Image.fromarray(rgb).save(os.path.join(ASSETS_DIR, f"environments/env_{code}.png"), optimize=True)

        # Flood-fill sky from top edge (x = 0..1199, y = 0) with moderate color tolerance
        # so the illustrated mountains, aqueduct, Fuji cone, barn, grain elevator, fazenda,
        # and trees remain 100% opaque while the sky becomes semi-transparent/keyed for dynamic sky!
        h, w, _ = resized_bgr.shape
        mask = np.zeros((h + 2, w + 2), np.uint8)
        work = resized_bgr.copy()
        for x in range(0, w, 8):
            # Avoid starting flood-fill on top of left aqueduct/trees/grain elevator
            b, g, r = [int(v) for v in work[2, x]]
            # Sky pixels are bright and either blue-ish or warm cream-sky
            if (b > 165 and g > 155) or (r > 210 and g > 200 and b > 175):
                if mask[3, x + 1] == 0:
                    cv2.floodFill(work, mask, (x, 2), (0, 0, 0), (14, 14, 14), (14, 14, 14), cv2.FLOODFILL_MASK_ONLY | (255 << 8))

        sky_mask = mask[1:h+1, 1:w+1]
        # Never key below y = 175 (ground/pasture/fence)
        sky_mask[175:, :] = 0
        fg_alpha = 255 - sky_mask
        fg_alpha = cv2.GaussianBlur(fg_alpha, (5, 5), 1.0)

        rgba = np.dstack([rgb, fg_alpha])
        Image.fromarray(rgba).save(os.path.join(ASSETS_DIR, f"environments/env_{code}_fg.png"), optimize=True)
        print(f"Processed regional environment {code}: 1200x300 (full + sky-keyed midground)")


if __name__ == "__main__":
    extracted, fw, fh = extract_arthur_poses()
    build_arthur_texture_atlas(extracted, fw, fh)
    build_editable_arthur_svg()
    process_regional_environments()
    print("Asset pipeline completed successfully!")
