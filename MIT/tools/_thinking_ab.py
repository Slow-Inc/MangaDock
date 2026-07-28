"""#623 translation A/B: run the SAME dense multi-segment translate request through the
custom_openai LLM with thinking OFF vs ON, to confirm thinking-off doesn't regress text
quality and doesn't hit the content=None / 2048-token-cap failure on dense pages.
Remote LLM (9arm gateway) — no local GPU. Loads MIT/.env for keys.
"""
import os, sys, asyncio, time

# load MIT/.env
envp = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
for line in open(envp, encoding='utf-8'):
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        os.environ.setdefault(k, v)

from manga_translator.translators.custom_openai import CustomOpenAiTranslator, resolve_enable_thinking

# A dense narration group like the One-Punch case that triggered #623: several long
# Japanese sentences translated in one request (the density that made qwen3 spend the whole
# completion budget on <think> and return empty content).
QUERIES = [
    "かつてこの街は平和だった。だが、ある日突然現れた謎の怪人によって、すべてが一変してしまったのだ。",
    "人々は恐怖に怯え、逃げ惑い、そして英雄の登場をただひたすらに待ち望んでいた。",
    "しかし、誰も知らなかった。その英雄が、たった一撃で全てを終わらせる男であることを。",
    "彼の名はサイタマ。趣味でヒーローをやっている、どこにでもいるような普通の男だった。",
    "だがその拳は、いかなる強敵をも、ただの一撃で塵に帰す圧倒的な力を秘めていたのである。",
    "この物語は、最強すぎるが故に退屈を持て余す、一人のヒーローの日常を描いたものだ。",
]


async def run(enable_thinking: bool):
    os.environ['CUSTOM_OPENAI_ENABLE_THINKING'] = 'true' if enable_thinking else 'false'
    assert resolve_enable_thinking() == enable_thinking
    t = CustomOpenAiTranslator()
    # minimal config: mimic parse_args without a full TranslatorConfig
    from types import SimpleNamespace
    t.config = getattr(t, 'config', None)
    started = time.time()
    try:
        out = await t._translate('JPN', 'ENG', QUERIES)
        dt = time.time() - started
        return {'ok': True, 'dt': dt, 'out': out}
    except Exception as e:
        return {'ok': False, 'dt': time.time() - started, 'err': f'{type(e).__name__}: {e}'}


async def main():
    print(f"=== #623 A/B: {len(QUERIES)} dense JPN→ENG segments, model={os.environ.get('CUSTOM_OPENAI_MODEL')} ===\n")
    for label, think in [('THINKING OFF (#623 default)', False), ('THINKING ON (baseline default)', True)]:
        print(f"--- {label} ---")
        r = await run(think)
        if r['ok']:
            out = r['out']
            empties = sum(1 for x in out if not (x or '').strip())
            print(f"  OK in {r['dt']:.1f}s | {len(out)} segments | {empties} EMPTY")
            for i, x in enumerate(out):
                print(f"    [{i+1}] {(x or '<EMPTY>')[:90]}")
        else:
            print(f"  FAILED in {r['dt']:.1f}s | {r['err']}")
        print()


asyncio.run(main())
