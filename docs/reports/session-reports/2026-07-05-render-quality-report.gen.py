# -*- coding: utf-8 -*-
import base64, os
B = "C:/Users/xenod/AppData/Local/Temp/mp2-deploy-build/docs/reports/benchmarks"
def d(p):
    with open(p, "rb") as f:
        return "data:image/png;base64," + base64.b64encode(f.read()).decode()
img = {
    "hair": d(f"{B}/2026-07-05-421-flux-hair-reconstruct.png"),
    "chibi": d(f"{B}/2026-07-05-540-protect-figures.png"),
    "sfx": d(f"{B}/2026-07-05-278-sfx-provenance.png"),
    "namebox": d(f"{B}/clip-evidence/namebox-FIXED-flatten.png"),
}
def L(en, th):
    return f'<span class="en">{en}</span><span class="th">{th}</span>'

STYLE = """<style>
  :root{
    --paper:#f4f3ef; --ink:#17171a; --seal:#c1332a; --fixed:#2e6d51;
    --grey:#6c6a64; --line:#e3e1da; --panel:#fffefb; --ink-soft:#33333a;
    --display:"Helvetica Neue",Helvetica,Arial,system-ui,sans-serif;
    --body:Georgia,"Times New Roman",serif;
    --thai:"Sarabun","Leelawadee UI","Noto Sans Thai","Tahoma",sans-serif;
    --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  }
  *{box-sizing:border-box}
  body{background:var(--paper);color:var(--ink);font-family:var(--body);
    line-height:1.6;margin:0;-webkit-font-smoothing:antialiased}
  body.lang-en .th{display:none} body.lang-th .en{display:none}
  body.lang-th{--body:var(--thai)}
  body.lang-th .th{font-family:var(--thai)}
  body.lang-th h1,body.lang-th h2,body.lang-th .th{line-height:1.5}
  .wrap{max-width:920px;margin:0 auto;padding:clamp(28px,5vw,72px) clamp(20px,5vw,56px)}
  .langbar{position:sticky;top:0;z-index:10;display:flex;justify-content:flex-end;
    background:linear-gradient(var(--paper),var(--paper) 70%,transparent);padding:12px 0 6px;margin-bottom:-18px}
  .seg{display:inline-flex;border:1px solid var(--ink);border-radius:2px;overflow:hidden;
    font-family:var(--display);font-size:12px;font-weight:700;letter-spacing:.04em}
  .seg button{border:0;background:var(--panel);color:var(--ink);padding:6px 14px;cursor:pointer;
    font:inherit;letter-spacing:inherit}
  .seg button[aria-pressed="true"]{background:var(--ink);color:var(--paper)}
  .seg button:focus-visible{outline:2px solid var(--seal);outline-offset:2px}
  .eyebrow{font-family:var(--display);text-transform:uppercase;letter-spacing:.18em;
    font-size:12px;font-weight:700;color:var(--seal)}
  h1{font-family:var(--display);font-weight:800;letter-spacing:-.02em;line-height:1.04;
    text-wrap:balance;font-size:clamp(29px,5.6vw,50px);margin:.35em 0 .3em}
  .dek{font-size:clamp(17px,2.4vw,21px);color:var(--ink-soft);max-width:62ch;margin:0}
  .meta{font-family:var(--mono);font-size:12.5px;color:var(--grey);margin-top:26px;
    display:flex;flex-wrap:wrap;gap:8px 22px;border-top:1px solid var(--line);padding-top:18px}
  .metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
    gap:1px;background:var(--line);border:1px solid var(--line);margin:40px 0 8px}
  .metric{background:var(--panel);padding:20px 22px}
  .metric b{font-family:var(--display);font-weight:800;font-size:30px;letter-spacing:-.02em;
    display:block;font-variant-numeric:tabular-nums}
  .metric .lab{font-family:var(--display);text-transform:uppercase;letter-spacing:.07em;
    font-size:11px;color:var(--grey)}
  body.lang-th .metric .lab{font-family:var(--thai);text-transform:none;letter-spacing:0;font-size:13px}
  section.fix{border-top:2px solid var(--ink);padding-top:28px;margin-top:56px}
  .chip{font-family:var(--display);text-transform:uppercase;letter-spacing:.1em;font-size:11px;
    font-weight:700;color:var(--seal);display:inline-block;margin-bottom:6px}
  body.lang-th .chip{font-family:var(--thai);text-transform:none;letter-spacing:.02em;font-size:12.5px}
  h2{font-family:var(--display);font-weight:800;letter-spacing:-.015em;font-size:clamp(21px,3.3vw,29px);
    margin:.1em 0 .5em;text-wrap:balance}
  body.lang-th h1,body.lang-th h2{font-family:var(--thai);letter-spacing:0}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:14px 30px;margin:6px 0 22px}
  @media(max-width:620px){.cols{grid-template-columns:1fr}}
  .col h4{font-family:var(--display);text-transform:uppercase;letter-spacing:.08em;font-size:11px;
    margin:0 0 4px;color:var(--grey)}
  body.lang-th .col h4{font-family:var(--thai);text-transform:none;letter-spacing:0;font-size:12.5px}
  .col p{margin:0;font-size:15.5px}
  .col.before h4{color:var(--seal)} .col.after h4{color:var(--fixed)}
  figure{margin:0}
  .frame{background:var(--panel);border:1px solid var(--line);padding:12px;box-shadow:0 1px 0 rgba(0,0,0,.03)}
  .frame img{display:block;width:100%;height:auto}
  figcaption{font-family:var(--mono);font-size:12.5px;color:var(--grey);margin-top:10px;line-height:1.55}
  body.lang-th figcaption{font-family:var(--thai);font-size:13.5px}
  figcaption .k{color:var(--ink)}
  .verdict{margin-top:14px;display:flex;flex-wrap:wrap;gap:8px 12px}
  .tag{display:inline-flex;align-items:center;padding:3px 10px;border-radius:2px;font-weight:600;
    font-size:12px;font-family:var(--display);letter-spacing:.02em}
  body.lang-th .tag{font-family:var(--thai);font-size:13px}
  .tag.g{background:#e7f1eb;color:var(--fixed)} .tag.r{background:#f6e4e2;color:var(--seal)}
  .tag.n{background:#eceae4;color:var(--ink-soft)}
  .note{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--ink);
    padding:20px 24px;margin:52px 0}
  .note h3{font-family:var(--display);font-size:16px;margin:0 0 8px;letter-spacing:-.01em}
  body.lang-th .note h3{font-family:var(--thai)}
  .note p{margin:0;font-size:15.5px}
  ul.list{list-style:none;padding:0;margin:18px 0 0}
  ul.list li{padding:11px 0;border-top:1px solid var(--line);font-size:15.5px;display:flex;gap:14px}
  ul.list li .id{font-family:var(--mono);font-size:13px;color:var(--seal);min-width:56px;font-weight:600}
  footer{border-top:2px solid var(--ink);margin-top:64px;padding-top:20px;
    font-family:var(--mono);font-size:12.5px;color:var(--grey)}
  body.lang-th footer{font-family:var(--thai);font-size:14px;line-height:1.7}
  .th-italic{color:var(--ink-soft)}
  strong{font-weight:700}
</style>"""

# --- content pieces (EN, TH) ---
TITLE = L("Teaching LaMa to read like Flux &mdash; and four other render fixes",
          "ทำให้ LaMa วาดได้ใกล้ Flux &mdash; พร้อมอีก 4 การแก้ render")
DEK = L("Every defect in this report was flagged on a real translated page, traced to its actual cause, fixed behind a gate, and proven against the original art &mdash; not &ldquo;looks better.&rdquo;",
        "ทุก defect ในรายงานนี้ถูกพบบนหน้าที่แปลจริง สืบหาต้นเหตุที่แท้จริง แก้ไขหลัง gate และพิสูจน์เทียบกับต้นฉบับ &mdash; ไม่ใช่แค่ &ldquo;ดูดีขึ้น&rdquo;")

METRICS = [
    ("5", L("issues closed","issue ที่ปิด")),
    ("3", L("figure-loss mechanisms","กลไก figure-loss")),
    ("108", L("TDD tests green","TDD tests ผ่าน")),
    ("0&#8202;&rarr;&#8202;byte", L("identical when off","เท่าเดิมเมื่อปิด")),
]

def fix(chip, h2, prob_h, prob, fix_h, fixp, src, alt, cap, tags):
    tagshtml = "".join(f'<span class="tag {c}">{L(e,t)}</span>' for c,e,t in tags)
    return f"""<section class="fix">
    <span class="chip">{chip}</span>
    <h2>{h2}</h2>
    <div class="cols">
      <div class="col before"><h4>{prob_h}</h4><p>{prob}</p></div>
      <div class="col after"><h4>{fix_h}</h4><p>{fixp}</p></div>
    </div>
    <figure><div class="frame"><img alt="{alt}" src="{src}"></div>
      <figcaption>{cap}</figcaption></figure>
    <div class="verdict">{tagshtml}</div>
  </section>"""

S421 = fix(
  L("#421 &middot; text over textured art","#421 &middot; text ทับ textured art"),
  L("Dialogue drawn over hair no longer smears into gray mush","บทพูดที่วางทับผมไม่เละเป็น gray smear อีกต่อไป"),
  L("The problem","ปัญหา"),
  L("When text sits directly on a character&rsquo;s hair, erasing it leaves a hole LaMa must repaint. LaMa can&rsquo;t synthesise hair &mdash; it fills a flat gray smear. This is the one case where the classical inpainter genuinely loses to a diffusion model.",
    "เมื่อ text วางบนผมตัวละครโดยตรง การลบทิ้งช่องที่ LaMa ต้องเติมกลับ แต่ LaMa สังเคราะห์ผมไม่ได้ &mdash; เติมเป็น gray smear แบนๆ นี่คือเคสเดียวที่ classical inpainter แพ้ diffusion model จริงๆ"),
  L("The fix","การแก้"),
  L("A discriminator finds only the mask regions that sit over textured art and routes just those crops to Flux Klein, pasted back into the LaMa page. LaMa handles everything else; flat pages route nothing.",
    "discriminator หาเฉพาะ mask ที่วางบน textured art แล้ว route เฉพาะ crop นั้นไป Flux Klein paste กลับเข้าหน้าที่ LaMa ทำ ส่วนที่เหลือ LaMa จัดการ; หน้า flat ไม่ route อะไรเลย"),
  img["hair"], "Original hair, LaMa smear, and Flux reconstruction",
  L('<span class="k">Original &nbsp;|&nbsp; LaMa only &nbsp;|&nbsp; Selective Flux.</span> The hair strands and the ear come back, matched to the target, with the text gone.',
    '<span class="k">ต้นฉบับ &nbsp;|&nbsp; LaMa อย่างเดียว &nbsp;|&nbsp; Selective Flux.</span> เส้นผมและใบหูกลับมา ตรงกับ target โดยที่ text หายไป'),
  [("g","Matches target","ตรง target"),
   ("n","+8.7s only on pages with textured art","+8.7s เฉพาะหน้าที่มี textured art"),
   ("n","flat pages &rarr; 0 routed, 0 cost","หน้า flat &rarr; route 0, cost 0"),
   ("n","VRAM steady-state unchanged","VRAM steady-state เท่าเดิม")])

S540 = fix(
  L("#540 &middot; a figure vanished","#540 &middot; ตัวละครหายไป"),
  L("A small character stopped getting erased with the text","ตัวละครเล็กเลิกถูกลบไปพร้อม text"),
  L("The problem","ปัญหา"),
  L("A chibi figure was disappearing from the page. The obvious theory was a detection false-positive &mdash; the model reading the drawing as text. An audit of every detection box <em>disproved</em> that: all boxes were legitimate text.",
    "ตัวละคร chibi หายจากหน้า ทฤษฎีแรกคือ detection false-positive &mdash; model อ่านภาพวาดเป็น text แต่ audit ทุก detection box <em>หักล้าง</em>ข้อนั้น: ทุก box เป็น text จริง"),
  L("The real cause &amp; fix","ต้นเหตุจริง &amp; การแก้"),
  L("The text mask&rsquo;s morph-close was bridging the text that surrounded the figure and filling the enclosed drawing &mdash; raw glyph outlines covered <b>0%</b> of it, the closed mask <b>95%</b>. The fix clips the mask back to the actual glyph outlines.",
    "morph-close ของ text mask เชื่อม text ที่ล้อมตัวละครแล้วเติมเต็มภาพที่ถูกล้อม &mdash; raw glyph คลุมแค่ <b>0%</b> แต่ closed mask <b>95%</b> การแก้คือ clip mask กลับให้ตรง glyph จริง"),
  img["chibi"], "Chibi figure preserved",
  L('<span class="k">Original &nbsp;|&nbsp; protect off &nbsp;|&nbsp; protect on.</span> Deterministic mask measurement: figure ink erased <b>95% &rarr; 0%</b>, text coverage <b>100% &rarr; 100%</b>.',
    '<span class="k">ต้นฉบับ &nbsp;|&nbsp; protect ปิด &nbsp;|&nbsp; protect เปิด.</span> วัด mask แบบ deterministic: figure ink ถูกลบ <b>95% &rarr; 0%</b>, text coverage <b>100% &rarr; 100%</b>'),
  [("g","Figure preserved, text untouched","figure รอด, text ไม่กระทบ"),
   ("r","detection-FP theory disproven","ทฤษฎี detection-FP ถูกหักล้าง"),
   ("n","provenance-based, not a pixel guess","ใช้ provenance ไม่ใช่เดา pixel")])

S278 = fix(
  L("#278 &middot; sound effects","#278 &middot; sound effects (SFX)"),
  L("SFX get translated; short dialogue stops being mistaken for SFX","SFX ถูกแปล; dialogue สั้นเลิกถูกเข้าใจผิดเป็น SFX"),
  L("The problem","ปัญหา"),
  L("The SFX rescue fired on <em>any</em> region under four characters in a biggish box &mdash; so short dialogue like <span class=\"th-italic\">&ldquo;huh?&rdquo;</span> was shipped to the vision model and overwritten with a made-up onomatopoeia, at ~1&ndash;2s each.",
    "SFX rescue ยิงกับ region <em>ใดๆ</em> ที่ต่ำกว่า 4 ตัวอักษรในกล่องใหญ่พอ &mdash; dialogue สั้นอย่าง <span class=\"th-italic\">&ldquo;หา?&rdquo;</span> จึงถูกส่งไป vision model แล้วถูกเขียนทับด้วย onomatopoeia ที่แต่งขึ้น เสีย ~1&ndash;2 วิ/อัน"),
  L("The fix","การแก้"),
  L("Rescue now gates on <em>provenance</em>: only regions the SFX detector actually found are rescued. Real SFX still translate; dialogue is left alone and never hits the gateway.",
    "ตอนนี้ rescue gate ด้วย <em>provenance</em>: rescue เฉพาะ region ที่ SFX detector เจอจริง SFX จริงยังแปล; dialogue ถูกปล่อยไว้ ไม่โดนส่ง gateway"),
  img["sfx"], "Japanese SFX rendered as Thai",
  L('<span class="k">Original SFX &nbsp;&#12396;&nbsp; &rarr; rendered Thai &nbsp;&ldquo;&#3609;&#3636;&#3657;&#3610;&rdquo;.</span> Verified live: the flag survives the real detect&rarr;merge&rarr;rescue path, so no SFX regressed.',
    '<span class="k">SFX ต้นฉบับ &nbsp;&#12396;&nbsp; &rarr; render ไทย &nbsp;&ldquo;&#3609;&#3636;&#3657;&#3610;&rdquo;.</span> verify live: flag รอด path detect&rarr;merge&rarr;rescue จริง SFX จึงไม่ regress'),
  [("g","SFX still rescued","SFX ยัง rescue ได้"),
   ("g","no more mis-read dialogue","ไม่มี dialogue อ่านผิดอีก"),
   ("n","fewer vision-gateway round-trips","vision-gateway round-trip น้อยลง")])

S535 = fix(
  L("#535 &middot; clean erasure","#535 &middot; การลบที่สะอาด"),
  L("Faint ghosts of the original text no longer haunt caption boxes","ghost จางของ text ต้นฉบับเลิกหลอกหลอน caption box"),
  L("The problem","ปัญหา"),
  L("On flat white caption boxes, LaMa reconstructed a faint ghost of the Japanese it had just erased &mdash; the mask covered every ink pixel, yet the model re-grew text from the stroke stubs around it.",
    "บน caption box ขาวเรียบ LaMa สร้าง ghost จางของญี่ปุ่นที่เพิ่งลบกลับมา &mdash; mask คลุม ink ครบทุก pixel แต่ model ปั้น text กลับจากเศษ stroke รอบๆ"),
  L("The fix","การแก้"),
  L("A verified white caption box is uniform paper. Fill the source ink with the box&rsquo;s own paper colour directly instead of trusting the GAN &mdash; deterministic, art-gated so a figure box is skipped.",
    "caption box ขาวที่ verify แล้ว = กระดาษเรียบ เติม source ink ด้วยสีกระดาษของกล่องเองตรงๆ แทนที่จะเชื่อ GAN &mdash; deterministic, art-gated จึงข้ามกล่องที่มี figure"),
  img["namebox"], "Name caption box rendered cleanly in Thai",
  L('<span class="k">The name box after the fix</span> &mdash; clean Thai, no residual squiggle of the original lettering.',
    '<span class="k">name box หลังแก้</span> &mdash; ไทยสะอาด ไม่มีเศษ squiggle ของตัวอักษรเดิม'),
  [("g","No LaMa ghost","ไม่มี LaMa ghost"),
   ("n","paper-fill, zero VRAM","เติมสีกระดาษ, VRAM 0"),
   ("n","art-gated","art-gated")])

NOTE = f"""<div class="note">
    <h3>{L("How each fix was proven &mdash; and one method that was retired","แต่ละ fix พิสูจน์อย่างไร &mdash; และวิธีที่ถูกยกเลิก")}</h3>
    <p>{L("The translate pipeline is non-deterministic (OCR / LLM sampling), so a live before/after can differ for reasons unrelated to the change. Every result here was confirmed on a <strong>fixed, captured mask with pure image math</strong> &mdash; e.g. &ldquo;figure ink erased 95%&rarr;0%, text 100%&rarr;100%&rdquo; &mdash; and an earlier claim that rested on a confounded live comparison was retracted. Deterministic measurement is the proof; the rendered image is the sanity check.",
    "pipeline การแปลเป็น non-deterministic (OCR / LLM sampling) live before/after จึงต่างกันได้ด้วยเหตุที่ไม่เกี่ยวกับการแก้ ทุกผลในนี้ยืนยันบน <strong>mask ที่ capture ไว้คงที่ ด้วยคณิต image ล้วน</strong> &mdash; เช่น &ldquo;figure ink ถูกลบ 95%&rarr;0%, text 100%&rarr;100%&rdquo; &mdash; และคำเคลมก่อนหน้าที่พึ่ง live ที่ confound ถูกถอน การวัด deterministic คือหลักฐาน; ภาพ render คือการเช็คความสมเหตุสมผล")}</p>
  </div>"""

LISTITEMS = [
    (L("closed","ปิด"), L("Verified-done issues cleared with evidence: seamless-clone escalation, in-bubble double-detect dedup, Knuth-Plass line-breaking, bubble-fit overflow, off-canvas clip guard.",
        "ปิด issue ที่ทำเสร็จแล้วพร้อมหลักฐาน: seamless-clone, dedup double-detect ในบับเบิล, Knuth-Plass line-breaking, bubble-fit overflow, off-canvas clip guard")),
    ("#172", L("OCR rescue ladder &mdash; the pure, ML-free policy and geometric pre-split that decide when a mangled long line gets re-read (integration wiring pending).",
        "OCR rescue ladder &mdash; policy pure ไม่มี ML และ geometric pre-split ที่ตัดสินว่าเมื่อไรบรรทัดยาวที่เพี้ยนต้องอ่านซ้ำ (เหลือ wiring integration)")),
    (L("levers","levers"), L("Two more gated erase-quality levers: adaptive mask dilation (kills LaMa ghosting on flat backgrounds) and full-page textline-restrict (stops CRF over-reach onto a figure).",
        "อีก 2 lever คุณภาพการลบแบบ gated: adaptive mask dilation (ฆ่า LaMa ghost บนพื้นเรียบ) และ full-page textline-restrict (กัน CRF over-reach ไปโดน figure)")),
    (L("process","process"), L("GitHub Issues promoted to the task source of truth &mdash; bilingual bodies kept current, every close carries a reason &mdash; so work hands off between people without loss.",
        "ยก GitHub Issues เป็น source of truth ของงาน &mdash; body สองภาษาที่อัปเดตเสมอ ทุกการปิดมีเหตุผล &mdash; เพื่อโอนงานระหว่างคนได้โดยไม่ตกหล่น")),
]
LIST = "".join(f'<li><span class="id">{i}</span><span>{t}</span></li>' for i,t in LISTITEMS)

FOOT = L("Every fix ships behind an env flag, off by default and byte-identical when off &mdash; nothing here changes production until it is promoted through the branch reconciliation. Figure-loss is now covered by three independent mechanisms working together: mask-restrict, selective Flux, and figure-protect.",
    "ทุก fix อยู่หลัง env flag ปิดเป็น default และ byte-identical เมื่อปิด &mdash; ไม่มีอะไรเปลี่ยน production จนกว่าจะ promote ผ่าน branch reconciliation ตอนนี้ figure-loss ครอบด้วย 3 กลไกอิสระที่ทำงานร่วมกัน: mask-restrict, selective Flux, และ figure-protect")

metrics_html = "".join(f'<div class="metric"><b>{v}</b><span class="lab">{l}</span></div>' for v,l in METRICS)
META = ('<span>2026-07-05</span><span>branch landing/render-phase0</span>'
        f'<span>{L("all fixes gated &middot; off = byte-identical","ทุก fix gated &middot; off = byte-identical")}</span>'
        f'<span>{L("108 unit tests green","108 unit tests ผ่าน")}</span>')

HTML = f"""<title>MIT Render Quality &mdash; Session Report</title>
{STYLE}
<div class="wrap">
  <div class="langbar"><div class="seg" role="group" aria-label="Language">
    <button id="b-en" aria-pressed="true" onclick="setLang('en')">EN</button>
    <button id="b-th" aria-pressed="false" onclick="setLang('th')">ไทย</button>
  </div></div>
  <div class="eyebrow">{L("MIT &middot; Manga image-translation pipeline","MIT &middot; ระบบแปลภาพมังงะ")}</div>
  <h1>{TITLE}</h1>
  <p class="dek">{DEK}</p>
  <div class="meta">{META}</div>
  <div class="metrics">{metrics_html}</div>
  {S421}
  {S540}
  {S278}
  {S535}
  {NOTE}
  <div class="eyebrow" style="margin-top:56px">{L("Also this session","ในรอบนี้ยังทำ")}</div>
  <ul class="list">{LIST}</ul>
  <footer>{FOOT}</footer>
</div>
<script>
  function setLang(l){{
    document.body.classList.remove('lang-en','lang-th');
    document.body.classList.add('lang-'+l);
    document.getElementById('b-en').setAttribute('aria-pressed', l==='en');
    document.getElementById('b-th').setAttribute('aria-pressed', l==='th');
    document.documentElement.lang = l;
  }}
  document.body.classList.add('lang-en');
</script>"""

out = os.path.dirname(os.path.abspath(__file__)) + "/mit-render-report.html"
with open(out, "w", encoding="utf-8") as f:
    f.write(HTML)
print("wrote", out, len(HTML), "bytes")
