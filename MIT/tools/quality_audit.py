"""Quality audit for translated pages (#1143 Track D).

Reads the JSON a bench run or a `/translate/with-form/patches` response already produced and prints the numbers
we usually work out by hand: how many real dialogue lines reach the reader, which came back without target
language text, and whether any character name is spelled more than one way in the same chapter.

Usage:
  python tools/quality_audit.py bench.json
  python tools/quality_audit.py response.json --json report.json
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from manga_translator.quality_audit import audit, pairs_from_payload, summary_line  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("json_path", help="bench result, patches response, or a list of {src,dst}")
    ap.add_argument("--json", help="write the full report here")
    args = ap.parse_args()

    payload = json.load(open(args.json_path, encoding="utf-8"))
    report = audit(pairs_from_payload(payload))
    print(summary_line(report))
    for row in report["residue"][:15]:
        print("  no Thai  p%s: %r -> %r" % (row["page"], row["src"][:52], row["dst"][:32]))
    for name, info in report["name_drift"].items():
        print("  drift    %s (%d lines): %s" % (name, info["lines"], " / ".join(info["spellings"])))
    if args.json:
        json.dump(report, open(args.json, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("wrote %s" % args.json)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
