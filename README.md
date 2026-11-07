# English Shadowing (B1 · B2 · C1)

Web app luyện tiếng Anh bằng phương pháp **shadowing**, có bản dịch tiếng Việt. Mỗi level có 50 bài, giọng đọc Anh-Anh (neural TTS) với 4 giọng xen kẽ.

## Cách dùng
1. Chọn level (B1/B2/C1) rồi chọn bài.
2. Nghe cả bài, đọc bản dịch để hiểu nghĩa.
3. Bật **Shadowing**: nghe từng câu rồi đọc theo trong khoảng dừng.
4. Chỉnh tốc độ, âm lượng, số lần lặp; ghi âm giọng mình để so sánh.

Tiến độ và số ngày học liên tiếp lưu trong trình duyệt (localStorage).

## Thêm / sửa bài
Nguồn bài học nằm ở `data/parts/<level>_<n>.json`.

```bash
python tools/build_data.py      # gộp thành data/b1.js, b2.js, c1.js
pip install edge-tts
python tools/generate_audio.py  # tạo mp3 còn thiếu (thêm --force để tạo lại)
```

Giọng đọc dùng [edge-tts](https://github.com/rany2/edge-tts).
