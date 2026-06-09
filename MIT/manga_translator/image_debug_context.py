"""Per-image debug-folder context (#187 seam S11).

Consolidates the scattered ``_current_image_context`` / ``_saved_image_contexts``
instance state and the verbose/web ``result_path`` computation off the god object, plus
a ``with_context`` manager replacing the manual save/restore swap closures. Logic is
moved verbatim, including the non-verbose web-mode default subfolder and the
``makedirs(dirname)`` side effect; ``verbose`` and ``result_sub_folder`` are passed in.
"""
import os
import time
from contextlib import contextmanager

from .utils.generic import BASE_PATH, get_image_md5


class ImageDebugContext:
    def __init__(self):
        self.current = None       # 当前处理图片的上下文信息 / current image's debug context
        self.saved = {}           # 批量处理中每个图片的上下文 / per-md5 saved contexts

    def set(self, config, image=None) -> None:
        """Build the current image debug context (subfolder name keyed by timestamp,
        md5, detection size, target lang, translator)."""
        timestamp = str(int(time.time() * 1000))
        detection_size = str(getattr(config.detector, 'detection_size', 1024))
        target_lang = getattr(config.translator, 'target_lang', 'unknown')
        translator = getattr(config.translator, 'translator', 'unknown')

        if image is not None:
            file_md5 = get_image_md5(image)
        else:
            file_md5 = "unknown"

        subfolder_name = f"{timestamp}-{file_md5}-{detection_size}-{target_lang}-{translator}"

        self.current = {
            'subfolder': subfolder_name,
            'file_md5': file_md5,
            'config': config,
        }

    @property
    def subfolder(self) -> str:
        if self.current:
            return self.current['subfolder']
        return ''

    def save(self, image_md5: str) -> None:
        if self.current:
            self.saved[image_md5] = self.current.copy()

    def restore(self, image_md5: str) -> bool:
        if image_md5 in self.saved:
            self.current = self.saved[image_md5].copy()
            return True
        return False

    def clear_saved(self) -> None:
        self.saved.clear()

    @contextmanager
    def with_context(self, ctx_dict):
        """Temporarily make ``ctx_dict`` the current context, restoring on exit — the
        explicit form of the manual save/restore swap closures."""
        original = self.current
        self.current = ctx_dict
        try:
            yield
        finally:
            self.current = original

    def result_path(self, path: str, *, verbose: bool, result_sub_folder: str) -> str:
        """Path to the result folder for intermediate (verbose) or web-cached images.
        Creates the containing directory. Verbatim the god object's ``_result_path``."""
        # 只有在verbose模式下才使用图片级子文件夹
        if verbose:
            image_subfolder = self.subfolder
            if image_subfolder:
                if result_sub_folder:
                    result_path = os.path.join(BASE_PATH, 'result', result_sub_folder, image_subfolder, path)
                else:
                    result_path = os.path.join(BASE_PATH, 'result', image_subfolder, path)
                # 确保目录存在
                os.makedirs(os.path.dirname(result_path), exist_ok=True)
                return result_path

        # server/web 模式（result_sub_folder 为空）且非 verbose 时，需要子文件夹保存 final.png
        if not result_sub_folder:
            if self.current:
                sub_folder = self.current['subfolder']
            else:
                timestamp = str(int(time.time() * 1000))
                sub_folder = f"{timestamp}-unknown-1024-unknown-unknown"
            result_path = os.path.join(BASE_PATH, 'result', sub_folder, path)
        else:
            result_path = os.path.join(BASE_PATH, 'result', result_sub_folder, path)

        # 确保目录存在
        os.makedirs(os.path.dirname(result_path), exist_ok=True)
        return result_path
