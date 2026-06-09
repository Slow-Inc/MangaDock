"""Series context (#157): append the Backend-composed series-context string
to a translator system template.

Stdlib-only on purpose: prompt assembly must unit-test in <1s, and the
`translators` package imports the ML stack (torch) at package level.
"""
from typing import Optional


def append_series_context(template: str, series_context: Optional[str]) -> str:
    """Return `template` with the series context appended, or unchanged when
    there is none (local-first rule: absent context → byte-identical prompt).

    Call sites run `.format(to_lang=...)` on the returned template, so literal
    braces in the context are escaped — a synopsis containing `{}` must not
    crash prompt assembly.
    """
    if not series_context:
        return template
    escaped = series_context.replace('{', '{{').replace('}', '}}')
    return f"{template}\n\n{escaped}"
