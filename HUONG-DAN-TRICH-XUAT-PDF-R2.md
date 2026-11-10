# Trích xuất PDF lớn trước khi đồng bộ lên R2

Tính năng đã được triển khai trong `workers/aif-kb-sync/src/sync.js`.

## Mục tiêu và giới hạn

- PDF lớn hơn 9 MiB được trích raw text và lưu vào R2 dưới tên `.txt`, để AI Search lập chỉ mục nội dung văn bản thay vì PDF nhị phân.
- PDF nhỏ và các định dạng khác tiếp tục theo luồng đồng bộ hiện có.
- Giữ tên file gốc và MIME type gốc trong custom metadata của object R2.
- Đây là trích xuất text có sẵn trong PDF. PDF scan không có lớp text sẽ không tạo được nội dung; cần cung cấp phiên bản có lớp văn bản trước khi đồng bộ.
- Bản text sau trích xuất vẫn cần nhỏ hơn giới hạn AI Search. Nếu vượt 10 MiB, cần tách tài liệu hoặc xử lý theo cách khác.

## Cài đặt thư viện

Trong PowerShell, từ thư mục worker:

```powershell
cd workers\aif-kb-sync
npm.cmd install unpdf
```

`unpdf` đã được thêm vào `package.json` và `package-lock.json`. `unpdf` cung cấp PDF.js serverless build tương thích Cloudflare Workers. Không cần thêm `nodejs_compat` hay `compatibility_flags` chỉ để dùng thư viện này. Nếu PowerShell chặn `npm.ps1`, dùng `npm.cmd`.

## Cấu hình dung lượng nguồn

Trong `workers/aif-kb-sync/wrangler.jsonc`, `MAX_FILE_BYTES` là giới hạn dung lượng tải từ Drive, không phải giới hạn cho file `.txt` đầu ra. Ví dụ file PDF 12.5 MB cần nằm dưới giới hạn này:

```jsonc
"MAX_FILE_BYTES": "26214400"
```

Giá trị 25 MiB hiện tại đủ cho ví dụ 12.5 MB. Nếu giá trị thấp hơn dung lượng PDF, luồng sẽ bỏ qua file trước khi tải và trích xuất. Kích thước PDF tải về cũng được kiểm tra độc lập, phòng trường hợp kích thước trên Drive không chính xác hoặc file là bản export.

Text sau trích xuất phải không quá 10 MiB. PDF scan không có lớp text sẽ không được Worker trích xuất.

## Luồng đã triển khai trong `src/sync.js`

Không cần sao chép các đoạn code bên dưới vào worker; đây là phần giải thích các thay đổi đã có trong mã nguồn.

### Thêm import và ngưỡng trích xuất

Thêm cạnh các import đầu file:

```js
import { extractText } from "unpdf";
```

Đặt ngưỡng cạnh `MAX_BYTES_DEFAULT`:

```js
const PDF_TEXT_THRESHOLD_BYTES = 9 * 1024 * 1024;
```

### Điều chỉnh phần chọn key và kiểm tra giới hạn

Trong vòng lặp `for (const f of files)`, giữ key ban đầu để kiểm tra định dạng. Tính trước key `.txt` cho PDF lớn và dùng key đầu ra khi so sánh trạng thái, để file PDF đã đồng bộ trước đây không bị bỏ qua nhầm:

```js
const sourceKey = r2KeyOf(f);
const ext = extOf(sourceKey);
if (!SUPPORTED_EXT.has(ext)) {
  report.skipped.push({ key: sourceKey, reason: "Định dạng chưa hỗ trợ (" + (ext || f.mimeType) + "). Lưu sang PDF/DOCX/MD." });
  continue;
}

const size = Number(f.size || 0);
const textKey = sourceKey.replace(/\.pdf$/i, ".txt");
const ver = f.md5Checksum || f.modifiedTime;
const prev = state.files[f.id];
const expectedKey = ext === ".pdf" && (size > PDF_TEXT_THRESHOLD_BYTES || (prev && prev.key === textKey))
  ? textKey
  : sourceKey;

if (size > maxBytes) {
  report.skipped.push({ key: sourceKey, reason: `Tệp ${(size / 1048576).toFixed(1)} MB vượt giới hạn ${(maxBytes / 1048576).toFixed(0)} MB.` });
  continue;
}
if (!force && prev && prev.ver === ver && prev.key === expectedKey) continue;
```

Giữ nguyên phần giới hạn `maxFiles` nằm giữa kiểm tra trạng thái và tải file.

### Thay phần tải và ghi R2

Trong `try`, thay phần từ tải `bytes` đến `KB_BUCKET.put(...)` bằng logic dưới đây. Phần xóa object cũ và ghi trạng thái sau `put` tiếp tục theo luồng hiện có:

```js
const bytes = new Uint8Array(await download(token, f, fetchImpl));
if (bytes.byteLength > maxBytes) {
  report.skipped.push({ key: sourceKey, reason: "Tệp tải về vượt giới hạn dung lượng nguồn." });
  continue;
}

const isLargePdf = ext === ".pdf" && bytes.byteLength > PDF_TEXT_THRESHOLD_BYTES;
let key = sourceKey;
let outputBytes = bytes;

if (isLargePdf) {
  const extracted = await extractText(bytes, { mergePages: true });
  const text = typeof extracted.text === "string"
    ? extracted.text
    : extracted.text.join("\n");

  if (!text.trim()) {
    report.skipped.push({
      key: sourceKey,
      reason: "PDF không có raw text để trích xuất; nếu là PDF scan, cần OCR trước.",
    });
    continue;
  }

  outputBytes = new TextEncoder().encode(text);
  if (outputBytes.byteLength > MAX_BYTES_DEFAULT) {
    report.skipped.push({
      key: sourceKey,
      reason: "Text sau khi trích xuất vẫn vượt giới hạn dung lượng AI Search.",
    });
    continue;
  }
  key = sourceKey.replace(/\.pdf$/i, ".txt");
}

const label = labelOf(f, key, outputBytes);
const customMetadata = { drive_id: f.id, modified: f.modifiedTime || "" };
if (isLargePdf) {
  customMetadata.original_name = f.name;
  customMetadata.original_mime_type = f.mimeType;
}

await env.KB_BUCKET.put(key, outputBytes, {
  httpMetadata: {
    contentType: isLargePdf
      ? "text/plain; charset=utf-8"
      : contentTypeOf(extOf(key)),
  },
  customMetadata,
});
if (prev && prev.key !== key) await env.KB_BUCKET.delete(prev.key);
state.files[f.id] = {
  key,
  ver,
  label,
  name: f.name,
  path: f.path,
  size: outputBytes.byteLength,
};
```

Trong phần tạo báo cáo ngay sau `try`, dùng `key` thực tế được ghi nếu cần báo đúng key `.txt`. Nếu muốn báo đúng key cả khi `try` ném lỗi, khởi tạo `let outputKey = expectedKey` trước khi tải, rồi cập nhật `outputKey = key` ngay sau khi xác định key đầu ra.

## Kiểm tra trước khi deploy

Từ thư mục `workers\aif-kb-sync` (đã cài dependency):

```powershell
node --check src\sync.js
npx.cmd wrangler deploy --dry-run
```

Sau khi deploy, chạy đồng bộ thủ công và kiểm tra:

1. Báo cáo `/sync` có key kết thúc bằng `.txt` cho PDF lớn.
2. Object R2 có `Content-Type: text/plain; charset=utf-8`.
3. Custom metadata có `original_name` và `original_mime_type`.
4. Nội dung `.txt` có văn bản mong đợi; PDF scan không có lớp văn bản sẽ không được trích xuất.
5. PDF nhỏ vẫn được lưu dưới dạng `.pdf`.
