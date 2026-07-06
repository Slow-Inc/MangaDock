import os
import sys
import asyncio
import logging
from argparse import Namespace

from manga_translator import Config
from manga_translator.args import parser, reparse
from .manga_translator import (
    set_main_logger, load_dictionary, apply_dictionary,
)
from .args import parser
from .utils import (
    BASE_PATH,
    init_logging,
    get_logger,
    set_log_level,
    natural_sort,
)

# TODO: Dynamic imports to reduce ram usage in web(-server) mode. Will require dealing with args.py imports.

def _free_vram_bytes(device: str):
    """Free VRAM in bytes for a cuda device; +inf on CPU or if it can't be read
    (so preflight never blocks when it can't measure)."""
    if not device.startswith('cuda'):
        return float('inf')
    try:
        import torch
        free, _total = torch.cuda.mem_get_info()
        return free
    except Exception:
        return float('inf')


def _flux_needs_encode(inpainter) -> bool:
    """True only when flux_klein's one-time prompt embedding is NOT yet cached to
    disk (the ~8-9 GB text-encoder spike). Cached → no spike; other inpainters →
    no such step. Conservative (True) if the probe fails."""
    from manga_translator.config import Inpainter
    if inpainter != Inpainter.flux_klein:
        return False
    try:
        from manga_translator import flux_embed_cache
        from manga_translator.inpainting.inpainting_flux_klein import FluxKleinInpainter
        fi = FluxKleinInpainter()
        cache_dir = fi._get_file_path("flux_klein_embed")
        path = os.path.join(cache_dir, flux_embed_cache._key(FluxKleinInpainter._PROMPT) + ".npy")
        return not os.path.exists(path)
    except Exception:
        return True


async def _run_prepare_models(args: Namespace):
    """#459: pre-download + warm the configured inpainter models OUT of the request
    path, then exit. Reuses the existing prepare() (idempotent HF download + embed
    cache); guards the flux one-time encode with a VRAM preflight."""
    from manga_translator.config import Inpainter
    from manga_translator.inpainting import prepare as prepare_inpainter
    from manga_translator.model_prepare import preflight, resolve_inpainters

    device = 'cuda' if getattr(args, 'use_gpu', False) else 'cpu'
    explicit = [s.strip() for s in args.inpainter.split(',') if s.strip()] if args.inpainter else None
    keys = resolve_inpainters(explicit, os.getenv('MIT_INPAINTER'))
    min_free = int(args.min_free_vram_gb * (1024 ** 3))
    logger.info(f'[prepare-models] preparing {keys} (device={device})')

    for key in keys:
        try:
            inpainter = Inpainter(key)
        except ValueError:
            logger.error(f"[prepare-models] unknown inpainter '{key}' — valid: {[e.value for e in Inpainter]}")
            sys.exit(2)

        needs_encode = _flux_needs_encode(inpainter)
        ok, reason = preflight(_free_vram_bytes(device), min_free, needs_encode)
        if not ok:
            logger.error(f'[prepare-models] {key}: {reason}')
            sys.exit(2)

        logger.info(f'[prepare-models] {key}: downloading + warming (one-time encode={needs_encode})...')
        await prepare_inpainter(inpainter, device)
        logger.info(f'[prepare-models] {key}: ready.')

    logger.info(f'[prepare-models] done — {keys} ready; the first flux request will not download inline.')


async def dispatch(args: Namespace):
    args_dict = vars(args)

    logger.info(f'Running in {args.mode} mode')

    if args.mode == 'local':
        if not args.input:
            raise Exception('No input image was supplied. Use -i <image_path>')
        from manga_translator.mode.local import MangaTranslatorLocal
        translator = MangaTranslatorLocal(args_dict)

        # Load pre-translation and post-translation dictionaries
        pre_dict = load_dictionary(args.pre_dict)
        post_dict = load_dictionary(args.post_dict)

        if len(args.input) == 1 and os.path.isfile(args.input[0]):
            dest = os.path.join(BASE_PATH, 'result/final.png')
            args.overwrite = True # Do overwrite result/final.png file

            # Apply pre-translation dictionaries
            await translator.translate_path(args.input[0], dest, args_dict)
            for textline in translator.textlines:
                textline.text = apply_dictionary(textline.text, pre_dict)
                logger.info(f'Pre-translation dictionary applied: {textline.text}')

            # Apply post-translation dictionaries
            for textline in translator.textlines:
                textline.translation = apply_dictionary(textline.translation, post_dict)
                logger.info(f'Post-translation dictionary applied: {textline.translation}')

        else: # batch
            dest = args.dest
            for path in natural_sort(args.input):
                    # Apply pre-translation dictionaries
                await translator.translate_path(path, dest, args_dict)
                for textline in translator.textlines:
                    textline.text = apply_dictionary(textline.text, pre_dict)
                    logger.info(f'Pre-translation dictionary applied: {textline.text}')

                    # Apply post-translation dictionaries
                for textline in translator.textlines:
                    textline.translation = apply_dictionary(textline.translation, post_dict)
                    logger.info(f'Post-translation dictionary applied: {textline.translation}')

    elif args.mode == 'ws':
        from manga_translator.mode.ws import MangaTranslatorWS
        translator = MangaTranslatorWS(args_dict)
        await translator.listen(args_dict)

    elif args.mode == 'shared':
        from manga_translator.mode.share import MangaTranslatorShared
        worker = MangaTranslatorShared(args_dict)
        await worker.start()

    elif args.mode == 'prepare-models':
        await _run_prepare_models(args)

    elif args.mode == 'config-help':
        import json
        config = Config.schema()
        print(json.dumps(config, indent=2))



if __name__ == '__main__':
    args = None
    init_logging()
    try:
        args, unknown = parser.parse_known_args()
        args = Namespace(**{**vars(args), **vars(reparse(unknown))})
        set_log_level(level=logging.DEBUG if args.verbose else logging.INFO)
        logger = get_logger(args.mode)
        set_main_logger(logger)
        if args.mode != 'web':
            logger.debug(args)

        asyncio.run(dispatch(args))
    except KeyboardInterrupt:
        print('\nTranslation cancelled by user.')
        sys.exit(0)
    except asyncio.CancelledError:
        print('\nTranslation cancelled by user.')
        sys.exit(0)
    except Exception as e:
        logger.error(f'{e.__class__.__name__}: {e}',
                     exc_info=e if args and args.verbose else None)
