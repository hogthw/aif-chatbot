// Tìm tài liệu liên quan: viết lại câu hỏi -> AI Search (tìm lai vector + từ khóa) -> ưu tiên thẻ khái niệm/FAQ -> gom theo tệp.

import { REWRITE_PROMPT } from "./prompts.js";

const MAP_TTL_MS = 5 * 60 * 1000;
let maps = null; // { labels, ids, at }

export async function loadMaps(env) {
  if (maps && Date.now() - maps.at < MAP_TTL_MS) return maps;
  let labels = {}, ids = {};
  try {
    const [l, i] = await Promise.all([env.KB_STATE.get("kb:labels"), env.KB_STATE.get("kb:ids")]);
    labels = JSON.parse(l || "{}"); ids = JSON.parse(i || "{}");
  } catch (e) { /* KV lỗi: vẫn chạy được, nhãn lấy từ nội dung */ }
  maps = { labels, ids, at: Date.now() };
  return maps;
}
export function _resetMaps() { maps = null; }

function withTimeout(p, ms) { return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]); }

// Bước 1: viết lại câu hỏi thành câu tiếng Việt đầy đủ (lượt hỏi nối tiếp, câu EN/繁中)
export async function rewriteQuery(env, question, hist, lang) {
  if (env.REWRITE === "0") return { query: question, rewritten: question };
  const h = hist.length ? hist.map((x) => (x.r === "u" ? "Người hỏi: " : "Trợ lý: ") + x.t.slice(0, 400)).join("\n") : "(không có)";
  try {
    const r = await withTimeout(env.AI.run(env.REWRITE_MODEL, {
      messages: [{ role: "system", content: REWRITE_PROMPT }, { role: "user", content: `LỊCH SỬ:\n${h}\n\nCÂU HỎI MỚI: ${question}` }],
      max_tokens: 120, temperature: 0,
    }, gatewayOpts(env)), Number(env.REWRITE_TIMEOUT_MS || 3000));
    const line = String((r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content))) || "").split("\n").map((s) => s.trim()).filter(Boolean)[0] || "";
    const clean = line.replace(/^["“]|["”]$/g, "").slice(0, 400);
    if (!clean) return { query: question, rewritten: question };
    const [main, terms] = clean.split("|");
    // Tìm bằng câu đã viết lại + thuật ngữ; với tiếng Việt giữ thêm câu gốc để không mất từ khóa của khách
    const query = [main.trim(), terms ? terms.trim() : "", lang === "vi" && !hist.length ? question : ""].filter(Boolean).join(" ");
    return { query, rewritten: main.trim() || question };
  } catch (e) {
    return { query: question, rewritten: question };
  }
}

export function gatewayOpts(env) {
  return env.GATEWAY_ID ? { gateway: { id: env.GATEWAY_ID, skipCache: false } } : undefined;
}

// Loại tài liệu theo thư mục -> trọng số ưu tiên + nhãn cho mô hình
export function kindOf(key) {
  const k = key.toLowerCase();
  if (/(^|\/)01[-_ ]|khai-niem|khái niệm/.test(k)) return { kind: "concept", kindLabel: "THẺ KHÁI NIỆM", weight: 1.3 };
  if (/(^|\/)02[-_ ]|(^|\/)faq/.test(k)) return { kind: "faq", kindLabel: "FAQ", weight: 1.15 };
  if (/(^|\/)03[-_ ]|sach|sách/.test(k)) return { kind: "book", kindLabel: "ĐOẠN SÁCH", weight: 1.0 };
  if (/(^|\/)04[-_ ]|website/.test(k)) return { kind: "web", kindLabel: "THÔNG TIN WEBSITE", weight: 1.0 };
  return { kind: "doc", kindLabel: "TÀI LIỆU", weight: 1.0 };
}

function labelFromText(text) {
  const m = /^\s*(?:Nguồn|Source)\s*:\s*(.+?)\s*$/im.exec(String(text || "").slice(0, 600));
  return m ? m[1] : "";
}
function labelFromKey(key) { return key.split("/").pop().replace(/\.[^.]+$/, ""); }
function cleanText(text) { return String(text || "").replace(/^\s*(?:Nguồn|Source|Từ khóa)\s*:.*$/gim, "").replace(/\n{3,}/g, "\n\n").trim(); }

// Chuẩn hóa một phần tử kết quả của AI Search (chịu được vài dạng trả về khác nhau)
export function normChunk(c) {
  const key = (c.item && (c.item.key || c.item.filename)) || c.filename || c.key || "";
  const text = c.text || (Array.isArray(c.content) ? c.content.map((x) => x.text || "").join("\n") : "") || "";
  const score = typeof c.score === "number" ? c.score : 0;
  return { key, text, score, details: c.scoring_details || null };
}

// Bước 2: tìm trên AI Search
export async function searchKB(env, query) {
  const inst = env.AI_SEARCH.get(env.AI_SEARCH_INSTANCE);
  const opts = {
    query,
    ai_search_options: {
      retrieval: {
        retrieval_type: env.RETRIEVAL_TYPE || "hybrid",
        // "max": điểm chuẩn hóa 0–1 (lấy cao hơn giữa vector và từ khóa) nên MATCH_THRESHOLD có ý nghĩa.
        // "rrf" (mặc định của Cloudflare) cho điểm theo thứ hạng rất nhỏ, cần hạ MATCH_THRESHOLD nếu dùng.
        ...((env.RETRIEVAL_TYPE || "hybrid") === "hybrid" && env.FUSION_METHOD ? { fusion_method: env.FUSION_METHOD } : {}),
        max_num_results: Number(env.MAX_RESULTS || 12),
        match_threshold: Number(env.MATCH_THRESHOLD || 0.3),
      },
      reranking: env.RERANK === "1"
        ? { enabled: true, model: env.RERANK_MODEL || "@cf/baai/bge-reranker-base", match_threshold: Number(env.RERANK_THRESHOLD || 0.2) }
        : { enabled: false },
    },
  };
  let res;
  try { res = await inst.search(opts); }
  catch (e) {
    // Dự phòng nếu tùy chọn không được chấp nhận: chỉ gửi câu hỏi
    res = await inst.search({ query });
  }
  const list = (res && (res.chunks || res.data)) || [];
  return list.map(normChunk).filter((c) => c.key && c.text);
}

// Bước 3: gom kết quả theo tệp, cộng trọng số, thêm FAQ khách vừa chọn, cắt theo giới hạn chữ
export async function buildContext(env, chunks, faqIds, opts = {}) {
  const { labels, ids } = await loadMaps(env);
  const maxDocs = opts.maxDocs || Number(env.MAX_DOCS || 7);
  const maxWords = opts.maxWords || Number(env.MAX_CONTEXT_WORDS || 2400);
  const byKey = new Map();
  for (const c of chunks) {
    const k = kindOf(c.key);
    const cur = byKey.get(c.key);
    const s = c.score * k.weight;
    if (!cur) byKey.set(c.key, { key: c.key, ...k, score: s, parts: [c.text] });
    else { cur.score = Math.max(cur.score, s); if (!cur.parts.includes(c.text)) cur.parts.push(c.text); }
  }
  // FAQ khách đã chọn ở trình duyệt: luôn đưa vào đầu
  const forced = [];
  for (const id of (faqIds || []).slice(0, 3)) {
    const key = ids[String(id)];
    if (!key) continue;
    let text = byKey.get(key) ? byKey.get(key).parts.join("\n") : "";
    if (!text && env.KB_BUCKET) { try { const o = await env.KB_BUCKET.get(key); if (o) text = await o.text(); } catch (e) { /* bỏ qua */ } }
    if (text) { forced.push({ key, ...kindOf(key), score: 9, parts: [text] }); byKey.delete(key); }
  }
  const found = [...byKey.values()].sort((a, b) => b.score - a.score);
  const ranked = forced.concat(found);
  const best = found.length ? found[0].score : 0;
  const docs = []; let words = 0;
  for (const d of ranked) {
    if (docs.length >= maxDocs) break;
    if (d.score < 9 && best && d.score < best * Number(env.RELATIVE_CUTOFF || 0.45)) continue;
    const raw = d.parts.join("\n\n");
    const text = cleanText(raw);
    const w = text.split(/\s+/).length;
    if (words + w > maxWords && docs.length) continue;
    docs.push({ key: d.key, kind: d.kind, kindLabel: d.kindLabel, score: +d.score.toFixed(3), label: labels[d.key] || labelFromText(raw) || labelFromKey(d.key), text });
    words += w;
  }
  return { docs, best };
}

// Nhãn nguồn hiển thị cho khách: "Tên sách, mục x.y" (chỉ sách, FAQ và thẻ khái niệm; tối đa 3)
const LABEL_TR = {
  en: [[/Nền Kinh tế Trí tuệ/g, "AI Economy"], [/\bmục\b/g, "section"], [/\bchương\b/gi, "chapter"], [/Phụ lục/g, "Appendix"], [/ và /g, " and "], [/ đến /g, "–"]],
  zh: [[/Nền Kinh tế Trí tuệ/g, "AI Economy"], [/\bmục\b/g, "§"], [/\bchương\b/gi, "第"], [/Phụ lục/g, "附錄"], [/ và /g, "、"], [/ đến /g, "–"]],
};
// Gộp theo sách: "AI First Business (mục 4.4; mục 2.2); Nền Kinh tế Trí tuệ (chương 8)". Lấy từ tối đa 3 tài liệu đầu.
export function sourceLine(docs, lang) {
  const books = new Map();
  for (const d of docs.slice(0, 3)) {
    for (const part of String(d.label || "").split(";")) {
      const t = part.trim(); if (!t) continue;
      const k = t.indexOf(",");
      const book = k > 0 ? t.slice(0, k).trim() : t;
      const loc = k > 0 ? t.slice(k + 1).trim() : "";
      if (!books.has(book)) books.set(book, []);
      const locs = books.get(book);
      if (loc && !locs.includes(loc) && locs.length < 3) locs.push(loc);
    }
  }
  const tr = (x) => (LABEL_TR[lang] || []).reduce((s, [a, b]) => s.replace(a, b), x);
  return [...books].slice(0, 3).map(([b, locs]) => tr(locs.length ? `${b} (${locs.join("; ")})` : b)).join("; ");
}
export function faqIdsOf(docs, ids) {
  const rev = {}; for (const [id, key] of Object.entries(ids || {})) rev[key] = id;
  return docs.filter((d) => d.kind === "faq" && rev[d.key] && /^\d+$/.test(rev[d.key])).map((d) => Number(rev[d.key])).slice(0, 3);
}
