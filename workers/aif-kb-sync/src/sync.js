// Đồng bộ thư mục Google Drive -> R2 bucket (nguồn dữ liệu của AI Search).
// Chỉ tải những tệp mới hoặc đã sửa (so md5/thời gian sửa với lần trước), xóa khỏi R2 những tệp đã xóa trên Drive.
// Trạng thái lưu trong KV. AI Search tự đánh chỉ mục lại R2 theo lịch (cài 15 phút trong dashboard).

import { getAccessToken, walk, download, EXPORTS, SUPPORTED_EXT, contentTypeOf } from "./google.js";
import { extractText } from "unpdf";

const STATE_KEY = "sync:state";     // { files: { [driveId]: { key, ver, label, name, path, size } } }
const LABELS_KEY = "kb:labels";     // { [r2Key]: "AI First Business, mục 4.4" }  -> Worker chatbot đọc để ghi nguồn
const IDS_KEY = "kb:ids";           // { "12": r2Key, "W1": r2Key }                -> chatbot lấy đúng câu FAQ theo số
const LAST_KEY = "sync:last";       // tóm tắt lần đồng bộ gần nhất

const MAX_BYTES_DEFAULT = 10 * 1024 * 1024; // AI Search: tối đa 10 MiB (PDF có OCR, văn bản); định dạng khác 4 MiB
const PDF_TEXT_THRESHOLD_BYTES = 9 * 1024 * 1024;

function extOf(name) { const m = /\.[^.\/]+$/.exec(name); return m ? m[0].toLowerCase() : ""; }
function stripExt(name) { return name.replace(/\.[^.\/]+$/, ""); }

// Đường dẫn trong R2 = đường dẫn thư mục trên Drive + tên tệp (Google Docs gốc thêm đuôi .docx/.xlsx/.pdf)
export function r2KeyOf(f) {
  const ex = EXPORTS[f.mimeType];
  const name = ex ? stripExt(f.name) + ex.ext : f.name;
  const clean = (s) => s.replace(/[\\]/g, "-").replace(/\s+/g, " ").trim();
  return (f.path ? f.path.split("/").map(clean).join("/") + "/" : "") + clean(name);
}

// Nhãn nguồn: tệp .md/.txt có dòng "Nguồn: ..." trong 8 dòng đầu thì lấy dòng đó; không có thì dùng tên tệp.
export function labelOf(f, key, bytes) {
  const ext = extOf(key);
  if (bytes && (ext === ".md" || ext === ".txt" || ext === ".markdown")) {
    const head = new TextDecoder().decode(bytes.slice(0, 4000)).split(/\r?\n/).slice(0, 8);
    for (const line of head) { const m = /^\s*(?:Nguồn|Nguon|Source)\s*:\s*(.+?)\s*$/i.exec(line); if (m) return m[1]; }
  }
  return stripExt(key.split("/").pop());
}

// Mã câu hỏi: tệp "faq-012-..." -> "12", "w1-..." -> "W1"
export function idOf(key) {
  const base = key.split("/").pop();
  let m = /^faq-0*(\d{1,4})\b/i.exec(base); if (m) return m[1];
  m = /^(w\d{1,3})\b/i.exec(base); if (m) return m[1].toUpperCase();
  return null;
}

export async function runSync(env, opts = {}) {
  const t0 = Date.now();
  const fetchImpl = opts.fetchImpl || fetch;
  const dry = !!opts.dry, force = !!opts.force;
  const maxFiles = Number(env.MAX_FILES_PER_RUN || 40);
  const maxBytes = Number(env.MAX_FILE_BYTES || MAX_BYTES_DEFAULT);
  if (!env.DRIVE_FOLDER_ID) throw new Error("Chưa đặt DRIVE_FOLDER_ID (mã thư mục Google Drive).");
  if (!env.GOOGLE_SA_KEY) throw new Error("Chưa đặt secret GOOGLE_SA_KEY (khóa JSON của service account).");

  const token = await getAccessToken(env.GOOGLE_SA_KEY, fetchImpl);
  const files = await walk(token, env.DRIVE_FOLDER_ID, fetchImpl);
  const state = JSON.parse((await env.KB_STATE.get(STATE_KEY)) || '{"files":{}}');
  const report = { started: new Date(t0).toISOString(), dry, force, found: files.length, added: [], updated: [], deleted: [], skipped: [], errors: [], pending: 0 };
  const seen = new Set();
  let processed = 0;

  for (const f of files) {
    seen.add(f.id);
    const sourceKey = r2KeyOf(f);
    const ext = extOf(sourceKey);
    if (!SUPPORTED_EXT.has(ext)) { report.skipped.push({ key: sourceKey, reason: "Định dạng chưa hỗ trợ (" + (ext || f.mimeType) + "). Lưu sang PDF/DOCX/MD." }); continue; }
    const size = Number(f.size || 0);
    if (size > maxBytes) { report.skipped.push({ key: sourceKey, reason: `Tệp ${(size / 1048576).toFixed(1)} MB vượt giới hạn ${(maxBytes / 1048576).toFixed(0)} MB, cần tách nhỏ.` }); continue; }
    const ver = f.md5Checksum || f.modifiedTime;
    const prev = state.files[f.id];
    const textKey = sourceKey.replace(/\.pdf$/i, ".txt");
    const expectedKey = ext === ".pdf" && (size > PDF_TEXT_THRESHOLD_BYTES || (prev && prev.key === textKey))
      ? textKey
      : sourceKey;
    if (!force && prev && prev.ver === ver && prev.key === expectedKey) continue;
    if (processed >= maxFiles) { report.pending++; continue; }
    processed++;
    try {
      let outputKey = expectedKey;
      if (!dry) {
        const bytes = new Uint8Array(await download(token, f, fetchImpl));
        if (bytes.byteLength > maxBytes) { report.skipped.push({ key: sourceKey, reason: "Tệp xuất ra vượt giới hạn dung lượng." }); continue; }

        const isLargePdf = ext === ".pdf" && bytes.byteLength > PDF_TEXT_THRESHOLD_BYTES;
        let key = sourceKey;
        let outputBytes = bytes;
        if (isLargePdf) {
          const extracted = await extractText(bytes, { mergePages: true });
          const text = typeof extracted.text === "string" ? extracted.text : extracted.text.join("\n");
          if (!text.trim()) {
            report.skipped.push({ key: sourceKey, reason: "PDF không có lớp văn bản để trích xuất; cần cung cấp phiên bản có thể chọn/copy văn bản." });
            continue;
          }
          outputBytes = new TextEncoder().encode(text);
          if (outputBytes.byteLength > MAX_BYTES_DEFAULT) {
            report.skipped.push({ key: sourceKey, reason: `Text sau khi trích xuất vượt giới hạn AI Search ${(MAX_BYTES_DEFAULT / 1048576).toFixed(0)} MiB.` });
            continue;
          }
          key = textKey;
        }

        outputKey = key;
        const label = labelOf(f, key, outputBytes);
        const customMetadata = { drive_id: f.id, modified: f.modifiedTime || "" };
        if (isLargePdf) {
          customMetadata.original_name = f.name;
          customMetadata.original_mime_type = f.mimeType;
        }
        await env.KB_BUCKET.put(key, outputBytes, {
          httpMetadata: { contentType: contentTypeOf(extOf(key)) },
          customMetadata,
        });
        if (prev && prev.key !== key) await env.KB_BUCKET.delete(prev.key);
        state.files[f.id] = { key, ver, label, name: f.name, path: f.path, size: outputBytes.byteLength };
      }
      (prev ? report.updated : report.added).push(outputKey);
    } catch (e) {
      report.errors.push({ key: outputKey, error: String(e && e.message || e).slice(0, 300) });
    }
  }

  // Tệp đã xóa (hoặc chuyển ra ngoài thư mục) trên Drive -> xóa khỏi R2
  for (const [id, s] of Object.entries(state.files)) {
    if (seen.has(id)) continue;
    if (!dry) { try { await env.KB_BUCKET.delete(s.key); } catch (e) { report.errors.push({ key: s.key, error: "Xóa R2 lỗi: " + e.message }); continue; } delete state.files[id]; }
    report.deleted.push(s.key);
  }

  if (!dry) {
    const labels = {}, ids = {};
    for (const s of Object.values(state.files)) { labels[s.key] = s.label; const id = idOf(s.key); if (id) ids[id] = s.key; }
    await env.KB_STATE.put(STATE_KEY, JSON.stringify(state));
    await env.KB_STATE.put(LABELS_KEY, JSON.stringify(labels));
    await env.KB_STATE.put(IDS_KEY, JSON.stringify(ids));
  }
  report.total_indexed = Object.keys(state.files).length;
  report.ms = Date.now() - t0;
  report.note = report.pending ? `Còn ${report.pending} tệp chờ, sẽ xử lý ở lần chạy sau (hoặc gọi /sync lần nữa).` : "Xong. AI Search sẽ tự cập nhật chỉ mục theo lịch đồng bộ (hoặc bấm Sync ngay trong dashboard).";
  if (!dry) await env.KB_STATE.put(LAST_KEY, JSON.stringify(report));
  return report;
}
