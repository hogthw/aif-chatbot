# Hướng dẫn quản lý thư mục AIF-KB (Knowledge Base của chatbot)

Tệp này bắt đầu bằng dấu "_" nên chatbot **không** đọc. Mọi tệp/thư mục có tên bắt đầu bằng `_`, `~` hoặc `.` đều bị bỏ qua (dùng để lưu nháp).

## Cấu trúc thư mục

| Thư mục | Nội dung | Mức ưu tiên khi tìm |
|---|---|---|
| `01-the-khai-niem` | Thẻ tóm tắt các khái niệm cốt lõi (3A, Bolt-on, ROI hai tầng, Hồ Sơ Agent…) | Cao nhất |
| `02-faq` | 100 câu hỏi thường gặp, mỗi câu một tệp `faq-NNN-...md` | Cao |
| `03-sach/ai-first-business` | Nội dung sách AI First Business, mỗi mục một tệp | Bình thường |
| `03-sach/nen-kinh-te-tri-tue` | Nội dung sách Nền Kinh tế Trí tuệ, mỗi mục một tệp | Bình thường |
| `04-website` | Thông tin trên website (mua sách, liên hệ, khóa học…), tệp `wN-...md` | Bình thường |
| `05-tai-lieu-khac` | Tài liệu bổ sung (PDF, Word, Excel, Google Docs/Sheets…) | Bình thường |

Chatbot ưu tiên theo **số đầu tên thư mục** (`01`, `02`…), nên giữ nguyên các tên thư mục này.

## Định dạng tệp

**Nên dùng .md (Markdown) hoặc Google Docs.** Chatbot đọc được: .md, .txt, .pdf, .docx, .xlsx, .csv, .html, Google Docs/Sheets/Slides. Mỗi tệp tối đa 10 MB (PDF scan cần OCR: tối đa 10 MB; các định dạng khác nên dưới 4 MB).

Mẫu một tệp .md (3 dòng đầu quan trọng):

```
# Tiêu đề ngắn, rõ nội dung
Nguồn: AI First Business, mục 4.4
Từ khóa: ROI hai tầng, tài sản bổ trợ, hiệu quả đầu tư

Nội dung…
```

- Dòng **`Nguồn:`** (trong 8 dòng đầu) là nội dung hiện ở "Nguồn: …" dưới câu trả lời. Chỉ ghi **tên sách và mục/chương**. Không có dòng này, chatbot dùng tên tệp làm nguồn.
- Dòng **`Từ khóa:`** (tùy chọn) giúp tìm đúng khi người hỏi dùng từ khác với sách.
- Mỗi tệp nên nói về **một chủ đề**, dài khoảng 200–500 chữ. Chủ đề dài thì tách thành nhiều tệp (`...-p1.md`, `...-p2.md`) và lặp lại dòng `Nguồn:` ở mỗi tệp.

## Quy tắc đặt tên

- Không dấu, chữ thường, nối bằng gạch ngang: `14-tu-dong-hoa-co-giam-sat.md`.
- FAQ: `faq-` + số 3 chữ số + tên: `faq-101-ai-co-thay-the-ke-toan-khong.md`. Số này khớp với số câu hỏi trên website.
- Website: `w` + số: `w10-lich-ra-mat-sach-moi.md`.

## Quy trình cập nhật hằng tháng

1. Sửa, thêm hoặc xóa tệp ngay trong thư mục này trên Google Drive.
2. Hệ thống tự đồng bộ lúc 02:00 sáng hôm sau (muốn ngay: chạy lệnh `/sync` trong HUONG-DAN-DEPLOY.md, mục 12).
3. AI Search cập nhật chỉ mục trong vòng 6 giờ (hoặc bấm **Sync** trên dashboard AI Search).
4. Hỏi thử chatbot 2–3 câu về nội dung vừa sửa.

Xóa tệp trên Drive thì chatbot cũng ngừng dùng tệp đó sau lần đồng bộ kế tiếp. Đổi tên/di chuyển tệp được xử lý như xóa tệp cũ và thêm tệp mới.

## Ghi chú về nội dung sách

Nội dung sách được chuyển từ bản PDF bằng nhận dạng chữ (OCR), nên còn một số lỗi nhỏ (dấu tiếng Việt, chữ trong hình vẽ/bảng biểu). Khi phát hiện, sửa trực tiếp trong tệp tương ứng. Nếu có bản Word gốc của sách, có thể thay toàn bộ thư mục `03-sach` bằng nội dung từ bản gốc để chính xác hơn.
