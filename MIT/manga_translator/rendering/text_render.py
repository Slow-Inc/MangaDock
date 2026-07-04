import os
import re
import cv2
import numpy as np
import freetype
import functools
import logging
from pathlib import Path
from typing import Tuple, Optional, List, Protocol
from hyphen import Hyphenator
from hyphen.dictools import LANGUAGES as HYPHENATOR_LANGUAGES
from langcodes import standardize_tag

from ..utils import BASE_PATH, is_punctuation
from ..line_break import find_optimal_line_breaks

# ── Thai word segmentation (optional) ────────────────────────────────────────
_THAI_RE = re.compile(r'[\u0E00-\u0E7F]')
_ZWSP = '\u200b'
try:
    from pythainlp.tokenize import word_tokenize as _thai_tokenize
    _HAS_PYTHAINLP = True
except ImportError:
    _HAS_PYTHAINLP = False

# ── Chinese word segmentation (optional) ─────────────────────────────────────
_CJK_RE = re.compile(r'[一-鿿㐀-䶿]')   # CJK Unified Ideographs (Simplified + Traditional)
try:
    import jieba as _jieba
    _HAS_JIEBA = True
except ImportError:
    _HAS_JIEBA = False


def _insert_cjk_word_breaks(text: str) -> str:
    """If text contains Chinese ideographs, segment it with jieba and insert zero-width spaces
    between tokens so calc_horizontal wraps on word boundaries instead of breaking mid-word.
    Chinese has no spaces, so without this the wrapper falls back to a per-character split."""
    if not _HAS_JIEBA or not _CJK_RE.search(text):
        return text
    try:
        tokens = [t for t in _jieba.cut(text, cut_all=False) if t.strip()]
        return _ZWSP.join(tokens) if len(tokens) > 1 else text
    except Exception:
        return text


# Thai non-spacing marks that must never start a line: they attach to the
# preceding base consonant (above/below vowels + tone marks). Splitting between
# a base char and one of these orphans the mark and corrupts the rendered glyph.
_THAI_COMBINING = frozenset(
    [chr(0x0E31)]                              # MAI HAN-AKAT
    + [chr(c) for c in range(0x0E34, 0x0E3B)]  # SARA I..U + PHINTHU
    + [chr(c) for c in range(0x0E47, 0x0E4F)]  # MAITAIKHU..YAMAKKAN (incl. tone marks)
)


def _safe_char_split(s: str) -> List[str]:
    """Split a string into renderable clusters, keeping Thai combining marks
    attached to their preceding base character. Equivalent to list(s) for text
    with no Thai marks. Used as the last-resort break unit so wrapping never
    orphans a Thai mark even when a single token exceeds the line width."""
    clusters: List[str] = []
    for ch in s:
        if ch in _THAI_COMBINING and clusters:
            clusters[-1] += ch
        else:
            clusters.append(ch)
    return clusters


def _insert_thai_word_breaks(text: str) -> str:
    """If text contains Thai characters, segment it with pythainlp and
    insert zero-width spaces between tokens so calc_horizontal can wrap on
    word boundaries without introducing visible spaces in rendered Thai text."""
    if not _HAS_PYTHAINLP or not _THAI_RE.search(text):
        return text
    try:
        tokens = _thai_tokenize(text, engine='newmm', keep_whitespace=False)
        return _ZWSP.join(t for t in tokens if t.strip())
    except Exception:
        return text
# ─────────────────────────────────────────────────────────────────────────────

try:
    HYPHENATOR_LANGUAGES.remove('fr')
    HYPHENATOR_LANGUAGES.append('fr_FR')
except Exception:
    pass

CJK_H2V = {
    "‥": "︰",
    "—": "︱",
    "―": "|",
    "–": "︲",
    "_": "︳",
    "_": "︴",
    "(": "︵",
    ")": "︶",
    "（": "︵",
    "）": "︶",
    "{": "︷",
    "}": "︸",
    "〔": "︹",
    "〕": "︺",
    "【": "︻",
    "】": "︼",
    "《": "︽",
    "》": "︾",
    "〈": "︿",
    "〉": "﹀",
    "⟨": "︿",   
    "⟩": "﹀",   
    "⟪": "︿",   
    "⟫": "﹀",       
    "「": "﹁",
    "」": "﹂",
    "『": "﹃",
    "』": "﹄",
    "﹑": "﹅",
    "﹆": "﹆",
    "[": "﹇",
    "]": "﹈",
    "⦅": "︵",   
    "⦆": "︶",   
    "❨": "︵",          
    "❩": "︶",   
    "❪": "︷",   
    "❫": "︸",   
    "❬": "﹇",   
    "❭": "﹈",   
    "❮": "︿",   
    "❯": "﹀",    
    "﹉": "﹉",
    "﹊": "﹊",
    "﹋": "﹋",
    "﹌": "﹌",
    "﹍": "﹍",
    "﹎": "﹎",
    "﹏": "﹏",
    "…": "⋮",
    "⋯": "︙", 
    "⋰": "⋮",    
    "⋱": "⋮",           
    """: "﹁",   
    """: "﹂",   
    "'": "﹁",   
    "'": "﹂",   
    "″": "﹂",   
    "‴": "﹂",   
    "‶": "﹁",   
    "‷": "﹁",   
    "~": "︴",   
    "〜": "︴",   
    "～": "︴",   
    "~": "≀",
    "〰": "︴",
    "!": "︕",    
    "?": "︖",    
    "؟": "︖",    
    "¿": "︖",    
    "¡": "︕",    
    ".": "︒",    
    "。": "︒",   
    ";": "︔",    
    "；": "︔",   
    ":": "︓",    
    "：": "︓",  
    ",": "︐",    
    "，": "︐",   
    # "､": "︐",    
    "‚": "︐",    
    "„": "︐",    
    #"、": "︑",    
    "-": "︲",    
    "−": "︲",
    "・": "·",          
}

CJK_V2H = {
    **dict(zip(CJK_H2V.items(), CJK_H2V.keys())),
}

logger = logging.getLogger(__name__)  
logger.addHandler(logging.NullHandler())  

def CJK_Compatibility_Forms_translate(cdpt: str, direction: int):
    """direction: 0 - horizontal, 1 - vertical"""
    if cdpt == 'ー' and direction == 1:
        return 'ー', 90
    if cdpt in CJK_V2H:
        if direction == 0:
            # translate
            return CJK_V2H[cdpt], 0
        else:
            return cdpt, 0
    elif cdpt in CJK_H2V:
        if direction == 1:
            # translate
            return CJK_H2V[cdpt], 0
        else:
            return cdpt, 0
    return cdpt, 0

def compact_special_symbols(text: str) -> str:  
    text = text.replace('...', '…')  
    text = text.replace('..', '…')      
    # Remove half-width and full-width spaces after each punctuation mark
    pattern = r'([^\w\s])[ \u3000]+'  
    text = re.sub(pattern, r'\1', text) 
    return text
    
def rotate_image(image, angle):
    if angle == 0:
        return image, (0, 0)
    image_exp = np.zeros((round(image.shape[0] * 1.5), round(image.shape[1] * 1.5), image.shape[2]), dtype = np.uint8)
    diff_i = (image_exp.shape[0] - image.shape[0]) // 2
    diff_j = (image_exp.shape[1] - image.shape[1]) // 2
    image_exp[diff_i:diff_i+image.shape[0], diff_j:diff_j+image.shape[1]] = image
    # from https://stackoverflow.com/questions/9041681/opencv-python-rotate-image-by-x-degrees-around-specific-point
    image_center = tuple(np.array(image_exp.shape[1::-1]) / 2)
    rot_mat = cv2.getRotationMatrix2D(image_center, angle, 1.0)
    result = cv2.warpAffine(image_exp, rot_mat, image_exp.shape[1::-1], flags=cv2.INTER_LINEAR)
    if angle == 90:
        return result, (0, 0)
    return result, (diff_i, diff_j)

def add_color(bw_char_map, color, stroke_char_map, stroke_color):
    if bw_char_map.size == 0:
        fg = np.zeros((bw_char_map.shape[0], bw_char_map.shape[1], 4), dtype = np.uint8)
        return fg
    
    # print(bw_char_map.shape, stroke_char_map.shape)
    # import matplotlib.pyplot as plt
    # x1, y1, w1, h1 = cv2.boundingRect(bw_char_map)
    # x2, y2, w2, h2 = cv2.boundingRect(stroke_char_map)
    # fig, ax = plt.subplots(1, 2)
    # ax[0].imshow(bw_char_map)
    # ax[1].imshow(stroke_char_map)
    # # draw bounding boxes
    # rect1 = plt.Rectangle((x1, y1), w1, h1, fill=False, color='red')
    # rect2 = plt.Rectangle((x2, y2), w2, h2, fill=False, color='blue')
    # ax[0].add_patch(rect1)
    # ax[0].add_patch(rect2)
    # rect1 = plt.Rectangle((x1, y1), w1, h1, fill=False, color='red')
    # rect2 = plt.Rectangle((x2, y2), w2, h2, fill=False, color='blue')
    # ax[1].add_patch(rect1)
    # ax[1].add_patch(rect2)
    # plt.show()

    # since bg rect is always larger than fg rect, we can just use the bg rect
    if stroke_color is None :
        x, y, w, h = cv2.boundingRect(bw_char_map)
    else :
        x, y, w, h = cv2.boundingRect(stroke_char_map)

    fg = np.zeros((h, w, 4), dtype = np.uint8)
    fg[:,:,0] = color[0]
    fg[:,:,1] = color[1]
    fg[:,:,2] = color[2]
    fg[:,:,3] = bw_char_map[y:y+h, x:x+w]

    if stroke_color is None :
        stroke_color = color
    bg = np.zeros((stroke_char_map.shape[0], stroke_char_map.shape[1], 4), dtype = np.uint8)
    bg[:,:,0] = stroke_color[0]
    bg[:,:,1] = stroke_color[1]
    bg[:,:,2] = stroke_color[2]
    bg[:,:,3] = stroke_char_map

    fg_alpha = fg[:, :, 3] / 255.0
    bg_alpha = 1.0 - fg_alpha
    bg[y:y+h, x:x+w, :] = (fg_alpha[:, :, np.newaxis] * fg[:, :, :] + bg_alpha[:, :, np.newaxis] * bg[y:y+h, x:x+w, :])

    #alpha_char_map = cv2.add(bw_char_map, stroke_char_map)
    #alpha_char_map[alpha_char_map > 0] = 255
    return bg#, alpha_char_map

FALLBACK_FONTS = [
    os.path.join(BASE_PATH, 'fonts/Arial-Unicode-Regular.ttf'),
    os.path.join(BASE_PATH, 'fonts/msyh.ttc'),
    os.path.join(BASE_PATH, 'fonts/msgothic.ttc'),
]
FONT_SELECTION: List[freetype.Face] = []
font_cache = {}
def get_cached_font(path: str) -> freetype.Face:
    path = path.replace('\\', '/')
    if not font_cache.get(path):
        # To circumvent a bug with non ascii paths in windows use memory fonts
        # https://github.com/rougier/freetype-py/issues/157#issuecomment-1683713726
        font_cache[path] = freetype.Face(Path(path).open('rb'))
    return font_cache[path]

def set_font(font_path: str):
    global FONT_SELECTION
    if font_path:
        selection = [font_path] + FALLBACK_FONTS
    else:
        selection = FALLBACK_FONTS
    FONT_SELECTION = [get_cached_font(p) for p in selection]

class namespace:
    pass

class Glyph:
    def __init__(self, glyph):
        self.bitmap = namespace()
        self.bitmap.buffer = glyph.bitmap.buffer
        self.bitmap.rows = glyph.bitmap.rows
        self.bitmap.width = glyph.bitmap.width
        self.advance = namespace()
        self.advance.x = glyph.advance.x
        self.advance.y = glyph.advance.y
        self.bitmap_left = glyph.bitmap_left
        self.bitmap_top = glyph.bitmap_top
        self.metrics = namespace()
        self.metrics.vertBearingX = glyph.metrics.vertBearingX
        self.metrics.vertBearingY = glyph.metrics.vertBearingY
        self.metrics.horiBearingX = glyph.metrics.horiBearingX
        self.metrics.horiBearingY = glyph.metrics.horiBearingY
        self.metrics.horiAdvance = glyph.metrics.horiAdvance
        self.metrics.vertAdvance = glyph.metrics.vertAdvance

def _select_face_for_char(cdpt: str, font_size: int, direction: int) -> freetype.Face:
    """Pick the first FONT_SELECTION face that has a glyph for ``cdpt`` (falling
    back to the last face when none cover it), size it for the given direction
    (0 = horizontal, 1 = vertical), and return it.

    Shared fallback loop for get_char_glyph / get_char_border, which previously
    carried byte-identical copies differing only in the subsequent load_char
    flags and the value they extract.
    """
    for i, face in enumerate(FONT_SELECTION):
        if face.get_char_index(cdpt) == 0 and i != len(FONT_SELECTION) - 1:
            continue
        if direction == 0:
            face.set_pixel_sizes(0, font_size)
        elif direction == 1:
            face.set_pixel_sizes(font_size, 0)
        return face


@functools.lru_cache(maxsize = 1024, typed = True)
def get_char_glyph(cdpt: str, font_size: int, direction: int) -> Glyph:
    face = _select_face_for_char(cdpt, font_size, direction)
    face.load_char(cdpt)
    return Glyph(face.glyph)

#@functools.lru_cache(maxsize = 1024, typed = True)
def get_char_border(cdpt: str, font_size: int, direction: int):
    face = _select_face_for_char(cdpt, font_size, direction)
    face.load_char(cdpt, freetype.FT_LOAD_DEFAULT | freetype.FT_LOAD_NO_BITMAP)
    return face.glyph.get_glyph()

# def get_char_kerning(cdpt, prev, font_size: int, direction: int):
#     global FONT_SELECTION
#     for i, face in enumerate(FONT_SELECTION):
#         if face.get_char_index(cdpt) == 0 and i != len(FONT_SELECTION) - 1:
#             continue
#         if direction == 0:
#             face.set_pixel_sizes(0, font_size)
#         elif direction == 1:
#             face.set_pixel_sizes(font_size, 0)
#         face.load_char(cdpt, freetype.FT_LOAD_DEFAULT | freetype.FT_LOAD_NO_BITMAP)
#         #print("VV", prev, cdpt, face.get_char_index(prev), face.get_char_index(cdpt))
#         print("VR", face.has_kerning)
#         return face.get_kerning(face.get_char_index(prev), face.get_char_index(cdpt))

def calc_vertical(font_size: int, text: str, max_height: int):
    line_text_list = []
    # line_width_list = []
    line_height_list = []

    line_str = ""
    line_height = 0
    line_width_left = 0
    line_width_right = 0
    for i, cdpt in enumerate(text):
        if line_height == 0 and cdpt == ' ':
            continue
        cdpt, rot_degree = CJK_Compatibility_Forms_translate(cdpt, 1)
        ckpt = get_char_glyph(cdpt, font_size, 1)
        bitmap = ckpt.bitmap
        # spaces, etc
        if bitmap.rows * bitmap.width == 0 or len(bitmap.buffer) != bitmap.rows * bitmap.width:
            char_offset_y = ckpt.metrics.vertBearingY >> 6
        else:
            char_offset_y = ckpt.metrics.vertAdvance >> 6
        char_width = bitmap.width
        char_bearing_x = ckpt.metrics.vertBearingX >> 6
        if line_height + char_offset_y > max_height:
            line_text_list.append(line_str)
            line_height_list.append(line_height)
            # line_width_list.append(line_width_left + line_width_right)
            line_str = ""
            line_height = 0
            line_width_left = 0
            line_width_right = 0
        line_height += char_offset_y
        line_str += cdpt
        line_width_left = max(line_width_left, abs(char_bearing_x))
        line_width_right = max(line_width_right, char_width - abs(char_bearing_x))
    # last char
    line_text_list.append(line_str)
    line_height_list.append(line_height)
    # line_width_list.append(line_width_left + line_width_right)

    # box_calc_x = sum(line_width_list) + (len(line_width_list) - 1) * spacing_x
    # box_calc_y = max(line_height_list)
    return line_text_list, line_height_list

def _render_glyph_stroke(cdpt: str, font_size: int, direction: int) -> Optional[np.ndarray]:
    """Render the stroked (border) glyph for ``cdpt`` as a uint8 bitmap, or
    ``None`` if the stroke bitmap is empty/invalid.

    Shared by put_char_horizontal/put_char_vertical: the freetype stroker setup
    (radius = 64·max(int(0.07·font_size), 1), round join + round cap) and the
    bitmap validity check were byte-identical copies in both; ``direction``
    selects the horizontal (0) / vertical (1) face orientation.
    """
    glyph_border = get_char_border(cdpt, font_size, direction)
    stroker = freetype.Stroker()
    stroke_radius = 64 * max(int(0.07 * font_size), 1)  # 1/64 px units
    stroker.set(stroke_radius, freetype.FT_STROKER_LINEJOIN_ROUND, freetype.FT_STROKER_LINECAP_ROUND, 0)
    glyph_border.stroke(stroker, destroy=True)
    blyph = glyph_border.to_bitmap(freetype.FT_RENDER_MODE_NORMAL, freetype.Vector(0, 0), True)
    bitmap_b = blyph.bitmap
    rows, width = bitmap_b.rows, bitmap_b.width
    if rows * width > 0 and len(bitmap_b.buffer) == rows * width:
        return np.array(bitmap_b.buffer, dtype=np.uint8).reshape((rows, width))
    return None


def _paste_bitmap(canvas: np.ndarray, bitmap: np.ndarray, place_x: int, place_y: int, blend) -> None:
    """Blend a glyph/stroke bitmap onto ``canvas`` with its top-left at
    (place_x, place_y), clipping to the canvas bounds and skipping the matching
    source rows/cols when the placement runs off the top/left edge.

    Shared by the four paste sites in put_char_horizontal/vertical: the char
    paste passes ``blend=np.maximum`` (so combining marks accumulate instead of
    overwriting the base glyph), the stroke paste passes ``blend=cv2.add``.
    Replaces four near-identical clip+slice+blend copies; the vertical stroke
    paste previously clamped the source origin to (0,0) instead of offsetting
    the source slice, so a stroke clipped off the top/left edge was misaligned
    (a latent bug, unreachable on padded render canvases) — this unification
    gives all four sites the same correct clipping.
    """
    rows, width = bitmap.shape
    y_start = max(0, place_y)
    x_start = max(0, place_x)
    y_end = min(canvas.shape[0], place_y + rows)
    x_end = min(canvas.shape[1], place_x + width)
    if y_start >= y_end or x_start >= x_end:
        return
    src = bitmap[y_start - place_y : y_end - place_y, x_start - place_x : x_end - place_x]
    target = canvas[y_start:y_end, x_start:x_end]
    if src.size > 0 and src.shape == target.shape:
        canvas[y_start:y_end, x_start:x_end] = blend(target, src)


def put_char_vertical(font_size: int, cdpt: str, pen_l: Tuple[int, int], canvas_text: np.ndarray, canvas_border: np.ndarray, border_size: int):  
    """  
    在画布上垂直放置一个字符，并可选地添加描边效果。  
    Vertically place a character on the canvas with optional border effect.  
    
    Args:  
        font_size: 字体大小 / Font size  
        cdpt: 要渲染的字符 / Character to render  
        pen_l: 笔的位置（起始绘制位置） / Pen position (starting drawing position)  
        canvas_text: 用于绘制文本的NumPy数组 / NumPy array for drawing text  
        canvas_border: 用于绘制描边的NumPy数组 / NumPy array for drawing border  
        border_size: 描边大小 / Border size  
        
    Returns:  
        int: 垂直步进值 / Vertical advance value  
    """  
    # 复制笔位置，避免修改原始值  
    # Copy pen position to avoid modifying the original value  
    pen = pen_l.copy()  

    # 检查是否是标点符号  
    # Check if the character is a punctuation  
    is_pun = is_punctuation(cdpt)  
    
    # 处理CJK兼容形式转换，并获取旋转角度  
    # Process CJK compatibility forms translation and get rotation degree  
    cdpt, rot_degree = CJK_Compatibility_Forms_translate(cdpt, 1)  
    
    # 获取字符字形  
    # Get character glyph  
    slot = get_char_glyph(cdpt, font_size, 1)  
    bitmap = slot.bitmap  # 这是原始字符的 bitmap 对象 / This is the bitmap object of the original character  

    # --- 获取原始字符位图信息 / Get original character bitmap information ---  
    char_bitmap_rows = bitmap.rows  
    char_bitmap_width = bitmap.width  
    
    # 检查位图是否有效（如空格等字符可能没有有效位图）  
    # Check if the bitmap is valid (characters like spaces may not have valid bitmaps)  
    if char_bitmap_rows * char_bitmap_width == 0 or len(bitmap.buffer) != char_bitmap_rows * char_bitmap_width:  
        # 对于无效位图（如空格），计算垂直步进 char_offset_y  
        # For invalid bitmaps (like spaces), calculate vertical advance char_offset_y  

        # 优先使用 vertAdvance (这是最适合垂直布局的)  
        # Prefer to use vertAdvance (this is most suitable for vertical layout)  
        if hasattr(slot, 'metrics') and hasattr(slot.metrics, 'vertAdvance') and slot.metrics.vertAdvance:  
             char_offset_y = slot.metrics.vertAdvance >> 6  
        # 其次尝试 advance.y (理论上 vertAdvance 更可靠)  
        # Then try advance.y (theoretically vertAdvance is more reliable)  
        elif hasattr(slot, 'advance') and slot.advance.y:  
             char_offset_y = slot.advance.y >> 6  
        # 再次尝试 vertBearingY (作为最后的度量回退，虽然不是步进值)  
        # Then try vertBearingY (as a last metric fallback, although not an advance value)  
        elif hasattr(slot, 'metrics') and hasattr(slot.metrics, 'vertBearingY'):  
             char_offset_y = slot.metrics.vertBearingY >> 6  
        # 最后的手段：使用 font_size 作为估算值  
        # Last resort: use font_size as an estimated value  
        else:  
             char_offset_y = font_size  

        # 对于空白字符等，只返回垂直步进距离  
        # For whitespace characters, just return the vertical advance  
        return char_offset_y  

    # --- 对于有效位图，正常处理 / For valid bitmaps, process normally ---  
    # 这里的 char_offset_y 应该是最终的垂直步进  
    # Here char_offset_y should be the final vertical advance  
    char_offset_y = slot.metrics.vertAdvance >> 6  

    # 将位图缓冲区转换为NumPy数组  
    # Convert bitmap buffer to NumPy array  
    bitmap_char = np.array(bitmap.buffer, dtype=np.uint8).reshape((char_bitmap_rows, char_bitmap_width))  

    # --- 计算原始字符在画布上的放置位置 (左上角) ---  
    # --- Calculate the placement position of the original character on canvas (top-left corner) ---  
    # 注意：这里的 pen[0] 和 pen[1] 是放置 bitmap_char 的左上角参考点  
    # Note: pen[0] and pen[1] are the top-left reference points for placing bitmap_char  
    char_place_x = pen[0] + (slot.metrics.vertBearingX >> 6)  
    char_place_y = pen[1] + (slot.metrics.vertBearingY >> 6)   

    _paste_bitmap(canvas_text, bitmap_char, char_place_x, char_place_y, np.maximum)

    # --- 处理描边 / Process border ---  
    if border_size > 0:  
        bitmap_border = _render_glyph_stroke(cdpt, font_size, 1)
        if bitmap_border is not None:
            border_bitmap_rows, border_bitmap_width = bitmap_border.shape

            # --- 计算描边位图放置位置，使其中心与原始字符位图中心对齐 ---  
            # --- Calculate border bitmap placement position to align its center with the original character bitmap center ---  
            
            # 原始字符位图中心偏移 (相对于其左上角)  
            # Original character bitmap center offset (relative to its top-left corner)  
            char_center_offset_x = char_bitmap_width / 2.0  
            char_center_offset_y = char_bitmap_rows / 2.0  
            
            # 描边位图中心偏移 (相对于其左上角)  
            # Border bitmap center offset (relative to its top-left corner)  
            border_center_offset_x = border_bitmap_width / 2.0  
            border_center_offset_y = border_bitmap_rows / 2.0  

            # 原始字符中心在画布上的坐标  
            # Coordinates of the original character center on canvas  
            char_center_on_canvas_x = char_place_x + char_center_offset_x  
            char_center_on_canvas_y = char_place_y + char_center_offset_y  

            # 计算描边位图的左上角放置位置 (pen_border)，使得其中心与字符中心重合  
            # Calculate the top-left placement position of border bitmap (pen_border) so that its center coincides with the character center  
            pen_border_x_float = char_center_on_canvas_x - border_center_offset_x  
            pen_border_y_float = char_center_on_canvas_y - border_center_offset_y  

            # 转换为整数坐标  
            # Convert to integer coordinates  
            pen_border_x = int(round(pen_border_x_float))  
            pen_border_y = int(round(pen_border_y_float))  

            _paste_bitmap(canvas_border, bitmap_border, pen_border_x, pen_border_y, cv2.add)

    # 返回垂直步进值  
    # Return vertical advance value  
    return char_offset_y  

def put_text_vertical(font_size: int, text: str, h: int, alignment: str, fg: Tuple[int, int, int], bg: Optional[Tuple[int, int, int]], line_spacing: int):
    text = compact_special_symbols(text)
    if not text :
        return
    bg_size = int(max(font_size * 0.07, 1)) if bg is not None else 0
    spacing_x = int(font_size * (line_spacing or 0.2))

    # make large canvas
    num_char_y = h // font_size
    num_char_x = len(text) // num_char_y + 1
    canvas_x = font_size * num_char_x + spacing_x * (num_char_x - 1) + (font_size + bg_size) * 2
    canvas_y = font_size * num_char_y + (font_size + bg_size) * 2
    line_text_list, line_height_list = calc_vertical(font_size, text, h)
    # print(line_text_list, line_height_list)

    canvas_text = np.zeros((canvas_y, canvas_x), dtype=np.uint8)
    canvas_border = canvas_text.copy()

    # pen (x, y)
    pen_orig = [canvas_text.shape[1] - (font_size + bg_size), font_size + bg_size]

    # write stuff
    for line_text, line_height in zip(line_text_list, line_height_list):
        pen_line = pen_orig.copy()
        if alignment == 'center':
            pen_line[1] += (max(line_height_list) - line_height) // 2
        elif alignment == 'right':
            pen_line[1] += max(line_height_list) - line_height

        for c in line_text:
            offset_y = put_char_vertical(font_size, c, pen_line, canvas_text, canvas_border, border_size=bg_size)
            pen_line[1] += offset_y
        pen_orig[0] -= spacing_x + font_size

    # colorize
    canvas_border = np.clip(canvas_border, 0, 255)
    line_box = add_color(canvas_text, fg, canvas_border, bg)
    # rect
    x, y, w, h = cv2.boundingRect(canvas_border)
    return line_box[y:y+h, x:x+w]

@functools.lru_cache(maxsize=None)
def select_hyphenator(lang: str):
    # #speed-study Phase 2b (L2, 2026-07-03): this is a PURE function of `lang`
    # (returns None or a stateless Hyphenator for that language; its `.syllables()`
    # is a read-only dictionary lookup with no call-history state), so caching the
    # result per language is byte-identical to constructing it fresh each call.
    # Measured: uncached `select_hyphenator('THA')` = ~163ms and `('ENG')` = ~372ms
    # (the failing `Hyphenator(lang)` construction attempt / dictionary load is the
    # cost, NOT `standardize_tag` which is ~0ms). calc_horizontal called it TWICE
    # per invocation (here + inside `_split_into_syllables`), ~68 calc_horizontal
    # calls/page → ~22s/page of pure repeated hyphenator setup on the render path.
    # Caching by `lang` alone is correct: the result depends only on `lang` and the
    # module-constant HYPHENATOR_LANGUAGES — NOT on the module-global font state,
    # so this sidesteps the font-cache landmine that gates other render caches.
    lang = standardize_tag(lang)
    if lang not in HYPHENATOR_LANGUAGES:
        for avail_lang in reversed(HYPHENATOR_LANGUAGES):
            if avail_lang.startswith(lang):
                lang = avail_lang
                break
        else:
            return None
    try:
        # #499 (multi-agent scrutinize, 3/3): the lru_cache above also caches a
        # FAILED construction as a sticky None until worker restart. This is an
        # accepted tradeoff, not a bug:
        #  - EN->TH hot path: Thai has no hyphenation dictionary, so this fails
        #    DETERMINISTICALLY (~163ms) every time — caching that None forever IS
        #    the win the cache exists for.
        #  - Narrow regression: for a hyphenatable target lang (DEU/FRA/…) whose
        #    dict downloads on first use, a transient first-call network failure
        #    would disable hyphenation for it until restart (old code retried).
        # Not "fixed" because it's inherent to result-caching: caching only
        # non-None would stop caching Thai's None and bring back the ~22s/page.
        return Hyphenator(lang)
    except Exception:
        return None

# @functools.lru_cache(maxsize = 1024, typed = True)
def get_char_offset_x(font_size: int, cdpt: str):
    c, rot_degree = CJK_Compatibility_Forms_translate(cdpt, 0)
    glyph = get_char_glyph(c, font_size, 0)
    bitmap = glyph.bitmap
    # Extract length
    if bitmap.rows * bitmap.width == 0 or len(bitmap.buffer) != bitmap.rows * bitmap.width:
        # spaces, etc
        char_offset_x = glyph.advance.x >> 6
    else:
        char_offset_x = glyph.metrics.horiAdvance >> 6
    return char_offset_x

def get_string_width(font_size: int, text: str):
    return sum([get_char_offset_x(font_size, c) for c in text])

def _split_words_and_widths(text: str, font_size: int) -> Tuple[List[str], List[int]]:
    """#186: split text on whitespace / zero-width-space and precompute each word's
    pixel width. Extracted verbatim from ``calc_horizontal``."""
    words = re.split(rf'[\s{_ZWSP}]+', text)
    return words, [get_string_width(font_size, w) for w in words]


def _split_into_syllables(words: List[str], font_size: int, max_width: int, language: str) -> List[List[str]]:
    """#186: per-word syllable segmentation for the greedy horizontal wrap. Uses the
    language hyphenator, falls back to a safe char-split for short/unhyphenatable
    words, then further splits any syllable wider than ``max_width``. Extracted
    verbatim from ``calc_horizontal`` (behaviour-preserving) so the wrap can later be
    swapped for a pluggable strategy. Depends only on module-level font state."""
    syllables = []
    hyphenator = select_hyphenator(language)
    for word in words:
        new_syls = []
        if hyphenator and len(word) <= 100:
            try:
                new_syls = hyphenator.syllables(word)
            except Exception:
                new_syls = []
        if len(new_syls) == 0:
            if len(word) <= 3:
                new_syls = [word]
            else:
                new_syls = _safe_char_split(word)

        # Split up syllables that are too large
        normalized_syls = []
        for syl in new_syls:
            syl_width = get_string_width(font_size, syl)
            if syl_width > max_width:
                normalized_syls.extend(_safe_char_split(syl))
            else:
                normalized_syls.append(syl)
        syllables.append(normalized_syls)
    return syllables


def _greedy_pack(words, word_widths, syllables, font_size, max_width,
                 whitespace_offset_x, hyphen_offset_x):
    """#186: greedy line packing — calc_horizontal's "Step 1". Packs words onto lines
    up to ``max_width``; a single word wider than the column is char-split across
    lines. Returns ``(line_words_list, line_width_list, hyphenation_idx_list)``:
    per-line word-index lists, their pixel widths, and the syllable index where an
    over-wide word was cut. This is the line-break strategy #186 will make swappable
    (e.g. Knuth-Plass #180). Extracted verbatim from calc_horizontal — byte-identical."""
    line_words_list = []
    line_width_list = []
    hyphenation_idx_list = []
    line_words = []
    line_width = 0
    hyphenation_idx = 0

    def break_line():
        nonlocal line_words, line_width, hyphenation_idx
        line_words_list.append(line_words)
        line_width_list.append(line_width)
        hyphenation_idx_list.append(hyphenation_idx)
        line_words = []
        line_width = 0
        hyphenation_idx = 0

    i = 0
    while True:
        if i >= len(words):
            if line_width > 0:
                break_line()
            break

        current_width = whitespace_offset_x if line_width > 0 else 0

        if line_width + current_width + word_widths[i] <= max_width + hyphen_offset_x:
            line_words.append(i)
            line_width += current_width + word_widths[i]
            i += 1
        elif word_widths[i] > max_width:
            # We know no syllable can be larger than max_width
            j = 0
            hyphenation_idx = 0
            while j < len(syllables[i]):
                syl = syllables[i][j]
                syl_width = get_string_width(font_size, syl)
                if line_width + current_width + syl_width <= max_width:
                    current_width += syl_width
                    j += 1
                    hyphenation_idx = j
                else:
                    if hyphenation_idx > 0:
                        line_words.append(i)
                        line_width += current_width
                    current_width = 0
                    break_line()
            line_words.append(i)
            line_width += current_width
            i += 1
        else:
            break_line()
    return line_words_list, line_width_list, hyphenation_idx_list


class LineBreaker(Protocol):
    """#186: the pluggable line-break strategy seam.

    A LineBreaker turns the tokenized ``words`` (plus their precomputed pixel
    ``word_widths`` and per-word ``syllables``) into per-line word-index
    groupings — the exact ``(line_words_list, line_width_list,
    hyphenation_idx_list)`` shape ``calc_horizontal`` Steps 2-4 consume. This lets
    the greedy packer be swapped for a holistic strategy (Knuth-Plass, #180)
    without touching tokenization or assembly.

    ``greedy_postprocess`` tells ``calc_horizontal`` whether to run its
    greedy-specific Step 2 (backward syllable hyphenation across line boundaries).
    The greedy packer relies on it; a holistic strategy already balances its lines
    and must not have that layout re-greedified, so it sets this ``False``.
    """

    greedy_postprocess: bool

    def pack(self, words: List[str], word_widths: List[int], syllables: List[List[str]],
             font_size: int, max_width: int, whitespace_offset_x: int,
             hyphen_offset_x: int) -> Tuple[List[List[int]], List[int], List[int]]:
        ...


_default_line_breaker: 'Optional[LineBreaker]' = None


def set_default_line_breaker(breaker: 'Optional[LineBreaker]') -> None:
    """Set the process-wide default LineBreaker that :func:`calc_horizontal` uses when no explicit
    ``line_breaker`` is passed (#180 P8). ``None`` restores the byte-identical greedy default. Set once
    per render pass from ``render.knuth_plass`` (mirrors :func:`set_font`), so both the sizing and the
    render calc_horizontal calls switch together without threading a flag through every call site."""
    global _default_line_breaker
    _default_line_breaker = breaker


class GreedyLineBreaker:
    """#186: default strategy — ``calc_horizontal``'s original greedy packing
    (Step 1), kept byte-identical by delegating straight to :func:`_greedy_pack`.
    Steps 2-4 post-process its output, so ``greedy_postprocess`` is ``True``."""

    greedy_postprocess = True

    def pack(self, words, word_widths, syllables, font_size, max_width,
             whitespace_offset_x, hyphen_offset_x):
        return _greedy_pack(words, word_widths, syllables, font_size, max_width,
                            whitespace_offset_x, hyphen_offset_x)


class KnuthPlassLineBreaker:
    """#186 / #180: holistic strategy — wraps the pure Knuth-Plass DP
    (:func:`manga_translator.line_break.find_optimal_line_breaks`) behind the
    LineBreaker seam.

    Groups whole words to globally minimise total badness (``slack ** exponent``),
    so lines come out balanced instead of greedily overflowing into an ugly short
    last line. It works at word granularity: it never splits a word across lines,
    hence emits no mid-word hyphenation (``hyphenation_idx_list`` all 0) and needs
    no greedy post-process (``greedy_postprocess = False``). A single word wider
    than the column is placed on its own line (the DP never deadlocks); the
    syllable-level splitting of over-wide words stays the greedy path's job.

    Opt-in: ``calc_horizontal`` defaults to :class:`GreedyLineBreaker`, so the
    production render stays byte-identical until #180 step 2 selects this behind
    ``render.bubble_area_fit``.
    """

    greedy_postprocess = False

    def __init__(self, badness_exponent: float = 3.0, hyphen_penalty: float = 1000.0):
        self._badness_exponent = badness_exponent
        self._hyphen_penalty = hyphen_penalty

    def pack(self, words, word_widths, syllables, font_size, max_width,
             whitespace_offset_x, hyphen_offset_x):
        lines = find_optimal_line_breaks(
            words,
            max_width=float(max_width),
            word_width=lambda tok: float(get_string_width(font_size, tok)),
            space_width=float(whitespace_offset_x),
            badness_exponent=self._badness_exponent,
            hyphen_penalty=self._hyphen_penalty,
        )
        # find_optimal_line_breaks partitions the word *sequence* contiguously, so
        # recover per-line word indices by walking the line lengths.
        line_words_list: List[List[int]] = []
        line_width_list: List[int] = []
        idx = 0
        for line in lines:
            indices = list(range(idx, idx + len(line)))
            idx += len(line)
            width = sum(word_widths[k] for k in indices)
            if len(indices) > 1:
                width += (len(indices) - 1) * whitespace_offset_x
            line_words_list.append(indices)
            line_width_list.append(width)
        hyphenation_idx_list = [0] * len(line_words_list)
        return line_words_list, line_width_list, hyphenation_idx_list


def calc_horizontal(font_size: int, text: str, max_width: int, max_height: int, language: str = 'en_US', hyphenate: bool = True, line_breaker: Optional[LineBreaker] = None) -> Tuple[List[str], List[int]]:
    """
    Splits up a string of text into lines. Returns list of lines and their widths.
    Will go over max_height if too much text is present.
    """
    # Pre-segment Thai text with zero-width spaces so wrapping can occur on
    # word boundaries without adding visible spaces to final rendered output.
    text = _insert_thai_word_breaks(text)
    text = _insert_cjk_word_breaks(text)
    has_zwsp_breaks = _ZWSP in text
    max_width = max(max_width, 2 * font_size)

    whitespace_offset_x = 0 if has_zwsp_breaks else get_char_offset_x(font_size, ' ')
    hyphen_offset_x = get_char_offset_x(font_size, '-')

    # Split text into words and precalculate each word width (#186: helper)
    words, word_widths = _split_words_and_widths(text, font_size)

    # Try to increase width usage if a height overflow is unavoidable
    while True:
        max_lines = max_height // font_size + 1
        expected_size = sum(word_widths) + max((len(word_widths) - 1) * whitespace_offset_x - (max_lines - 1) * hyphen_offset_x, 0)
        max_size = max_width * max_lines
        if max_size < expected_size:
            multiplier = np.sqrt(expected_size / max_size)
            max_width *= max(multiplier, 1.05)
            max_height *= multiplier
        else:
            break

    # Split words into syllables (#186: extracted to _split_into_syllables)
    syllables = _split_into_syllables(words, font_size, max_width, language)
    # Step 2/4 below still consult the hyphenator for backward-hyphenation decisions.
    hyphenator = select_hyphenator(language)

    # Step 1: line packing via the pluggable LineBreaker seam (#186). Default is
    # GreedyLineBreaker — byte-identical to the original greedy Step 1; #180 step 2
    # selects KnuthPlassLineBreaker behind render.bubble_area_fit. Steps 2-4 below
    # post-process greedy output; a holistic strategy opts out via greedy_postprocess.
    breaker = line_breaker if line_breaker is not None else (_default_line_breaker or GreedyLineBreaker())
    line_words_list, line_width_list, hyphenation_idx_list = breaker.pack(
        words, word_widths, syllables, font_size, max_width,
        whitespace_offset_x, hyphen_offset_x)

    def get_present_syllables_range(line_idx, word_pos):
        while word_pos < 0:
            word_pos += len(line_words_list[line_idx])
        word_idx = line_words_list[line_idx][word_pos]
        syl_start_idx = 0
        syl_end_idx = len(syllables[word_idx])
        if line_idx > 0 and word_pos == 0 and line_words_list[line_idx - 1][-1] == word_idx:
            syl_start_idx = hyphenation_idx_list[line_idx - 1]
        if line_idx < len(line_words_list) - 1 and word_pos == len(line_words_list[line_idx]) - 1 \
            and line_words_list[line_idx + 1][0] == word_idx:
            syl_end_idx = hyphenation_idx_list[line_idx]
        return syl_start_idx, syl_end_idx

    def get_present_syllables(line_idx, word_pos):
        syl_start_idx, syl_end_idx = get_present_syllables_range(line_idx, word_pos)
        return syllables[line_words_list[line_idx][word_pos]][syl_start_idx:syl_end_idx]


    # (Step 1 packing produced by _greedy_pack above.)

    # Step 2:
    # Compare two adjacent lines and try to hyphenate backwards

    # Avoid hyphenation if max_lines isn't fully used
    if breaker.greedy_postprocess and hyphenate and len(line_words_list) > max_lines:
        line_idx = 0
        while line_idx < len(line_words_list) - 1:
            line_words1 = line_words_list[line_idx]
            line_words2 = line_words_list[line_idx + 1]
            left_space = max_width - line_width_list[line_idx]

            # Move syllables from below line to above
            first_word = True
            while len(line_words2) != 0:
                word_idx = line_words2[0]

                # A bit messy but were basically trying to only use the syllables on the current line
                if first_word and word_idx == line_words1[-1]:
                    syl_start_idx = hyphenation_idx_list[line_idx]
                    if line_idx < len(line_width_list) - 2 and word_idx == line_words_list[line_idx + 2][0]:
                        syl_end_idx = hyphenation_idx_list[line_idx + 1]
                    else:
                        syl_end_idx = len(syllables[word_idx])
                else:
                    left_space -= whitespace_offset_x
                    syl_start_idx = 0
                    syl_end_idx = len(syllables[word_idx]) if len(line_words2) > 1 else hyphenation_idx_list[line_idx + 1]
                first_word = False

                current_width = 0
                for i in range(syl_start_idx, syl_end_idx):
                    syl = syllables[word_idx][i]
                    syl_width = get_string_width(font_size, syl)
                    if left_space > current_width + syl_width:
                        current_width += syl_width
                    else:
                        # Splitting up word
                        if current_width > 0:
                            # We dont want very small splits
                            # if 
                            left_space -= current_width
                            line_width_list[line_idx] = max_width - left_space
                            hyphenation_idx_list[line_idx] = i
                            line_words1.append(word_idx)
                        break
                else:
                    # Whole word was brought to above line
                    left_space -= current_width
                    line_width_list[line_idx] = max_width - left_space
                    line_words1.append(word_idx)
                    line_words2.pop(0)
                    continue
                break

            if len(line_words2) == 0:
                line_words_list.pop(line_idx + 1)
                line_width_list.pop(line_idx + 1)
                hyphenation_idx_list.pop(line_idx)
            else:
                line_idx += 1

    
    # Step 3
    # Move single char syllables on the left up and those on the right down

    line_idx = 0
    while line_idx < len(line_words_list) - 1:
        line_words1 = line_words_list[line_idx]
        line_words2 = line_words_list[line_idx + 1]
        merged_word_idx = -1

        if line_words1[-1] == line_words2[0]:
            word1_text = ''.join(get_present_syllables(line_idx, -1))
            word2_text = ''.join(get_present_syllables(line_idx + 1, 0))
            word1_width = get_string_width(font_size, word1_text)
            word2_width = get_string_width(font_size, word2_text)
            if len(word2_text) == 1 or word2_width < font_size:
                merged_word_idx = line_words1[-1]
                line_words2.pop(0)
                line_width_list[line_idx] += word2_width
                line_width_list[line_idx + 1] -= word2_width + whitespace_offset_x
            elif len(word1_text) == 1 or word1_width < font_size:
                merged_word_idx = line_words1[-1]
                line_words1.pop(-1)
                line_width_list[line_idx] -= word1_width + whitespace_offset_x
                line_width_list[line_idx + 1] += word1_width

        if len(line_words1) == 0:
            line_words_list.pop(line_idx)
            line_width_list.pop(line_idx)
            hyphenation_idx_list.pop(line_idx)
        elif len(line_words2) == 0:
            line_words_list.pop(line_idx + 1)
            line_width_list.pop(line_idx + 1)
            hyphenation_idx_list.pop(line_idx)
        # We dont want all single letters to be merged
        elif line_idx >= len(line_words_list) - 1 or line_words_list[line_idx + 1] != merged_word_idx:
            line_idx += 1


    # Step 4
    # Assemble line_text_list

    use_hyphen_chars = hyphenate and hyphenator and max_width > 1.5 * font_size and len(words) > 1

    line_text_list = []
    for i, line in enumerate(line_words_list):
        line_text = ''
        for j, word_idx in enumerate(line):
            syl_start_idx, syl_end_idx = get_present_syllables_range(i, j)
            current_syllables = syllables[word_idx][syl_start_idx:syl_end_idx]
            line_text += ''.join(current_syllables)
            if len(line_text) == 0:
                continue
            if j == 0 and i > 0 and line_text_list[-1][-1] == '-' and line_text[0] == '-':
                line_text = line_text[1:]
                line_width_list[i] -= hyphen_offset_x
            if j < len(line) - 1 and len(line_text) > 0 and not has_zwsp_breaks:
                line_text += ' '
            elif use_hyphen_chars and syl_end_idx != len(syllables[word_idx]) and len(words[word_idx]) > 3 and line_text[-1] != '-' \
                and not (syl_end_idx < len(syllables[word_idx]) and not re.search(r'\w', syllables[word_idx][syl_end_idx][0])):
                line_text += '-'
                # hyphen_offset was ignored in previous steps
                line_width_list[i] += hyphen_offset_x

        # print(line_text, get_string_width(font_size, line_text), line_width_list[i])
        # assert(line_width_list[i] == get_string_width(font_size, line_text))

        # Shouldn't be needed but there is apparently still a bug somewhere (See #458)
        line_width_list[i] = get_string_width(font_size, line_text)
        line_text_list.append(line_text)

    return line_text_list, line_width_list


def put_char_horizontal(font_size: int, cdpt: str, pen_l: Tuple[int, int], canvas_text: np.ndarray, canvas_border: np.ndarray, border_size: int):
    """
    Render a single character (with optional stroke) onto horizontally oriented canvas.
    将单个字符（包括可能的描边）渲染到水平方向的画布上。

    Args:
        font_size: Font size in pixels. 字体大小（像素）
        cdpt: Character to render. 要渲染的字符
        pen_l: Current pen position (x, y), where x is horizontal origin and y is baseline. 
               画笔的当前位置 (x, y)，其中 x 是水平原点，y 是基线
        canvas_text: Grayscale canvas for character rendering (numpy array).
                    用于渲染字符本身的灰度画布 (numpy array)
        canvas_border: Grayscale canvas for stroke rendering (numpy array).
                      用于渲染字符描边的灰度画布 (numpy array)
        border_size: Target stroke size (used to calculate stroker radius, enabled when >0).
                    描边的目标大小（用于计算描边器半径，>0 时启用描边）

    Returns:
        The character's horizontal advance distance (int). 该字符的水平步进距离 (int)
    """
    pen = list(pen_l)  # Use mutable copy 使用可变副本

    # Get character and rotation angle (0° means horizontal)
    # 获取字符和旋转角度（方向0代表水平）
    cdpt, rot_degree = CJK_Compatibility_Forms_translate(cdpt, 0)
    
    # Get glyph information 获取字形信息
    slot = get_char_glyph(cdpt, font_size, 0)
    bitmap = slot.bitmap  # Original character bitmap 原始字符位图对象

    # --- Calculate horizontal advance (char_offset_x) ---
    # 优先使用 horiAdvance 获取水平布局的步进
    # Priority: Use horiAdvance for horizontal layout advance
    if hasattr(slot, 'metrics') and hasattr(slot.metrics, 'horiAdvance') and slot.metrics.horiAdvance:
        char_offset_x = slot.metrics.horiAdvance >> 6
    
    # Fallback: Use advance.x (usually same as horiAdvance)
    # 备选：使用 advance.x (通常与 horiAdvance 相同)
    elif hasattr(slot, 'advance') and slot.advance.x:
        char_offset_x = slot.advance.x >> 6
    
    # Further fallback: Estimate based on bitmap width if metrics missing (rare case)
    # 更进一步的备选：如果缺少度量信息，基于位图宽度和左跨距估算
    elif bitmap.width > 0 and hasattr(slot, 'bitmap_left'):
         char_offset_x = slot.bitmap_left + bitmap.width  # Rough estimation 非常粗略的估算
    
    # Final fallback: Guess based on font size
    # 最后备选：基于字体大小猜测
    else:
         char_offset_x = font_size // 2  # If no information available 如果完全没有信息

    # --- Check bitmap validity ---
    # 处理空格、无效字符等情况，在访问 buffer 前检查
    # Handle spaces/invalid chars before accessing buffer
    if bitmap.rows * bitmap.width == 0 or len(bitmap.buffer) != bitmap.rows * bitmap.width:
        return char_offset_x  # Return advance for empty/invalid bitmap 对于无效或空位图直接返回步进

    # --- For valid bitmap, proceed with rendering ---
    # 将位图缓冲区转换为 numpy 数组
    # Convert bitmap buffer to numpy array
    bitmap_char = np.array(bitmap.buffer, dtype=np.uint8).reshape((bitmap.rows, bitmap.width))

    # --- Calculate character placement ---
    # pen[0] is horizontal origin (cursor x)
    # pen[1] is vertical baseline (cursor y)
    # bitmap_left is horizontal distance from origin to left edge
    # bitmap_top is vertical distance from baseline to top edge (positive upwards)
    # pen[0] 是水平原点 (光标的 x 位置)
    # pen[1] 是垂直基线 (光标的 y 位置)
    # bitmap_left 是从原点到字形位图左边缘的水平距离
    # bitmap_top 是从基线到字形位图上边缘的垂直距离 (向上为正)
    char_place_x = pen[0] + slot.bitmap_left
    char_place_y = pen[1] - slot.bitmap_top

    # --- Paste character to canvas_text ---
    _paste_bitmap(canvas_text, bitmap_char, char_place_x, char_place_y, np.maximum)

    # --- Handle stroke rendering (if border_size > 0) ---
    # 处理描边渲染 (如果 border_size > 0)
    if border_size > 0:
        bitmap_border = _render_glyph_stroke(cdpt, font_size, 0)
        if bitmap_border is not None:
            border_bitmap_rows, border_bitmap_width = bitmap_border.shape

            # --- Calculate stroke placement (center alignment logic) ---
            # 原始字符位图的尺寸
            char_bitmap_rows = bitmap.rows
            char_bitmap_width = bitmap.width

            # Original character center offsets
            # 原始字符位图中心相对于其左上角的偏移
            char_center_offset_x = char_bitmap_width / 2.0
            char_center_offset_y = char_bitmap_rows / 2.0

            # Stroke bitmap center offsets
            # 描边位图中心相对于其自身左上角的偏移
            border_center_offset_x = border_bitmap_width / 2.0
            border_center_offset_y = border_bitmap_rows / 2.0

            # Calculate absolute center coordinates on canvas
            # 计算原始字符中心在画布上的绝对坐标
            char_center_on_canvas_x = char_place_x + char_center_offset_x
            char_center_on_canvas_y = char_place_y + char_center_offset_y

            # Calculate stroke placement position (pen_border_x/y)
            # So its center aligns with character center
            # 计算描边位图的左上角放置位置 (pen_border_x, pen_border_y)
            # 使得其中心与字符中心对齐
            pen_border_x_float = char_center_on_canvas_x - border_center_offset_x
            pen_border_y_float = char_center_on_canvas_y - border_center_offset_y

            # Convert to integer coordinates
            # 转换为整数坐标进行放置
            pen_border_x = int(round(pen_border_x_float))
            pen_border_y = int(round(pen_border_y_float))

            # --- Paste stroke to canvas_border ---
            _paste_bitmap(canvas_border, bitmap_border, pen_border_x, pen_border_y, cv2.add)

    return char_offset_x  # Return horizontal advance 返回水平步进距离

def put_text_horizontal(font_size: int, text: str, width: int, height: int, alignment: str,
                        reversed_direction: bool, fg: Tuple[int, int, int], bg: Tuple[int, int, int],
                        lang: str = 'en_US', hyphenate: bool = True, line_spacing: int = 0):
    text = compact_special_symbols(text)
    if not text :
        return
    bg_size = int(max(font_size * 0.07, 1)) if bg is not None else 0
    spacing_y = int(font_size * (line_spacing or 0.01))

    # calc
    # print(width)
    line_text_list, line_width_list = calc_horizontal(font_size, text, width, height, lang, hyphenate)
    # print(line_text_list, line_width_list)

    # make large canvas
    canvas_w = max(line_width_list) + (font_size + bg_size) * 2
    canvas_h = font_size * len(line_width_list) + spacing_y * (len(line_width_list) - 1) + (font_size + bg_size) * 2
    canvas_text = np.zeros((canvas_h, canvas_w), dtype=np.uint8)
    canvas_border = canvas_text.copy()

    # pen (x, y)
    pen_orig = [font_size + bg_size, font_size + bg_size]
    if reversed_direction:
        # right to left languages have to be rendered in the correct order (starting from right)
        # so that the white outline of characters dont go over black parts of neighbouring characters
        pen_orig[0] = canvas_w - bg_size - 10

    # write stuff
    for line_text, line_width in zip(line_text_list, line_width_list):
        pen_line = pen_orig.copy()
        if alignment == 'center':
            pen_line[0] += (max(line_width_list) - line_width) // 2 * (-1 if reversed_direction else 1)
        elif alignment == 'right' and not reversed_direction:
            pen_line[0] += max(line_width_list) - line_width
        elif alignment == 'left' and reversed_direction:
            pen_line[0] -= max(line_width_list) - line_width
            pen_line[0] = max(line_width, pen_line[0])
        # print((line_width, pen_line[0], canvas_w))
        # print(0, pen_line, line_text)

        for c in line_text:
            if reversed_direction:
                cdpt, rot_degree = CJK_Compatibility_Forms_translate(c, 0)
                glyph = get_char_glyph(cdpt, font_size, 0)
                offset_x = glyph.metrics.horiAdvance >> 6
                pen_line[0] -= offset_x
            # print(1, pen_line, c)
            offset_x = put_char_horizontal(font_size, c, pen_line, canvas_text, canvas_border, border_size=bg_size)
            if not reversed_direction:
                pen_line[0] += offset_x
        pen_orig[1] += spacing_y + font_size

    # colorize
    canvas_border = np.clip(canvas_border, 0, 255)
    line_box = add_color(canvas_text, fg, canvas_border, bg)

    x, y, w, h = cv2.boundingRect(canvas_border)
    return line_box[y:y+h, x:x+w]

# def put_text(img: np.ndarray, text: str, line_count: int, x: int, y: int, w: int, h: int, fg: Tuple[int, int, int], bg: Optional[Tuple[int, int, int]]):
#     pass

def test():
    #canvas = put_text_vertical(64, 1.0, '因为不同‼ [这"真的是普]通的》肉！那个“姑娘”的恶作剧！是吗？咲夜⁉。', 700, (0, 0, 0), (255, 128, 128))
    canvas = put_text_horizontal(64, 1.0, '因为不同‼ [这"真的是普]通的》肉！那个“姑娘”的恶作剧！是吗？咲夜⁉', 400, (0, 0, 0), (255, 128, 128))
    cv2.imwrite('text_render_combined.png', canvas)

if __name__ == '__main__':
    test()
