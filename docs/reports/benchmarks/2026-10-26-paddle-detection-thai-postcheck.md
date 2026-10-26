# Paddle stack, PP-OCRv6 detection and a Thai post-render check — sweep round 2

**Setup.** The PRD's OCR/detection/post-check candidates all live in Paddle, and installing Paddle into the live
MIT venv would risk the serving stack, so the experiment runs in an isolated venv:
`C:\Users\xenod\venvs\paddle` (paddlepaddle 3.3.1 + paddleocr 3.7.0, CPU).

**Gotcha:** on this CPU the Paddle 3.3.1 oneDNN path fails detection with
`NotImplementedError: ConvertPirAttribute2RuntimeAttribute not support [pir::ArrayAttribute<pir::DoubleAttribute>]`.
`enable_mkldnn=False` makes it run (loaded 3.0 s, then 45–62 s per page on CPU — CPU numbers only; they say
nothing about GPU cost).

## 1) PP-OCRv6 detection vs our DBNet

Models downloaded by paddleocr: `PP-OCRv6_medium_det` + `PP-OCRv6_medium_rec` (that is the PRD candidate), later
`PP-OCRv5_server_det` + `th_PP-OCRv5_mobile_rec` for the Thai test.

| page | Paddle boxes | our merged lines | what it read |
|---|---|---|---|
| 2 | 7 | 7 | `SENPAI!`, `GOOD`, `AFTERN...`, `HUH`, `ス`, `C`, `50` |
| 9 | 31 | 13 | word-level: `Fu`, `ABOUT`, `YESTERDAY,`, `IT WAS AN`, `ACCIDENT,`, `SO IT'S NOT` … |
| 10 | 20 | 10 | word-level: `You`, `hated`, `that`, `idea`, `much~?`, plus junk (`キEEて`, `2)`) |

- PP-OCRv6 det is **word/phrase level**; MIT's pipeline merges textlines anyway, so a swap would mean feeding its
  boxes through the existing merge — not a drop-in model change.
- On these three pages it found **no text that our DBNet + rescue pipeline missed**; it also produced junk boxes
  over artwork (`ス`, `C`, `50`, `キEEて`), the same class the #693 gate exists to drop.
- Verdict: **not adopted**. There is no measured recall gap to close, and running Paddle inside MIT means a new
  runtime or an ONNX export of det/rec.

## 2) Thai post-render check (`th_PP-OCRv5_mobile_rec`)

Read back the Thai actually rendered on pages 9–10 (13 regions), compared character-wise (CER) with the intended
translation:

| | value |
|---|---|
| median CER | **6.5 %** |
| regions ≤ 10 % CER | 8 / 13 |
| regions ≤ 25 % CER | 13 / 13 |
| worst | `พรึ่บ` → `พรึบ` (0.20, a **missing tone mark** — the class of defect this gate exists to catch) |

It also splits Thai words with spaces (`ดีใจ จัง`) and makes its own small errors (`เพิ่งจุจะ` for `เพิ่งจะ`,
`พูพเร่ง` for `ฟุฟุ เรื่อง`), so an exact-match gate would cry wolf. As a **screening gate** it is promising:
it surfaces the one region where a tone mark may really be clipped, and everything else stays under a 25 %
threshold.

Verdict: **candidate, not adopted** — needs integration at the render seam and calibration against human labels
(which CER values are render defects vs recogniser noise). The model dependency is Paddle/ONNX; the ONNX export
would keep the live MIT venv free of Paddle.

## Where the sweep stands

| pipeline part | candidate tested | result |
|---|---|---|
| OCR (line) | Hayai v2.5 Nova | adopted for the rescue path; confidence-gated |
| OCR (alternative) | manga-ocr | rejected (Japanese recogniser; 0 patches on an EN page, 57 s) |
| Translator | gpt-6-luna (Responses) | **adopted**; blind judge 9:3:1 |
| Inpainting | FLUX.2-klein | rejected (4.6× cost, no visible gain) |
| Detection | PP-OCRv6 det | no measured gain; word-level boxes; needs a Paddle/ONNX runtime |
| Post-render check | th_PP-OCRv5 | promising screen, needs calibration + ONNX |
| Foreground masks | SAM 2.1 | not tested yet (runnable via ultralytics) |
| Fragment linking / speaker / lettering | COO, MAGI, MangaLMM, AnyText2, Qwen-Image | no weights on this box |
