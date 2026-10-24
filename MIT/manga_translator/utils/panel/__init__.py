import cv2
import numpy as np

from .kumikolib import Kumiko


def get_panels_from_array(img_rgb, rtl=True):
    """Panels of a page array. Kumiko works on the array directly — it used to be written to a temp
    PNG and read back, a lossless round trip that returned the same bytes for 3/4-channel uint8
    input (#872). Any other input (grayscale, float, 16-bit) still goes through the same PNG codec,
    in memory, so it is normalised exactly as before."""
    img = img_rgb
    if img.dtype != np.uint8 or img.ndim != 3 or img.shape[2] not in (3, 4):
        img = cv2.imdecode(cv2.imencode('.png', img)[1], cv2.IMREAD_COLOR)
    k = Kumiko({'rtl': rtl})
    k.parse_image('page.png', img=img)
    return k.get_infos()[0]['panels']
