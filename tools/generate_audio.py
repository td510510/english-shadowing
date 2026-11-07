"""Tạo audio mp3 (giọng neural Anh-Anh) cho từng câu trong data/*.js.

Chạy:  python tools/generate_audio.py            (tất cả level)
       python tools/generate_audio.py b1         (một level)
Đã có file thì bỏ qua; thêm --force để tạo lại.
Mỗi câu tạo 2 file: sNN.mp3 (chuẩn) và sNN_slow.mp3 (chậm -20%).
"""
import asyncio
import json
import re
import sys
from pathlib import Path

import edge_tts

sys.stdout.reconfigure(encoding="utf-8")  # in tiếng Việt được trên console Windows
ROOT = Path(__file__).resolve().parent.parent
SLOW_RATE = "-20%"


def load_level(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    m = re.search(r"window\.DATA\.\w+\s*=\s*", text)
    start = m.end()
    end = text.rindex("}")
    return json.loads(text[start:end + 1])


async def synth(text, voice, rate, out: Path, force):
    if out.exists() and not force:
        return False
    out.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(3):
        try:
            await edge_tts.Communicate(text, voice, rate=rate).save(str(out))
            return True
        except Exception as e:  # mạng chập chờn
            if attempt == 2:
                raise
            await asyncio.sleep(2)


async def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    force = "--force" in sys.argv
    files = sorted((ROOT / "data").glob("*.js"))
    if args:
        files = [f for f in files if f.stem in args]
    sem = asyncio.Semaphore(4)

    async def job(*a):
        async with sem:
            return await synth(*a)

    tasks = []
    for f in files:
        data = load_level(f)
        for ls in data["lessons"]:
            for i, s in enumerate(ls["sentences"], 1):
                base = ROOT / "audio" / data["level"] / ls["id"] / f"s{i:02d}"
                tasks.append(job(s["en"], ls["voice"], "+0%", base.with_suffix(".mp3"), force))
                tasks.append(job(s["en"], ls["voice"], SLOW_RATE,
                                 base.with_name(base.name + "_slow.mp3"), force))
    results = await asyncio.gather(*tasks)
    print(f"Đã tạo {sum(1 for r in results if r)} file, bỏ qua {sum(1 for r in results if not r)} file có sẵn.")


if __name__ == "__main__":
    asyncio.run(main())
