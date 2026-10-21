from .kumikolib import Kumiko


def get_panels_from_array(img_rgb, rtl=True):
    """Panels of a page array. Kumiko works on the array directly — it used to be written to a temp
    PNG and read back, a lossless round trip that returned the same bytes (#822 follow-up)."""
    k = Kumiko({'rtl': rtl})
    k.parse_image('page.png', img=img_rgb)
    return k.get_infos()[0]['panels']
