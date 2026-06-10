import os
import cv2
import numpy as np
from typing import List
from shapely import affinity
from shapely.geometry import Polygon
from tqdm import tqdm

# from .ballon_extractor import extract_ballon_region
from . import text_render
from ..font_fit import fit_font_size, font_high_cap
from ..bubble_association import balloon_occupancy
from ..safe_area import safe_area_box
from .text_render_eng import render_textblock_list_eng
from .text_render_pillow_eng import render_textblock_list_eng as render_textblock_list_eng_pillow
from ..utils import (
    BASE_PATH,
    TextBlock,
    color_difference,
    get_logger,
    rotate_polygons,
)

logger = get_logger('render')

def parse_font_paths(path: str, default: List[str] = None) -> List[str]:
    if path:
        parsed = path.split(',')
        parsed = list(filter(lambda p: os.path.isfile(p), parsed))
    else:
        parsed = default or []
    return parsed

def fg_bg_compare(fg, bg):
    fg_avg = np.mean(fg)
    if color_difference(fg, bg) < 30:
        bg = (255, 255, 255) if fg_avg <= 127 else (0, 0, 0)
    return fg, bg

def count_text_length(text: str) -> float:
    """Calculate text length, treating っッぁぃぅぇぉ as 0.5 characters"""
    half_width_chars = 'っッぁぃぅぇぉ'  
    length = 0.0
    for char in text.strip():
        if char in half_width_chars:
            length += 0.5
        else:
            length += 1.0
    return length

# #175 sizing safety: text was rendering too big and clipping at the balloon
# edge. _LINE_HEIGHT approximates real per-line height (ascent+descent ≈ 1.2×
# font) so the vertical fit isn't under-estimated; _FIT_MARGIN fits to 92% of the
# box so rounding/glyph slack can't touch the edge; _MAX_FONT_BOX_RATIO caps the
# font at half the box height so a short line in a big balloon isn't a giant.
_LINE_HEIGHT = 1.2
_FIT_MARGIN = 0.92
_MAX_FONT_BOX_RATIO = 0.5


def _bubble_fit_font_size(region, bubble_wh, max_box_ratio: float = _MAX_FONT_BOX_RATIO) -> int:
    """#166/#175: largest font whose wrapped translation fits the balloon box,
    measured with the renderer's own wrapper so the prediction matches the actual
    render — with a real line-height estimate, a fit margin, and a relative cap so
    the text fills the balloon without overflowing it. Render-parity C: a higher
    ``max_box_ratio`` lets short lines fill a tall balloon (MangaTranslator has no
    cap); the default reproduces the #175 0.5 cap byte-for-byte."""
    w_box, h_box = bubble_wh
    lang = getattr(region, 'target_lang', 'en_US')
    text = region.translation

    # Wrap to the *margin'd* width so the lines calc_horizontal produces are
    # never wider than the fit-test (which compares against w_box * margin) —
    # otherwise every size fails the margin check and the search floors at `low`
    # (#175 self-bug).
    mw, mh = int(w_box * _FIT_MARGIN), int(h_box * _FIT_MARGIN)

    def measure(size):
        lines, widths = text_render.calc_horizontal(
            size, text, max_width=mw, max_height=mh, language=lang)
        # Empty widths means nothing measurable wrapped — treat as "does not fit"
        # so the search floors at `low` instead of picking the max font (#bug-hunt).
        block_w = max(widths) if widths else float('inf')
        block_h = len(lines) * size * _LINE_HEIGHT
        return block_w, block_h

    high = font_high_cap(h_box, max_box_ratio, floor=8)
    return fit_font_size((w_box, h_box), measure, low=8, high=high, margin=_FIT_MARGIN)


def _bubble_interior_box(region, bubble_box, crop_shape):
    """#179: the safe-interior box + anchor for narrow-column wrapping.

    When the balloon polygon is carried (#170 → crop coords), rasterize it and
    measure the distance-transform safe interior so English wraps to the bubble's
    true (narrow) shape, not its bounding box. Falls back to the centered bounding
    box when no polygon is present (== pre-#179 behaviour)."""
    bx1, by1, bx2, by2 = bubble_box
    poly = getattr(region, 'bubble_polygon', None)
    if poly:
        h, w = crop_shape[:2]
        mask = np.zeros((h, w), dtype=np.uint8)
        pts = np.array([[int(round(px)), int(round(py))] for px, py in poly], dtype=np.int32)
        cv2.fillPoly(mask, [pts], 1)
        iw, ih, anchor = safe_area_box(mask)
        if iw > 1 and ih > 1:
            return iw, ih, anchor
    return int(bx2 - bx1), int(by2 - by1), ((bx1 + bx2) / 2.0, (by1 + by2) / 2.0)


def _expand_single_axis(region, needed_count: int, used_count: int, horizontal_axis: bool):
    """If the wrapped translation needs more lines than the detection box has,
    scale the region's unrotated min-rect along the text's wrap axis to make
    room and return the rotated int64 dst_points; else None.

    Shared by the horizontal (rows → x-axis) and vertical (cols → y-axis)
    expansion, which previously carried byte-identical scale/rotate/except blocks
    differing only in the line-count source and which axis is scaled. The caller
    passes horizontal_axis explicitly (not inferred from region.horizontal) so
    the original two-independent-`if` behaviour is preserved exactly.
    """
    if not (needed_count > used_count and used_count > 0):
        return None
    scale_x = ((needed_count - used_count) / used_count) * 1 + 1
    xfact, yfact = (scale_x, 1.0) if horizontal_axis else (1.0, scale_x)
    try:
        poly = Polygon(region.unrotated_min_rect[0])
        minx, miny, maxx, maxy = poly.bounds
        poly = affinity.scale(poly, xfact=xfact, yfact=yfact, origin=(minx, miny))
        pts = np.array(poly.exterior.coords[:4])
        dst_points = rotate_polygons(
            region.center, pts.reshape(1, -1), -region.angle, to_int=False
        ).reshape(-1, 4, 2)
        return dst_points.astype(np.int64)
    except Exception:
        return None


def resize_regions_to_font_size(img: np.ndarray, text_regions: List['TextBlock'], font_size_fixed: int, font_size_offset: int, font_size_minimum: int, bubble_fit: bool = False, font_max_box_ratio: float = _MAX_FONT_BOX_RATIO):
    """
    Adjust text region size to accommodate font size and translated text length.
    
    Args:  
        img: Input image
        text_regions: List of text regions to process
        font_size_fixed: Fixed font size (overrides other font parameters)
        font_size_offset: Font size offset
        font_size_minimum: Minimum font size (-1 for auto-calculation)

    Returns:  
        List of adjusted text region bounding boxes
    """    
    
    # Define minimum font size
    if font_size_minimum == -1:  
        font_size_minimum = round((img.shape[0] + img.shape[1]) / 200)  
    # logger.debug(f'font_size_minimum {font_size_minimum}')  
    font_size_minimum = max(1, font_size_minimum)  

    # #166: a fitted region is rendered into its *whole* balloon, so only the
    # sole occupant of a balloon may be fitted — two regions sharing one balloon
    # would otherwise stack on the same rect.
    occupancy = (balloon_occupancy([getattr(r, 'bubble_box', None) for r in text_regions])
                 if bubble_fit else None)

    dst_points_list = []
    for i, region in enumerate(text_regions):

        # #166 binary-search fit: when this region is the sole occupant of a known
        # balloon, size the font to fill the balloon box and render into that box.
        # This is the final word — it bypasses the length-ratio heuristic below so
        # the fitted size is never re-inflated past the balloon it was just fit to.
        # Only for horizontal targets (the wrapper measures horizontally); vertical,
        # balloon-less, and balloon-sharing regions fall through to legacy unchanged.
        bubble_box = getattr(region, 'bubble_box', None) if bubble_fit else None
        if (bubble_box is not None and region.horizontal and occupancy[i] == 1
                and region.translation and region.translation.strip()):
            # #179: wrap to the balloon's safe *interior* (narrow column) centered
            # on the safe anchor, not the full bounding box.
            fit_w, fit_h, (acx, acy) = _bubble_interior_box(region, bubble_box, img.shape)
            region.font_size = _bubble_fit_font_size(region, (fit_w, fit_h), font_max_box_ratio)
            hw, hh = fit_w / 2.0, fit_h / 2.0
            dst_points_list.append(
                np.array([[[acx - hw, acy - hh], [acx + hw, acy - hh],
                           [acx + hw, acy + hh], [acx - hw, acy + hh]]], dtype=np.int64))
            continue

        # Store and validate original font size
        original_region_font_size = region.font_size
        if original_region_font_size <= 0:  
            # logger.warning(f"Invalid original font size ({original_region_font_size}) for text '{region.translation}'. Using default value {font_size_minimum}.")  
            original_region_font_size = font_size_minimum

        # Determine target font size
        current_base_font_size = original_region_font_size  
        if font_size_fixed is not None:  
            target_font_size = font_size_fixed  
        else:  
            target_font_size = current_base_font_size + font_size_offset  

        target_font_size = max(target_font_size, font_size_minimum, 1)  
        # print("-" * 50)
        # logger.debug(f"Calculated target font size: {target_font_size} for text '{region.translation}'")  

        # Single-axis text box expansion
        single_axis_expanded = False
        dst_points = None
        
        if region.horizontal:
            line_text_list, _ = text_render.calc_horizontal(
                region.font_size,
                region.translation,
                max_width=region.unrotated_size[0],
                max_height=region.unrotated_size[1],
                language=getattr(region, "target_lang", "en_US")
            )
            expanded = _expand_single_axis(region, len(line_text_list), len(region.texts), True)
            if expanded is not None:
                dst_points = expanded
                single_axis_expanded = True

        if region.vertical:
            line_text_list, _ = text_render.calc_vertical(
                region.font_size,
                region.translation,
                max_height=region.unrotated_size[1],
            )
            expanded = _expand_single_axis(region, len(line_text_list), len(region.texts), False)
            if expanded is not None:
                dst_points = expanded
                single_axis_expanded = True

        # If single-axis expansion failed, use general scaling
        if not single_axis_expanded:
            # Calculate scaling factor based on text length ratio
            orig_text = getattr(region, "text_raw", region.text)
            char_count_orig = count_text_length(orig_text)
            char_count_trans = count_text_length(region.translation.strip())     
            length_ratio = 1.0

            if char_count_orig > 0 and char_count_trans > char_count_orig:  
                increase_percentage = (char_count_trans - char_count_orig) / char_count_orig
                font_increase_ratio = 1 + (increase_percentage * 0.3)
                font_increase_ratio = min(1.5, max(1.0, font_increase_ratio))
                # logger.debug(f"Translation is {increase_percentage:.2%} longer, font increase ratio: {font_increase_ratio:.2f}")
                target_font_size = int(target_font_size * font_increase_ratio)
                # logger.debug(f"Adjusted target font size: {target_font_size}")
                # Need greater bounding box scaling to accommodate larger font size and longer text
                target_scale = max(1, min(1 + increase_percentage * 0.3, 2))  # Possibly max(1, min(1 + (font_increase_ratio-1), 2))
                # logger.debug(f"Translation is longer than original and font increased, need larger bounding box scaling. Target scale factor: {target_scale:.2f}")
            # Short text box expansion is quite aggressive, in many cases short text boxes don't need expansion
            # elif char_count_orig > 0 and char_count_trans < char_count_orig:
            #     # Translation is shorter, increase font proportionally
            #     decrease_percentage = (char_count_orig - char_count_trans) / char_count_orig
            #     # Font increase ratio equals text reduction ratio
            #     font_increase_ratio = 1 + decrease_percentage
            #     # Limit font increase ratio to reasonable range, e.g., between 1.0 and 1.5
            #     font_increase_ratio = min(1.5, max(1.0, font_increase_ratio))
            #     logger.debug(f"Translation is {decrease_percentage:.2%} shorter than original, font increase ratio: {font_increase_ratio:.2f}")
            #     # Update target font size
            #     target_font_size = int(target_font_size * font_increase_ratio)
            #     logger.debug(f"Adjusted target font size: {target_font_size}")
            #     target_scale = 1.0  # No additional bounding box scaling needed
            #     logger.debug(f"Translation is shorter than original, no bounding box scaling applied, only font increase. Target scale factor: {target_scale:.2f}")            
            else:  
                target_scale = 1              
                # logger.debug(f"No length ratio scaling applied. Target scale factor: {target_scale:.2f}")   

            # Calculate final scaling factor
            font_size_scale = (((target_font_size - original_region_font_size) / original_region_font_size) * 0.4 + 1) if original_region_font_size > 0 else 1.0  
            # logger.debug(f"Font size ratio: ({target_font_size} / {original_region_font_size})")  
            final_scale = max(font_size_scale, target_scale)
            final_scale = max(1, min(final_scale, 1.1))  
            
            # logger.debug(f"Final scaling factor: {final_scale:.2f}")  

            # Scale bounding box if needed
            if final_scale > 1.001:  
                # logger.debug(f"Scaling bounding box: text='{region.translation}', scale={final_scale:.2f}")  
                try:  
                    poly = Polygon(region.unrotated_min_rect[0])  
                     # Scale from the center  
                    poly = affinity.scale(poly, xfact=final_scale, yfact=final_scale, origin='center')  
                    scaled_unrotated_points = np.array(poly.exterior.coords[:4])  

                    dst_points = rotate_polygons(region.center, scaled_unrotated_points.reshape(1, -1), -region.angle, to_int=False).reshape(-1, 4, 2)  
                    # 移除边界限制，允许文本超出检测框边界
                    # dst_points[..., 0] = dst_points[..., 0].clip(0, img.shape[1] - 1)  
                    # dst_points[..., 1] = dst_points[..., 1].clip(0, img.shape[0] - 1)  
                    dst_points = dst_points.astype(np.int64)  
                    dst_points = dst_points.reshape((-1, 4, 2))  
                    # logger.debug(f"Finished calculating scaled dst_points.")  

                except Exception as e:  
                    # logger.error(f"Error during scaling for text '{region.translation}': {e}. Using original min_rect.")  
                    dst_points = region.min_rect
            else:
                dst_points = region.min_rect

        # #183: when render parity is on, clamp the legacy dst to image bounds so
        # text may exceed the detection box but never render off the page (the
        # commented-out clip let off-canvas text be silently dropped, #bug-hunt).
        # bubble_fit off → unchanged (byte-identical).
        if bubble_fit and isinstance(dst_points, np.ndarray):
            dst_points = np.clip(
                dst_points, np.array([0, 0]),
                np.array([img.shape[1] - 1, img.shape[0] - 1]))

        # Store results and update font size
        dst_points_list.append(dst_points)
        region.font_size = int(target_font_size)

    return dst_points_list

async def dispatch(
    img: np.ndarray,
    text_regions: List[TextBlock],
    font_path: str = '',
    font_size_fixed: int = None,
    font_size_offset: int = 0,
    font_size_minimum: int = 0,
    hyphenate: bool = True,
    render_mask: np.ndarray = None,
    line_spacing: int = None,
    disable_font_border: bool = False,
    bubble_fit: bool = False,
    supersampling: int = 1,
    font_max_box_ratio: float = _MAX_FONT_BOX_RATIO
    ) -> np.ndarray:

    text_render.set_font(font_path)
    text_regions = list(filter(lambda region: region.translation, text_regions))

    # Resize regions that are too small
    dst_points_list = resize_regions_to_font_size(img, text_regions, font_size_fixed, font_size_offset, font_size_minimum, bubble_fit, font_max_box_ratio)

    # TODO: Maybe remove intersections

    # Render text
    for region, dst_points in tqdm(zip(text_regions, dst_points_list), '[render]', total=len(text_regions)):
        if render_mask is not None:
            # set render_mask to 1 for the region that is inside dst_points
            cv2.fillConvexPoly(render_mask, dst_points.astype(np.int32), 1)
        img = render(img, region, dst_points, hyphenate, line_spacing, disable_font_border, supersampling)
    return img

def render(
    img,
    region: TextBlock,
    dst_points,
    hyphenate,
    line_spacing,
    disable_font_border,
    supersampling: int = 1
):
    # #181: render the text canvas at `ss`× then downscale → crisp glyphs +
    # controlled weight (ss=1 → byte-identical).
    ss = max(1, int(supersampling))
    fg, bg = region.get_font_colors()
    fg, bg = fg_bg_compare(fg, bg)

    if disable_font_border :
        bg = None

    middle_pts = (dst_points[:, [1, 2, 3, 0]] + dst_points) / 2
    norm_h = np.linalg.norm(middle_pts[:, 1] - middle_pts[:, 3], axis=1)
    norm_v = np.linalg.norm(middle_pts[:, 2] - middle_pts[:, 0], axis=1)
    r_orig = np.mean(norm_h / norm_v)

    # If configuration is set to non-automatic mode, use configuration to determine direction directly
    forced_direction = region._direction if hasattr(region, "_direction") else region.direction
    if forced_direction != "auto":
        if forced_direction in ["horizontal", "h"]:
            render_horizontally = True
        elif forced_direction in ["vertical", "v"]:
            render_horizontally = False
        else:
            render_horizontally = region.horizontal
    else:
        render_horizontally = region.horizontal

    #print(f"Region text: {region.text}, forced_direction: {forced_direction}, render_horizontally: {render_horizontally}")

    if render_horizontally:
        temp_box = text_render.put_text_horizontal(
            region.font_size * ss,
            region.get_translation_for_rendering(),
            round(norm_h[0] * ss),
            round(norm_v[0] * ss),
            region.alignment,
            region.direction == 'hl',
            fg,
            bg,
            region.target_lang,
            hyphenate,
            line_spacing,
        )
    else:
        temp_box = text_render.put_text_vertical(
            region.font_size * ss,
            region.get_translation_for_rendering(),
            round(norm_v[0] * ss),
            region.alignment,
            fg,
            bg,
            line_spacing,
        )
    if ss > 1:
        temp_box = cv2.resize(
            temp_box,
            (max(1, temp_box.shape[1] // ss), max(1, temp_box.shape[0] // ss)),
            interpolation=cv2.INTER_AREA,
        )
    h, w, _ = temp_box.shape
    r_temp = w / h

    # Extend temporary box so that it has same ratio as original
    box = None  
    #print("\n" + "="*50)  
    #print(f"Processing text: \"{region.get_translation_for_rendering()}\"")  
    #print(f"Text direction: {'Horizontal' if region.horizontal else 'Vertical'}")  
    #print(f"Font size: {region.font_size}, Alignment: {region.alignment}")  
    #print(f"Target language: {region.target_lang}")      
    #print(f"Region horizontal: {region.horizontal}")  
    #print(f"Starting image adjustment: r_temp={r_temp}, r_orig={r_orig}, h={h}, w={w}")  
    if render_horizontally:  # use effective direction, not raw detected orientation (#110 R-1)
        #print("Processing HORIZONTAL region")
        
        if r_temp > r_orig:   
            #print(f"Case: r_temp({r_temp}) > r_orig({r_orig}) - Need vertical padding")  
            h_ext = int((w / r_orig - h) // 2) if r_orig > 0 else 0  
            #print(f"Calculated h_ext = {h_ext}")  
            
            if h_ext >= 0:  
                #print(f"Creating new box with dimensions: {h + h_ext * 2}x{w}")  
                box = np.zeros((h + h_ext * 2, w, 4), dtype=np.uint8)  
                #print(f"Placing temp_box at position [h_ext:h_ext+h, :w] = [{h_ext}:{h_ext+h}, 0:{w}]")  
                # Columns fully filled, rows centered
                box[h_ext:h_ext+h, 0:w] = temp_box  
            else:  
                #print("h_ext < 0, using original temp_box")  
                box = temp_box.copy()  
        else:   
            #print(f"Case: r_temp({r_temp}) <= r_orig({r_orig}) - Need horizontal padding")  
            w_ext = int((h * r_orig - w) // 2)  
            #print(f"Calculated w_ext = {w_ext}")  
            
            if w_ext >= 0:  
                #print(f"Creating new box with dimensions: {h}x{w + w_ext * 2}")  
                box = np.zeros((h, w + w_ext * 2, 4), dtype=np.uint8)  
                #print(f"Placing temp_box at position [:, :w] = [0:{h}, 0:{w}]")  
         
                # The line is full, and there should be no empty columns on the left side of the text. Otherwise, when multiple text boxes are aligned on the left, the translated text cannot be aligned. Common scenarios: borderless comics, comic postscript.  
                # When there are bubbles on the current page, it can be changed to center: box[0:h, w_ext:w_ext+w] = temp_box, requiring more accurate bubble detection. But not changing it doesn't have much impact.
                box[0:h, 0:w] = temp_box  
            else:  
                #print("w_ext < 0, using original temp_box")  
                box = temp_box.copy()  
    else:  
        #print("Processing VERTICAL region")  
        
        if r_temp > r_orig:   
            #print(f"Case: r_temp({r_temp}) > r_orig({r_orig}) - Need vertical padding")  
            h_ext = int(w / (2 * r_orig) - h / 2) if r_orig > 0 else 0   
            #print(f"Calculated h_ext = {h_ext}")  
            
            if h_ext >= 0:   
                #print(f"Creating new box with dimensions: {h + h_ext * 2}x{w}")  
                box = np.zeros((h + h_ext * 2, w, 4), dtype=np.uint8)  
                #print(f"Placing temp_box at position [0:h, 0:w] = [0:{h}, 0:{w}]")  
                # The rows are full, and there should be no empty lines above the text; otherwise, when multiple text boxes have their top edges aligned, the text cannot be aligned. Common scenario: borderless comics, CG. 
                # When there are bubbles on the current page, it can be changed to center: box[h_ext:h_ext+h, 0:w] = temp_box, requiring more accurate bubble detection.
                box[0:h, 0:w] = temp_box  
            else:   
                #print("h_ext < 0, using original temp_box")  
                box = temp_box.copy()   
        else:   
            #print(f"Case: r_temp({r_temp}) <= r_orig({r_orig}) - Need horizontal padding")  
            w_ext = int((h * r_orig - w) / 2)  
            #print(f"Calculated w_ext = {w_ext}")  
            
            if w_ext >= 0:  
                #print(f"Creating new box with dimensions: {h}x{w + w_ext * 2}")  
                box = np.zeros((h, w + w_ext * 2, 4), dtype=np.uint8)  
                #print(f"Placing temp_box at position [0:h, w_ext:w_ext+w] = [0:{h}, {w_ext}:{w_ext+w}]") 
                # Rows are fully filled, columns are centered
                box[0:h, w_ext:w_ext+w] = temp_box  
            else:   
                #print("w_ext < 0, using original temp_box")  
                box = temp_box.copy()   
    #print(f"Final box dimensions: {box.shape if box is not None else 'None'}")  

    src_points = np.array([[0, 0], [box.shape[1], 0], [box.shape[1], box.shape[0]], [0, box.shape[0]]]).astype(np.float32)
    #src_pts[:, 0] = np.clip(np.round(src_pts[:, 0]), 0, enlarged_w * 2)
    #src_pts[:, 1] = np.clip(np.round(src_pts[:, 1]), 0, enlarged_h * 2)

    M, _ = cv2.findHomography(src_points, dst_points, cv2.RANSAC, 5.0)
    if M is None:  # degenerate/collinear dst_points (#110 R-2)
        logger.debug('findHomography returned None (degenerate region), skipping warp')
        return img
    rgba_region = cv2.warpPerspective(box, M, (img.shape[1], img.shape[0]), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    x, y, w, h = cv2.boundingRect(dst_points.astype(np.int32))
    x0 = max(0, x)
    y0 = max(0, y)
    x1 = min(img.shape[1], x + w)
    y1 = min(img.shape[0], y + h)
    if x1 <= x0 or y1 <= y0:
        return img

    canvas_region = rgba_region[y0:y1, x0:x1, :3]
    mask_region = rgba_region[y0:y1, x0:x1, 3:4].astype(np.float32) / 255.0
    img[y0:y1, x0:x1] = np.clip(
        (img[y0:y1, x0:x1].astype(np.float32) * (1 - mask_region) + canvas_region.astype(np.float32) * mask_region),
        0,
        255,
    ).astype(np.uint8)
    return img

async def dispatch_eng_render(img_canvas: np.ndarray, original_img: np.ndarray, text_regions: List[TextBlock], font_path: str = '', line_spacing: int = 0, disable_font_border: bool = False) -> np.ndarray:
    if len(text_regions) == 0:
        return img_canvas

    if not font_path:
        font_path = os.path.join(BASE_PATH, 'fonts/comic shanns 2.ttf')
    text_render.set_font(font_path)

    return render_textblock_list_eng(img_canvas, text_regions, line_spacing=line_spacing, size_tol=1.2, original_img=original_img, downscale_constraint=0.8,disable_font_border=disable_font_border)

async def dispatch_eng_render_pillow(img_canvas: np.ndarray, original_img: np.ndarray, text_regions: List[TextBlock], font_path: str = '', line_spacing: int = 0, disable_font_border: bool = False) -> np.ndarray:
    if len(text_regions) == 0:
        return img_canvas

    if not font_path:
        font_path = os.path.join(BASE_PATH, 'fonts/NotoSansMonoCJK-VF.ttf.ttc')
    text_render.set_font(font_path)

    return render_textblock_list_eng_pillow(font_path, img_canvas, text_regions, original_img=original_img, downscale_constraint=0.95)
