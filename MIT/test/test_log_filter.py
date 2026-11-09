"""#1147: the post-processing modules log to logging.getLogger('manga_translator'); the worker's handler filter
only let 'manga-translator.*' through, so [EmptyBalloon], [InkCluster], [RegionDrop], the page-level
target-language retries and the OCR rescue warnings never reached the worker log - which hid #1139 and #881."""
import logging

from manga_translator.utils.log import Filter


def _rec(name):
    return logging.LogRecord(name, logging.INFO, __file__, 1, 'm', None, None)


def test_the_module_loggers_reach_the_worker_log():
    f = Filter()
    assert f.filter(_rec('manga_translator'))
    assert f.filter(_rec('manga_translator.ocr_vlm'))
    assert f.filter(_rec('manga-translator.shared'))


def test_third_party_loggers_stay_out():
    assert not Filter().filter(_rec('urllib3.connectionpool'))
