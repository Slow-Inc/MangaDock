"""Pre-/post-translation dictionary application (#187 seam S8).

``load_dictionary`` / ``apply_dictionary`` are pure regex helpers — token-delete or
``pattern → value`` replacement, with per-line logging — moved verbatim off the god
object so ``apply_post_dictionary`` (which folds the duplicated post-dict apply+log
block from the single and batch paths) can live and be tested without the ML stack.
MangaTranslator re-imports all three, so ``from .manga_translator import
load_dictionary`` still resolves for ``__main__.py``.
"""
import logging
import os

import regex as re

logger = logging.getLogger('manga_translator')


def load_dictionary(file_path):
    dictionary = []
    if file_path and os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as file:
            for line_number, line in enumerate(file, start=1):
                # Ignore empty lines and lines starting with '#' or '//'
                if not line.strip() or line.strip().startswith('#') or line.strip().startswith('//'):
                    continue
                # Remove comment parts
                line = line.split('#')[0].strip()
                line = line.split('//')[0].strip()
                parts = line.split()
                if len(parts) == 1:
                    # If there is only the left part, the right part defaults to an empty string, meaning delete the left part
                    pattern = re.compile(parts[0])
                    dictionary.append((pattern, '', line_number))
                elif len(parts) == 2:
                    # If both left and right parts are present, perform the replacement
                    pattern = re.compile(parts[0])
                    dictionary.append((pattern, parts[1], line_number))
                else:
                    logger.error(f'Invalid dictionary entry at line {line_number}: {line.strip()}')
    return dictionary


def apply_dictionary(text, dictionary):
    for pattern, value, line_number in dictionary:
        original_text = text
        text = pattern.sub(value, text)
        if text != original_text:
            logger.info(f'Line {line_number}: Replaced "{original_text}" with "{text}" using pattern "{pattern.pattern}" and value "{value}"')
    return text


def apply_post_dictionary(text_regions, post_dict_path) -> list:
    """Apply the post-translation dictionary to every region's translation in place,
    log each "before => after" replacement and a summary, and return the list of those
    replacement strings. Folds the verbatim block from the single and batch paths."""
    post_dict = load_dictionary(post_dict_path)
    post_replacements = []
    for region in text_regions:
        original = region.translation
        region.translation = apply_dictionary(region.translation, post_dict)
        if original != region.translation:
            post_replacements.append(f"{original} => {region.translation}")

    if post_replacements:
        logger.info("Post-translation replacements:")
        for replacement in post_replacements:
            logger.info(replacement)
    else:
        logger.info("No post-translation replacements made.")
    return post_replacements
