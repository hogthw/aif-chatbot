# Hướng dẫn deploy chatbot AIF 2.0 (từng bước, máy Windows)

Tài liệu này hướng dẫn đưa kiến trúc chatbot mới lên Cloudflare của anh Sỹ. Làm lần lượt từ Bước 1 đến Bước 12. Mỗi bước có phần **Kiểm tra** để biết đã làm đúng trước khi sang bước sau.

Thời gian dự kiến: 60–90 phút cho lần đầu.

---

## 0. Tổng quan: sẽ tạo những gì

```
Google Drive (thư mục AIF-KB)
      │  Worker aif-kb-sync tự tải về lúc 02:00 hằng ngày (hoặc bấm tay)
      ▼
R2 bucket "aif-kb"  ──►  AI Search "aif-kb"  (tự đọc file, tách đoạn, tạo embedding, lưu vector + chỉ mục từ khóa)
                                 │
Website ──► Worker aif-kb-chat ──┘  tìm đoạn liên quan → Workers AI viết câu trả lời → trả về kèm "Nguồn: tên sách (mục)"
```

| Thành phần | Tên | Ghi chú |
|---|---|---|
| R2 bucket | `aif-kb` | Bản sao các tệp KB lấy từ Drive |
| KV namespace | `KB_STATE` | Lưu trạng thái đồng bộ + nhãn nguồn của từng tệp |
| AI Search | `aif-kb` | Thay cho file JSON cũ trong Worker |
| Worker | `aif-kb-sync` | Mới. Đồng bộ Drive → R2 |
| Worker | `aif-kb-chat` | **Thay** bản đang chạy trên dashboard (giữ nguyên địa chỉ, website không cần sửa) |   

Website (`aifirstbusiness-website`, bản v2.2.0) **không cần upload lại**: chatbot mới giữ đúng định dạng giao tiếp cũ.

---

## 1. Chuẩn bị máy

1. Cài **Node.js LTS** (bản 22 trở lên) tại https://nodejs.org → tải bản "LTS" cho Windows → cài với tùy chọn mặc định.
2. Giải nén gói `aif-chatbot-v2.0.0.zip` vào một thư mục ngắn, ví dụ `C:\aif-chatbot`.
3. Mở **PowerShell**: bấm phím Windows, gõ `PowerShell`, Enter.
4. Chuyển vào thư mục vừa giải nén:
   ```powershell
   cd C:\aif-chatbot
   ```

**Kiểm tra**
```powershell
node -v      # phải hiện v22.x hoặc cao hơn
npm -v
```
Nếu báo "không nhận lệnh node": đóng PowerShell, mở lại (hoặc khởi động lại máy) rồi thử lại.

> Nếu PowerShell báo lỗi "running scripts is disabled" khi chạy `npx`, chạy một lần lệnh sau rồi thử lại:
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` (chọn `Y`).

---

## 2. Cài wrangler và đăng nhập Cloudflare

```powershell
cd C:\aif-chatbot\workers\aif-kb-sync
npm install
cd ..\aif-kb-chat
npm install
npx wrangler login
```

Trình duyệt mở trang Cloudflare → đăng nhập **tài khoản Cloudflare của anh Sỹ** (tài khoản đang chứa `aif-kb-chat` và website) → bấm **Allow**.

**Kiểm tra**
```powershell
npx wrangler whoami
```
Phải thấy email và **Account ID** của tài khoản anh Sỹ. Nếu tài khoản của bạn là thành viên của nhiều account, wrangler sẽ hỏi chọn account ở bước deploy: chọn account của anh Sỹ.

---

## 3. Tạo R2 bucket

Lần đầu dùng R2, cần bật R2 trên dashboard: Cloudflare dashboard → **R2 Object Storage** → làm theo hướng dẫn kích hoạt (tài khoản đang ở gói trả phí nên chỉ cần xác nhận).

Sau đó:
```powershell
npx wrangler r2 bucket create aif-kb
```

**Kiểm tra**: `npx wrangler r2 bucket list` có dòng `aif-kb`.

---

## 4. Tạo KV namespace

```powershell
npx wrangler kv namespace create KB_STATE
```
Kết quả có dạng:
```
{ "binding": "KB_STATE", "id": "3f2a9c...e71" }
```
Chép chuỗi `id` (32 ký tự). Mở **2 tệp** bằng Notepad và thay `<KV_NAMESPACE_ID>` bằng chuỗi đó:

- `C:\aif-chatbot\workers\aif-kb-sync\wrangler.jsonc`
- `C:\aif-chatbot\workers\aif-kb-chat\wrangler.jsonc`

Ví dụ: `{ "binding": "KB_STATE", "id": "3f2a9c...e71" }` — giữ dấu ngoặc kép, bỏ dấu `< >`.

**Kiểm tra**: `npx wrangler kv namespace list` có `KB_STATE`. Cả hai tệp `wrangler.jsonc` dùng **cùng một id**.

---

## 5. Tạo tài khoản dịch vụ Google (để Worker đọc thư mục Drive)

Làm bằng **chính tài khoản Gmail cá nhân đang sở hữu thư mục KB**.

1. Vào https://console.cloud.google.com → nếu lần đầu, đồng ý điều khoản.
2. Góc trên bên trái, bấm chọn dự án → **New Project** → đặt tên `aif-kb` → **Create**. Chờ vài giây, chọn dự án `aif-kb` vừa tạo.
3. Bật Drive API: menu ☰ → **APIs & Services** → **Library** → tìm `Google Drive API` → **Enable**.
4. Tạo tài khoản dịch vụ: ☰ → **IAM & Admin** → **Service Accounts** → **+ Create service account**
   - Service account name: `aif-kb-sync` → **Create and continue**
   - Bước "Grant this service account access": **bỏ qua**, bấm **Continue** → **Done**.
5. Tạo khóa: bấm vào email tài khoản vừa tạo (dạng `aif-kb-sync@aif-kb-xxxx.iam.gserviceaccount.com`) → tab **Keys** → **Add key** → **Create new key** → chọn **JSON** → **Create**. Trình duyệt tải về một tệp `.json`.
   - Lưu tệp này ở nơi an toàn, ví dụ `C:\aif-keys\aif-kb-sa.json`. **Không** gửi tệp này qua chat/email, **không** đặt trong thư mục Drive KB.
6. Chép lại **email của tài khoản dịch vụ** (dùng ở Bước 6).

> Nếu Google báo "Service account key creation is disabled": tài khoản đang thuộc một tổ chức Google Workspace có chính sách chặn. Với Gmail cá nhân thường không gặp; nếu gặp, báo lại để chuyển sang cách khác.

---

## 6. Đưa Knowledge Base lên Google Drive

1. Trên Google Drive, tạo thư mục **`AIF-KB`**.
2. Mở `C:\aif-chatbot\kb\AIF-KB` trên máy, **kéo thả toàn bộ các thư mục con** (`01-the-khai-niem`, `02-faq`, `03-sach`, `04-website`, `05-tai-lieu-khac`) và tệp `_HUONG-DAN.md` vào thư mục `AIF-KB` trên Drive.
3. Chia sẻ thư mục: chuột phải `AIF-KB` → **Share** → dán **email tài khoản dịch vụ** (Bước 5.6) → quyền **Viewer** → bỏ chọn "Notify people" → **Share**.
4. Lấy mã thư mục: mở thư mục `AIF-KB`, nhìn thanh địa chỉ:
   `https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz` → mã là phần sau `folders/`.
5. Mở `C:\aif-chatbot\workers\aif-kb-sync\wrangler.jsonc`, thay `<DRIVE_FOLDER_ID>` bằng mã đó.

**Kiểm tra**: trong Drive, mục Share của `AIF-KB` có email `...iam.gserviceaccount.com` với quyền Viewer.

---

## 7. Deploy Worker đồng bộ `aif-kb-sync`

```powershell
cd C:\aif-chatbot\workers\aif-kb-sync
npx wrangler deploy
```
Kết quả cuối có địa chỉ, ví dụ `https://aif-kb-sync.trantansy.workers.dev` và dòng `schedule: 0 19 * * *`.

Đặt 2 secret:

```powershell
# 7a. Khóa JSON của tài khoản dịch vụ (đọc nguyên tệp, đẩy thẳng vào secret)
Get-Content -Raw C:\aif-keys\aif-kb-sa.json | npx wrangler secret put GOOGLE_SA_KEY

# 7b. Tạo một mã bí mật ngẫu nhiên cho việc đồng bộ tay, rồi đặt làm SYNC_TOKEN
$SYNC = -join ((48..57) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
$SYNC          # hiện mã ra màn hình: CHÉP LẠI, lưu vào trình quản lý mật khẩu
$SYNC | npx wrangler secret put SYNC_TOKEN
```

**Chạy đồng bộ lần đầu**

```powershell
$H = @{ Authorization = "Bearer $SYNC" }
# Chạy thử (không ghi gì), xem sẽ tải những tệp nào
Invoke-RestMethod -Method Post -Uri "https://aif-kb-sync.trantansy.workers.dev/sync?dry=1" -Headers $H
# Chạy thật
Invoke-RestMethod -Method Post -Uri "https://aif-kb-sync.trantansy.workers.dev/sync" -Headers $H -TimeoutSec 600
```
(Thay `trantansy` nếu địa chỉ workers.dev của tài khoản khác.)

Kết quả mong đợi: `found` khoảng 555, `added` ≈ `found`, `errors` rỗng, `pending` = 0.
Nếu `pending` > 0: chạy lại lệnh "chạy thật" cho tới khi `pending` = 0.

**Kiểm tra**
```powershell
Invoke-RestMethod -Uri "https://aif-kb-sync.trantansy.workers.dev/status" -Headers $H
```
`files` ≈ 555. Trên dashboard → **R2** → bucket `aif-kb` thấy các thư mục `01-the-khai-niem`, `02-faq`, `03-sach`...

---

## 8. Tạo AI Search `aif-kb`

Làm trên dashboard (dễ kiểm soát hơn dòng lệnh):

1. Cloudflare dashboard → **AI** → **AI Search** → **Create**.
2. **Data source**: chọn **R2 bucket** → `aif-kb`.
3. **Name**: `aif-kb` (phải đúng tên này, Worker chatbot gọi theo tên).
4. Cấu hình (mục nào không thấy thì để mặc định):

| Mục | Giá trị khuyên dùng | Lý do |
|---|---|---|
| Embedding model | `@cf/qwen/qwen3-embedding-0.6b` (hoặc `@cf/baai/bge-m3`) | Đa ngôn ngữ, đọc tốt tiếng Việt |
| Chunk size | 1024 tokens | Mỗi tệp KB đã được cắt sẵn ~400 chữ, vừa 1 đoạn |
| Chunk overlap | 10% | |
| Keyword search / Hybrid | **Bật** | Tìm đúng thuật ngữ sách (3A, Bolt-on, EAR Index…) |
| Fusion method | `max` | Worker đặt sẵn `FUSION_METHOD=max` |
| Reranking | Tắt (thử sau) | |
| Query rewrite | Tắt | Worker đã tự viết lại câu hỏi |
| Sync interval | 6 giờ (mặc định) | KB cập nhật hằng tháng; cần ngay thì bấm Sync tay |

5. **Create**. AI Search bắt đầu đọc R2. Chờ tới khi trạng thái hoàn tất (thường 10–30 phút với ~555 tệp).

**Kiểm tra**
- Tab **Overview** / **Jobs**: số tệp đã đánh chỉ mục ≈ số tệp trong R2, không có lỗi.
- Tab **Playground** (hoặc **Search**): gõ `ROI hai tầng là gì` → kết quả đầu là tệp trong `01-the-khai-niem` hoặc `03-sach/ai-first-business/04-4-4-...`.

Cách dùng dòng lệnh (tùy chọn): `npx wrangler ai-search --help` liệt kê các lệnh `create`, `stats`, `search`, `jobs`.

---

## 9. Deploy Worker chatbot `aif-kb-chat`

> Lưu ý: bước này **thay** bản `aif-kb-chat` đang chạy trên dashboard (bản cũ dùng file JSON). Địa chỉ `https://aif-kb-chat.trantansy.workers.dev/` giữ nguyên nên website không phải sửa. Nếu cần quay lại bản cũ: xem mục 12.

```powershell
cd C:\aif-chatbot\workers\aif-kb-chat
npx wrangler deploy
```
Nếu wrangler hỏi "...was last modified in the dashboard. Continue?" → gõ `y`.

Đặt secret dùng chung với website. Không lưu giá trị này trong `wrangler.jsonc` hoặc Git:
```powershell
npx wrangler secret put CHAT_SECRET
```
Nhập cùng một giá trị với cấu hình `AIF_CHAT` trong website. Worker cũng chấp nhận secret tên `CHAT_CLIENT_TOKEN` để tương thích cấu hình đã triển khai trước đây. Worker từ chối yêu cầu nếu không có secret phù hợp hoặc giá trị không khớp.

Đặt mã quản trị (dùng cho công cụ kiểm tra `/debug` và chấm thử):
```powershell
$ADMIN = -join ((48..57) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
$ADMIN         # CHÉP LẠI
$ADMIN | npx wrangler secret put ADMIN_TOKEN
```

**Kiểm tra**
1. Mở trình duyệt: `https://aif-kb-chat.trantansy.workers.dev/` → thấy JSON:
   `"ok": true, "version": "2.0.0", "ai": true, "search": true, "kb_files": 555...`
   - `search: false` → binding AI Search chưa nhận: kiểm tra Bước 8 đã tạo xong.
   - `kb_files: 0` → Bước 7 chưa đồng bộ xong.
2. Xem chatbot tìm được gì:
   ```powershell
   $A = @{ Authorization = "Bearer $ADMIN" }
   Invoke-RestMethod -Method Post -Uri "https://aif-kb-chat.trantansy.workers.dev/debug" -Headers $A -Body '{"message":"ROI hai tầng là gì?","lang":"vi"}' -ContentType "application/json" | ConvertTo-Json -Depth 5
   ```
   Phải có `used` (các tài liệu được dùng) và `src` dạng `AI First Business (mục 4.4)`.
3. Mở **https://aifirstbusiness.vn**, mở chatbot, chọn một câu gợi ý rồi gõ tự do một câu, ví dụ "Làm sao biết đầu tư AI có thực sự giúp công ty kiếm thêm tiền?" → câu trả lời hiện dần, cuối có "Nguồn: AI First Business (mục 4.4…)".

**Giới hạn nguồn trả lời**: câu hỏi khớp chính xác một thẻ QA có đáp án và nguồn thì chatbot trả trực tiếp đáp án đã duyệt, không gọi model viết lại hoặc model trả lời. Câu hỏi khác được tìm trong sách; chỉ đoạn của một cuốn được gửi cho model. Ngoại lệ chỉ áp dụng cho thẻ QA đối chiếu được biên tập và dẫn riêng từng nguồn của hai cuốn. FAQ thông thường, thẻ khái niệm và nội dung website không được dùng làm căn cứ. Nếu không tìm được đoạn sách phù hợp thì chatbot báo chưa đủ thông tin. `/debug` trả thêm `qaCard` và `book` để kiểm tra truy xuất.

**Điều chỉnh cách trả lời**: sửa hướng dẫn trong `workers\aif-kb-chat\src\prompts.js`, chạy `npm test`, sau đó deploy lại Worker để áp dụng. Câu trả lời được hướng dẫn mở đầu bằng kết luận, giải thích rõ thuật ngữ, dùng các bước/gạch đầu dòng khi phù hợp và giới hạn tối đa 160 từ.

**QA-first**: khớp câu hỏi/bí danh không phân biệt hoa thường, dấu tiếng Việt hay dấu câu; cụm tiêu đề mục sách cũng có thể định tuyến tới đáp án QA tương ứng. Câu hỏi diễn đạt khác tiếp tục qua AI Search và LLM như trước; nếu nhiều thẻ khớp, thiếu đáp án hoặc thiếu nguồn thì không tự chọn đáp án QA.

**Lịch sử hội thoại**: lịch sử chỉ được chuyển vào bước viết lại và prompt trả lời khi câu hỏi mới có dấu hiệu tham chiếu rõ tới lượt trước (ví dụ “còn cách đó thì sao?”). Câu hỏi độc lập không nhận ngữ cảnh từ câu trả lời cũ, tránh kéo nhầm chủ đề sang lượt mới.

**Nạp thẻ QA cho hai sách**: trong đúng thư mục Google Drive nguồn đang cấu hình cho `aif-kb-sync`, tạo `02-faq/book-qa/aifb/` và `02-faq/book-qa/aiec/`. Chép vào đây các JSON theo chương có `cards` (bỏ các tệp tổng hợp `_FULL.json` để tránh thẻ trùng); giữ nguyên `book_id` là `aifb` hoặc `aiec`. Thẻ đối chiếu hai sách có thể để trong thư mục `aifb`, nhưng từng mục trong `sources` phải khai báo `book_id` của cuốn tương ứng để nguồn hiển thị chính xác. Không đổi `DRIVE_FOLDER_ID` sang thư mục Drive mới khi đang đồng bộ KB hiện tại, vì Worker đồng bộ sẽ xóa khỏi R2 các tệp không có trong thư mục nguồn mới. Sau khi thêm JSON, chạy sync và chờ AI Search lập chỉ mục; sách vẫn phải nằm dưới `03-sach/ai-first-business/` hoặc `03-sach/nen-kinh-te-tri-tue/`. `/debug` sẽ cho biết `qaCard` được chọn, cuốn sách và các đoạn sách thực sự dùng.

---

## 10. (Tùy chọn) AI Gateway: theo dõi chi phí và nhật ký

1. Dashboard → **AI** → **AI Gateway** → **Create Gateway** → tên `aif-chat`.
2. Mở `workers\aif-kb-chat\wrangler.jsonc`, đặt `"GATEWAY_ID": "aif-chat"` → chạy lại `npx wrangler deploy`.
3. Trang AI Gateway sẽ hiện từng lượt gọi mô hình, số token, thời gian, lỗi.

---

## 11. Chấm thử bằng 40 câu hỏi của file Test KB

```powershell
cd C:\aif-chatbot
$env:CHAT_URL = "https://aif-kb-chat.trantansy.workers.dev"
$env:ADMIN_TOKEN = $ADMIN
$env:CHAT_SECRET = "<CHAT_SECRET đang dùng trên website>"
node tools/eval/run_eval.mjs
```
- Mất khoảng 8–10 phút (nghỉ 8 giây giữa các câu để không chạm giới hạn 8 câu/phút).
- Kết quả: `tools\eval\ket-qua-<ngày-giờ>.csv` → mở bằng Excel, so cột **Câu trả lời mới** với **Ý chính**, điền cột **Đánh giá mới**.
- Chỉ chạy vài câu: `$env:ONLY="1,5,12"` trước lệnh `node`.

---

## 12. Vận hành hằng tháng

### Cập nhật Knowledge Base
1. Sửa/thêm/xóa tệp trong thư mục `AIF-KB` trên Google Drive (quy tắc đặt tệp: xem `_HUONG-DAN.md` trong thư mục đó).
2. Chờ đồng bộ tự động lúc **02:00** sáng, **hoặc** chạy tay:
   ```powershell
   Invoke-RestMethod -Method Post -Uri "https://aif-kb-sync.trantansy.workers.dev/sync" -Headers @{ Authorization = "Bearer <SYNC_TOKEN>" }
   ```
   Xem `added` / `updated` / `deleted` để biết tệp nào thay đổi.
3. AI Search tự cập nhật theo chu kỳ (6 giờ). Muốn áp dụng ngay: dashboard → AI Search → `aif-kb` → **Sync** (nút đồng bộ ngay).
4. Hỏi thử 2–3 câu liên quan nội dung vừa sửa trên website.

### Xem nhật ký
- `cd workers\aif-kb-chat` → `npx wrangler tail` (xem trực tiếp từng câu hỏi: câu viết lại, tài liệu dùng, thời gian).
- Hoặc dashboard → Workers → `aif-kb-chat` → **Logs**.

### Quay lại bản trước
Dashboard → Workers & Pages → `aif-kb-chat` → **Deployments** → chọn bản trước → **Rollback**.

### Chỉnh độ "khó tính" khi tìm tài liệu
Trong `workers\aif-kb-chat\wrangler.jsonc` (sửa xong chạy `npx wrangler deploy`):

| Biến | Mặc định | Khi nào chỉnh |
|---|---|---|
| `MATCH_THRESHOLD` | 0.3 | Chatbot hay từ chối câu đúng chủ đề → hạ 0.2. Hay lấy tài liệu lạc đề → nâng 0.4 |
| `RELATIVE_CUTOFF` | 0.45 | Tài liệu yếu so với tài liệu tốt nhất bị loại nếu điểm < 45% |
| `MAX_DOCS` | 7 | Số tài liệu tối đa đưa cho mô hình |
| `RERANK` | 0 | Đặt 1 để thử sắp xếp lại bằng mô hình rerank; chấm thử lại (Bước 11) để so |
| `MODEL` | llama-3.3-70b fp8-fast | Mô hình viết câu trả lời |

---

## 13. Xử lý sự cố

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| `/sync` trả 401 | Sai `SYNC_TOKEN` | Đặt lại: `$SYNC \| npx wrangler secret put SYNC_TOKEN` |
| `/sync` báo "Không lấy được token Google" | Sai/thiếu `GOOGLE_SA_KEY`, hoặc Drive API chưa bật | Làm lại 5.3 và 7a |
| `/sync` báo `Drive API 404` | Sai `DRIVE_FOLDER_ID` hoặc chưa chia sẻ thư mục cho tài khoản dịch vụ | Làm lại Bước 6.3–6.5, deploy lại |
| `found: 0` | Thư mục rỗng hoặc chia sẻ sai thư mục | Kiểm tra lại thư mục `AIF-KB` |
| Tệp nằm trong `skipped` | Định dạng chưa hỗ trợ hoặc > 10 MB | Lưu sang PDF/DOCX/MD, hoặc tách nhỏ |
| `GET /` của chatbot: `search: false` | AI Search chưa tạo, hoặc tên khác `aif-kb` | Bước 8 |
| Chatbot luôn trả lời "chưa có nội dung" | AI Search chưa đánh chỉ mục xong, hoặc `MATCH_THRESHOLD` quá cao | Kiểm tra tab Jobs; gọi `/debug` xem `chunks` có điểm bao nhiêu |
| Website báo lỗi kết nối chatbot | CORS: website chạy từ địa chỉ khác | Thêm địa chỉ vào `ALLOWED_ORIGINS` (cách nhau dấu phẩy), deploy lại |
| Trả lời "Trợ lý đang nhận nhiều câu hỏi" | Chạm giới hạn 8 câu/phút/IP | Bình thường; tăng `limit` trong `ratelimits` nếu cần |

---

## 14. Chi phí (tham khảo, giá Cloudflare tại thời điểm viết, 11/2026)

- **AI Search** bắt đầu tính phí từ **01/12/2026**: khoảng $0,75 / 1 triệu token khi đánh chỉ mục (embedding đã bao gồm), $2 / GB-tháng lưu trữ, $0,75 / 1.000 lượt tìm. KB hiện tại nhỏ (dưới 1 triệu token, vài MB), nên phần lớn chi phí đến từ số lượt hỏi.
- **Workers AI** (mô hình trả lời): tính theo token, xem tại dashboard → AI → Workers AI hoặc AI Gateway.
- **R2, KV, Workers**: nằm trong hạn mức gói trả phí với quy mô này.
