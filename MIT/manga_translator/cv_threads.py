"""OpenCV thread count. Importing ultralytics runs ``cv2.setNumThreads(0)`` — a PyTorch DataLoader
workaround for forked workers — which leaves OpenCV single-threaded for the whole process: every
bilateral filter, warp and resize in the pipeline (#872: the detector's page bilateral filter took
0.64 s instead of 0.05 s). MIT only runs inference, so the YOLO loaders restore the default."""
import cv2


def restore_opencv_threads() -> None:
    cv2.setNumThreads(-1)   # negative = OpenCV's default thread count
