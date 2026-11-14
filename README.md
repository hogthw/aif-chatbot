# AIF-Chatbot: Trợ lý AI Hỏi-Đáp Theo Sách & Knowledge Base

Dự án trợ lý trí tuệ nhân tạo chuyên sâu phục vụ bạn đọc của hai cuốn sách:
- **AI Economy – Nền Kinh Tế Trí Tuệ** (Tác giả: Trần Tấn Sỹ, bản in `v13.7`)
- **AI First Business** (Tác giả: Trần Tấn Sỹ, bản in `V16.3`)

Hệ thống được thiết kế theo kiến trúc **Hybrid RAG & Two-Tier Lookup** hiện đại trên nền tảng **Cloudflare Serverless Ecosystem** (Workers, Workers AI, Vectorize / AI Search, R2 Storage, KV) kết hợp với bộ widget giao diện nhúng website (`web-patch`).

---

## 🚀 Hướng Dẫn Deploy Nhanh: Staging & Production

### 1. Bảng So Sánh Môi Trường
| Tham số | Staging (STG) | Production (PROD) |
|---|---|---|
| **Worker Chatbot** | `https://aif-kb-chat-stg.<subdomain>.workers.dev` | `https://aif-kb-chat.<subdomain>.workers.dev` |
| **Worker Sync** | Chạy thử với `/sync?dry=1` | `https://aif-kb-sync.<subdomain>.workers.dev` (cron 02:00 hàng ngày) |
| **Origins (CORS)** | `http://localhost:*`, `*.workers.dev`, staging domain | `https://aifirstbusiness.vn`, `https://www.aifirstbusiness.vn` |
| **Mục đích** | Thử nghiệm prompt, kiểm tra FAQ mới, test hồi quy UI | Phục vụ chính thức độc giả trên website |

---

### 2. Triển Khai Lên Môi Trường Staging (STG)

```powershell
# Bước 1: Kiểm thử toàn vẹn code & dữ liệu trước khi deploy
npm test        # Chạy 39 test suites (logic Worker, FAQ, sync)
npm run test:qa # Kiểm tra toàn vẹn 947 test cases dữ liệu sách

# Bước 2: Deploy Worker Chatbot bản Staging
cd workers/aif-kb-chat
npx wrangler deploy --name aif-kb-chat-stg

# Bước 3: Nạp Secret cho Staging Worker
npx wrangler secret put CHAT_SECRET --name aif-kb-chat-stg
npx wrangler secret put ADMIN_TOKEN --name aif-kb-chat-stg

# Bước 4: Kiểm tra nhanh trạng thái (Health Check)
curl https://aif-kb-chat-stg.your-subdomain.workers.dev/
```

**Tích hợp Web Widget Staging (Local / Staging Site):**
```html
<script>
  window.AIF_CHAT = {
    url: "https://aif-kb-chat-stg.your-subdomain.workers.dev",
    secret: "staging_secret_vua_dat"
  };
</script>
<script defer src="/assets/js/chat.js?v=stg-v22"></script>
```

---

### 3. Triển Khai Lên Môi Trường Production (PROD)

```powershell
# Bước 1: Deploy & Kích hoạt Worker đồng bộ Knowledge Base
cd workers/aif-kb-sync
npx wrangler deploy
# Kích hoạt đồng bộ Drive -> R2 (lần đầu hoặc khi cập nhật sách mới)
$H = @{ Authorization = "Bearer <SYNC_TOKEN>" }
Invoke-RestMethod -Method Post -Uri "https://aif-kb-sync.your-subdomain.workers.dev/sync" -Headers $H

# Bước 2: Deploy Worker Chatbot chính thức (Thay thế bản cũ)
cd ../aif-kb-chat
npx wrangler deploy
# Thiết lập secret bảo mật chính thức
npx wrangler secret put CHAT_SECRET
npx wrangler secret put ADMIN_TOKEN

# Bước 3: Kiểm tra nghiệm thu sau deploy (Smoke Test)
Invoke-RestMethod -Uri "https://aif-kb-chat.your-subdomain.workers.dev/"
```

**Cập nhật Website Production (`aifirstbusiness.vn`):**
1. Sao chép thư mục `web-patch/assets/` lên máy chủ web / static storage.
2. Nhúng script vào cuối thẻ `<body>` (tăng chuỗi version cache `?v=...`):
```html
<script>
  window.AIF_CHAT = {
    url: "https://aif-kb-chat.your-subdomain.workers.dev",
    secret: "prod_chat_secret_da_dat_o_buoc_2"
  };
</script>
<script defer src="/assets/js/chat.js?v=20261114-v24"></script>
```
*(Chi tiết từng bước cấu hình tài khoản Google Cloud, R2, AI Search xem tại [docs/HUONG-DAN-DEPLOY.md](docs/HUONG-DAN-DEPLOY.md)).*

---

## 1. Kiến trúc Tổng quan Hệ thống (System Architecture)

```
                            [GOOGLE DRIVE] (Thư mục AIF-KB)
                                   │
                                   │ (Cron 02:00 UTC+7 hoặc POST /sync)
                                   ▼
                       [WORKER: aif-kb-sync]
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
            [R2 Bucket: aif-kb]          [KV: KB_STATE]
            (Lưu trữ Markdown, PDF...)   (Metadata & State md5)
                    │
                    ▼
        [Cloudflare AI Search]
        (Hybrid: Vectorize + BM25)
                    │
                    ▼
[WEBSITE CLIENT] ────── (POST /) ──────► [WORKER: aif-kb-chat]
├── chat.js (UI Widget)                  ├── Rewrite query (llama-3.1-8b)
├── lookup.mjs (Tầng 1: Client Cache)    ├── Hybrid Retrieval (AI Search)
└── lead-intent.mjs (Ý định tư vấn)     ├── Context Assembly (Book chunks)
                                         ├── Workers AI (llama-3.3-70b-instruct)
                                         └── Stream SSE response kèm trích dẫn
```

### Cơ chế Tra cứu Hai Tầng (Two-Tier Lookup):
1. **Tầng 1 - In-browser Instant Lookup (`web-patch/assets/js/lookup.mjs`):**
   - Khớp tức thì các câu hỏi thường gặp (FAQ), định vị mục/hình/bảng/trang in và thẻ khái niệm trực tiếp trong trình duyệt qua file JSON nén mà không tốn chi phí gọi mô hình lớn.
   - Nhận diện ý định tư vấn, đào tạo doanh nghiệp và mua sách (`lead-intent.mjs`).
2. **Tầng 2 - Cloudflare Hybrid RAG (`workers/aif-kb-chat`):**
   - Áp dụng khi câu hỏi phức tạp hoặc ngoài danh mục FAQ.
   - Sử dụng mô hình suy luận `llama-3.3-70b-instruct` (dự phòng: `mistral-small-3.1-24b-instruct`) trích xuất từ dữ liệu Knowledge Base đã vector hóa trên Cloudflare R2 / AI Search.
   - Trả lời dạng luồng (Server-Sent Events - SSE), dẫn nguồn trang/mục chính xác.

---

## 2. Cấu trúc Thư mục Dự án

```text
aif-chatbot/
├── .gitignore                      # Cấu hình loại trừ file rác, secrets, test artifacts
├── .env.example                    # File mẫu khai báo các biến môi trường và bí mật
├── package.json                    # Cấu hình dự án & scripts kiểm thử
├── package-lock.json
├── README.md                       # Tài liệu tổng quan kiến trúc & hướng dẫn vận hành
│
├── data/                           # Dữ liệu cấu trúc và ánh xạ sách
│   ├── manifest.json               # Danh mục chương, mục và liên kết tệp của 2 cuốn sách
│   ├── book-map.json               # Ánh xạ 549 trang in, hình vẽ, bảng biểu và mục tham chiếu
│   └── books/                      # Dữ liệu trích xuất cấu trúc gốc của 2 cuốn sách
│       ├── AIEC_AI_Economy_v13-7/  # JSON + Markdown từng chương sách AI Economy
│       └── AIFB_AI_First_Business_v16-3/ # JSON + Markdown từng chương sách AI First Business
│
├── docs/                           # Tài liệu kỹ thuật, hướng dẫn triển khai & vận hành
│   ├── BAO-CAO-THAY-DOI.md         # Báo cáo lịch sử thay đổi kiến trúc
│   ├── HUONG-DAN-DEPLOY.md         # Hướng dẫn chi tiết từng bước deploy lên Cloudflare
│   └── HUONG-DAN-TRICH-XUAT-PDF-R2.md # Hướng dẫn OCR PDF và chuyển đổi sang R2
│
├── kb/                             # Knowledge Base tải lên Google Drive & R2
│   └── AIF-KB/
│       ├── _HUONG-DAN.md           # Hướng dẫn cập nhật tài liệu KB
│       ├── 01-the-khai-niem/       # 13 thẻ khái niệm trọng tâm
│       ├── 02-faq/                 # Các câu hỏi thường gặp đã chuẩn hóa
│       ├── 03-sach/                # 433 phân đoạn sách theo từng mục chuẩn
│       └── 04-website/             # Thông tin website tác giả (W1-W9)
│
├── tests/                          # Bộ kiểm thử tự động toàn diện
│   ├── chat.test.mjs               # Test suite Worker Chatbot (AI, streaming, CORS, limits)
│   ├── faq-v22.test.mjs            # Test suite cho FAQ v2.2.0 và phân loại ý định Lead
│   ├── qa.mjs                      # 947 test cases toàn vẹn dữ liệu sách và tra cứu 2 tầng
│   ├── sync.test.mjs               # Test suite Worker Sync (Google Drive -> R2)
│   ├── helpers.mjs                 # Mock bộ nhớ trong: R2, KV, Rate Limiter
│   └── kbsearch.mjs                # Mock bộ tìm kiếm ngữ nghĩa AI Search
│
├── tools/                          # Bộ công cụ phụ trợ dữ liệu và kiểm thử
│   ├── eval/                       # Đánh giá chất lượng thực tế (cases.json, run_eval.mjs)
│   └── normalize/                  # Scripts tiền xử lý và chuẩn hóa OCR sách
│
├── web-patch/                      # Giao diện Chatbot nhúng Website (Single Source of Truth)
│   └── assets/
│       ├── chat/                   # Dữ liệu FAQ và tóm tắt sách (JSON)
│       └── js/
│           ├── chat.js             # Widget chatbot giao diện người dùng
│           ├── lead-intent.mjs     # Module phân loại ý định khách hàng
│           └── lookup.mjs          # Thuật toán tra cứu 2 tầng (Two-Tier Lookup)
│
└── workers/                        # Cloudflare Workers Backend
    ├── aif-kb-chat/                # Worker xử lý hỏi-đáp AI (LLM, RAG, AI Search)
    └── aif-kb-sync/                # Worker chạy cron đồng bộ Google Drive -> R2
```

---

## 3. Cài đặt & Cấu hình Biến Môi trường

### 3.1. Yêu cầu hệ thống
- **Node.js:** Phiên bản `>= 20.0.0` (khuyến nghị Node 22).
- **Wrangler CLI:** Được cài đặt qua npm/npx (`npm i -g wrangler` hoặc `npx wrangler`).

### 3.2. Cấu hình biến môi trường
Sao chép file `.env.example` thành `.env` để tham khảo khi chạy test hoặc công cụ eval:
```bash
cp .env.example .env
```

Các biến bí mật trên Cloudflare Workers được thiết lập bằng lệnh `wrangler secret put`:

#### Dành cho `workers/aif-kb-chat`:
```bash
cd workers/aif-kb-chat
npx wrangler secret put CHAT_SECRET   # Khóa bí mật giao tiếp giữa website widget và Worker
npx wrangler secret put ADMIN_TOKEN   # Token xem prompt và tài liệu qua endpoint /debug
```

#### Dành cho `workers/aif-kb-sync`:
```bash
cd workers/aif-kb-sync
npx wrangler secret put SYNC_TOKEN    # Token gọi POST /sync hoặc GET /status
npx wrangler secret put GOOGLE_SA_KEY # Toàn bộ chuỗi JSON của Service Account Google Cloud
```

---

## 4. Hướng dẫn Kiểm thử (Testing)

Dự án cung cấp bộ kiểm thử phân tầng, kiểm tra từ tính toàn vẹn dữ liệu sách đến logic Cloudflare Workers:

### 4.1. Chạy Unit & Integration Tests (Khuyến nghị)
Kiểm tra toàn bộ luồng xử lý của Worker Chat, Worker Sync và module FAQ:
```bash
npm test
```
*(Chạy `node --test tests/*.test.mjs`, thời gian hoàn thành ~1.5s, không cần kết nối mạng bên ngoài).*

### 4.2. Chạy Kiểm tra Toàn vẹn Dữ liệu Sách (QA Data Check)
Kiểm tra 947 ca kiểm thử liên quan đến định danh nguồn sách, trang in, hình/bảng và thuật toán tra cứu:
```bash
npm run test:qa
```

### 4.3. Chạy Toàn bộ Test Suites
```bash
npm run test:all
```

### 4.4. Đánh giá Chất lượng Thực tế 40 Kịch bản (Evaluation Tool)
```bash
$env:CHAT_URL="https://aif-kb-chat.your-subdomain.workers.dev"
$env:CHAT_SECRET="your_secret"
$env:ADMIN_TOKEN="your_admin_token"
node tools/eval/run_eval.mjs
```
Kết quả sẽ được xuất ra file `tools/eval/ket-qua-<timestamp>.csv` để đối chiếu với ý chính.

---

## 5. Hướng dẫn Triển khai (Deployment)

Chi tiết quy trình triển khai từng bước vui lòng xem tại [HUONG-DAN-DEPLOY.md](docs/HUONG-DAN-DEPLOY.md).

### 5.1. Triển khai Cloudflare Workers

1. **Deploy Worker Đồng bộ KB:**
   ```bash
   cd workers/aif-kb-sync
   npx wrangler deploy
   ```
2. **Deploy Worker Chatbot:**
   ```bash
   cd workers/aif-kb-chat
   npx wrangler deploy
   ```

### 5.2. Triển khai Frontend Web Widget
Sao chép toàn bộ thư mục `web-patch/assets/` vào thư mục static assets của website (ví dụ Webflow, Astro, Next.js, hoặc static HTML), sau đó nhúng script vào cuối thẻ `<body>`:
```html
<script>
  window.AIF_CHAT = {
    url: "https://aif-kb-chat.your-subdomain.workers.dev",
    secret: "your_chat_client_secret"
  };
</script>
<script defer src="/assets/js/chat.js?v=20261114-v24"></script>
```

---

## 6. Tài liệu Kỹ thuật Liên quan

- [Hướng dẫn triển khai chi tiết](docs/HUONG-DAN-DEPLOY.md)
- [Hướng dẫn trích xuất OCR PDF sang R2](docs/HUONG-DAN-TRICH-XUAT-PDF-R2.md)
- [Báo cáo thay đổi kiến trúc](docs/BAO-CAO-THAY-DOI.md)
- [Quy tắc tổ chức Knowledge Base](kb/AIF-KB/_HUONG-DAN.md)
