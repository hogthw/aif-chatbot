// Google Drive API qua tài khoản dịch vụ (service account), chỉ quyền đọc.
// Không cần thư viện ngoài: ký JWT RS256 bằng WebCrypto có sẵn trong Workers.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const API = "https://www.googleapis.com/drive/v3";

// Google Docs/Sheets/Slides gốc không tải trực tiếp được, phải xuất (export) sang định dạng AI Search đọc được.
export const EXPORTS = {
  "application/vnd.google-apps.document": { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: ".docx" },
  "application/vnd.google-apps.spreadsheet": { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: ".xlsx" },
  "application/vnd.google-apps.presentation": { mime: "application/pdf", ext: ".pdf" },
};
const FOLDER = "application/vnd.google-apps.folder";

// Định dạng AI Search chuyển được sang Markdown (theo tài liệu Cloudflare, 11/2026).
export const SUPPORTED_EXT = new Set([
  ".md", ".markdown", ".txt", ".rst", ".csv", ".html", ".htm", ".xml", ".json",
  ".pdf", ".docx", ".xlsx", ".xlsm", ".xlsb", ".xls", ".odt", ".ods",
  ".jpg", ".jpeg", ".png", ".webp", ".svg",
]);

const CONTENT_TYPES = {
  ".md": "text/markdown; charset=utf-8", ".markdown": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8", ".html": "text/html; charset=utf-8", ".htm": "text/html; charset=utf-8",
  ".json": "application/json", ".xml": "application/xml", ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
export function contentTypeOf(ext) { return CONTENT_TYPES[ext] || "application/octet-stream"; }

function b64url(bytes) {
  let s = ""; const a = new Uint8Array(bytes);
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlStr(str) { return b64url(new TextEncoder().encode(str)); }
function pemToDer(pem) {
  const b = atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""));
  const out = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out.buffer;
}

let cached = null; // { token, exp }
export async function getAccessToken(saJson, fetchImpl = fetch) {
  if (cached && cached.exp - 60 > Date.now() / 1000) return cached.token;
  let sa;
  try { sa = typeof saJson === "string" ? JSON.parse(saJson) : saJson; } catch (e) { throw new Error("GOOGLE_SA_KEY không phải JSON hợp lệ (dán nguyên nội dung tệp khóa .json)."); }
  if (!sa || !sa.client_email || !sa.private_key) throw new Error("GOOGLE_SA_KEY thiếu client_email hoặc private_key.");
  const iat = Math.floor(Date.now() / 1000), exp = iat + 3600;
  const unsigned = b64urlStr(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." +
    b64urlStr(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat, exp }));
  const key = await crypto.subtle.importKey("pkcs8", pemToDer(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") + "&assertion=" + unsigned + "." + b64url(sig),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw new Error("Không lấy được token Google: " + (j.error_description || j.error || res.status));
  cached = { token: j.access_token, exp: iat + (j.expires_in || 3600) };
  return cached.token;
}
export function _resetTokenCache() { cached = null; }

async function gfetch(token, url, fetchImpl) {
  const res = await fetchImpl(url, { headers: { Authorization: "Bearer " + token } });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Drive API ${res.status}: ${t.slice(0, 300)}`);
  }
  return res;
}

// Liệt kê đệ quy toàn bộ tệp trong thư mục gốc. Bỏ qua tệp/thư mục có tên bắt đầu bằng "_", "~" hoặc ".".
export async function walk(token, rootId, fetchImpl = fetch) {
  const out = [];
  const queue = [{ id: rootId, path: "" }];
  while (queue.length) {
    const { id, path } = queue.shift();
    let pageToken = "";
    do {
      const q = encodeURIComponent(`'${id}' in parents and trashed = false`);
      const fields = encodeURIComponent("nextPageToken, files(id, name, mimeType, md5Checksum, modifiedTime, size)");
      const url = `${API}/files?q=${q}&fields=${fields}&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true` + (pageToken ? `&pageToken=${pageToken}` : "");
      const j = await (await gfetch(token, url, fetchImpl)).json();
      for (const f of j.files || []) {
        if (/^[_~.]/.test(f.name)) continue;
        if (f.mimeType === FOLDER) queue.push({ id: f.id, path: path ? `${path}/${f.name}` : f.name });
        else out.push({ ...f, path });
      }
      pageToken = j.nextPageToken || "";
    } while (pageToken);
  }
  return out;
}

// Tải nội dung tệp (Google Docs/Sheets/Slides thì xuất sang docx/xlsx/pdf). Trả về ArrayBuffer.
export async function download(token, f, fetchImpl = fetch) {
  const ex = EXPORTS[f.mimeType];
  const url = ex
    ? `${API}/files/${f.id}/export?mimeType=${encodeURIComponent(ex.mime)}`
    : `${API}/files/${f.id}?alt=media&supportsAllDrives=true`;
  return (await gfetch(token, url, fetchImpl)).arrayBuffer();
}
