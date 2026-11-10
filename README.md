# Chatbot AIF 2.0 – Kiến trúc RAG trên Cloudflare

Thay chatbot cũ (Knowledge Base là một tệp JSON nằm trong Worker) bằng kiến trúc mới: Knowledge Base nằm trong **Google Drive**, tự đồng bộ sang **R2**, được **Cloudflare AI Search** đọc, tách đoạn, tạo embedding và lưu vector. Worker `aif-kb-chat` tìm theo ngữ nghĩa + từ khóa rồi để **Workers AI** viết câu trả lời kèm nguồn (tên sách + mục).

Bắt đầu từ: **HUONG-DAN-DEPLOY.md** (deploy từng bước trên Windows).

## Kiến trúc

```
                    (1) đồng bộ: cron 02:00 hằng ngày hoặc POST /sync
 Google Drive  ───────────────────────────────►  Worker aif-kb-sync
 thư mục AIF-KB      Drive API (service account,        │ chỉ tải tệp mới/đã sửa (so md5)
 .md .pdf .docx      chỉ quyền đọc)                     │ xóa tệp đã xóa trên Drive
 .xlsx Google Docs…                                     ▼
                                          R2 "aif-kb"  +  KV "KB_STATE" (nhãn nguồn, mã FAQ)
                                                │
                    (2) AI Search tự đọc R2 ────┘  chuyển sang Markdown (PDF/DOCX/XLSX…),
                                                   tách đoạn, embedding qwen3/bge-m3,
                                                   chỉ mục vector + BM25 (hybrid)
                                                │
 Website v2.2.0 ── POST (giữ giao thức cũ) ──► Worker aif-kb-chat
   chat.js: cấp 1–3 trả lời ngay                 a. viết lại câu hỏi (llama-3.1-8b-fast, ≤3s)
   trong trình duyệt; cấp 4 gọi Worker           b. AI Search hybrid → gom theo tệp, ưu tiên thẻ khái niệm/FAQ
                                                 c. Workers AI (llama-3.3-70b fp8-fast, dự phòng mistral-small-3.1)
                                                 d. trả về dạng luồng + "Nguồn: AI First Business (mục 4.4)"
```

## Lựa chọn công nghệ

| Nhu cầu | Chọn | Vì sao |
|---|---|---|
| Đọc nhiều định dạng, tách đoạn, embedding, vector store | **Cloudflare AI Search** (dùng R2 làm nguồn) | Một dịch vụ làm trọn: chuyển PDF/DOCX/XLSX/HTML/ảnh sang Markdown, tách đoạn, embedding, lưu Vectorize, tìm hybrid, tự đồng bộ theo lịch. Không phải tự viết bộ đọc từng định dạng trong Worker (giới hạn CPU/bộ nhớ). |
| Lấy tệp từ Drive cá nhân | Drive API v3 + **service account** (JWT ký bằng WebCrypto) | Không cần thư viện; không cần đăng nhập OAuth định kỳ; chỉ quyền đọc thư mục được chia sẻ. |
| Lưu bản sao + trạng thái | **R2** + **KV** | R2 là nguồn dữ liệu của AI Search; KV giữ md5 từng tệp (đồng bộ tăng dần) và nhãn nguồn. |
| Viết câu trả lời | **Workers AI** `llama-3.3-70b-instruct-fp8-fast` | Nhanh, tiếng Việt khá; mô hình dự phòng `mistral-small-3.1-24b-instruct`. |
| Theo dõi | **AI Gateway** (tùy chọn) + Workers Logs | Nhật ký từng lượt, chi phí token, cache. |
| Chống lạm dụng | Workers **Rate Limiting** (8 câu/phút/IP) + CORS + secret | |

Vì sao **không** tự ghép Vectorize + tự parse: phải tự viết bộ đọc PDF/DOCX/XLSX trong Worker (thư viện nặng, dễ chạm giới hạn 128 MB bộ nhớ và thời gian CPU), tự quản lý chunk/embedding/xóa vector cũ. AI Search đã làm những việc này và tính phí theo dung lượng thực dùng.

## Xử lý đa định dạng

| Định dạng | Cách xử lý |
|---|---|
| .md .txt .csv .html | AI Search đọc trực tiếp. **Khuyên dùng .md** để kiểm soát dòng `Nguồn:` và cách tách đoạn. |
| .pdf | AI Search chuyển sang Markdown, có OCR (≤ 10 MB). |
| .docx .xlsx .odt .ods | AI Search chuyển sang Markdown (bảng giữ thành bảng Markdown). |
| Google Docs / Sheets / Slides | Worker sync xuất sang .docx / .xlsx / .pdf trước khi lưu R2. |
| Định dạng khác, tệp quá lớn | Bỏ qua, ghi lý do trong `skipped` của báo cáo đồng bộ. |

**Riêng 2 cuốn sách**: bản PDF đã chuyển chữ thành hình vẽ (không có lớp chữ), OCR thẳng sẽ cho đoạn cắt ngang mục và nhiều lỗi. Vì vậy sách đã được **chuẩn hóa sẵn** (`tools/normalize/build_books.py`): OCR mô hình tiếng Việt chất lượng cao → sửa lỗi OCR thường gặp → bỏ tiêu đề chạy, số trang, mục lục, chú thích, tài liệu tham khảo, mảnh chữ trong hình → tách **đúng theo mục x.y**, mỗi tệp 250–480 chữ, có dòng `Nguồn: <sách>, mục x.y`. Đây chính là phần sửa lỗi "cắt đoạn" và "tìm sai" trong báo cáo test.

## Chiến lược cập nhật

- Đồng bộ **tăng dần**: chỉ tải tệp có md5/thời gian sửa thay đổi; tệp bị xóa trên Drive bị xóa khỏi R2 (AI Search tự gỡ khỏi chỉ mục ở lần đồng bộ sau).
- Lịch: Worker sync chạy **02:00 hằng ngày**; AI Search đồng bộ R2 **mỗi 6 giờ**. Cập nhật KB hằng tháng không cần thao tác kỹ thuật; cần ngay thì gọi `/sync` và bấm Sync trên AI Search.
- Mỗi lần chạy xử lý tối đa 200 tệp (`MAX_FILES_PER_RUN`) để không chạm giới hạn subrequest; phần còn lại được xử lý ở lần chạy sau.

## Giới hạn Workers đã tính tới

| Giới hạn | Cách xử lý |
|---|---|
| CPU mỗi lần chạy (gói trả phí: mặc định 30s, tối đa 5 phút) | Sync đặt `cpu_ms: 120000`; phần nặng (parse, embedding) do AI Search làm, Worker chỉ tải và ghi. |
| Subrequest mỗi lần chạy | Tối đa 200 tệp/lần (≈ 400–450 lệnh gọi). |
| Bộ nhớ 128 MB | Mỗi tệp ≤ 10 MB, xử lý tuần tự từng tệp. |
| Thời gian phản hồi chat | Viết lại câu hỏi có timeout 3s; trả lời dạng luồng nên chữ đầu tiên hiện sớm. |
| Giới hạn tệp của AI Search | PDF có OCR ≤ 10 MB, định dạng chuyển đổi khác ≤ 4 MB; tệp vượt mức được báo trong `skipped`. |

## Cấu trúc mã

```
aif-chatbot/
├─ HUONG-DAN-DEPLOY.md        ← hướng dẫn deploy chi tiết (Windows)
├─ BAO-CAO-THAY-DOI.md        ← báo cáo gửi anh Sỹ
├─ kb/AIF-KB/                 ← nội dung tải lên Google Drive (555 tệp)
│   ├─ _HUONG-DAN.md          ← quy tắc quản lý KB (chatbot bỏ qua tệp này)
│   ├─ 01-the-khai-niem/      13 thẻ khái niệm (cần tác giả duyệt)
│   ├─ 02-faq/                100 FAQ (chuyển từ faq.json của website v2.2.0)
│   ├─ 03-sach/               2 cuốn sách, 433 tệp theo mục
│   ├─ 04-website/            9 mục thông tin website (W1–W9)
│   └─ 05-tai-lieu-khac/      (trống, để thêm tài liệu sau)
├─ workers/
│   ├─ aif-kb-sync/           Worker đồng bộ Drive → R2
│   │   └─ src/ index.js (HTTP + cron) · sync.js (so sánh, ghi R2/KV) · google.js (JWT, liệt kê, tải, xuất)
│   └─ aif-kb-chat/           Worker chatbot
│       └─ src/ index.js (HTTP, CORS, giới hạn) · retrieve.js (viết lại câu hỏi, AI Search, gom ngữ cảnh, nguồn)
│              generate.js (gọi mô hình, luồng SSE, ẩn [NF]) · prompts.js (System Prompt, câu từ chối 3 ngôn ngữ)
├─ tests/                     17 test chạy bằng Node (giả lập Drive, R2, KV, AI Search, Workers AI)
└─ tools/
    ├─ normalize/             tạo lại KB từ OCR sách và faq.json/site.json của website
    └─ eval/                  chấm thử 40 câu hỏi của file Test KB → CSV
```

Chạy test: `npm test` (Node 22, không cần mạng).

## Giao tiếp với website (giữ nguyên bản cũ)

Yêu cầu `POST /` (text/plain JSON): `{secret, message, lang: "vi"|"en"|"zh", faq: [mã FAQ khách đã chọn], hist: [{r:"u"|"b", t}], page}`
Trả về luồng SSE: `data: {"t":"…"}` … `data: {"done":true,"nf":false,"src":"AI First Business (mục 4.4)","faq":[12]}`
Hoặc JSON `{ok:true, answer, nf:true}` khi không tìm thấy, bận, lỗi.

Các đường dẫn khác: `GET /` (tình trạng), `POST /debug` (cần `Authorization: Bearer ADMIN_TOKEN`: xem câu hỏi viết lại, các đoạn tìm được, điểm số).
