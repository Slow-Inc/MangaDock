"""#980: cross-page character-name glossary.

Cross-page name spellings drift (measured: TSUKUYOMI rendered as สึกุโยมิ / ทสึคุโยมิ / ทสึคโยมิ in one chapter).
The #159 rolling dialogue context did not fix it, and injecting it can hurt the current page (see
2026-10-22-905-context-ab.md). This module keeps only the small, structured part that matters: a
source-name -> Thai-spelling glossary built from each page's own output and passed to the next page's prompt.

Pure logic only, so it unit-tests without the ML stack.
"""
import re

#: Latin words that look like names but are ordinary dialogue words (all-caps manga lettering is loud).
#: A curated common-word list keeps the prompt block to real names: without it a page produced junk entries
#: like MAN = เฮ้อ..., RUNS = ..., FAMOUS = ... (round 69 coverage experiment).
_COMMON_WORDS = frozenset("""
A AN AND ARE AS AT BE BEEN BEING BUT BY CAN COULD DID DO DOES DOING DONE FOR FROM GET GETS GOT HAD HAS HAVE
HE HER HERE HERS HIM HIS HOW I IF IN INTO IS IT ITS JUST KNOW KNOWS LET LIKE MADE MAKE MANY MAY ME MIGHT MORE
MOST MUCH MUST MY NO NOT NOW OF ON ONCE ONE ONLY OR OTHER OUR OUT OVER OWN SAID SAME SAY SAYS SEE SEES SHE
SHOULD SO SOME STILL SUCH TAKE TAKES TELL TELLS THAN THAT THE THEIR THEM THEN THERE THESE THEY THING THINGS
THIS THOSE THOUGH THROUGH TO TOO UNDER UP US VERY WAS WAY WE WELL WENT WERE WHAT WHEN WHERE WHETHER WHICH
WHILE WHO WHY WILL WITH WOULD YES YOU YOUR YOURS
ABOUT AFTER AGAIN AGAINST ALL ALREADY ALSO ALWAYS AROUND AWAY BACK BAD BEFORE BEHIND BETTER BIG BLACK BOTH
BOY BROUGHT CALLED CAME CANNOT CLOSE COLD COME COMES COMING COULD NOT DARK DAY DAYS DEAD DIFFERENT DOING DOWN
EACH EARLY EASY EAT EATS ELSE END ENOUGH EVEN EVER EVERY EVERYONE EVERYTHING FAMOUS FAR FAST FEW FIND FINE
FIRST FOUND FRIEND FRIENDS GAVE GIRL GIVE GIVES GIVING GO GOES GOING GOOD GOT GREAT GUTS HAD HANDS HAPPEN
HAPPENED HAPPY HARD HEAR HEARD HELP HIMSELF HOME HOPE HOUR HOURS HOUSE HOWEVER HUGE IDEA IMPORTANT KEEP KEPT
KIND KNEW KNOWN LAST LATE LATER LEAVE LEAVING LEFT LET LIFE LIGHT LITTLE LIVE LONG LOOK LOOKS LOOKED LOT
LOUD LOVE LOVED LOW MADE MANS MEAN MEANS MEET MET MIND MINUTE MINUTES MONEY MORNING MORNIN NICE NIGHT NOPE
NOTHING NOWHERE NUMBER OFFER OK OKAY OLD ONCE OPEN OPENED OPENS ORDER OTHERWISE OUTSIDE PART PEOPLE PERHAPS
PERSON PICK PLACE PLACES PLAY PLEASE POINT POLITE POWER PREVIOUS PROBLEM PROPERLY PUT QUICK QUICKLY RAN
REALLY REJECTED REMEMBER RIGHT ROOM RUN RUNNING RUNS SAD SAFE SCHOOL SEE SEEM SEEMS SENSE SHARE SHOW SHOWS
SHOWN SICK SIDE SIGHT SIMPLE SINCE SLOW SMALL SOMEONE SOMETHING SOMETIMES SOON SORRY SOUND START STARTED
STILL STOP STOPPED STRANGE STRANGELY STUFF SURE TALK TALKED TELLING THINK THINKING THOUGHT TIME TIMES TODAY
TOGETHER TOLD TOMORROW TONIGHT TOOK TOWARD TROUBLE TRUE TRY TRYING TURN TURNED TWICE UHM UH OH AH EH HEY HA
HAHA WOW YEAH YEP UGLY USED USUALLY WAIT WAITING WAKE WALK WALKING WALL WANNA WANT WANTED WANTS WATCH
WATER WHATS WHAAT WHATEVER WHOLE WIFE WISH WOMAN WOMEN WONDER WORD WORDS WORK WORKED WORKS WORLD WORRIED
WRONG YESTERDAY YOUNG
ANY DAMN DROP FORMED GODDESS GROUND HEIGHT JOIN SKY SKYS SKYSCRAPER SIT SNACKS
ITD ALLERGIES BAND CDS HOMEWORK RELEASING IMMEDIATELY SHITTY VOICE FACE HANDS EYES HEAD BODY
DOOR TABLE CHAIR WINDOW STREET TRAIN FLOOR FRIEND SHADOW SILENCE FEAR HOPE PAIN
""".split())

#: OCR noise that the all-caps matcher would otherwise read as a name (apostrophe/letter mash).
_OCR_JUNK = frozenset("""
ILL IVE IM ID YOURE THATS THERES WHATS SHES WEVE THEYRE YOUVE LETS ITS ALRIGHT
DONT CANT WONT DIDNT DOESNT ISNT ARENT WASNT WERENT HAVENT HASNT HADNT COULDNT SHOULDNT WOULDNT
WANNA GONNA GOTTA THATLL
HHI HNEM ORSOIT PPOPERLY TELICANI THEIPOWER VVENEVER HELPME ICANT
SIIIG SOR MORNIN MAN GRANTING LEAVING DISGUSTING SURVIVE SKYSCRAPER ANYTHING THERES PRETTM RFLIGION
""".split())

_NAME_STOP = _COMMON_WORDS | _OCR_JUNK

_LATIN_NAME = re.compile(r"\b([A-Z][a-z]{2,}|[A-Z]{3,})\b")
#: A name broken by a LINE BREAK is one name ("TSUKU- YOMI", "TSUKU - YOMI"): the hyphen is followed by
#: whitespace. An inline hyphen is a separator, not a break ("HAIMIYA-SENPAI" = the name HAIMIYA plus the address
#: word SENPAI) - fusing that produced the candidate HAIMIYASENPAI, which never matched the same character written
#: on another page and left the spelling free to drift (measured on Haimiya ch. 6).
_HYPHEN_BREAK = re.compile(r"(?<=[A-Z])\s*-\s+(?=[A-Z])")
_THAI_RUN = re.compile("[\\u0E00-\\u0E7F]{3,}")
#: JP->TH (#980c): a Japanese character name is a katakana run. 2-8 chars keeps short SFX-ish runs
#: (pinned too - consistent SFX is fine) and drops long loanwords; the two-occurrence filter is the second net.
_KATAKANA = re.compile("[\\u30A1-\\u30FA]{2,8}")
#: Laughter/interjection "names": the model translates these inconsistently (`HEHE` -> `เข่า` on one page,
#: `ฮิฮิ` on the next). They must never enter the name glossary, otherwise the series memory enforces one bad
#: rendering across the chapter (measured: gate flagged HEHE -> เข่า vs ฮิฮิ).
_INTERJECTION = re.compile(
    r'^(?:HA+|HE+|HI+|HO+|HU+|HEHE|HAHA|HEH|HIHI|NYA|NYAH|MEOW|MROW|PURU|FU+|KUKU|BWAH|GUFU|UGH|UMPH|HMM+|'
    r'OH+|AH+|EH+|HUH|HEY|OI|YAY|YES|NO|OK|OKAY|WOW|YEAH|HMPH|TCH|PSH|SIGH|GASP|HISS|GRR+|ROAR|THUD|BAM|WHAM|'
    r'BOOM|ZOOM|SWOOSH|WHOO|WHEE|AAH+|EEH+|OOH+|UOH)[.!~?]*$', re.I)


def is_interjection_source(text: str) -> bool:
    """True for pure laughter/SFX tokens that must not be treated as character names."""
    return bool(_INTERJECTION.match((text or '').strip()))


def glossary_enabled(env=None) -> bool:
    """Whether the cross-page name glossary runs (#980). Default ON: it adds no model call and only fixes
    spellings it can extract with high confidence. MIT_NAME_GLOSSARY=0/false/off disables it.
    """
    import os

    value = str((env or os.environ).get('MIT_NAME_GLOSSARY', '')).strip().lower()
    return value not in ('0', 'false', 'no', 'off')


def candidate_names(srcs) -> list:
    """Canonical (uppercase) name candidates from the page's source lines, in first-seen order."""
    found = []
    for src in srcs or []:
        text = _HYPHEN_BREAK.sub("", src or "")
        for tok in _LATIN_NAME.findall(text):
            key = tok.upper()
            if key in _NAME_STOP or len(key) < 3 or is_interjection_source(tok):
                continue
            if key not in found:
                found.append(key)
        # Japanese sources: katakana runs are names (or repeated SFX, which consistency also helps).
        for tok in _KATAKANA.findall(src or ""):
            if tok not in found:
                found.append(tok)
    return found


def extract_glossary(regions, existing=None) -> dict:
    """Extend a name -> Thai spelling glossary from one page's {src, dst} regions.

    Only regions that carry exactly one name candidate are used, and the longest Thai run in the translation
    is taken as the spelling (transliterated names are the longest words in practice). An existing spelling
    always wins, so a page never overrides the glossary it inherited.
    """
    glossary = dict(existing or {})
    for region in _pairs(regions):
        src, dst = region
        names = candidate_names([src])
        if len(names) != 1:
            continue
        name = names[0]
        if name in glossary:
            continue
        runs = _THAI_RUN.findall(dst)
        if not runs:
            continue
        spelling = max(runs, key=len)
        # a transliterated name is short; a whole Thai clause means the region was not name-focused
        if not (3 <= len(spelling) <= 12):
            continue
        # Name-focused only: if the translation is much longer than the spelling, the region merely MENTIONS
        # the name inside dialogue and the 'longest run' is a clause, not a spelling (gate FP: TSUKUYOMI ->
        # 'ฉันอยากเห็นเธออีก'). Such a line must not define the series glossary.
        if len(dst) > len(spelling) + 6:
            continue
        glossary[name] = spelling
    return glossary


def count_candidates(regions) -> dict:
    """How many times each name candidate occurs on one page (used to keep only recurring names)."""
    counts = {}
    for src, _dst in _pairs(regions):
        for name in candidate_names([src]):
            counts[name] = counts.get(name, 0) + 1
    return counts


#: Thai consonants (0E01-0E2E); vowels and tone marks sit outside this range and are stripped for the skeleton.
_CONSONANT_RANGE = ('\u0e01', '\u0e2e')


def _skeleton(text: str) -> str:
    """The consonant skeleton of a Thai word: transliteration variants usually differ in vowels, not consonants
    (ไฮมิยะ / ฮาอิมิยะ -> ฮมย / ฮอมย). Pure."""
    return ''.join(c for c in (text or '') if _CONSONANT_RANGE[0] <= c <= _CONSONANT_RANGE[1])


def _same_name_skeleton(a: str, b: str) -> bool:
    """Two Thai spellings of the same transliterated name (pure).

    Same first consonant, skeletons within one edit, similar length. This catches variant pairs the generic
    similarity guard rejects (ไฮมิยะ vs ฮาอิมิยะ = 0.57 similarity, 4 edits) while needing the shared consonant
    backbone, so unrelated words do not match."""
    if len(a) < 4 or len(b) < 4:
        return False
    sa, sb = _skeleton(a), _skeleton(b)
    if not sa or not sb or sa[0] != sb[0]:
        return False
    return _edit_distance(sa, sb) <= 1 and abs(len(a) - len(b)) <= 4


def _cluster_safe(run: str, start: int, length: int) -> bool:
    """Whether the slice starts and ends on a whole Thai character cluster (pure).

    Cutting inside a cluster builds hybrids: taking 'ี่ฮาอิมิยะ' out of 'รุ่นพี่ฮาอิมิยะ' leaves 'รุ่นพ' and the
    replacement reads 'รุ่นพฮาอิมิยะ'. A cluster starts on a base letter and must not end before its marks."""
    import unicodedata
    if start < 0 or length <= 0 or start + length > len(run):
        return False
    if unicodedata.category(run[start]) != 'Lo':
        return False
    end = start + length
    if end < len(run) and unicodedata.category(run[end]) == 'Mn':
        return False
    # A name does not end on a dangling leading vowel: "ไฮมิยะเอ" cut before the next syllable's า, and replacing
    # it turned "เอามาคืน" into "อามาคืน".
    if run[end - 1] in 'เแโใไ':
        return False
    return True


def _find_near_spelling(text: str, target: str, matcher=None):
    """The substring of a Thai run that is the same name spelled differently (pure).

    Thai has no spaces between words, so the whole-run comparison this used to do only worked when the model
    happened to separate the name ("รุ่นพี่ ฮาอิมิยะ"). Here each run is also scanned with windows of the target's
    length +-2, and the best window within 3 edits and 60 % similarity is returned - the same guards as the
    whole-run rule, so unrelated words stay untouched."""
    from difflib import SequenceMatcher
    matcher = matcher or SequenceMatcher

    def score(window, strict_len=False):
        """(kind, ratio) for a candidate spelling, or (0, 0.0) when it is not the same name.

        Two ways to be a variant: the generic near-match (ratio >= 0.6 and <= 3 edits), or the consonant skeleton
        of a transliteration - ไฮมิยะ / ฮาอิมิยะ sit at 0.57 similarity and 4 edits but share the consonants
        ฮมย / ฮอมย. A window may only use the generic rule when it is the name almost in full (one character of
        slack); a two-character longer window let "พี่ฮาอิมิยะ" pass as "ฮาอิมิยะ" and the replacement deleted the
        address word."""
        ratio = matcher(None, window, target).ratio()
        if (not strict_len or abs(len(window) - len(target)) <= 1) and ratio >= 0.6 \
                and _edit_distance(window, target) <= 3:
            return 1, ratio
        if _same_name_skeleton(window, target):
            return 0.5, ratio
        return 0.0, 0.0

    def key(candidate, ratio):
        """Rank by kind, then by how close the window is to the target's length, then similarity, then shorter.

        The length first is what keeps a PARTIAL spelling from winning: "ฮมิยะ" (5) scores a higher similarity than
        "ไฮมิยะ" (6) against "ฮาอิมิยะ", but it dropped the leading vowel and replacing it would corrupt the word.
        A window longer than the target loses the same way ("ฮาอิมิยะเ")."""
        return (candidate[0], -abs(len(candidate[1]) - len(target)), ratio, -len(candidate[1]))

    def better(candidate, ratio, best, best_ratio):
        if best is None:
            return True
        return key(candidate, ratio) > key(best, best_ratio)

    runs = _THAI_RUN.findall(text)
    # Whole runs first: when the model separated the name, replacing just a window inside the run would splice
    # the old spelling together with the new one ("ทสึคึโยมิ" -> "ทสึคสึกุโยมิ" instead of "สึกุโยมิ").
    best, best_ratio = None, 0.0
    for run in runs:
        if abs(len(run) - len(target)) > 2:
            continue
        kind, ratio = score(run)
        candidate = (kind, run)
        if kind and better(candidate, ratio, best, best_ratio):
            best, best_ratio = candidate, ratio
    if best is not None:
        return best[1], best_ratio
    # Unspaced Thai: the name sits inside a longer run, so scan windows of the target's length, aligned to whole
    # character clusters so a cut never splits a Thai cluster.
    for run in runs:
        for length in range(max(4, len(target) - 3), len(target) + 4):
            if length > len(run):
                break
            for start in range(0, len(run) - length + 1):
                if start == 0 and length < len(run) - 2:
                    continue
                if not _cluster_safe(run, start, length):
                    continue
                window = run[start:start + length]
                kind, ratio = score(window, strict_len=True)
                candidate = (kind, window)
                if kind and better(candidate, ratio, best, best_ratio):
                    best, best_ratio = candidate, ratio
    return (best[1], best_ratio) if best is not None else (None, 0.0)


def apply_glossary(regions, glossary) -> int:
    """Deterministically enforce a glossary on one page's translated regions; returns how many were fixed.

    Prompt-level instructions are not reliable (the model copied ทสึคุโยมิ as ทสึคิโยมิ in one run), so on a
    region whose SOURCE contains a glossary name, a Thai token within edit distance of the glossary spelling
    is replaced with the exact spelling. Only near matches are touched: the token must be within 3 edits and
    60% similar, so unrelated words that merely share a few letters are left alone.
    """
    if not glossary:
        return 0
    from difflib import SequenceMatcher

    fixed = 0
    for item in regions or []:
        if isinstance(item, dict):
            src = item.get("src") or ""
            dst = item.get("dst") or ""
        else:
            src = getattr(item, "text", "") or getattr(item, "src", "")
            dst = getattr(item, "dst", "") or getattr(item, "translation", "")
        if not src or not dst:
            continue
        present = [n for n in candidate_names([src]) if n in glossary]
        if not present:
            continue
        new_dst = dst
        for name in present:
            target = glossary[name]
            # Token-level presence: a substring test misses variants that merely CONTAIN the spelling
            # (`ทสึคุโยมิ` contains `สึคุโยมิ`), so the series memory would never fix exactly that shape (#1065).
            if any(tok == target for tok in _THAI_RUN.findall(new_dst)):
                continue
            best, best_ratio = _find_near_spelling(new_dst, target, SequenceMatcher)
            if best == target:
                # The spelling is already there inside a longer run ("ทสึคุโยมิ" contains "สึคุโยมิ"): the extra
                # prefix is the drift, so the run becomes exactly the glossary spelling (#1065).
                for run in _THAI_RUN.findall(new_dst):
                    if target in run and len(run) <= len(target) + 2:
                        new_dst = new_dst.replace(run, target, 1)
                        fixed += 1
                        break
            elif best is not None and abs(len(target) - len(best)) <= 2:
                # A spelling variant differs by a couple of characters; a bigger jump means the window was a
                # different word (or the name plus an honorific) and replacing it would change the sentence.
                new_dst = new_dst.replace(best, target, 1)
                fixed += 1
        if new_dst != dst:
            if isinstance(item, dict):
                item["dst"] = new_dst
            elif hasattr(item, 'translation'):
                item.translation = new_dst
            else:
                setattr(item, "dst", new_dst)
    return fixed


def _pairs(regions):
    for item in regions or []:
        if isinstance(item, dict):
            yield (item.get("src") or ""), (item.get("dst") or "")
        else:
            yield (getattr(item, "src", "") or getattr(item, "text", "")), \
                (getattr(item, "dst", "") or getattr(item, "translation", ""))


def _edit_distance(a: str, b: str) -> int:
    """Levenshtein distance, small strings only (name spellings)."""
    if a == b:
        return 0
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


#: Address words that ride along with a name in the source ("HAIMIYA-SENPAI") and must never become a name
#: themselves, or the glossary would enforce a Thai function word.
_NAME_STOP = _NAME_STOP | frozenset("""
SENPAI SEMPAI SENSEI KUN CHAN SAN SAMA ONII ONIISAN ONIICHAN ONEE BRO SIS
""".split())

#: Grammar the translator puts in front of a name ("รุ่นพี่ไฮมิยะ" = "senpai Haimiya"); stripped from a learned
#: spelling so the glossary stores the name alone.
_THAI_PREFIXES = ('รุ่นพี่', 'คุณ', 'นาย', 'เธอ', 'น้อง', 'พี่')


def _ngrams(run, max_len: int):
    for n in range(3, min(len(run), max_len) + 1):
        for start in range(0, len(run) - n + 1):
            yield run[start:start + n]


#: Honorifics the translator appends to a name ("คุโรเสะคุง" = "Kurose-kun"); they belong to the sentence, not to
#: the remembered spelling, or the glossary would append one to every mention.
_THAI_SUFFIXES = ('คุง', 'จัง', 'ซัง', 'ซัง', 'คุงซัง')


def _strip_prefix(spelling: str) -> str:
    for prefix in _THAI_PREFIXES:
        rest = spelling[len(prefix):]
        if spelling.startswith(prefix) and len(rest) >= 3:
            spelling = rest
            break
    for suffix in _THAI_SUFFIXES:
        rest = spelling[:len(spelling) - len(suffix)]
        if spelling.endswith(suffix) and len(rest) >= 3:
            return rest
    return spelling


def learn_spellings(regions, min_lines: int = 2, max_len: int = 16, specificity: float = 0.75) -> dict:
    """name -> Thai spelling learned from every line that MENTIONS the name (pure).

    extract_glossary only reads name-focused lines, so a character whose name only ever appears inside full
    sentences never enters the glossary and its spelling drifts (measured: HAIMIYA as ไฮมิยะ and ฮาอิมิยะ in one
    chapter). This votes on Thai character n-grams over the name-bearing lines and keeps a candidate only when it
    appears in at least min_lines of them AND is mostly confined to them - the specificity test rejects the
    grammar the translator uses everywhere (รุ่นพี่), which naive substring voting would choose. Leading address
    words are stripped, so the stored spelling is the name alone."""
    pairs = [(src, dst) for src, dst in _pairs(regions) if src and dst]
    if not pairs:
        return {}
    names = []
    for src, _ in pairs:
        for name in candidate_names([src]):
            if name not in names:
                names.append(name)
    out = {}
    for name in names:
        bearing, others = [], []
        for src, dst in pairs:
            (bearing if name in candidate_names([src]) else others).append(dst)
        if len(bearing) < min_lines:
            continue
        counts = {}
        for dst in bearing:
            grams = set()
            for run in _THAI_RUN.findall(dst):
                for gram in _ngrams(run, max_len):
                    grams.add(gram)
            for gram in grams:
                counts[gram] = counts.get(gram, 0) + 1
        candidates = {}
        for gram, count in counts.items():
            if count < min_lines or len(gram) < 3:
                continue
            other = sum(1 for dst in others if gram in dst)
            if count / float(count + other) < specificity:
                continue
            candidates[gram] = count
        # A partial spelling can outcount the full one when the chapter used two variants: 'มิยะ' matches both
        # 'ไฮมิยะ' and 'ฮาอิมิยะ', so it appears on every line while each full spelling appears on only some. Drop
        # any candidate contained in a longer candidate that is itself frequent enough, and the full spellings
        # remain to be ranked.
        maximal = {gram: count for gram, count in candidates.items()
                   if not any(gram != other and gram in other and other_count >= min_lines
                              for other, other_count in candidates.items())}
        best = None
        for gram, count in maximal.items():
            key = (count, len(gram))
            if best is None or key > best[0]:
                best = (key, gram)
        if not best:
            continue
        spelling = _strip_prefix(best[1])
        if 3 <= len(spelling) <= 12:
            out[name] = spelling
    return out


def format_glossary(glossary) -> str:
    """Prompt block for the next page; empty glossary -> "" (prompt byte-identical)."""
    if not glossary:
        return ""
    pairs = "; ".join(f"{name} = {spelling}" for name, spelling in glossary.items())
    return ("\n\n## Consistent character names\n"
            "Never re-spell these characters. Copy the Thai spelling exactly as given, on every occurrence, "
            "even when the source spells the name differently or the Thai looks unusual: "
            + pairs + ".\n")
