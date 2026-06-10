"""Verbose debug-image sink (#187 seam S14).

The scattered `if self.verbose: cv2.imwrite(...)` bodies, lifted byte-for-byte
out of the three drivers in `manga_translator.py` (the verbose guard stays at
each call site; only the bodies live here, so each save exists once instead of
per-driver copies). The guarded-vs-unguarded split is load-bearing and pinned:

- GUARDED (try/except + imwrite success check → warning): save_input_png,
  save_inpainted, save_final — identical in every driver that has them.
- UNGUARDED (bare imwrite; an exception propagates): save_mask_raw,
  save_bboxes_unfiltered, save_bboxes — likewise identical per driver.

`result_path` is the caller's bound `MangaTranslator._result_path` (it owns the
verbose/result_sub_folder directory logic + makedirs). The streaming-placeholder
branch in `_revert_upscale` (L11) is flow control, not a debug save — it stays
in the driver.
"""
import contextlib
import logging
import os
import traceback

import cv2
import numpy as np

from .utils import visualize_textblocks

logger = logging.getLogger('manga_translator')


@contextlib.contextmanager
def ocr_debug_dir_env(verbose, get_image_subfolder, result_sub_folder, base_path):
    """The `_run_ocr` debug-dir + env dance: when verbose, build (and create)
    the per-image `ocrs/` result dir via one of three branches, expose it to
    the OCR module through MANGA_OCR_RESULT_DIR for the duration of the body,
    and always restore the variable afterwards. `get_image_subfolder` is the
    caller's bound `_get_image_subfolder` — only consulted when verbose."""
    # 为OCR创建子文件夹（只在verbose模式下）
    if verbose:
        image_subfolder = get_image_subfolder()
        if image_subfolder:
            if result_sub_folder:
                ocr_result_dir = os.path.join(base_path, 'result', result_sub_folder, image_subfolder, 'ocrs')
            else:
                ocr_result_dir = os.path.join(base_path, 'result', image_subfolder, 'ocrs')
            os.makedirs(ocr_result_dir, exist_ok=True)
        else:
            ocr_result_dir = os.path.join(base_path, 'result', result_sub_folder, 'ocrs')
            os.makedirs(ocr_result_dir, exist_ok=True)
    else:
        # 非verbose模式下使用临时目录或不创建OCR结果目录
        ocr_result_dir = None

    # 临时设置环境变量供OCR模块使用
    old_ocr_dir = os.environ.get('MANGA_OCR_RESULT_DIR', None)
    if ocr_result_dir:
        os.environ['MANGA_OCR_RESULT_DIR'] = ocr_result_dir

    try:
        yield ocr_result_dir
    finally:
        # 恢复环境变量
        if old_ocr_dir is not None:
            os.environ['MANGA_OCR_RESULT_DIR'] = old_ocr_dir
        elif 'MANGA_OCR_RESULT_DIR' in os.environ:
            del os.environ['MANGA_OCR_RESULT_DIR']


def save_input_png(image, result_path):
    """保存原始输入图片用于调试 (guarded; single + patch drivers)."""
    try:
        input_img = np.array(image)
        if len(input_img.shape) == 3:  # 彩色图片，转换BGR顺序
            input_img = cv2.cvtColor(input_img, cv2.COLOR_RGB2BGR)
        path = result_path('input.png')
        success = cv2.imwrite(path, input_img)
        if not success:
            logger.warning(f"Failed to save debug image: {path}")
    except Exception as e:
        logger.error(f"Error saving input.png debug image: {e}")
        logger.debug(f"Exception details: {traceback.format_exc()}")


def save_mask_raw(mask_raw, result_path):
    """Unguarded bare write (single + patch drivers)."""
    cv2.imwrite(result_path('mask_raw.png'), mask_raw)


def save_bboxes_unfiltered(img_rgb, textlines, result_path):
    """Unguarded; draws detection polygons on a copy (single + patch drivers)."""
    img_bbox_raw = np.copy(img_rgb)
    for txtln in textlines:
        cv2.polylines(img_bbox_raw, [txtln.pts], True, color=(255, 0, 0), thickness=2)
    cv2.imwrite(result_path('bboxes_unfiltered.png'), cv2.cvtColor(img_bbox_raw, cv2.COLOR_RGB2BGR))


def save_bboxes(img_rgb, text_regions, config, result_path):
    """Unguarded; merged-region visualisation (single + patch drivers)."""
    show_panels = not config.force_simple_sort  # 当不使用简单排序时显示panel
    bboxes = visualize_textblocks(cv2.cvtColor(img_rgb, cv2.COLOR_BGR2RGB), text_regions,
                                show_panels=show_panels, img_rgb=img_rgb, right_to_left=config.render.rtl)
    cv2.imwrite(result_path('bboxes.png'), bboxes)


def save_inpainted(img_inpainted, result_path):
    """Guarded (single + batch back-half drivers)."""
    try:
        inpainted_path = result_path('inpainted.png')
        success = cv2.imwrite(inpainted_path, cv2.cvtColor(img_inpainted, cv2.COLOR_RGB2BGR))
        if not success:
            logger.warning(f"Failed to save debug image: {inpainted_path}")
    except Exception as e:
        logger.error(f"Error saving inpainted.png debug image: {e}")
        logger.debug(f"Exception details: {traceback.format_exc()}")


async def save_inpaint_preview(mask, result_path, make_preview):
    """UNGUARDED (single driver): render the Inpainter.none preview via the
    caller's `make_preview` and write inpaint_input.png + mask_final.png bare —
    an exception propagates. The guarded batch variant is a separate function;
    the divergence is load-bearing (analysis §3, S14)."""
    inpaint_input_img = await make_preview()
    cv2.imwrite(result_path('inpaint_input.png'), cv2.cvtColor(inpaint_input_img, cv2.COLOR_RGB2BGR))
    cv2.imwrite(result_path('mask_final.png'), mask)


async def save_inpaint_preview_guarded(mask, result_path, make_preview):
    """GUARDED (batch back-half driver): same two writes, but the whole block —
    including the preview render — sits in try/except with per-file success
    checks."""
    try:
        inpaint_input_img = await make_preview()

        # 保存inpaint_input.png
        inpaint_input_path = result_path('inpaint_input.png')
        success1 = cv2.imwrite(inpaint_input_path, cv2.cvtColor(inpaint_input_img, cv2.COLOR_RGB2BGR))
        if not success1:
            logger.warning(f"Failed to save debug image: {inpaint_input_path}")

        # 保存mask_final.png
        mask_final_path = result_path('mask_final.png')
        success2 = cv2.imwrite(mask_final_path, mask)
        if not success2:
            logger.warning(f"Failed to save debug image: {mask_final_path}")
    except Exception as e:
        logger.error(f"Error saving debug images (inpaint_input.png, mask_final.png): {e}")
        logger.debug(f"Exception details: {traceback.format_exc()}")


def save_final(result, result_path):
    """在verbose模式下保存final.png到调试文件夹 (guarded; `_revert_upscale`)."""
    try:
        final_img = np.array(result)
        if len(final_img.shape) == 3:  # 彩色图片，转换BGR顺序
            final_img = cv2.cvtColor(final_img, cv2.COLOR_RGB2BGR)
        final_path = result_path('final.png')
        success = cv2.imwrite(final_path, final_img)
        if not success:
            logger.warning(f"Failed to save debug image: {final_path}")
    except Exception as e:
        logger.error(f"Error saving final.png debug image: {e}")
        logger.debug(f"Exception details: {traceback.format_exc()}")
