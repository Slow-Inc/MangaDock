"""Translation hallucination / language checks (#187 — extract pure verdicts off
the MangaTranslator god object).

`_check_repetition_hallucination` and `_check_target_language_ratio` are pure logic
welded onto the 3,200-line orchestrator as `async` methods (they await nothing).
Pulling them into `translation_checks` gives a unit-testable seam where *new*
validators attach — instead of growing the god object (feedback_core_boundary).
Behaviour is preserved verbatim.
"""
from manga_translator.utils.lang_ratio import target_script_ratio
from manga_translator.translation_checks import (
    check_repetition_hallucination,
    check_target_language_ratio,
)


class _Region:
    def __init__(self, translation):
        self.translation = translation


def test_ratio_check_passes_with_no_regions():
    assert check_target_language_ratio([], "THA", lambda t, l: 0.0) is True


def test_ratio_check_passes_when_no_region_has_translated_text():
    regions = [_Region(""), _Region("   ")]
    assert check_target_language_ratio(regions, "THA", lambda t, l: 0.0) is True


def test_ratio_check_passes_when_target_script_share_meets_minimum():
    regions = [_Region("สวัสดี"), _Region("ครับ")]
    assert check_target_language_ratio(regions, "THA", lambda t, l: 0.8) is True


def test_ratio_check_fails_below_minimum():
    regions = [_Region("hello"), _Region("world")]
    assert check_target_language_ratio(regions, "THA", lambda t, l: 0.3) is False


def test_ratio_check_honours_custom_min_ratio():
    regions = [_Region("mixed text")]
    assert check_target_language_ratio(regions, "THA", lambda t, l: 0.6, min_ratio=0.5) is True
    assert check_target_language_ratio(regions, "THA", lambda t, l: 0.6, min_ratio=0.7) is False


def test_clean_text_is_not_flagged():
    assert check_repetition_hallucination("hello there friend", silent=True) is False


def test_empty_or_too_short_text_is_not_flagged():
    assert check_repetition_hallucination("", silent=True) is False
    assert check_repetition_hallucination("abcd", silent=True) is False  # len < default threshold 5


def test_consecutive_character_repetition_is_flagged():
    assert check_repetition_hallucination("aaaaa", silent=True) is True   # 5 consecutive 'a'


def test_consecutive_segment_repetition_is_flagged():
    assert check_repetition_hallucination("go go go go go", silent=True) is True  # 5 repeated tokens


def test_threshold_is_honoured():
    # 'aaa' (len 3) only trips char-repetition once threshold drops to 3
    assert check_repetition_hallucination("aaa", threshold=3, silent=True) is True
    assert check_repetition_hallucination("aaa", threshold=5, silent=True) is False  # len < threshold


class _Pair:
    def __init__(self, text, translation):
        self.text, self.translation = text, translation


def _credit_page(kept_line):
    """A scanlator donation page as the live gateway answered it (#1139): coin names, wallet addresses and URLs
    come back verbatim, the sentences come back Thai."""
    return [_Pair("O DOGE COIN", "O DOGE COIN"),
            _Pair("DAU6i4t5Sy1WKCBKyn7 ufaJKoUGo2MiMnQ", "DAU6i4t5Sy1WKCBKyn7 ufaJKoUGo2MiMnQ"),
            _Pair("OBITCOIN CASH", "OBITCOIN CASH"),
            _Pair("qrfcrlpe3tttcr6s9plmlv zcvh3ne9u87guh3qqy6s", "qrfcrlpe3tttcr6s9plmlv zcvh3ne9u87guh3qqy6s"),
            _Pair("PLEASE SUPPORT US FOR SPEEDY RELEASES-", kept_line),
            _Pair("Contact -Setsuscans@gmail.com", "ติดต่อ -Setsuscans@gmail.com"),
            _Pair("OLITE COIN", "OLITE COIN"),
            _Pair("ltclqzq7kf3a5w84dmeezw eg8xynxckfv0xlt29qx7m", "ltclqzq7kf3a5w84dmeezw eg8xynxckfv0xlt29qx7m"),
            _Pair("SETSUSCANS.COM/PAYPAL SSJ10,B00TH,PM DISCORD - SETSUSCANS,COM/DISCORD",
                  "SETSUSCANS. COM/PAYPAL SSJ10, B00TH, PM DISCORD - SETSUSCANS,COM/DISCORD")]


def test_untranslatable_lines_kept_verbatim_do_not_fail_the_page_1139():
    # measured: 0.37 Thai -> the page was re-translated 3x and every retry failed the same way
    page = _credit_page("โปรดสนับสนุนพวกเราเพื่อให้ออกตอนใหม่ได้เร็วขึ้น")
    assert check_target_language_ratio(page, "THA", target_script_ratio) is True


def test_a_sentence_left_in_english_still_fails_the_page_1139():
    page = _credit_page("PLEASE SUPPORT US FOR SPEEDY RELEASES-")
    assert check_target_language_ratio(page, "THA", target_script_ratio) is False


def test_a_page_answered_in_english_still_fails_1139():
    lines = ["WELL NO... BEING THAT CLOSE", "THINK OF THE SIGHTSEEING SPOTS", "COULD YOU PLEASE KEEP IT DOWN",
             "HEY, WE AGREED WE DIDN'T", "RIGHT...", "HUH?!"]
    assert check_target_language_ratio([_Pair(l, l) for l in lines], "THA", target_script_ratio) is False


def test_a_page_of_short_lines_all_left_in_english_still_fails_1139():
    lines = ["HUH?!", "NO WAY!", "RIGHT...", "WHAT?", "STOP IT!", "OKAY"]
    assert check_target_language_ratio([_Pair(l, l) for l in lines], "THA", target_script_ratio) is False


def test_short_english_lines_hidden_behind_one_thai_line_still_fail_1139():
    lines = [_Pair(l, l) for l in ["HUH?!", "NO WAY!", "STOP IT!", "WHAT?", "GET OUT!"]]
    lines.append(_Pair("I SAID GET OUT OF MY ROOM", "ฉันบอกให้ออกไปจากห้องฉัน"))
    assert check_target_language_ratio(lines, "THA", target_script_ratio) is False


def test_a_foreign_script_line_returned_verbatim_still_counts_1139():
    page = [_Pair("今日はいい天気ですね", "今日はいい天気ですね"), _Pair("明日も晴れるといいな", "明日も晴れるといいな"),
            _Pair("SEE YOU", "แล้วเจอกัน"), _Pair("https://discord.gg/x8sjNQP", "https://discord.gg/x8sjNQP")]
    assert check_target_language_ratio(page, "THA", target_script_ratio) is False


def test_dialogue_punctuation_does_not_look_like_a_credit_page_1139():
    shouts = ["HUH?!", "NO WAY!", "STOP IT!", "WHAT?", "GET OUT!"]
    for odd in ["WAIT...WHAT?!", "WHAT THE @#%!", "MR.SMITH", "ID: ab12cd34ef", "LISTEN.TO ME", "COME.TO.ME"]:
        page = [_Pair(l, l) for l in shouts + [odd]]
        page.append(_Pair("I SAID GET OUT OF MY ROOM", "ฉันบอกให้ออกไปจากห้องฉัน"))
        assert check_target_language_ratio(page, "THA", target_script_ratio) is False, odd


def test_one_url_alone_does_not_open_the_credit_exemption_1139():
    page = [_Pair(l, l) for l in ["HUH?!", "NO WAY!", "STOP IT!", "WHAT?", "www.x.com"]]
    page.append(_Pair("I SAID GET OUT OF MY ROOM", "ฉันบอกให้ออกไปจากห้องฉัน"))
    assert check_target_language_ratio(page, "THA", target_script_ratio) is False


def test_ocr_glued_words_on_two_lines_do_not_open_the_credit_exemption_1139():
    page = [_Pair(l, l) for l in ["HUH?!", "NO WAY!", "STOP IT!", "LISTEN.TO ME", "COME.TO.ME"]]
    page.append(_Pair("I SAID GET OUT OF MY ROOM", "ฉันบอกให้ออกไปจากห้องฉัน"))
    assert check_target_language_ratio(page, "THA", target_script_ratio) is False
