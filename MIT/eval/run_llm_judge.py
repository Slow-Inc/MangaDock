import sys, glob, pickle, asyncio
sys.path.insert(0, 'D:/Github/MangaDock/.claude/worktrees/mp2-work/MIT')
from dotenv import load_dotenv
load_dotenv('D:/Github/MangaDock/MIT/.env')  # CUSTOM_OPENAI_* keys
from eval.translation_eval import EvalItem, aggregate, render_scorecard
from eval.llm_judge import judge_items

items = []
for i, p in enumerate(sorted(glob.glob('D:/Github/MangaDock/.claude/worktrees/mp2-work/MIT/_render_dump/r_*.pkl'))):
    d = pickle.load(open(p, 'rb'))
    for j, r in enumerate(d['regions']):
        src = (getattr(r, 'text', '') or '').strip()
        cand = (getattr(r, 'translation', '') or '').strip()
        if src and cand:
            items.append(EvalItem(f'ds3-p{i}-r{j}', src, cand, cand, 'dialogue', 'production'))
print(f'eval-set: {len(items)} bubbles (Gal Yome EN p4, source EN -> MIT Thai)')

async def main():
    scores = await judge_items(items)
    agg = aggregate(items, scores)
    md = render_scorecard(agg, meta={'title': 'Gal Yome EN p4 — LLM-judged (custom_openai, small sample)', 'date': '2026-07-04'})
    banner = ('> ⚠️ **LLM-JUDGED (not human)** — first autonomous scorecard via the custom_openai judge on a\n'
              '> SMALL sample (ds3 = Gal Yome EN p4 only). Lower-confidence than the human MVE; expand to ~100\n'
              '> bubbles + blind human grading for the gold-standard #526 run. Proves the eval is now RUNNABLE.\n\n')
    out = 'D:/Github/MangaDock/.claude/worktrees/mp2-work/docs/reports/benchmarks/2026-07-04-translation-eval-llmjudged.md'
    open(out, 'w', encoding='utf-8').write(banner + md)
    print('overall:', round(agg['overall_mean'], 2), '/2 | per-axis:', {k: round(v,2) for k,v in agg['axis_mean'].items()})
    print('WROTE', out)

asyncio.run(main())
