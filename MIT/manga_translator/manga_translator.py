import asyncio
import copy
import cv2
import io
import json
import langcodes
import os
import regex as re
import time
import torch
import logging
import sys
import traceback
import numpy as np
from PIL import Image
from typing import Optional, Any, List
from .region_filter import filter_translated_regions
from .region_apply import apply_original_as_translation, apply_render_casing, apply_translations
from .model_usage_tracker import ModelUsageTracker
from .model_unloader import ModelUnloader
from .memory_guard import release_memory
from .context_counts import context_page_counts
from .dictionary import load_dictionary, apply_dictionary, apply_post_dictionary
from .prev_context import build_prev_context
from .none_translator import apply_prep_manual_override, stamp_none_translations
from .translation_store import read_translations, write_translations
from .image_debug_context import ImageDebugContext
from .pipeline_params import apply_global_settings, PipelineParams
from .model_reaper import ModelReaper
from .detection_postproc import merge_sfx_detections
from .translation_memory import TranslationMemory
from .gather_per_context import gather_per_context
from .model_lifecycle import ModelLifecycle
from .text_translation_dispatcher import build_chatgpt_translator, dispatch_translate
from .punctuation import correct_punctuation
from .stage_runner import run_stage
from .patch_geometry import build_local_region, create_text_only_mask, crop_mask_for_patch, union_refined_with_fallback
from .patch_renderer import PatchRenderer
from .batch_orchestration import placeholder_context, build_page_translation_record
from .stages import (
    run_colorizer,
    run_upscaling,
    run_detection,
    run_mask_refinement,
    run_inpainting,
    run_text_rendering,
)
from .debug_sink import (
    ocr_debug_dir_env,
    save_input_png,
    save_mask_raw,
    save_bboxes_unfiltered,
    save_bboxes,
    save_inpaint_preview,
    save_inpaint_preview_guarded,
    save_inpainted,
    save_final,
)
from .post_translation import (
    apply_post_translation_processing,
    concurrent_page_lang_check_retry,
    single_page_lang_check_retry,
    batch_lang_check_retry,
)
import py3langid as langid

from .config import Config, Colorizer, Detector, Translator, Renderer, Inpainter
from .utils import (
    BASE_PATH,
    LANGUAGE_ORIENTATION_PRESETS,
    Context,
    load_image,
    dump_image,
    visualize_textblocks,
    is_valuable_text,
    sort_regions,
)
from .utils.lang_ratio import target_script_ratio
from .text_layer import regions_payload

from .detection import dispatch as dispatch_detection, prepare as prepare_detection, unload as unload_detection
from .upscaling import dispatch as dispatch_upscaling, prepare as prepare_upscaling, unload as unload_upscaling
from .ocr import dispatch as dispatch_ocr, prepare as prepare_ocr, unload as unload_ocr
from .textline_merge import dispatch as dispatch_textline_merge
from .mask_refinement import dispatch as dispatch_mask_refinement
from .inpainting import dispatch as dispatch_inpainting, prepare as prepare_inpainting, unload as unload_inpainting
from .translators import (
    dispatch as dispatch_translation,
    prepare as prepare_translation,
    unload as unload_translation,
)
from .translators.common import ISO_639_1_TO_VALID_LANGUAGES
from .colorization import dispatch as dispatch_colorization, prepare as prepare_colorization, unload as unload_colorization
from .rendering import dispatch as dispatch_rendering, dispatch_eng_render, dispatch_eng_render_pillow

# Will be overwritten by __main__.py if module is being run directly (with python -m)
logger = logging.getLogger('manga_translator')

# 全局console实例，用于日志重定向
_global_console = None
_log_console = None

def set_main_logger(l):
    global logger
    logger = l

class TranslationInterrupt(Exception):
    """
    Can be raised from within a progress hook to prematurely terminate
    the translation.
    """
    pass


class MangaTranslator:
    verbose: bool
    ignore_errors: bool
    _gpu_limited_memory: bool
    device: Optional[str]
    kernel_size: Optional[int]
    models_ttl: int
    _progress_hooks: list[Any]
    result_sub_folder: str
    batch_size: int

    # Minimum number of regions on a page before the page-level target-language
    # check is worth running. Single-sourced so every page-level call site agrees
    # (Issue #109). Below this, a few untranslated SFX/credits would dominate the
    # ratio and reject an otherwise-fine page.
    _PAGE_LANG_CHECK_MIN_REGIONS = 6

    def __init__(self, params: dict = None):
        self.pre_dict = params.get('pre_dict', None)
        self.post_dict = params.get('post_dict', None)
        self.font_path = None
        self.use_mtpe = False
        self.kernel_size = None
        self.device = None
        self._gpu_limited_memory = False
        self.ignore_errors = False
        self.verbose = False
        self.models_ttl = 0
        self.batch_size = 1  # 默认不批量处理

        self._progress_hooks = []
        self._add_logger_hook()

        params = params or {}

        self.disable_memory_optimization = params.get('disable_memory_optimization', False)
        # batch_concurrent 会在 parse_init_params 中验证并设置
        self.batch_concurrent = params.get('batch_concurrent', False)
        
        self.parse_init_params(params)
        self.result_sub_folder = ''

        # Process-global construction settings (model dir override + TF32 flags) — S12
        apply_global_settings(params)

        self._model_usage_tracker = ModelUsageTracker()
        self._model_unloader = ModelUnloader(
            {
                'colorization': unload_colorization,
                'detection': unload_detection,
                'inpainting': unload_inpainting,
                'ocr': unload_ocr,
                'upscaling': unload_upscaling,
                'translation': unload_translation,
            },
            empty_cache=torch.cuda.empty_cache,
            cuda_available=torch.cuda.is_available,
        )
        self._model_reaper = ModelReaper(self._model_usage_tracker, self._model_unloader, lambda: self.models_ttl)
        self._model_lifecycle = ModelLifecycle(self._model_reaper, {
            'upscaling': prepare_upscaling, 'detection': prepare_detection,
            'ocr': prepare_ocr, 'inpainting': prepare_inpainting,
            'translation': prepare_translation, 'colorization': prepare_colorization,
        })
        self.prep_manual = params.get('prep_manual', None)
        self.context_size = params.get('context_size', 0)
        self._translation_memory = TranslationMemory()  # 跨页翻译记忆 / cross-page memory (S16, #136/#140)

        # 调试图片管理相关属性
        self._image_debug = ImageDebugContext()  # 图片级调试上下文 / per-image debug context (S11)
        
        # 设置日志文件
        self._setup_log_file()

    def _setup_log_file(self):
        """设置日志文件，在result文件夹下创建带时间戳的log文件"""
        try:
            # 创建result目录
            result_dir = os.path.join(BASE_PATH, 'result')
            os.makedirs(result_dir, exist_ok=True)
            
            # 生成带时间戳的日志文件名
            from datetime import datetime
            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
            log_filename = f"log_{timestamp}.txt"
            log_path = os.path.join(result_dir, log_filename)
            
            # 配置文件日志处理器
            file_handler = logging.FileHandler(log_path, encoding='utf-8')
            file_handler.setLevel(logging.DEBUG)
            # 使用自定义格式器，保持与控制台输出一致
            from .utils.log import Formatter
            formatter = Formatter()
            file_handler.setFormatter(formatter)
            
            # 添加到manga-translator根logger以捕获所有输出
            mt_logger = logging.getLogger('manga-translator')
            mt_logger.addHandler(file_handler)
            if not mt_logger.level or mt_logger.level > logging.DEBUG:
                mt_logger.setLevel(logging.DEBUG)
            
            # 保存日志文件路径供后续使用
            self._log_file_path = log_path
            
            # 简单的print重定向
            import builtins
            original_print = builtins.print
            
            def log_print(*args, **kwargs):
                # 正常打印到控制台
                original_print(*args, **kwargs)
                # 同时写入日志文件
                try:
                    import io
                    buffer = io.StringIO()
                    original_print(*args, file=buffer, **kwargs)
                    output = buffer.getvalue()
                    if output.strip():
                        with open(log_path, 'a', encoding='utf-8') as f:
                            f.write(output)
                except Exception:
                    pass
            
            builtins.print = log_print
            
            # Rich Console输出重定向
            try:
                from rich.console import Console
                import sys
                
                # 创建一个自定义的文件对象，同时写入控制台和日志文件
                class TeeFile:
                    def __init__(self, log_file_path, original_file):
                        self.log_file_path = log_file_path
                        self.original_file = original_file
                    
                    def write(self, text):
                        # 写入原始输出
                        self.original_file.write(text)
                        # 写入日志文件
                        try:
                            if text.strip():
                                with open(self.log_file_path, 'a', encoding='utf-8') as f:
                                    f.write(text)
                        except Exception:
                            pass
                        return len(text)
                    
                    def flush(self):
                        self.original_file.flush()
                    
                    def __getattr__(self, name):
                        return getattr(self.original_file, name)
                
                # 创建一个仅用于日志记录的Console（无颜色、无样式）
                class LogOnlyFile:
                    def __init__(self, log_file_path):
                        self.log_file_path = log_file_path
                    
                    def write(self, text):
                        try:
                            if text.strip():
                                with open(self.log_file_path, 'a', encoding='utf-8') as f:
                                    f.write(text)
                        except Exception:
                            pass
                        return len(text)
                    
                    def flush(self):
                        pass
                    
                    def isatty(self):
                        return False
                
                # 为日志创建纯文本console
                log_file_only = LogOnlyFile(log_path)
                log_console = Console(file=log_file_only, force_terminal=False, no_color=True, width=80)
                
                # 创建带颜色的控制台console
                display_console = Console(force_terminal=True)
                
                # 全局设置console实例，供translator使用
                global _global_console, _log_console
                _global_console = display_console  # 控制台显示用
                _log_console = log_console         # 日志记录用
                
            except Exception as e:
                logger.debug(f"Failed to setup rich console logging: {e}")
            
            logger.info(f"Log file created: {log_path}")
        except Exception as e:
            print(f"Failed to setup log file: {e}")

    def parse_init_params(self, params: dict):
        # #187 S12: the field parsing + device/using_gpu/raise logic + batch_concurrent
        # auto-disable now live in the PipelineParams value object (byte-identical).
        pp = PipelineParams.from_params(params, self.batch_concurrent)
        self.verbose = pp.verbose
        self.use_mtpe = pp.use_mtpe
        self.font_path = pp.font_path
        self.models_ttl = pp.models_ttl
        self.batch_size = pp.batch_size
        self.batch_concurrent = pp.batch_concurrent
        self.ignore_errors = pp.ignore_errors
        self.device = pp.device
        self._gpu_limited_memory = pp.gpu_limited_memory
        self.kernel_size = pp.kernel_size
        self.input_files = pp.input_files
        self.save_text = pp.save_text
        self.load_text = pp.load_text
        
        # batch_concurrent 已在初始化时设置并验证
        

        
    def _set_image_context(self, config: Config, image=None):
        """Delegate to ImageDebugContext (#187 S11)."""
        self._image_debug.set(config, image)

    def _get_image_subfolder(self) -> str:
        return self._image_debug.subfolder

    def _save_current_image_context(self, image_md5: str):
        self._image_debug.save(image_md5)

    def _restore_image_context(self, image_md5: str):
        return self._image_debug.restore(image_md5)

    @property
    def using_gpu(self):
        return self.device.startswith('cuda') or self.device == 'mps'

    async def translate(self, image: Image.Image, config: Config, image_name: str = None, skip_context_save: bool = False) -> Context:
        """
        Translates a single image.

        :param image: Input image.
        :param config: Translation config.
        :param image_name: Deprecated parameter, kept for compatibility.
        :return: Translation context.
        """
        await self._report_progress('running_pre_translation_hooks')
        for hook in self._progress_hooks:
            try:
                hook('running_pre_translation_hooks', False)
            except Exception as e:
                logger.error(f"Error in progress hook: {e}")

        ctx = Context()
        ctx.input = image
        ctx.result = None
        ctx.verbose = self.verbose

        # 设置图片上下文以生成调试图片子文件夹
        self._set_image_context(config, image)
        
        # 保存debug文件夹信息到Context中（用于Web模式的缓存访问）
        # 在web模式下总是保存，不仅仅是verbose模式
        ctx.debug_folder = self._get_image_subfolder()
        
        # 保存原始输入图片用于调试 — #187 S14: body in debug_sink
        if self.verbose:
            save_input_png(image, self._result_path)

        # preload and download models (not strictly necessary, remove to lazy load)
        await self._model_lifecycle.preload(config, self.device, self.models_ttl)

        # translate
        ctx = await self._translate(config, ctx)

        # 在翻译流程的最后保存翻译结果，确保保存的是最终结果（包括重试后的结果）
        # Save translation results at the end of translation process to ensure final results are saved
        if not skip_context_save and ctx.text_regions:
            # 汇总本页翻译，供下一页做上文
            page_translations = {r.text_raw if hasattr(r, "text_raw") else r.text: r.translation
                                 for r in ctx.text_regions}
            self._translation_memory.all_page_translations.append(page_translations)

            # 同时保存原文用于并发模式的上下文
            page_original_texts = {i: (r.text_raw if hasattr(r, "text_raw") else r.text)
                                  for i, r in enumerate(ctx.text_regions)}
            self._translation_memory.original_page_texts.append(page_original_texts)

        return ctx

    async def _run_until_translation_stages(self, ctx: Context, config: Config):
        """Run the shared colorize→upscale→detect→ocr→textline_merge→pre-dict block
        (#187 S25). Returns ``(ctx, finished)``: ``finished=True`` means an
        early-exit fired (no regions / no text) and ``ctx`` is already the final
        reverted result; ``finished=False`` means continue to translation. Both
        ``_translate`` and ``_translate_until_translation`` drive this identical
        sequence — the divergence lives only in their prefix (preload /
        save_input_png) and suffix (continue-to-translation vs save image_context).
        """
        # -- Colorization
        if config.colorizer.colorizer != Colorizer.none:
            ctx.img_colorized = await self._run_stage(
                'colorizing',
                lambda: self._run_colorizer(config, ctx),
                lambda: ctx.input)  # Fallback to input image if colorization fails
        else:
            ctx.img_colorized = ctx.input

        # -- Upscaling
        # The default text detector doesn't work very well on smaller images, might want to
        # consider adding automatic upscaling on certain kinds of small images.
        if config.upscale.upscale_ratio:
            ctx.upscaled = await self._run_stage(
                'upscaling',
                lambda: self._run_upscaling(config, ctx),
                lambda: ctx.img_colorized)  # Fallback to colorized (or input) image if upscaling fails
        else:
            ctx.upscaled = ctx.img_colorized

        ctx.img_rgb, ctx.img_alpha = load_image(ctx.upscaled)

        # -- Detection
        ctx.textlines, ctx.mask_raw, ctx.mask = await self._run_stage(
            'detection',
            lambda: self._run_detection(config, ctx),
            lambda: ([], None, None))

        if self.verbose and ctx.mask_raw is not None:
            save_mask_raw(ctx.mask_raw, self._result_path)

        if not ctx.textlines:
            await self._report_progress('skip-no-regions', True)
            # If no text was found result is intermediate image product
            ctx.result = ctx.upscaled
            return await self._revert_upscale(config, ctx), True

        if self.verbose:
            save_bboxes_unfiltered(ctx.img_rgb, ctx.textlines, self._result_path)

        # -- OCR
        ctx.textlines = await self._run_stage(
            'ocr',
            lambda: self._run_ocr(config, ctx),
            lambda: [])  # Fallback to empty textlines if OCR fails

        if not ctx.textlines:
            await self._report_progress('skip-no-text', True)
            # If no text was found result is intermediate image product
            ctx.result = ctx.upscaled
            return await self._revert_upscale(config, ctx), True

        # -- Textline merge
        ctx.text_regions = await self._run_stage(
            'textline_merge',
            lambda: self._run_textline_merge(config, ctx),
            lambda: [])  # Fallback to empty text_regions if textline merge fails

        if self.verbose and ctx.text_regions:
            save_bboxes(ctx.img_rgb, ctx.text_regions, config, self._result_path)

        # Apply pre-dictionary after textline merge
        pre_dict = load_dictionary(self.pre_dict)
        pre_replacements = []
        for region in ctx.text_regions:
            original = region.text
            region.text = apply_dictionary(region.text, pre_dict)
            if original != region.text:
                pre_replacements.append(f"{original} => {region.text}")

        if pre_replacements:
            logger.info("Pre-translation replacements:")
            for replacement in pre_replacements:
                logger.info(replacement)
        else:
            logger.info("No pre-translation replacements made.")

        return ctx, False

    async def _translate(self, config: Config, ctx: Context) -> Context:
        # Start the background cleanup job once if not already started.
        self._model_lifecycle.ensure_running()

        ctx, finished = await self._run_until_translation_stages(ctx, config)
        if finished:
            return ctx

        # -- Translation
        ctx.text_regions = await self._run_stage(
            'translating',
            lambda: self._run_text_translation(config, ctx),
            lambda: [])  # Fallback to empty text_regions if translation fails

        await self._report_progress('after-translating')

        if not ctx.text_regions:
            await self._report_progress('error-translating', True)
            ctx.result = ctx.upscaled
            return await self._revert_upscale(config, ctx)
        elif ctx.text_regions == 'cancel':
            await self._report_progress('cancelled', True)
            ctx.result = ctx.upscaled
            return await self._revert_upscale(config, ctx)

        # -- Mask refinement
        # (Delayed to take advantage of the region filtering done after ocr and translation)
        if ctx.mask is None:
            ctx.mask = await self._run_stage(
                'mask-generation',
                lambda: self._run_mask_refinement(config, ctx),
                lambda: ctx.mask_raw if ctx.mask_raw is not None else np.zeros_like(ctx.img_rgb, dtype=np.uint8)[:,:,0])  # Fallback to raw mask or empty mask

        if self.verbose and ctx.mask is not None:
            # #187 S14: unguarded variant — body in debug_sink (the batch driver's is guarded)
            await save_inpaint_preview(
                ctx.mask, self._result_path,
                lambda: dispatch_inpainting(Inpainter.none, ctx.img_rgb, ctx.mask, config.inpainter,config.inpainter.inpainting_size,
                                            self.device, self.verbose))

        # -- Inpainting
        ctx.img_inpainted = await self._run_stage(
            'inpainting',
            lambda: self._run_inpainting(config, ctx),
            lambda: ctx.img_rgb)
        ctx.gimp_mask = np.dstack((cv2.cvtColor(ctx.img_inpainted, cv2.COLOR_RGB2BGR), ctx.mask))

        if self.verbose:
            save_inpainted(ctx.img_inpainted, self._result_path)
        # -- Rendering
        # #187 S23: kept inline — 'rendering' is reported, then the conditional
        # 'rendering_folder:' message, BEFORE the stage runs; _run_stage couples
        # report+run so folding it would double-report 'rendering' and reorder.
        await self._report_progress('rendering')

        # 在rendering状态后立即发送文件夹信息，用于前端精确检查final.png
        if hasattr(self, '_progress_hooks') and self._image_debug.current:
            folder_name = self._image_debug.current['subfolder']
            # 发送特殊格式的消息，前端可以解析
            await self._report_progress(f'rendering_folder:{folder_name}')

        try:
            ctx.img_rendered = await self._run_text_rendering(config, ctx)
        except Exception as e:
            logger.error(f"Error during rendering:\n{traceback.format_exc()}")
            if not self.ignore_errors:
                raise
            ctx.img_rendered = ctx.img_inpainted # Fallback to inpainted (or original RGB) image if rendering fails

        await self._report_progress('finished', True)
        ctx.result = dump_image(ctx.input, ctx.img_rendered, ctx.img_alpha)

        return await self._revert_upscale(config, ctx)
    
    # If `revert_upscaling` is True, revert to input size
    # Else leave `ctx` as-is
    async def _revert_upscale(self, config: Config, ctx: Context):
        if config.upscale.revert_upscaling:
            await self._report_progress('downscaling')
            ctx.result = ctx.result.resize(ctx.input.size)

        # 在verbose模式下保存final.png到调试文件夹 — #187 S14: body in debug_sink
        if ctx.result and self.verbose:
            save_final(ctx.result, self._result_path)

        # Web流式模式优化：保存final.png并使用占位符
        if ctx.result and not self.result_sub_folder and hasattr(self, '_is_streaming_mode') and self._is_streaming_mode:
            # 保存final.png文件
            final_img = np.array(ctx.result)
            if len(final_img.shape) == 3:  # 彩色图片，转换BGR顺序
                final_img = cv2.cvtColor(final_img, cv2.COLOR_RGB2BGR)
            cv2.imwrite(self._result_path('final.png'), final_img)

            # 通知前端文件已就绪
            if hasattr(self, '_progress_hooks') and self._image_debug.current:
                folder_name = self._image_debug.current['subfolder']
                await self._report_progress(f'final_ready:{folder_name}')

            # 创建占位符结果并立即返回
            from PIL import Image
            placeholder = Image.new('RGB', (1, 1), color='white')
            ctx.result = placeholder
            ctx.use_placeholder = True
            return ctx

        return ctx

    async def _run_colorizer(self, config: Config, ctx: Context):
        current_time = time.time()
        self._model_usage_tracker.touch("colorizer", config.colorizer.colorizer, current_time)
        return await run_colorizer(config, ctx, self.device)

    async def _run_upscaling(self, config: Config, ctx: Context):
        current_time = time.time()
        self._model_usage_tracker.touch("upscaling", config.upscale.upscaler, current_time)
        return await run_upscaling(config, ctx, self.device)

    async def _run_detection(self, config: Config, ctx: Context):
        current_time = time.time()
        self._model_usage_tracker.touch("detection", config.detector.detector, current_time)
        return await run_detection(config, ctx, self.device, self.verbose)


    async def _unload_model(self, tool: str, model: str):
        await self._model_unloader.unload(tool, model)


    async def _run_ocr(self, config: Config, ctx: Context):
        current_time = time.time()
        self._model_usage_tracker.touch("ocr", config.ocr.ocr, current_time)
        
        # OCR debug-dir + MANGA_OCR_RESULT_DIR env dance — #187 S14: body in debug_sink
        with ocr_debug_dir_env(self.verbose, self._get_image_subfolder, self.result_sub_folder, BASE_PATH):
            textlines = await dispatch_ocr(config.ocr.ocr, ctx.img_rgb, ctx.textlines, config.ocr, self.device, self.verbose)

        new_textlines = []
        for textline in textlines:
            if textline.text.strip():
                if config.render.font_color_fg:
                    textline.fg_r, textline.fg_g, textline.fg_b = config.render.font_color_fg
                if config.render.font_color_bg:
                    textline.bg_r, textline.bg_g, textline.bg_b = config.render.font_color_bg
                new_textlines.append(textline)
        return new_textlines

    async def _run_textline_merge(self, config: Config, ctx: Context):
        current_time = time.time()
        self._model_usage_tracker.touch("textline_merge", "textline_merge", current_time)
        text_regions = await dispatch_textline_merge(ctx.textlines, ctx.img_rgb.shape[1], ctx.img_rgb.shape[0],
                                                     verbose=self.verbose)
        for region in text_regions:
            if not hasattr(region, "text_raw"):
                region.text_raw = region.text      # <- Save the initial OCR results to expand the render detection box. Also, prevent affecting the forbidden translation function.       
        # Filter out languages to skip  
        if config.translator.skip_lang is not None:  
            skip_langs = [lang.strip().upper() for lang in config.translator.skip_lang.split(',')]  
            filtered_textlines = []  
            for txtln in ctx.textlines:  
                try:  
                    detected_lang, confidence = langid.classify(txtln.text)
                    source_language = ISO_639_1_TO_VALID_LANGUAGES.get(detected_lang, 'UNKNOWN')
                    if source_language != 'UNKNOWN':
                        source_language = source_language.upper()
                except Exception:  
                    source_language = 'UNKNOWN'  
    
                # Print detected source_language and whether it's in skip_langs  
                # logger.info(f'Detected source language: {source_language}, in skip_langs: {source_language in skip_langs}, text: "{txtln.text}"')  
    
                if source_language in skip_langs:  
                    logger.info(f'Filtered out: {txtln.text}')  
                    logger.info(f'Reason: Detected language {source_language} is in skip_langs')  
                    continue  # Skip this region  
                filtered_textlines.append(txtln)  
            ctx.textlines = filtered_textlines  
    
        text_regions = await dispatch_textline_merge(ctx.textlines, ctx.img_rgb.shape[1], ctx.img_rgb.shape[0],  
                                                     verbose=self.verbose)  

        new_text_regions = []
        for region in text_regions:
            # Remove leading spaces after pre-translation dictionary replacement                
            original_text = region.text  
            stripped_text = original_text.strip()  
            
            # Record removed leading characters  
            removed_start_chars = original_text[:len(original_text) - len(stripped_text)]  
            if removed_start_chars:  
                logger.info(f'Removed leading characters: "{removed_start_chars}" from "{original_text}"')  
            
            # Modified filtering condition: handle incomplete parentheses  
            bracket_pairs = {  
                '(': ')', '（': '）', '[': ']', '【': '】', '{': '}', '〔': '〕', '〈': '〉', '「': '」',  
                '"': '"', '＂': '＂', "'": "'", "“": "”", '《': '》', '『': '』', '"': '"', '〝': '〞', '﹁': '﹂', '﹃': '﹄',  
                '⸂': '⸃', '⸄': '⸅', '⸉': '⸊', '⸌': '⸍', '⸜': '⸝', '⸠': '⸡', '‹': '›', '«': '»', '＜': '＞', '<': '>'  
            }   
            left_symbols = set(bracket_pairs.keys())  
            right_symbols = set(bracket_pairs.values())  
            
            has_brackets = any(s in stripped_text for s in left_symbols) or any(s in stripped_text for s in right_symbols)  
            
            if has_brackets:  
                result_chars = []  
                stack = []  
                to_skip = []    
                
                # 第一次遍历：标记匹配的括号  
                # First traversal: mark matching brackets
                for i, char in enumerate(stripped_text):  
                    if char in left_symbols:  
                        stack.append((i, char))  
                    elif char in right_symbols:  
                        if stack:  
                            # 有对应的左括号，出栈  
                            # There is a corresponding left bracket, pop the stack
                            stack.pop()  
                        else:  
                            # 没有对应的左括号，标记为删除  
                            # No corresponding left parenthesis, marked for deletion
                            to_skip.append(i)  
                
                # 标记未匹配的左括号为删除
                # Mark unmatched left brackets as delete  
                for pos, _ in stack:  
                    to_skip.append(pos)  
                
                has_removed_symbols = len(to_skip) > 0  
                
                # 第二次遍历：处理匹配但不对应的括号
                # Second pass: Process matching but mismatched brackets
                stack = []  
                for i, char in enumerate(stripped_text):  
                    if i in to_skip:  
                        # 跳过孤立的括号
                        # Skip isolated parentheses
                        continue  
                        
                    if char in left_symbols:  
                        stack.append(char)  
                        result_chars.append(char)  
                    elif char in right_symbols:  
                        if stack:  
                            left_bracket = stack.pop()  
                            expected_right = bracket_pairs.get(left_bracket)  
                            
                            if char != expected_right:  
                                # 替换不匹配的右括号为对应左括号的正确右括号
                                # Replace mismatched right brackets with the correct right brackets corresponding to the left brackets
                                result_chars.append(expected_right)  
                                logger.info(f'Fixed mismatched bracket: replaced "{char}" with "{expected_right}"')  
                            else:  
                                result_chars.append(char)  
                    else:  
                        result_chars.append(char)  
                
                new_stripped_text = ''.join(result_chars)  
                
                if has_removed_symbols:  
                    logger.info(f'Removed unpaired bracket from "{stripped_text}"')  
                
                if new_stripped_text != stripped_text and not has_removed_symbols:  
                    logger.info(f'Fixed brackets: "{stripped_text}" → "{new_stripped_text}"')  
                
                stripped_text = new_stripped_text  
              
            region.text = stripped_text.strip()     
            
            # SFX rescue (#168/#172) — runs BEFORE the value/lang filter so it works for EVERY
            # target language. A LARGE region the 48px line-OCR could only read as a few characters
            # is a stylized SFX (e.g. ぬ); localize the crop to the TARGET language via the
            # custom_openai/9arm vision gateway and keep it. (The old code nested the rescue inside
            # the filter, which only caught SFX when the misread happened to match the target script
            # — i.e. English — so SFX were dropped, leaving the raw JP glyph, for TH/ZH/KO.)
            # #278: gate the rescue on det_sfx PROVENANCE (region.from_sfx_detection), not a bare
            # ≤4-char heuristic — so a short dialogue line ('HUH?', 'おい') in a large bubble is not
            # misread as SFX (and doesn't add a vision-gateway round-trip). Tight ≤2-char fallback
            # only when provenance is unavailable (det_sfx off).
            from .ocr_vlm import should_rescue_sfx
            _x1, _y1, _x2, _y2 = (int(v) for v in region.xyxy)
            if should_rescue_sfx(region.text, getattr(region, 'from_sfx_detection', False),
                                 _x2 - _x1, _y2 - _y1, config.ocr.vlm_rescue):
                x1, y1, x2, y2 = _x1, _y1, _x2, _y2
                from .ocr_vlm import vlm_localize_sfx
                from .translators.keys import (CUSTOM_OPENAI_API_BASE,
                                               CUSTOM_OPENAI_API_KEY, CUSTOM_OPENAI_MODEL)
                crop = ctx.img_rgb[max(0, y1):max(0, y2), max(0, x1):max(0, x2)]
                if crop.size:
                    rescued = vlm_localize_sfx(crop, api_base=CUSTOM_OPENAI_API_BASE,
                                               api_key=CUSTOM_OPENAI_API_KEY, model=CUSTOM_OPENAI_MODEL,
                                               target_lang=config.translator.target_lang)
                    if rescued:
                        logger.info(f'[OcrVLM] rescued SFX region "{region.text}" -> "{rescued}"')
                        # The rescue produced the FINAL SFX in the target language. Pre-setting
                        # text+translation makes source_lang auto-derive as the target so the
                        # translate stage skips it, and filter_translated_regions keeps it.
                        region.text = rescued
                        region.translation = rescued
                        region.sfx_rescued = True  # restore_sfx_translations re-applies after translate
                        new_text_regions.append(region)
                        continue

            if len(region.text) < config.ocr.min_text_length \
                    or not is_valuable_text(region.text) \
                    or (not config.translator.no_text_lang_skip and langcodes.tag_distance(region.source_lang, config.translator.target_lang) == 0):
                if region.text.strip():
                    logger.info(f'Filtered out: {region.text}')
                    if len(region.text) < config.ocr.min_text_length:
                        logger.info('Reason: Text length is less than the minimum required length.')
                    elif not is_valuable_text(region.text):
                        logger.info('Reason: Text is not considered valuable.')
                    elif langcodes.tag_distance(region.source_lang, config.translator.target_lang) == 0:
                        logger.info('Reason: Text language matches the target language and no_text_lang_skip is False.')
            else:
                if config.render.font_color_fg or config.render.font_color_bg:
                    if config.render.font_color_bg:
                        region.adjust_bg_color = False
                new_text_regions.append(region)
        text_regions = new_text_regions

        text_regions = sort_regions(
            text_regions,
            right_to_left=config.render.rtl,
            img=ctx.img_rgb,
            force_simple_sort=config.force_simple_sort
        )   
        
        return text_regions

    def _build_prev_context(self, use_original_text=False, current_page_index=None, batch_index=None, batch_original_texts=None):
        """Thin delegate to the pure ``build_prev_context`` (#187 S6) — the per-mode
        index policy now lives in a testable pure function; the two call sites are
        unchanged."""
        return build_prev_context(
            self._translation_memory.all_page_translations, self._translation_memory.original_page_texts, self.context_size,
            use_original_text=use_original_text,
            current_page_index=current_page_index,
            batch_index=batch_index,
            batch_original_texts=batch_original_texts,
        )

    async def _dispatch_with_context(self, config: Config, texts: list[str], ctx: Context):
        # 计算实际要使用的上下文页数和跳过的空页数 / context page accounting
        done_pages = self._translation_memory.all_page_translations
        pages_used, skipped = context_page_counts(self.context_size, done_pages)

        if self.context_size > 0:
            logger.info(f"Context-aware translation enabled with {self.context_size} pages of history")

        # 构建上下文字符串 / build the context string
        prev_ctx = self._build_prev_context()

        # ChatGPT / ChatGPT2Stage：构造后注入上下文（单页模式 result_path 直接绑定，无 batch 接线）
        if config.translator.translator in [Translator.chatgpt, Translator.chatgpt_2stage]:
            translator = build_chatgpt_translator(config.translator.translator)
            return await dispatch_translate(
                translator, texts, config, ctx, prev_ctx, pages_used, skipped,
                result_path_callback=self._result_path,
                on_2stage_batch_setup=None,
            )

        return await dispatch_translation(
            config.translator.translator_gen,
            texts,
            config.translator,
            self.use_mtpe,
            ctx,
            'cpu' if self._gpu_limited_memory else self.device
        )

    async def _run_text_translation(self, config: Config, ctx: Context):
        # 检查text_regions是否为None或空
        if not ctx.text_regions:
            return []
            
        # 如果设置了prep_manual则将translator设置为none，防止token浪费
        # Set translator to none to provent token waste if prep_manual is True  
        apply_prep_manual_override(config, self.prep_manual)
    
        current_time = time.time()
        self._model_usage_tracker.touch("translation", config.translator.translator, current_time)

        # 为none翻译器添加特殊处理  
        # Add special handling for none translator  
        if config.translator.translator == Translator.none:
            stamp_none_translations(ctx.text_regions, config)
            return ctx.text_regions  

        # 以下翻译处理仅在非none翻译器或有none翻译器但没有prep_manual时执行  
        # Translation processing below only happens for non-none translator or none translator without prep_manual  
        if self.load_text:  
            input_filename = os.path.splitext(os.path.basename(self.input_files[0]))[0]  
            translated_sentences = read_translations(self._result_path(f"{input_filename}_translations.txt"))  
        else:  
            # 如果是none翻译器，不需要调用翻译服务，文本已经设置为空  
            # If using none translator, no need to call translation service, text is already set to empty  
            if config.translator.translator != Translator.none:  
                # 自动给 ChatGPT 加上下文，其他翻译器不改变
                # Automatically add context to ChatGPT, no change for other translators
                texts = [region.text for region in ctx.text_regions]
                translated_sentences = \
                    await self._dispatch_with_context(config, texts, ctx)
            else:  
                # 对于none翻译器，创建一个空翻译列表  
                # For none translator, create an empty translation list  
                translated_sentences = ["" for _ in ctx.text_regions]  

            # Save translation if args.save_text is set and quit  
            if self.save_text:  
                input_filename = os.path.splitext(os.path.basename(self.input_files[0]))[0]  
                write_translations(self._result_path(f"{input_filename}_translations.txt"), translated_sentences)  
                print("Don't continue if --save-text is used")  
                exit(-1)  

        # 如果不是none翻译器或者是none翻译器但没有prep_manual  
        # If not none translator or none translator without prep_manual  
        if config.translator.translator != Translator.none or not self.prep_manual:
            apply_translations(ctx.text_regions, translated_sentences, config, apply_casing=True)
            # #168/#172: the translator blanks already-English SFX the rescue produced;
            # restore them so filter_translated_regions keeps the localized SFX.
            from .ocr_vlm import restore_sfx_translations
            restore_sfx_translations(ctx.text_regions)

        # Punctuation correction logic. for translators often incorrectly change quotation marks from the source language to those commonly used in the target language.
        for region in ctx.text_regions:
            if region.text and region.translation:
                region.translation = correct_punctuation(region.text, region.translation)

        # 注意：翻译结果的保存移动到了翻译流程的最后，确保保存的是最终结果而不是重试前的结果

        # Apply post dictionary after translating
        apply_post_dictionary(ctx.text_regions, self.post_dict)

        # 译后检查和重试逻辑 - 第一阶段：单个region幻觉检测
        failed_regions = []
        if config.translator.enable_post_translation_check:
            logger.info("Starting post-translation check...")
            
            # 单个region级别的幻觉检测（在过滤前进行）
            for region in ctx.text_regions:
                if region.translation and region.translation.strip():
                    # 只检查重复内容幻觉，不进行页面级目标语言检查
                    if await self._check_repetition_hallucination(
                        region.translation, 
                        config.translator.post_check_repetition_threshold,
                        silent=False
                    ):
                        failed_regions.append(region)
            
            # 对失败的区域进行重试
            if failed_regions:
                logger.warning(f"Found {len(failed_regions)} regions that failed repetition check, starting retry...")
                for region in failed_regions:
                    await self._retry_translation_with_validation(region, config, ctx)
                logger.info("Repetition check retry finished.")

        # 译后检查和重试逻辑 - 第二阶段 — #187 S18: body in post_translation.single_page_lang_check_retry
        await single_page_lang_check_retry(
            ctx.text_regions, config, ctx,
            min_regions=self._PAGE_LANG_CHECK_MIN_REGIONS, min_ratio=0.5,
            check_ratio=self._check_target_language_ratio,
            batch_translate=self._batch_translate_texts,
        )

        # 过滤逻辑（简化版本，保留主要过滤条件）
        new_text_regions = filter_translated_regions(ctx.text_regions, config)

        return new_text_regions

    async def _run_mask_refinement(self, config: Config, ctx: Context):
        return await run_mask_refinement(config, ctx, self.verbose, self.kernel_size)

    async def _run_inpainting(self, config: Config, ctx: Context):
        current_time = time.time()
        self._model_usage_tracker.touch("inpainting", config.inpainter.inpainter, current_time)
        return await run_inpainting(config, ctx, self.device, self.verbose)

    def _render_font_path(self, config: Config, target_lang: str) -> str:
        """#176: Latin/EN targets render in the bundled comic font when enabled;
        everything else keeps the worker font (Prompt-Bold for Thai, CJK fallbacks).
        Off (or font missing) → ``self.font_path`` (byte-identical).

        Render-parity B: ``render.en_font`` overrides the EN face by filename so a
        heavier comic font (e.g. a CC Wild Words-style face) can be dropped into
        ``fonts/`` — MangaTranslator's BYO-font approach. Takes precedence over the
        bundled comic font; missing file → falls through to the prior behavior."""
        if target_lang in ('ENG',):
            fonts_dir = os.path.join(os.path.dirname(__file__), '..', 'fonts')
            if config.render.en_font:
                override = os.path.normpath(os.path.join(fonts_dir, config.render.en_font))
                if os.path.isfile(override):
                    return override
            if config.render.en_comic_font:
                comic = os.path.normpath(os.path.join(fonts_dir, 'comic shanns 2.ttf'))
                if os.path.isfile(comic):
                    return comic
        return self.font_path

    async def _run_text_rendering(self, config: Config, ctx: Context):
        current_time = time.time()
        self._model_usage_tracker.touch("rendering", config.render.renderer, current_time)
        font_path = self._render_font_path(
            config, ctx.text_regions[0].target_lang if ctx.text_regions else '')
        return await run_text_rendering(config, ctx, font_path)

    def _result_path(self, path: str) -> str:
        """Path to the result folder for intermediate (verbose) or web-cached images
        (#187 S11 — delegates to ImageDebugContext)."""
        return self._image_debug.result_path(path, verbose=self.verbose, result_sub_folder=self.result_sub_folder)

    def add_progress_hook(self, ph):
        self._progress_hooks.append(ph)

    async def _report_progress(self, state: str, finished: bool = False):
        for ph in self._progress_hooks:
            await ph(state, finished)

    async def _run_stage(self, name, fn, fallback):
        # #187 S23: thin bind of the uniform stage policy (progress + try/except
        # ignore_errors + "Error during {name}" log). `logger` is the live
        # module global so set_main_logger swaps are honoured at call time.
        return await run_stage(
            name, fn, fallback,
            report_progress=self._report_progress,
            ignore_errors=self.ignore_errors,
            logger=logger,
        )

    def _add_logger_hook(self):
        # TODO: Pass ctx to logger hook
        LOG_MESSAGES = {
            'upscaling': 'Running upscaling',
            'detection': 'Running text detection',
            'ocr': 'Running ocr',
            'mask-generation': 'Running mask refinement',
            'translating': 'Running text translation',
            'rendering': 'Running rendering',
            'colorizing': 'Running colorization',
            'downscaling': 'Running downscaling',
        }
        LOG_MESSAGES_SKIP = {
            'skip-no-regions': 'No text regions! - Skipping',
            'skip-no-text': 'No text regions with text! - Skipping',
            'error-translating': 'Text translator returned empty queries',
            'cancelled': 'Image translation cancelled',
        }
        LOG_MESSAGES_ERROR = {
            # 'error-lang':           'Target language not supported by chosen translator',
        }

        async def ph(state, finished):
            if state in LOG_MESSAGES:
                logger.info(LOG_MESSAGES[state])
            elif state in LOG_MESSAGES_SKIP:
                logger.warn(LOG_MESSAGES_SKIP[state])
            elif state in LOG_MESSAGES_ERROR:
                logger.error(LOG_MESSAGES_ERROR[state])

        self.add_progress_hook(ph)

    async def _preprocess_image_for_batch(self, image, config, i, memory_optimization_enabled):
        """Pre-process one batch image through `_translate_until_translation`, with
        the MemoryError fallback ladder (#187 S26b). Returns the ``(ctx, config)``
        pair the caller appends to ``pre_translation_contexts``: on success the
        real ctx + original config; on MemoryError a ``release_memory`` +
        deepcopy-config retry (or re-raise when memory optimization is off); on
        retry failure or any other error a placeholder Context + the original
        config. The per-image psutil check stays in the driver loop.
        """
        try:
            # 为批量处理中的每张图片设置上下文
            self._set_image_context(config, image)
            # 保存图片上下文，确保后处理阶段使用相同的文件夹
            if self._image_debug.current:
                image_md5 = self._image_debug.current['file_md5']
                self._save_current_image_context(image_md5)
            ctx = await self._translate_until_translation(image, config)
            # 保存图片上下文到Context对象中，用于后续批量处理
            if self._image_debug.current:
                ctx.image_context = self._image_debug.current.copy()
            # 保存verbose标志到Context对象中
            ctx.verbose = self.verbose
            logger.debug(f'Image {i+1} pre-processing successful')
            return (ctx, config)
        except MemoryError as e:
            logger.error(f'Memory error in pre-processing image {i+1}: {e}')
            if not memory_optimization_enabled:
                logger.error('Consider enabling memory optimization')
                raise

            # 尝试降级处理
            try:
                logger.warning(f'Image {i+1} attempting fallback processing...')
                import copy
                recovery_config = copy.deepcopy(config)

                # 强制清理
                release_memory(torch.cuda.is_available, torch.cuda.empty_cache)

                # 重新设置图片上下文
                self._set_image_context(recovery_config, image)
                # 保存fallback图片上下文
                if self._image_debug.current:
                    image_md5 = self._image_debug.current['file_md5']
                    self._save_current_image_context(image_md5)
                ctx = await self._translate_until_translation(image, recovery_config)
                # 保存图片上下文到Context对象中
                if self._image_debug.current:
                    ctx.image_context = self._image_debug.current.copy()
                # 保存verbose标志到Context对象中
                ctx.verbose = self.verbose
                logger.info(f'Image {i+1} fallback processing successful')
                return (ctx, recovery_config)
            except Exception as retry_error:
                logger.error(f'Image {i+1} fallback processing also failed: {retry_error}')
                return (placeholder_context(image), config)
        except Exception as e:
            logger.error(f'Image {i+1} pre-processing error: {e}')
            return (placeholder_context(image), config)

    async def translate_batch(self, images_with_configs: List[tuple], batch_size: int = None, image_names: List[str] = None) -> List[Context]:
        """
        批量翻译多张图片，在翻译阶段进行批量处理以提高效率
        Args:
            images_with_configs: List of (image, config) tuples
            batch_size: 批量大小，如果为None则使用实例的batch_size
            image_names: 已弃用的参数，保留用于兼容性
        Returns:
            List of Context objects with translation results
        """
        batch_size = batch_size or self.batch_size
        if batch_size <= 1:
            # 不使用批量处理时，回到原来的逐个处理方式
            logger.debug('Batch size <= 1, switching to individual processing mode')
            results = []
            for i, (image, config) in enumerate(images_with_configs):
                ctx = await self.translate(image, config)  # 单页翻译时正常保存上下文
                results.append(ctx)
            return results
        
        logger.debug(f'Starting batch translation: {len(images_with_configs)} images, batch size: {batch_size}')
        
        # 简化的内存检查
        memory_optimization_enabled = not self.disable_memory_optimization
        if not memory_optimization_enabled:
            logger.debug('Memory optimization disabled for batch translation')
        
        results = []
        
        # 处理所有图片到翻译之前的步骤
        logger.debug('Starting pre-processing phase...')
        pre_translation_contexts = []
        
        for i, (image, config) in enumerate(images_with_configs):
            logger.debug(f'Pre-processing image {i+1}/{len(images_with_configs)}')
            
            # 简化的内存检查
            if memory_optimization_enabled:
                try:
                    import psutil
                    memory_percent = psutil.virtual_memory().percent
                    if memory_percent > 85:
                        logger.warning(f'High memory usage during pre-processing: {memory_percent:.1f}%')
                        release_memory(torch.cuda.is_available, torch.cuda.empty_cache)
                except ImportError:
                    pass  # psutil 不可用时忽略
                except Exception as e:
                    logger.debug(f'Memory check failed: {e}')
                
            pre_translation_contexts.append(
                await self._preprocess_image_for_batch(image, config, i, memory_optimization_enabled))
        
        if not pre_translation_contexts:
            logger.warning('No images pre-processed successfully')
            return results
            
        logger.debug(f'Pre-processing completed: {len(pre_translation_contexts)} images')
            
        # 批量翻译处理
        logger.debug('Starting batch translation phase...')
        try:
            if self.batch_concurrent:
                logger.info(f'Using concurrent mode for batch translation')
                translated_contexts = await self._concurrent_translate_contexts(pre_translation_contexts)
            else:
                logger.debug(f'Using standard batch mode for translation')
                translated_contexts = await self._batch_translate_contexts(pre_translation_contexts, batch_size)
        except MemoryError as e:
            logger.error(f'Memory error in batch translation: {e}')
            if not memory_optimization_enabled:
                logger.error('Consider enabling memory optimization')
                raise
                
            logger.warning('Batch translation failed, switching to individual page translation mode...')
            # 降级到每页逐个翻译
            translated_contexts = []
            for ctx, config in pre_translation_contexts:
                try:
                    if ctx.text_regions:  # 检查text_regions是否不为None且不为空
                        # 对整页进行翻译处理
                        translated_texts = await self._batch_translate_texts([region.text for region in ctx.text_regions], config, ctx)
                        
                        # 将翻译结果应用到各个region
                        apply_translations(ctx.text_regions, translated_texts, config)
                    translated_contexts.append((ctx, config))
                    
                    # 每页翻译后都清理内存
                    release_memory(torch.cuda.is_available, torch.cuda.empty_cache)
                        
                except Exception as individual_error:
                    logger.error(f'Individual page translation failed: {individual_error}')
                    translated_contexts.append((ctx, config))
        
        # 完成翻译后的处理
        logger.debug('Starting post-processing phase...')
        for i, (ctx, config) in enumerate(translated_contexts):
            try:
                if ctx.text_regions:
                    # 恢复预处理阶段保存的图片上下文，确保使用相同的文件夹
                    # 通过图片计算MD5来恢复上下文
                    from .utils.generic import get_image_md5
                    image = ctx.input  # 从context中获取原始图片
                    image_md5 = get_image_md5(image)
                    if not self._restore_image_context(image_md5):
                        # 如果恢复失败，作为fallback重新设置（理论上不应该发生）
                        logger.warning(f"Failed to restore image context for MD5 {image_md5}, creating new context")
                        self._set_image_context(config, image)
                    ctx = await self._complete_translation_pipeline(ctx, config)
                results.append(ctx)
                logger.debug(f'Image {i+1} post-processing completed')
            except Exception as e:
                logger.error(f'Image {i+1} post-processing error: {e}')
                results.append(ctx)
        
        logger.info(f'Batch translation completed: processed {len(results)} images')

        # 批处理完成后，保存所有页面的最终翻译结果
        for ctx in results:
            if ctx.text_regions:
                # 汇总本页翻译，供下一页做上文（同时保存原文用于并发模式的上下文）
                page_translations, page_original_texts = build_page_translation_record(ctx.text_regions)
                self._translation_memory.all_page_translations.append(page_translations)
                self._translation_memory.original_page_texts.append(page_original_texts)

        # 清理批量处理的图片上下文缓存
        self._image_debug.clear_saved()
        
        return results

    async def _translate_until_translation(self, image: Image.Image, config: Config) -> Context:
        """
        执行翻译之前的所有步骤（彩色化、上采样、检测、OCR、文本行合并）
        """
        ctx = Context()
        ctx.input = image
        ctx.result = None

        # 保存原始输入图片用于调试 — #187 S14: body in debug_sink
        if self.verbose:
            save_input_png(image, self._result_path)

        # preload and download models (not strictly necessary, remove to lazy load)
        await self._model_lifecycle.preload(config, self.device, self.models_ttl)

        # Start the background cleanup job once if not already started.
        self._model_lifecycle.ensure_running()

        ctx, finished = await self._run_until_translation_stages(ctx, config)
        if finished:
            return ctx

        # 保存当前图片上下文到ctx中，用于并发翻译时的路径管理
        if self._image_debug.current:
            ctx.image_context = self._image_debug.current.copy()

        return ctx

    def _detect_region_source_lang(self, region, requested_source_lang: str = '') -> str:
        source_lang = str(getattr(region, 'source_lang', '') or '').upper()
        if source_lang and source_lang != 'UNKNOWN':
            return source_lang

        text = str(getattr(region, 'text', '') or '').strip()
        if not text:
            return 'UNKNOWN'

        # langid is unreliable for Latin-script text — it often confuses
        # English with Polish, French, Dutch, etc. even at high confidence.
        # When the requested source is a Latin-script language (ENG, FRA, DEU…)
        # and the text is mostly ASCII, skip langid entirely and trust the
        # request.  The real purpose of this filter is to separate CJK from
        # Latin, not to distinguish between Latin languages.
        LATIN_SCRIPT_LANGS = {
            'ENG', 'FRA', 'DEU', 'ESP', 'ITA', 'POR', 'NLD', 'POL', 'SWE',
            'NOR', 'DAN', 'FIN', 'CES', 'ROM', 'HUN', 'TUR', 'IND', 'MSA',
            'VIE', 'FIL', 'MAL',
        }
        is_mostly_ascii = sum(1 for c in text if ord(c) < 128) / max(1, len(text)) > 0.85
        if requested_source_lang in LATIN_SCRIPT_LANGS and is_mostly_ascii:
            return requested_source_lang

        try:
            detected_lang, confidence = langid.classify(text)
            lang_tag = ISO_639_1_TO_VALID_LANGUAGES.get(detected_lang, 'UNKNOWN').upper()
            return lang_tag
        except Exception:
            return 'UNKNOWN'

    def _filter_regions_by_source_lang(self, regions: List[Any], config: Config) -> List[Any]:
        source_lang_only = bool(getattr(config.translator, 'source_lang_only', False))
        requested_source_lang = str(getattr(config.translator, 'source_lang', '') or '').strip().upper()

        if not source_lang_only or not requested_source_lang:
            return regions

        filtered_regions = []
        dropped_texts = []
        for region in regions:
            region_source_lang = self._detect_region_source_lang(region, requested_source_lang)
            text_preview = str(getattr(region, 'text', '') or '').strip()[:60]

            if langcodes.tag_distance(region_source_lang, requested_source_lang) == 0:
                filtered_regions.append(region)
            elif region_source_lang == 'UNKNOWN':
                # When detection fails, keep the region rather than silently dropping it
                filtered_regions.append(region)
                logger.debug(
                    f'[PatchTranslate] keeping UNKNOWN-lang region: "{text_preview}"'
                )
            else:
                dropped_texts.append(f'{region_source_lang}: "{text_preview}"')

        if dropped_texts:
            logger.info(
                f'[PatchTranslate] source_lang_only={requested_source_lang}: '
                f'dropped {len(dropped_texts)} regions: {"; ".join(dropped_texts)}'
            )

        logger.info(
            f'[PatchTranslate] source_lang_only={requested_source_lang}: '
            f'kept {len(filtered_regions)}/{len(regions)} regions'
        )
        return filtered_regions

    def _build_local_region(self, region: Any, x_offset: int, y_offset: int) -> Any:
        return build_local_region(region, x_offset, y_offset)

    def _create_text_only_mask(self, img_h: int, img_w: int, regions: List[Any]) -> np.ndarray:
        return create_text_only_mask(img_h, img_w, regions)

    def _crop_mask_for_patch(
        self,
        raw_mask_source: np.ndarray,
        x1: int,
        y1: int,
        x2: int,
        y2: int,
        img_h: int,
        img_w: int,
    ) -> np.ndarray:
        return crop_mask_for_patch(raw_mask_source, x1, y1, x2, y2, img_h, img_w)

    def _tag_regions_with_bubbles(self, ctx, regions: List[Any]) -> None:
        """#170: detect speech balloons and tag each region with the balloon
        containing it (``region.bubble_idx`` + ``region.bubble_box``), so
        grouping is balloon-aware and #166 can size text to the balloon.

        Best-effort: any failure (or no balloons) leaves regions untagged and
        the pipeline behaves exactly as if the stage were off.
        """
        from .bubble_detector import detect_bubbles
        from .bubble_association import associate_regions_to_bubbles

        polygons = detect_bubbles(ctx.img_rgb, device=str(self.device or 'cuda'))
        if not polygons:
            logger.info('[BubbleSeg] no balloons detected — proximity grouping')
            return
        boxes = [tuple(map(float, r.xyxy)) for r in regions]
        assoc = associate_regions_to_bubbles(boxes, polygons)
        tagged = 0
        for r, idx in zip(regions, assoc):
            r.bubble_idx = idx
            if idx is not None:
                poly = polygons[idx]
                xs = [p[0] for p in poly]
                ys = [p[1] for p in poly]
                r.bubble_box = (min(xs), min(ys), max(xs), max(ys))
                # #179: carry the balloon polygon so the renderer can wrap to the
                # mask's true interior (narrow column), not the bounding box.
                r.bubble_polygon = [(float(p[0]), float(p[1])) for p in poly]
                tagged += 1
        logger.info(f'[BubbleSeg] {len(polygons)} balloons, '
                    f'{tagged}/{len(regions)} regions tagged')

    def _group_nearby_regions(self, regions: List[Any], pad: int, img_w: int, img_h: int) -> List[List[Any]]:
        """Group text regions that should share one render crop.

        Delegates the union-find to the pure, unit-tested ``group_regions``
        helper. When regions carry a ``bubble_idx`` (#170, stage on) grouping
        becomes balloon-aware — adjacent caption boxes in different balloons no
        longer collapse into one strip, and a multi-line balloon stays one
        group. With no ``bubble_idx`` it is the legacy pure-proximity grouping.
        """
        from .bubble_association import group_regions

        if not regions:
            return []
        boxes = [tuple(map(int, r.xyxy)) for r in regions]
        bubble_idxs = [getattr(r, 'bubble_idx', None) for r in regions]
        index_groups = group_regions(boxes, bubble_idxs, pad, img_w, img_h)
        return [[regions[i] for i in group] for group in index_groups]

    def reset_page_context(self) -> None:
        """Drop the cross-page translation context.

        This instance is a process-lifetime singleton in the worker (#136): the
        context lists grew with every page ever translated and let pages from
        unrelated jobs bleed into context-aware prompts. Each request starts
        clean; a per-Batch-Job context seam is tracked as the Translation
        Session design (#140).
        """
        self._translation_memory.reset()

    async def translate_patches(self, image: Image.Image, config: Config) -> dict:
        """Translate image and return per-region rendered PNG patches.

        This path runs detect/ocr/translate once on the full page, then applies
        mask/inpaint/render per region crop to avoid full-page inpainting.
        Nearby regions are grouped into a single crop to avoid overlapping patches.
        """
        self.reset_page_context()
        # Carry the source page's ICC profile into every patch PNG — manga
        # scans often embed non-sRGB profiles (e.g. "Dot Gain 20%"); an
        # untagged patch renders darker than the color-managed page (#156).
        source_icc = image.info.get('icc_profile')
        ctx = await self._translate_until_translation(image, config)
        img_h, img_w = ctx.img_rgb.shape[:2]

        if not ctx.text_regions:
            return {'img_width': img_w, 'img_height': img_h, 'patches': [], 'regions': []}

        await self._report_progress('translating')
        try:
            ctx.text_regions = await self._run_text_translation(config, ctx)
        except Exception:
            logger.error(f"Error during translating (patch mode):\n{traceback.format_exc()}")
            if not self.ignore_errors:
                raise
            ctx.text_regions = []

        await self._report_progress('after-translating')
        if not ctx.text_regions or ctx.text_regions == 'cancel':
            return {'img_width': img_w, 'img_height': img_h, 'patches': [], 'regions': []}

        regions = self._filter_regions_by_source_lang(ctx.text_regions, config)
        if not regions:
            return {'img_width': img_w, 'img_height': img_h, 'patches': [], 'regions': []}

        # Bubble segmentation (#170): tag each region with its speech balloon so
        # grouping stays within balloons (no cross-balloon clumps). Opt-in via
        # detector.det_bubble_seg; untagged regions group by proximity as before.
        if config.detector.det_bubble_seg:
            try:
                self._tag_regions_with_bubbles(ctx, regions)
            except Exception:
                logger.warning(f"[BubbleSeg] tagging failed:\n{traceback.format_exc()}")

        await self._report_progress('mask-generation')
        await self._report_progress('inpainting')
        await self._report_progress('rendering')

        pad = 40
        render_extra = 80
        patches = []

        # Group nearby regions so they share one crop and avoid overlap.
        # Use pad + render_extra as grouping threshold so any two regions whose
        # expanded render canvases would overlap are pre-merged into one group.
        region_groups = self._group_nearby_regions(regions, pad + render_extra, img_w, img_h)
        logger.info(f'[PatchTranslate] {len(regions)} regions -> {len(region_groups)} groups after proximity merge')

        # --- Parallel per-group processing ---
        # Each group is independent: mask → inpaint → render → PNG encode.
        # We use a semaphore to limit GPU concurrency (inpainting is GPU-heavy)
        # while still allowing CPU-bound work (rendering, PNG) to overlap with
        # the next group's GPU work.
        _PATCH_CONCURRENCY = int(os.environ.get('PATCH_CONCURRENCY', '3'))
        _sem = asyncio.Semaphore(_PATCH_CONCURRENCY)

        # Full-page inpaint (clean text removal): inpaint the WHOLE page once so every
        # patch's background matches full-page quality. Per-region crop inpainting starves
        # LaMa's global (FFC) branch of context and leaves a gray blob where large text sat
        # over complex/dark art; the full-page inpaint reconstructs it cleanly (matching the
        # upstream full-page path). Off → per-crop inpaint (byte-identical).
        full_inpainted = None
        if getattr(config.inpainter, 'full_page_inpaint', False):
            try:
                ctx.text_regions = regions
                full_mask = await self._run_mask_refinement(config, ctx)
                text_only = create_text_only_mask(img_h, img_w, regions)
                ctx.mask = (union_refined_with_fallback(full_mask, text_only)
                            if full_mask is not None else text_only)
                # #268: shrink the full-page erase mask to the ink strokes so LaMa repaints
                # less of the textured art (smaller band). Off → unchanged.
                if getattr(config.inpainter, 'mask_tighten', False):
                    from .patch_geometry import tighten_text_mask
                    ctx.mask = tighten_text_mask(ctx.img_rgb, ctx.mask)
                full_inpainted = await self._run_inpainting(config, ctx)
                logger.info('[PatchTranslate] full-page inpaint done — patches reuse it')
            except Exception:
                logger.warning(f"[PatchTranslate] full-page inpaint failed, per-crop fallback:\n{traceback.format_exc()}")
                full_inpainted = None

        renderer = PatchRenderer(
            self, ctx, config,
            pad=pad, render_extra=render_extra, img_w=img_w, img_h=img_h,
            source_icc=source_icc, sem=_sem, logger=logger,
            full_inpainted=full_inpainted,
        )

        # Fire all groups concurrently (semaphore gates GPU work)
        results = await asyncio.gather(*[renderer.process_group(g) for g in region_groups], return_exceptions=True)
        for r in results:
            if isinstance(r, Exception):
                logger.warning(f"[PatchTranslate] group exception: {r}")
            elif r is not None:
                patches.append(r)

        await self._report_progress('finished', True)
        # Text layer (#158): what each rendered region said — the enabler for
        # rolling context (#159) and translation memory (#160).
        return {'img_width': img_w, 'img_height': img_h, 'patches': patches, 'regions': regions_payload(regions)}

    async def _batch_translate_contexts(self, contexts_with_configs: List[tuple], batch_size: int) -> List[tuple]:
        """
        批量处理翻译步骤，防止内存溢出
        """
        results = []
        total_contexts = len(contexts_with_configs)
        
        # 按批次处理，防止内存溢出
        for i in range(0, total_contexts, batch_size):
            batch = contexts_with_configs[i:i + batch_size]
            logger.info(f'Processing translation batch {i//batch_size + 1}/{(total_contexts + batch_size - 1)//batch_size}')
            
            # 收集当前批次的所有文本
            all_texts = []
            batch_text_mapping = []  # 记录每个文本属于哪个context和region
            
            for ctx_idx, (ctx, config) in enumerate(batch):
                if not ctx.text_regions:
                    continue
                    
                region_start_idx = len(all_texts)
                for region_idx, region in enumerate(ctx.text_regions):
                    all_texts.append(region.text)
                    batch_text_mapping.append((ctx_idx, region_idx))
                
            if not all_texts:
                # 当前批次没有需要翻译的文本
                results.extend(batch)
                continue
                
            # 批量翻译
            try:
                await self._report_progress('translating')
                # 使用第一个配置进行翻译（假设批次内配置相同）
                sample_config = batch[0][1] if batch else None
                if sample_config:
                    # 支持批量翻译 - 传递所有批次上下文
                    batch_contexts = [ctx for ctx, config in batch]
                    translated_texts = await self._batch_translate_texts(all_texts, sample_config, batch[0][0], batch_contexts)
                else:
                    translated_texts = all_texts  # 无法翻译时保持原文
                    
                # 将翻译结果分配回各个context
                text_idx = 0
                for ctx_idx, (ctx, config) in enumerate(batch):
                    if not ctx.text_regions:  # 检查text_regions是否为None或空
                        continue
                    text_idx += apply_translations(ctx.text_regions, translated_texts[text_idx:], config)
                        
                # 应用后处理逻辑（括号修正、过滤等）
                for ctx, config in batch:
                    if ctx.text_regions:
                        ctx.text_regions = await self._apply_post_translation_processing(ctx, config)
                        
                # 批次级别的目标语言检查 — #187 S18: body in post_translation.batch_lang_check_retry
                await batch_lang_check_retry(
                    batch, threshold=10, min_ratio=0.5,
                    check_ratio=self._check_target_language_ratio,
                    batch_translate=self._batch_translate_texts,
                )
                        
                # 过滤逻辑（简化版本，保留主要过滤条件）
                for ctx, config in batch:
                    if ctx.text_regions:
                        new_text_regions = filter_translated_regions(ctx.text_regions, config)
                        ctx.text_regions = new_text_regions
                        
                results.extend(batch)
                
            except Exception as e:
                logger.error(f"Error in batch translation: {e}")
                if not self.ignore_errors:
                    raise
                # 错误时保持原文
                for ctx, config in batch:
                    if not ctx.text_regions:  # 检查text_regions是否为None或空
                        continue
                    apply_original_as_translation(ctx.text_regions, config)
                results.extend(batch)
                
            # 强制垃圾回收以释放内存
            release_memory(torch.cuda.is_available, torch.cuda.empty_cache)
                
        return results

    async def _concurrent_translate_contexts(self, contexts_with_configs: List[tuple]) -> List[tuple]:
        """
        并发处理翻译步骤，为每个图片单独发送翻译请求，避免合并大批次
        """

        # 在并发模式下，先保存所有页面的原文用于上下文
        batch_original_texts = []  # 存储当前批次的原文
        if self.context_size > 0:
            for i, (ctx, config) in enumerate(contexts_with_configs):
                if ctx.text_regions:
                    # 保存当前页面的原文
                    page_texts = {}
                    for j, region in enumerate(ctx.text_regions):
                        page_texts[j] = region.text
                    batch_original_texts.append(page_texts)

                    # 确保 _original_page_texts 有足够的长度
                    while len(self._translation_memory.original_page_texts) <= len(self._translation_memory.all_page_translations) + i:
                        self._translation_memory.original_page_texts.append({})

                    self._translation_memory.original_page_texts[len(self._translation_memory.all_page_translations) + i] = page_texts
                else:
                    batch_original_texts.append({})

        async def translate_single_context(ctx_config_pair_with_index):
            """翻译单个context的异步函数"""
            ctx, config, page_index, batch_index = ctx_config_pair_with_index
            try:
                if not ctx.text_regions:
                    return ctx, config

                # 收集该context的所有文本
                texts = [region.text for region in ctx.text_regions]

                if not texts:
                    return ctx, config

                logger.debug(f'Translating {len(texts)} regions for single image in concurrent mode (page {page_index}, batch {batch_index})')

                # 单独翻译这一张图片的文本，传递页面索引和批次索引用于正确的上下文
                translated_texts = await self._batch_translate_texts(
                    texts, config, ctx,
                    page_index=page_index,
                    batch_index=batch_index,
                    batch_original_texts=batch_original_texts
                )

                # 将翻译结果分配回各个region
                apply_translations(ctx.text_regions, translated_texts, config)
                
                # 应用后处理逻辑（括号修正、过滤等）
                if ctx.text_regions:
                    ctx.text_regions = await self._apply_post_translation_processing(ctx, config)
                
                # 单页目标语言检查（如果启用）— #187 S18: body in post_translation.concurrent_page_lang_check_retry
                await concurrent_page_lang_check_retry(
                    ctx.text_regions, config, ctx,
                    min_regions=self._PAGE_LANG_CHECK_MIN_REGIONS, min_ratio=0.3,
                    check_ratio=self._check_target_language_ratio,
                    batch_translate=self._batch_translate_texts,
                )
                
                # 过滤逻辑
                if ctx.text_regions:
                    new_text_regions = filter_translated_regions(ctx.text_regions, config)
                    ctx.text_regions = new_text_regions
                
                return ctx, config
                
            except Exception as e:
                logger.error(f"Error in concurrent translation for single image: {e}")
                if not self.ignore_errors:
                    raise
                # 错误时保持原文
                if ctx.text_regions:
                    apply_original_as_translation(ctx.text_regions, config)
                return ctx, config
        
        # 创建并发任务，为每个任务添加页面索引和批次索引
        tasks = []
        for i, ctx_config_pair in enumerate(contexts_with_configs):
            # 计算当前页面在整个翻译序列中的索引
            page_index = len(self._translation_memory.all_page_translations) + i
            batch_index = i  # 在当前批次中的索引
            ctx_config_pair_with_index = (*ctx_config_pair, page_index, batch_index)
            task = asyncio.create_task(translate_single_context(ctx_config_pair_with_index))
            tasks.append(task)
        
        logger.info(f'Starting concurrent translation of {len(tasks)} images...')
        
        final_results = await gather_per_context(tasks, contexts_with_configs, self.ignore_errors)
        
        logger.info(f'Concurrent translation completed: {len(final_results)} images processed')
        return final_results

    async def _batch_translate_texts(self, texts: List[str], config: Config, ctx: Context, batch_contexts: List[Context] = None, page_index: int = None, batch_index: int = None, batch_original_texts: List[dict] = None) -> List[str]:
        """
        批量翻译文本列表，使用现有的翻译器接口

        Args:
            texts: 要翻译的文本列表
            config: 配置对象
            ctx: 上下文对象
            batch_contexts: 批处理上下文列表
            page_index: 当前页面索引，用于并发模式下的上下文计算
            batch_index: 当前页面在批次中的索引
            batch_original_texts: 当前批次的原文数据
        """
        if config.translator.translator == Translator.none:
            return ["" for _ in texts]

        # 如果是ChatGPT翻译器（包括chatgpt和chatgpt_2stage），需要处理上下文
        if config.translator.translator in [Translator.chatgpt, Translator.chatgpt_2stage]:
            # 先构造翻译器（构造顺序在 context 之前，需保留——构造函数可能 warn glossary）
            translator = build_chatgpt_translator(config.translator.translator)

            # 确定是否使用并发模式和原文上下文
            use_original_text = self.batch_concurrent and self.batch_size > 1

            done_pages = self._translation_memory.all_page_translations
            pages_used, skipped = context_page_counts(self.context_size, done_pages)

            if self.context_size > 0:
                context_type = "original text" if use_original_text else "translation results"
                logger.info(f"Context-aware translation enabled with {self.context_size} pages of history using {context_type}")

            # 构建上下文 - 在并发模式下使用原文和页面索引
            prev_ctx = self._build_prev_context(
                use_original_text=use_original_text,
                current_page_index=page_index,
                batch_index=batch_index,
                batch_original_texts=batch_original_texts
            )

            # 为当前图片创建专用的result_path_callback，避免并发时路径错位
            current_image_context = getattr(ctx, 'image_context', None) or self._image_debug.current

            def result_path_callback(path: str) -> str:
                """为特定图片创建结果路径，使用保存的图片上下文"""
                with self._image_debug.with_context(current_image_context):
                    return self._result_path(path)

            def on_2stage_batch_setup(ctx):
                # Check if batch processing is enabled and batch_contexts are provided
                if batch_contexts and len(batch_contexts) > 1 and not self.batch_concurrent:
                    # Enable batch processing for chatgpt_2stage
                    ctx.batch_contexts = batch_contexts
                    logger.info(f"Enabling batch processing for chatgpt_2stage with {len(batch_contexts)} images")

                    # Set result_path_callback for each context in the batch
                    for batch_ctx in batch_contexts:
                        if hasattr(batch_ctx, 'image_context'):
                            batch_image_context = batch_ctx.image_context
                        else:
                            batch_image_context = self._image_debug.current

                        def create_result_path_callback(image_context):
                            def result_path_callback(path: str) -> str:
                                """为特定图片创建结果路径，使用保存的图片上下文"""
                                with self._image_debug.with_context(image_context):
                                    return self._result_path(path)
                            return result_path_callback

                        batch_ctx.result_path_callback = create_result_path_callback(batch_image_context)

            return await dispatch_translate(
                translator, texts, config, ctx, prev_ctx, pages_used, skipped,
                result_path_callback=result_path_callback,
                on_2stage_batch_setup=on_2stage_batch_setup,
            )

        else:
            # 使用通用翻译调度器
            return await dispatch_translation(
                config.translator.translator_gen,
                texts,
                config.translator,
                self.use_mtpe,
                ctx,
                'cpu' if self._gpu_limited_memory else self.device
            )
            
    async def _apply_post_translation_processing(self, ctx: Context, config: Config) -> List:
        """应用翻译后处理逻辑（括号修正、后字典、phase-1 幻觉重试）。

        #187 S18: body extracted byte-for-byte into
        post_translation.apply_post_translation_processing; the two self-bound
        async steps are passed as callbacks. The per-scope page-level ratio
        check + retry loops stay in the drivers (L6/L8 divergence preserved)."""
        return await apply_post_translation_processing(
            ctx.text_regions, config, self.post_dict,
            check_repetition=self._check_repetition_hallucination,
            retry_region=lambda region, cfg: self._retry_translation_with_validation(region, cfg, ctx),
        )

    async def _complete_translation_pipeline(self, ctx: Context, config: Config) -> Context:
        """
        完成翻译后的处理步骤（掩码细化、修复、渲染）
        """
        await self._report_progress('after-translating')

        if not ctx.text_regions:
            await self._report_progress('error-translating', True)
            ctx.result = ctx.upscaled
            return await self._revert_upscale(config, ctx)
        elif ctx.text_regions == 'cancel':
            await self._report_progress('cancelled', True)
            ctx.result = ctx.upscaled
            return await self._revert_upscale(config, ctx)

        # -- Mask refinement
        if ctx.mask is None:
            await self._report_progress('mask-generation')
            try:
                ctx.mask = await self._run_mask_refinement(config, ctx)
            except Exception as e:  
                logger.error(f"Error during mask-generation:\n{traceback.format_exc()}")  
                if not self.ignore_errors:  
                    raise 
                ctx.mask = ctx.mask_raw if ctx.mask_raw is not None else np.zeros_like(ctx.img_rgb, dtype=np.uint8)[:,:,0]

        if self.verbose and ctx.mask is not None:
            # #187 S14: guarded variant — body in debug_sink (the single driver's is unguarded)
            await save_inpaint_preview_guarded(
                ctx.mask, self._result_path,
                lambda: dispatch_inpainting(Inpainter.none, ctx.img_rgb, ctx.mask, config.inpainter,config.inpainter.inpainting_size,
                                            self.device, self.verbose))

        # -- Inpainting
        await self._report_progress('inpainting')
        try:
            ctx.img_inpainted = await self._run_inpainting(config, ctx)

        except Exception as e:  
            logger.error(f"Error during inpainting:\n{traceback.format_exc()}")  
            if not self.ignore_errors:  
                raise
            else:
                ctx.img_inpainted = ctx.img_rgb
        ctx.gimp_mask = np.dstack((cv2.cvtColor(ctx.img_inpainted, cv2.COLOR_RGB2BGR), ctx.mask))

        if self.verbose:
            save_inpainted(ctx.img_inpainted, self._result_path)

        # -- Rendering
        await self._report_progress('rendering')

        # 在rendering状态后立即发送文件夹信息，用于前端精确检查final.png
        if hasattr(self, '_progress_hooks') and self._image_debug.current:
            folder_name = self._image_debug.current['subfolder']
            # 发送特殊格式的消息，前端可以解析
            await self._report_progress(f'rendering_folder:{folder_name}')

        try:
            ctx.img_rendered = await self._run_text_rendering(config, ctx)
        except Exception as e:
            logger.error(f"Error during rendering:\n{traceback.format_exc()}")
            if not self.ignore_errors:
                raise
            ctx.img_rendered = ctx.img_inpainted

        await self._report_progress('finished', True)
        ctx.result = dump_image(ctx.input, ctx.img_rendered, ctx.img_alpha)
        
        # 保存debug文件夹信息到Context中（用于Web模式的缓存访问）
        if self.verbose:
            ctx.debug_folder = self._get_image_subfolder()

        return await self._revert_upscale(config, ctx)
    
    async def _check_repetition_hallucination(self, text: str, threshold: int = 5, silent: bool = False) -> bool:
        """
        检查文本是否包含重复内容（模型幻觉）
        Check if the text contains repetitive content (model hallucination)
        """
        # #187: logic extracted to the pure, unit-tested translation_checks module.
        from .translation_checks import check_repetition_hallucination
        return check_repetition_hallucination(text, threshold, silent)

    async def _check_target_language_ratio(self, text_regions: List, target_lang: str, min_ratio: float = 0.5) -> bool:
        """Pure verdict (Issue #109): is enough of the merged translation written in
        target_lang's script? Logic extracted to the unit-tested
        translation_checks.check_target_language_ratio (#187)."""
        from .translation_checks import check_target_language_ratio
        return check_target_language_ratio(text_regions, target_lang, target_script_ratio, min_ratio)

    async def _validate_translation(self, original_text: str, translation: str, target_lang: str, config, ctx: Context = None, silent: bool = False, page_lang_check_result: bool = None) -> bool:
        """
        验证翻译质量（包含目标语言比例检查和幻觉检测）
        Validate translation quality (includes target language ratio check and hallucination detection)
        
        Args:
            page_lang_check_result: 页面级目标语言检查结果，如果为None则进行检查，如果已有结果则直接使用
        """
        if not config.translator.enable_post_translation_check:
            return True
            
        if not translation or not translation.strip():
            return True
        
        # 1. 目标语言比例检查（页面级别）
        if page_lang_check_result is None and ctx and ctx.text_regions and len(ctx.text_regions) >= self._PAGE_LANG_CHECK_MIN_REGIONS:
            # 进行页面级目标语言检查
            page_lang_check_result = await self._check_target_language_ratio(
                ctx.text_regions,
                target_lang,
                min_ratio=0.5
            )
            
        # 如果页面级检查失败，直接返回失败
        if page_lang_check_result is False:
            if not silent:
                logger.debug("Target language ratio check failed for this region")
            return False
        
        # 2. 检查重复内容幻觉（region级别）
        if await self._check_repetition_hallucination(
            translation, 
            config.translator.post_check_repetition_threshold,
            silent
        ):
            return False
                
        return True

    async def _retry_translation_with_validation(self, region, config: Config, ctx: Context) -> str:
        """
        带验证的重试翻译
        Retry translation with validation
        """
        original_translation = region.translation
        max_attempts = config.translator.post_check_max_retry_attempts
        
        for attempt in range(max_attempts):
            # 验证当前翻译 - 在重试过程中只检查单个region（幻觉检测），不进行页面级检查
            is_valid = await self._validate_translation(
                region.text, 
                region.translation, 
                config.translator.target_lang,
                config,
                ctx=None,  # 不传ctx避免页面级检查
                silent=True,  # 重试过程中禁用日志输出
                page_lang_check_result=True  # 传入True跳过页面级检查，只做region级检查
            )
            
            if is_valid:
                if attempt > 0:
                    logger.info(f'Post-translation check passed (Attempt {attempt + 1}/{max_attempts}): "{region.translation}"')
                return region.translation
            
            # 如果不是最后一次尝试，进行重新翻译
            if attempt < max_attempts - 1:
                logger.warning(f'Post-translation check failed (Attempt {attempt + 1}/{max_attempts}), re-translating: "{region.text}"')
                
                try:
                    # 单独重新翻译这个文本区域
                    if config.translator.translator != Translator.none:
                        from .translators import dispatch
                        retranslated = await dispatch(
                            config.translator.translator_gen,
                            [region.text],
                            config.translator,
                            self.use_mtpe,
                            ctx,
                            'cpu' if self._gpu_limited_memory else self.device
                        )
                        if retranslated:
                            region.translation = retranslated[0]
                            
                            # 应用格式化处理
                            apply_render_casing(region, config)
                                
                            logger.info(f'Re-translation finished: "{region.text}" -> "{region.translation}"')
                        else:
                            logger.warning(f'Re-translation failed, keeping original translation: "{original_translation}"')
                            region.translation = original_translation
                            break
                    else:
                        logger.warning('Translator is none, cannot re-translate.')
                        break
                        
                except Exception as e:
                    logger.error(f'Error during re-translation: {e}')
                    region.translation = original_translation
                    break
            else:
                logger.warning(f'Post-translation check failed, maximum retry attempts ({max_attempts}) reached, keeping original translation: "{original_translation}"')
                region.translation = original_translation
        
        return region.translation