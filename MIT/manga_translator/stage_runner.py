"""The uniform per-stage runner (#187 seam S23).

Every pipeline stage in :meth:`MangaTranslator._translate` and
:meth:`MangaTranslator._translate_until_translation` was written as the same
~8-line block, ~14× over: report progress under a name, await the stage
dispatcher, and on failure log ``"Error during {name}"`` with the traceback and
either re-raise (``ignore_errors`` False) or fall back to a default. Folding it
here puts that error/progress policy in exactly one place so the call sites can't
drift, and lets it be unit-tested without importing the ML stack.

`logger` is passed in (not imported) because the driver's module-level `logger`
is reassigned at runtime by `set_main_logger`; resolving it at the call site
keeps S23 byte-identical with the inline blocks.
"""
import traceback


async def run_stage(name, fn, fallback, *, report_progress, ignore_errors, logger):
    """Report ``name``, run the stage, and apply the shared failure policy.

    - ``report_progress``: async callable awaited with ``name`` before the stage.
    - ``fn``: async, zero-arg; its awaited result is returned on success.
    - ``fallback``: zero-arg callable producing the value returned when the stage
      raises and ``ignore_errors`` is True (only called on the failure path).
    - On exception: log ``"Error during {name}"`` with the active traceback, then
      re-raise when ``ignore_errors`` is False, else return ``fallback()``.
    """
    await report_progress(name)
    try:
        return await fn()
    except Exception:
        logger.error(f"Error during {name}:\n{traceback.format_exc()}")
        if not ignore_errors:
            raise
        return fallback()
