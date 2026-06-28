"""#180 — kinsoku (CJK line-break) forbidden-position rules, pure.

Japanese/CJK typography forbids certain characters at a line START (行頭禁則) or a
line END (行末禁則). The sibling Knuth-Plass breaker (``line_break.py``, same package
root so both stay PIL/cv2-free) consults these via ``respect_kinsoku=True`` so a
wrapped line never opens with a comma/period/closing-bracket/small-kana nor ends with
an opening bracket — a large but finite ``kinsoku_penalty`` at such a break. Table-
driven, font-free."""

# 行頭禁則文字 — must NOT begin a line.
KINSOKU_START = frozenset(
    # closing brackets / parens (full- and half-width)
    "）〕］｝〉》」』】〙〗〟｠)]}"
    # trailing punctuation
    "、。，．・：；！？‼⁇⁈⁉。、,."
    # small kana (hiragana + katakana) — cling to the preceding mora
    "ぁぃぅぇぉっゃゅょゎ"
    "ァィゥェォッャュョヮヵヶ"
    "ｧｨｩｪｫｬｭｮｯ"
    # prolonged sound + iteration marks
    "ー〜ゝゞ々ヽヾ゠"
    # closing quotes
    "”’｣"
)

# 行末禁則文字 — must NOT end a line.
KINSOKU_END = frozenset(
    # opening brackets / parens (full- and half-width)
    "（〔［｛〈《「『【〘〖〝｟([{｢"
    # opening quotes
    "“‘"
)


def is_forbidden_line_start(text: str) -> bool:
    """True if ``text`` begins with a character forbidden at the start of a line
    (行頭禁則). Only the first character is considered. Empty string → False."""
    return bool(text) and text[0] in KINSOKU_START


def is_forbidden_line_end(text: str) -> bool:
    """True if ``text`` ends with a character forbidden at the end of a line
    (行末禁則). Only the last character is considered. Empty string → False."""
    return bool(text) and text[-1] in KINSOKU_END
