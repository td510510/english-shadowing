"""Gộp data/parts/<level>_*.json thành data/<level>.js (để index.html tải được cả khi mở file://).

Chạy:  python tools/build_data.py
Mỗi part là một mảng JSON các bài học. Bài được sắp theo id (l01, l02, ...).
"""
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
LEVELS = {"b1": (6, 8), "b2": (8, 10), "c1": (10, 12)}  # số câu tối thiểu/tối đa mỗi bài (cảnh báo)


def main():
    problems = 0
    for level, (lo, hi) in LEVELS.items():
        lessons = []
        for f in sorted((ROOT / "data" / "parts").glob(f"{level}_*.json")):
            lessons += json.loads(f.read_text(encoding="utf-8"))
        if not lessons:
            continue
        lessons.sort(key=lambda l: l["id"])
        ids = [l["id"] for l in lessons]
        if len(set(ids)) != len(ids):
            print(f"[{level}] TRÙNG id:", sorted({i for i in ids if ids.count(i) > 1}))
            problems += 1
        for l in lessons:
            for k in ("id", "title", "title_vi", "voice", "voice_label", "sentences", "vocab", "notes"):
                if k not in l:
                    print(f"[{level}] {l.get('id')} thiếu '{k}'"); problems += 1
            n = len(l.get("sentences", []))
            if not lo <= n <= hi:
                print(f"[{level}] {l['id']} có {n} câu (mong đợi {lo}-{hi})")
            for s in l.get("sentences", []):
                if not s.get("en") or not s.get("vi"):
                    print(f"[{level}] {l['id']} có câu thiếu en/vi"); problems += 1
        out = ROOT / "data" / f"{level}.js"
        body = json.dumps({"level": level, "lessons": lessons}, ensure_ascii=False, indent=2)
        out.write_text(f"window.DATA = window.DATA || {{}};\nwindow.DATA.{level} = {body};\n", encoding="utf-8")
        print(f"[{level}] {len(lessons)} bài -> {out.name}")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
