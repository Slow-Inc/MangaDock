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
#: A name broken by a stammer hyphen or a line break ("TSUKU- YOMI", "TSUKU - YOMI") is one name.
_HYPHEN_BREAK = re.compile(r"(?<=[A-Z])-\s*(?=[A-Z])")
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
            if target in new_dst:
                continue
            best = None
            best_ratio = 0.0
            for tok in _THAI_RUN.findall(new_dst):
                if abs(len(tok) - len(target)) > 2:
                    continue
                ratio = SequenceMatcher(None, tok, target).ratio()
                if ratio >= 0.6 and _edit_distance(tok, target) <= 3 and ratio > best_ratio:
                    best, best_ratio = tok, ratio
            if best is not None:
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


def format_glossary(glossary) -> str:
    """Prompt block for the next page; empty glossary -> "" (prompt byte-identical)."""
    if not glossary:
        return ""
    pairs = "; ".join(f"{name} = {spelling}" for name, spelling in glossary.items())
    return ("\n\n## Consistent character names\n"
            "Never re-spell these characters. Copy the Thai spelling exactly as given, on every occurrence, "
            "even when the source spells the name differently or the Thai looks unusual: "
            + pairs + ".\n")
