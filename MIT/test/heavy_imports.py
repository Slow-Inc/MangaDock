"""Static (AST-only) reasoning about which test modules drag in the heavy ML stack (#643).

Pure `ast` — importing this must never import torch, since it runs inside the torch-free gate.
"""

import ast

# Packages whose import pulls in torch — directly, or transitively through a chain that a static
# scan cannot follow (`manga_translator.translators` reaches it via `translators/__init__` →
# `.common` → `from ..utils import InfererModule`, which fires `utils/__init__.__getattr__` and
# loads `.inference` at runtime; no `import torch` statement exists anywhere on that path).
# Derived empirically: the `manga_translator.*` prefixes imported by the modules already in
# conftest's `_HEAVY_TESTS` and by NO torch-free test. Keeping it a short list of packages rather
# than a list of test files is the point — packages are stable, test files churn.
HEAVY_PACKAGES = (
    'manga_translator.detection',
    'manga_translator.inpainting',
    'manga_translator.manga_translator',
    'manga_translator.pipeline_params',
    'manga_translator.stages',
    'manga_translator.translators',
)


def is_heavy_module(name: str) -> bool:
    """True when importing `name` reaches the ML stack."""
    return any(name == pkg or name.startswith(pkg + '.') for pkg in HEAVY_PACKAGES)


def find_unlisted_heavy_tests(sources: dict, listed) -> list:
    """Test modules that import a heavy package at module level but are absent from `listed`.

    These are exactly the modules that would abort collection in the torch-free gate.
    """
    listed = set(listed)
    return sorted(
        name
        for name, src in sources.items()
        if name not in listed and any(is_heavy_module(m) for m in module_level_imports(src))
    )


def module_level_imports(source: str) -> set[str]:
    """Modules imported at MODULE level by `source`.

    Module level only: a collection error is caused by imports that execute when pytest imports
    the file. An import inside a function or a fixture is fine in the torch-free gate — that test
    just fails/skips at call time instead of killing collection.
    """
    found = set()
    for node in ast.parse(source).body:
        if isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            found.add(node.module)
        elif isinstance(node, ast.Import):
            found.update(alias.name for alias in node.names)
    return found
