# Báo cáo thay đổi – Chatbot AIF 2.0

**Gửi:** anh Trần Tấn Sỹ · **Ngày:** 09/11/2026 · **Phạm vi:** chatbot trên aifirstbusiness.vn (website giữ nguyên bản v2.2.0)

## Vì sao làm lại

Báo cáo test 40 câu cho thấy 32 câu không đạt. Nguyên nhân chính không nằm ở mô hình AI, mà ở cách lưu kiến thức: toàn bộ KB là một tệp JSON trong Worker, sách bị cắt thành đoạn theo số chữ (cắt ngang mục), tìm kiếm theo từ khóa đơn giản nên hay lấy sai đoạn hoặc bỏ sót khái niệm cốt lõi (3A, Bolt-on, ROI hai tầng…).

## Thay đổi chính

1. **Kiến thức chuyển sang Google Drive** (thư mục `AIF-KB`). Sửa nội dung trên Drive là chatbot tự cập nhật (02:00 mỗi đêm), không cần sửa code hay deploy lại.
2. **Tìm kiếm theo ngữ nghĩa + từ khóa** bằng Cloudflare AI Search (hiểu câu hỏi diễn đạt khác với sách), thay cho so khớp từ khóa.
3. **Sách được chuẩn hóa lại từ đầu**: nhận dạng chữ lại bằng mô hình tiếng Việt chất lượng cao, tách **đúng theo từng mục** (96 mục AI First Business, 88 mục Nền Kinh tế Trí tuệ), bỏ mục lục, chú thích, tài liệu tham khảo.
4. **13 thẻ khái niệm** tóm tắt các khung cốt lõi, được ưu tiên khi tìm, để chatbot không bỏ sót ý chính.
5. **Hội thoại nhiều lượt**: câu hỏi nối tiếp ("vậy khâu đó thì sao?") được viết lại thành câu đầy đủ trước khi tìm.
6. **Trích dẫn gọn**: chỉ ghi tên sách và mục, ví dụ *Nguồn: AI First Business (mục 4.4)*.
7. **System Prompt mới** theo đề xuất đã gửi: chỉ trả lời từ tài liệu, từ chối lịch sự theo 4 loại câu hỏi, chống lộ cấu hình.
8. Hỗ trợ thêm tài liệu nhiều định dạng (PDF, Word, Excel, Google Docs/Sheets) vào thư mục `05-tai-lieu-khac`.

Website **không phải upload lại**; địa chỉ chatbot giữ nguyên.

## Cần anh Sỹ xem/quyết định

| # | Việc | Ghi chú |
|---|---|---|
| 1 | **Duyệt 13 thẻ khái niệm** (thư mục `01-the-khai-niem`) | Viết bám nội dung sách, nhưng là bản tóm tắt nên cần tác giả xác nhận cách diễn đạt. Sửa trực tiếp trên Drive. |
| 2 | Chi phí **AI Search** bắt đầu tính từ **01/12/2026** | Khoảng $0,75 / 1.000 lượt tìm + phí đánh chỉ mục và lưu trữ nhỏ (KB hiện < 3 MB). |
| 3 | Mô hình trả lời: Llama 3.3 70B (dự phòng Mistral Small 3.1) | Có thể đổi trong cấu hình nếu muốn so sánh chất lượng/chi phí. |
| 4 | Bản Word gốc của 2 cuốn sách (nếu có) | Nội dung sách hiện lấy từ PDF qua nhận dạng chữ, còn lỗi nhỏ ở bảng biểu và bảng thuật ngữ. Có bản Word thì thay vào sẽ chính xác hơn. |
| 5 | Cập nhật lại đáp án tham chiếu trong file Test KB | Một số "Ý chính" trong file test cần đối chiếu lại với sách trước khi chấm vòng mới. |

## Bước tiếp theo

1. Deploy theo `HUONG-DAN-DEPLOY.md` (khoảng 60–90 phút).
2. Chạy công cụ chấm thử 40 câu (`tools/eval`) và so với kết quả cũ.
3. Hằng tháng: cập nhật KB trên Drive theo `kb/AIF-KB/_HUONG-DAN.md`.
