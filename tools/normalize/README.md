# Công cụ tạo lại Knowledge Base

Chỉ cần khi muốn dựng lại toàn bộ thư mục `kb/AIF-KB` từ nguồn gốc (thường không cần: sửa trực tiếp tệp .md trên Drive là đủ).

1. FAQ + website (từ mã nguồn website v2.2.0, thư mục `content/chat`):
   `python3 build_faq_web.py <afb>/content/chat ../../kb/AIF-KB`
2. Sách (PDF → OCR → tệp theo mục):
   ```
   ./ocr_sach.sh 1.pdf ocr_afb 240 4 <tessdata_best>
   ./ocr_sach.sh Ai-Economy.pdf ocr_aie 269 4 <tessdata_best>
   python3 build_books.py ocr_afb ocr_aie ../../kb/AIF-KB
   ```
   Cấu hình trang/chương của từng cuốn nằm trong `build_books.py` (AFB) và `build_books_aie.py` (Nền Kinh tế Trí tuệ). Danh sách sửa lỗi OCR: biến `FIX`.
3. Thẻ khái niệm (`01-the-khai-niem`) viết tay, không sinh tự động.
