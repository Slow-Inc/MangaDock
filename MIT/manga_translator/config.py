import argparse
import os
import re
from enum import Enum

from typing import Optional, Any, Literal, List

from omegaconf import OmegaConf
from pydantic import BaseModel, Field

from .translator_chain import parse_translator_chain


class TranslatorChain:
    def __init__(self, string: str):
        """
        Parses string in form 'trans1:lang1;trans2:lang2' into chains,
        which will be executed one after another when passed to the dispatch function.
        """
        # #192: parsing extracted to the pure, unit-tested parse_translator_chain.
        from manga_translator.translators import TRANSLATORS, VALID_LANGUAGES
        self.target_lang = None
        self.chain = parse_translator_chain(string, lambda s: Translator[s], TRANSLATORS, VALID_LANGUAGES)
        self.translators, self.langs = list(zip(*self.chain))

    def has_offline(self) -> bool:
        """
        Returns True if the chain contains offline translators.
        """
        from manga_translator.translators import OFFLINE_TRANSLATORS
        return any(translator in OFFLINE_TRANSLATORS for translator in self.translators)

    def __eq__(self, __o: object) -> bool:
        if type(__o) is str:
            return __o == self.translators[0]
        return super.__eq__(self, __o)


def translator_chain(string):
    try:
        return TranslatorChain(string)
    except ValueError as e:
        raise argparse.ArgumentTypeError(e)
    except Exception:
        raise argparse.ArgumentTypeError(f'Invalid translator_chain value: "{string}". Example usage: --translator "google:sugoi" -l "JPN:ENG"')


def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

class Renderer(str, Enum):
    default = "default"
    manga2Eng = "manga2eng"
    manga2EngPillow = "manga2eng_pillow"
    none = "none"

class Alignment(str, Enum):
    auto = "auto"
    left = "left"
    center = "center"
    right = "right"

class Direction(str, Enum):
    auto = "auto"
    h = "horizontal"
    v = "vertical"

class InpaintPrecision(str, Enum):
    fp32 = "fp32"
    fp16 = "fp16"
    bf16 = "bf16"

    def __str__(self):
        return self.name

class Detector(str, Enum):
    default = "default"
    dbconvnext = "dbconvnext"
    craft = "craft"
    paddle = "paddle"
    none = "none"

class Inpainter(str, Enum):
    default = "default"
    lama_large = "lama_large"
    lama_mpe = "lama_mpe"
    none = "none"
    original = "original"
    flux_klein = "flux_klein"

class Colorizer(str, Enum):
    none = "none"
    mc2 = "mc2"

class Ocr(str, Enum):
    ocr32px = "32px"
    ocr48px = "48px"
    ocr48px_ctc = "48px_ctc"
    mocr = "mocr"

class Translator(str, Enum):
    youdao = "youdao"
    baidu = "baidu"
    deepl = "deepl"
    papago = "papago"
    caiyun = "caiyun"
    chatgpt = "chatgpt"
    chatgpt_2stage = "chatgpt_2stage"
    none = "none"
    original = "original"
    sakura = "sakura"
    deepseek = "deepseek"
    groq = "groq"
    gemini = "gemini"
    gemini_2stage = "gemini_2stage"
    custom_openai = "custom_openai"
    offline = "offline"
    nllb = "nllb"
    nllb_big = "nllb_big"
    sugoi = "sugoi"
    jparacrawl = "jparacrawl"
    jparacrawl_big = "jparacrawl_big"
    m2m100 = "m2m100"
    m2m100_big = "m2m100_big"
    mbart50 = "mbart50"
    qwen2 = "qwen2"
    qwen2_big = "qwen2_big"
    qwen3 = "qwen3"
    qwen3_big = "qwen3_big"

    def __str__(self):
        return self.name

    # Map 'openai' and any translator starting with 'gpt'* to 'chatgpt'
    @classmethod
    def _missing_(cls, value):
        if value.startswith('gpt') or value == 'openai':
            return cls.chatgpt
        raise ValueError(f"{value} is not a valid {cls.__name__}")


class Upscaler(str, Enum):
    waifu2x = "waifu2x"
    esrgan = "esrgan"
    upscler4xultrasharp = "4xultrasharp"

class RenderConfig(BaseModel):
    renderer: Renderer = Renderer.default
    """Render english text translated from manga with some additional typesetting. Ignores some other argument options"""
    alignment: Alignment = Alignment.auto
    """Align rendered text"""
    disable_font_border: bool = False
    """Disable font border"""
    font_size_offset: int = 0
    """Offset font size by a given amount, positive number increase font size and vice versa"""
    font_size_minimum: int = -1
    """Minimum output font size. Default is image_sides_sum/200"""
    bubble_area_fit: bool = False
    """#166: size each region's font to its speech-balloon area (#170 bubble_box)
    instead of the source textline column, so translated text fills the bubble.
    Off → font sized as before (byte-identical)."""
    en_comic_font: bool = False
    """#176: render Latin/EN targets in the bundled comic font ('comic shanns 2')
    instead of the worker's default (Prompt-Bold, a Thai face). Off → byte-identical."""
    en_font: Optional[str] = None
    """Render-parity B: filename (in fonts/) of a heavier EN face to use for Latin
    targets, overriding en_comic_font (MangaTranslator's BYO-font approach). Missing
    file or None → prior behavior (byte-identical)."""
    supersampling: int = 1
    """#181: render the text canvas at Nx then downscale for crisp glyphs and
    controlled weight. 1 → byte-identical."""
    font_max_box_ratio: float = 0.5
    """Render-parity C: cap the #166 bubble-fit font at this fraction of the
    balloon height. 0.5 (#175) keeps a short line from becoming a giant; raise it
    (toward MangaTranslator's no-cap fill) to let text grow into the balloon.
    0.5 → byte-identical."""
    font_size_max: int = 0
    """Cap the render font (px) of non-SFX regions so narration/caption text can't be
    scaled up by the length-ratio heuristic into an oversized block that overflows its
    panel (matches MangaTranslator's small absolute fonts). SFX is exempt. 0 → no cap
    (byte-identical)."""
    anti_overlap: bool = False
    """Anti-overlap text layout: clamp each region's bubble-fit box against its
    neighbours (using the detected positions) before sizing the font, so translated
    text can't grow into the adjacent bubble/caption and overlap it. Off → byte-identical."""
    clean_layout: bool = False
    """Render-layout rework: for non-balloon, non-SFX regions (narration, captions,
    vertical-JP columns), lay the translated text out as an upright horizontal block at a
    small absolute font instead of warping it onto the original (often tall/vertical)
    detection quad — the warp stretches English oversized and overflowing. Pairs with
    font_size_max as the absolute font. Off → byte-identical."""
    patch_feather_radius: int = 0
    """#173: feather the outer N px of each composited patch to a transparent
    alpha (distance-transform ramp) so the rectangular patch edge blends into the
    page instead of showing a seam. The crop has a ≥120px content margin, so the
    fade never touches rendered text. 0 → hard-alpha patch (byte-identical)."""
    patch_content_alpha: bool = False
    """#436: make each patch opaque only over the pixels it actually CHANGED (original ink the
    inpaint erased + the new glyphs), transparent over the rest of its rectangle. Two overlapping
    speech balloons each emit a rectangular patch; without this the one composited last repaints
    its whole opaque rectangle of clean background over the other balloon's text (it renders
    empty). With it the rectangular margins are transparent so the neighbour's text survives.
    Off → full-rectangle (feathered) patch, byte-identical."""
    direction: Direction = Direction.auto
    """Force text to be rendered horizontally/vertically/none"""
    uppercase: bool = False
    """Change text to uppercase"""
    lowercase: bool = False
    """Change text to lowercase"""
    gimp_font: str = 'Sans-serif'
    """Font family to use for gimp rendering."""
    no_hyphenation: bool = False
    """If renderer should be splitting up words using a hyphen character (-)"""
    font_color: Optional[str] = None
    """Overwrite the text fg/bg color detected by the OCR model. Use hex string without the "#" such as FFFFFF for a white foreground or FFFFFF:000000 to also have a black background around the text."""
    line_spacing: Optional[int] = None
    """Line spacing is font_size * this value. Default is 0.01 for horizontal text and 0.2 for vertical."""
    font_size: Optional[int] = None
    """Use fixed font size for rendering"""
    rtl: bool = True
    """Right-to-left reading order for panel and text_region sorting,"""  
    _font_color_fg = None
    _font_color_bg = None
    @property
    def font_color_fg(self):
        if self.font_color and not self._font_color_fg:
            colors = self.font_color.split(':')
            try:
                self._font_color_fg = hex2rgb(colors[0]) if colors[0] else None
                self._font_color_bg = hex2rgb(colors[1]) if len(colors) > 1 and colors[1] else None
            except:
                raise Exception(
                    f'Invalid --font-color value: {self.font_color}. Use a hex value such as FF0000')
        return self._font_color_fg

    @property
    def font_color_bg(self):
        if self.font_color and not self._font_color_bg:
            colors = self.font_color.split(':')
            try:              
                self._font_color_fg = hex2rgb(colors[0]) if colors[0] else None
                self._font_color_bg = hex2rgb(colors[1]) if len(colors) > 1 and colors[1] else None
            except:
                raise Exception(
                    f'Invalid --font-color value: {self.font_color}. Use a hex value such as FF0000')
        return self._font_color_bg

class UpscaleConfig(BaseModel):
    upscaler: Upscaler = Upscaler.esrgan
    """Upscaler to use. --upscale-ratio has to be set for it to take effect"""
    revert_upscaling: bool = False
    """Downscales the previously upscaled image after translation back to original size (Use with --upscale-ratio)."""
    upscale_ratio: Optional[int] = None
    """Image upscale ratio applied before detection. Can improve text detection."""

def _default_translator() -> Translator:
    t_type = os.environ.get('TRANSLATOR_TYPE')
    if t_type == 'local':
        key = os.environ.get('DEFAULT_LOCAL_TRANSLATOR', 'qwen3')
    elif t_type == 'api':
        key = os.environ.get('DEFAULT_API_TRANSLATOR', 'gemini')
    else:
        key = os.environ.get('DEFAULT_TRANSLATOR', 'gemini')
    try:
        return Translator(key)
    except ValueError:
        return Translator.gemini


class TranslatorConfig(BaseModel):
    translator: Translator = Field(default_factory=_default_translator)
    """Language translator to use. Controlled by DEFAULT_TRANSLATOR env var in MIT .env.
    default_factory so the env is read per instance, not once at import time."""
    target_lang: str = 'ENG' #todo: validate VALID_LANGUAGES #todo: convert to enum
    """Destination language"""
    no_text_lang_skip: bool = False
    """Dont skip text that is seemingly already in the target language."""
    skip_lang: Optional[str] = None
    """Skip translation if source image is one of the provide languages, use comma to separate multiple languages. Example: JPN,ENG"""
    gpt_config: Optional[str] = None  # todo: no more path
    """Path to GPT config file, more info in README"""
    translator_chain: Optional[str] = None
    """Output of one translator goes in another. Example: --translator-chain "google:JPN;sugoi:ENG"."""
    selective_translation: Optional[str] = None
    """Select a translator based on detected language in image. Note the first translation service acts as default if the language isn\'t defined. Example: --translator-chain "google:JPN;sugoi:ENG".'"""
    source_lang: Optional[str] = None
    """Expected source language for region filtering, e.g. ENG, JPN."""
    source_lang_only: bool = False
    """If true, only translate regions whose source language matches source_lang."""
    model: Optional[str] = None
    """Per-request model override for API-based translators (e.g. Gemini).
    Falls back to the translator's env-configured default when absent (#87)."""
    series_context: Optional[str] = None
    """Backend-composed context about the series being translated (#157).
    Exposed through chatgpt_config so every ConfigGPT-family translator
    appends it to its system prompt. Absent → prompts identical to today."""
    prev_context: Optional[str] = None
    """Rolling cross-page context (#159): the Batch Job's front-built numbered
    `<|n|>sentence` block of recent pages' dialogue. Rides the same chatgpt_config
    seam as series_context so every GPT-family translator carries it. The worker
    resets its own per-request memory, so this is the batch path's only carrier.
    Absent → prompts identical to today."""

    # 译后检查配置项
    enable_post_translation_check: bool = True
    """Enable post-translation validation check"""
    post_check_max_retry_attempts: int = 3
    """Maximum retry attempts for failed translation validation"""
    post_check_repetition_threshold: int = 20
    """Minimum number of consecutive repetitions to trigger hallucination detection"""
    post_check_target_lang_threshold: float = 0.5  
    """Minimum ratio of target language in translation text for ratio check"""
    
    _translator_gen = None
    _gpt_config = None

    @property
    def translator_gen(self):
        if self._translator_gen is None:
            if self.selective_translation is not None:
                #todo: refactor TranslatorChain
                trans =  translator_chain(self.selective_translation)
                trans.target_lang = self.target_lang
                self._translator_gen = trans
            elif self.translator_chain is not None:
                trans = translator_chain(self.translator_chain)
                trans.target_lang = trans.langs[0]
                self._translator_gen = trans
            else:
                self._translator_gen = TranslatorChain(f'{str(self.translator)}:{self.target_lang}')
        return self._translator_gen

    @property
    def chatgpt_config(self):
        if self.gpt_config is not None and self._gpt_config is None:
            #todo: load from already loaded file
            self._gpt_config = OmegaConf.load(self.gpt_config)
        # Series context (#157) and rolling cross-page context (#159) ride the same
        # OmegaConf all ConfigGPT translators read via _config_get — one carriage point.
        overrides = {}
        if self.series_context:
            overrides['series_context'] = self.series_context
        if self.prev_context:
            overrides['prev_context'] = self.prev_context
        if overrides:
            ctx = OmegaConf.create(overrides)
            return OmegaConf.merge(self._gpt_config, ctx) if self._gpt_config is not None else ctx
        return self._gpt_config


class DetectorConfig(BaseModel):
    """"""
    detector: Detector =Detector.default
    """"Text detector used for creating a text mask from an image, DO NOT use craft for manga, it\'s not designed for it"""
    detection_size: int = 2560 #(default 2048)
    """Size of image used for detection"""
    text_threshold: float = 0.5
    """Threshold for text detection"""
    det_rotate: bool = False
    """Rotate the image for detection. Might improve detection."""
    det_auto_rotate: bool = False
    """Rotate the image for detection to prefer vertical textlines. Might improve detection."""
    det_invert: bool = False
    """Invert the image colors for detection. Might improve detection."""
    det_gamma_correct: bool = False
    """Applies gamma correction for detection. Might improve detection."""
    det_bubble_seg: bool = False
    """#170: run a speech-balloon segmentation YOLO alongside the text detector
    and tag each text-line region with its balloon mask (renderer area,
    mask-aware crop, OCR scoping). Off → pipeline byte-identical."""
    det_sfx: bool = False
    """#168: run a second SFX/display-text detector (AnimeText YOLO) after DBNet
    and merge its boxes (IoA dedup) into the textline flow, so stylized katakana
    sound effects DBNet can't see get translated. Off → pipeline byte-identical."""
    box_threshold: float = 0.7
    """Threshold for bbox generation"""
    unclip_ratio: float = 2.3
    """How much to extend text skeleton to form bounding box"""

class InpainterConfig(BaseModel):
    inpainter: Inpainter = Inpainter.lama_large
    """Inpainting model to use"""
    inpainting_size: int = 2048
    """Size of image used for inpainting (too large will result in OOM)"""
    inpainting_precision: InpaintPrecision = InpaintPrecision.bf16
    """Inpainting precision for lama, use bf16 while you can."""
    inpaint_context_pad: int = 0
    """#249 (patch path only): inpaint a crop expanded by this many px on each side
    of the render rect, then slice the result back, so LaMa's FFC global branch sees
    real background instead of a starved tight crop (cleaner fill on textured pages).
    Peak VRAM is bounded by min(crop, inpainting_size)². 0 → tight crop (byte-identical)."""
    full_page_inpaint: bool = False
    """Patch path only: inpaint the WHOLE page once (like the full-page renderer) and
    slice each patch's background from it, instead of inpainting per-region crops. LaMa
    sees the entire page → clean reconstruction even where large text sat over complex/
    dark art (a small crop starves its global branch → a gray blob). One inpaint per page
    (often faster than N per-group inpaints). Off → per-crop inpaint (byte-identical)."""
    lama_lum_reground: float = 0.0
    """Patch path only (#268): re-ground the inpaint's low-frequency luminance INSIDE the
    erase mask to the local original surroundings (per-pixel, per-RGB-channel) before the
    translation is drawn, killing the faint "painted band" where LaMa's fill is a few levels
    off the real art over dark hair. Strength 0→1 lerp; pure CPU (cv2/numpy), no extra VRAM.
    0 → off, byte-identical."""
    mask_tighten: bool = False
    """Patch path only (#268): shrink the inpaint mask to the actual ink strokes (local-contrast
    pixels) before LaMa runs, so it repaints thin strokes instead of the whole text rectangle and
    the original art between strokes survives → smaller band. Pure CPU. Off → byte-identical."""
    seamless_clone: bool = False
    """Patch path only (#268, escalation): Poisson seamless-clone the inpainted region into the
    original (gradient-domain) so the mean-brightness band vanishes. Cannot synthesise texture
    (smudges high-freq art) — a comparison/escalation lever. Pure CPU. Off → byte-identical."""

class ColorizerConfig(BaseModel):
    colorization_size: int = 576
    """Size of image used for colorization. Set to -1 to use full image size"""
    denoise_sigma: int = 30
    """Used by colorizer and affects color strength, range from 0 to 255 (default 30). -1 turns it off."""
    colorizer: Colorizer = Colorizer.none
    """Colorization model to use."""

class OcrConfig(BaseModel):
    use_mocr_merge: bool = False
    """Use bbox merge when Manga OCR inference."""
    ocr: Ocr = Ocr.ocr48px
    """Optical character recognition (OCR) model to use"""
    min_text_length: int = 0
    """Minimum text length of a text region"""
    ignore_bubble: int = 0
    """The threshold for ignoring text in non bubble areas, with valid values ranging from 1 to 50, does not ignore others. Recommendation 5 to 10. If it is too low, normal bubble areas may be ignored, and if it is too large, non bubble areas may be considered normal bubbles"""
    prob: float | None = None
    """Minimum probability of a text region to be considered valid. If None, uses the model default."""
    vlm_rescue: bool = False
    """#168/#172: when the 48px line-OCR drops a large region (stylized SFX like ぬ),
    send its crop to the OpenAI-compatible vision gateway (custom_openai / 9arm) to
    localize it into an English onomatopoeia instead of losing it. Off → byte-identical."""

class Config(BaseModel):
    # General
    filter_text: Optional[str] = None
    """Filter regions by their text with a regex. Example usage: '.*badtext.*'"""
    render: RenderConfig = RenderConfig()
    """render configs"""
    upscale: UpscaleConfig = UpscaleConfig()
    """upscaler configs"""
    translator: TranslatorConfig = TranslatorConfig()
    """tanslator configs"""
    detector: DetectorConfig = DetectorConfig()
    """detector configs"""
    colorizer: ColorizerConfig = ColorizerConfig()
    """colorizer configs"""
    inpainter: InpainterConfig = InpainterConfig()
    """inpainter configs"""
    ocr: OcrConfig = OcrConfig()
    """Ocr configs"""
    # ?
    force_simple_sort: bool = False
    """Don't use panel detection for sorting, use a simpler fallback logic instead"""
    kernel_size: int = 3
    """Set the convolution kernel size of the text erasure area to completely clean up text residues"""
    mask_dilation_offset: int = 20
    """By how much to extend the text mask to remove left-over text pixels of the original image."""
    _filter_text = None

    @property
    def re_filter_text(self):
        if self._filter_text is None:
            self._filter_text = re.compile(self.filter_text)
        return self._filter_text


def parse_and_validate_config(config: str) -> Config:
    """Single parse + validate entry point for the raw JSON config string every
    server endpoint (and the batch runner) receives (#192).

    Centralises parsing so validation / error policy lives in one place instead of
    a dozen scattered ``Config.parse_raw`` calls, and uses Pydantic v2
    ``model_validate_json`` (``parse_raw`` is deprecated and dropped in Pydantic
    v3). For a valid config the resulting ``Config`` is identical to the old
    ``parse_raw`` path; invalid input still raises ``pydantic.ValidationError``.
    """
    return Config.model_validate_json(config)
