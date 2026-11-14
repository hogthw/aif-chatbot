// Tìm tài liệu liên quan: viết lại câu hỏi -> thẻ hỏi đáp định tuyến -> đoạn sách -> gom theo tệp.

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

export function isFollowUpQuestion(question) {
  const q = normalizeQuestion(question);
  return /(^|\s)(cai|dieu|viec|y|phan|cach|mo hinh|quy trinh|buoc|khung|cong cu) (do|nay|vua noi|tren)(\s|$)/.test(q)
    || /(^|\s)(nhu vay|the con|vay con|vay thi|con neu|neu vay|y ban la|ban vua noi|cau tra loi vua roi|o tren)(\s|$)/.test(q)
    || /^(con|vay|the con|what about|and what about)\b/.test(q)
    || /(^|\s)(that|those|them|it|the second one|the first one)(\s|$)/.test(q)
    || /(^|\s)(what does that mean|why is that|can you explain that|how about that)(\s|$)/.test(q);
}

// Bước 1: viết lại câu hỏi thành câu tiếng Việt đầy đủ (lượt hỏi nối tiếp, câu EN/繁中)
export async function rewriteQuery(env, question, hist, lang) {
  if (env.REWRITE === "0") return { query: question, rewritten: question };
  const relevantHist = isFollowUpQuestion(question) ? hist : [];
  const h = relevantHist.length ? relevantHist.map((x) => (x.r === "u" ? "Người hỏi: " : "Trợ lý: ") + x.t.slice(0, 400)).join("\n") : "(không có)";
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
    const standaloneVietnamese = lang === "vi" && !relevantHist.length;
    const query = standaloneVietnamese
      ? question
      : [main.trim(), terms ? terms.trim() : "", lang === "vi" ? question : ""].filter(Boolean).join(" ");
    return { query, rewritten: standaloneVietnamese ? question : main.trim() || question };
  } catch (e) {
    return { query: question, rewritten: question };
  }
}

export function gatewayOpts(env) {
  return env.GATEWAY_ID ? { gateway: { id: env.GATEWAY_ID, skipCache: false } } : undefined;
}

// Loại tài liệu theo thư mục -> trọng số ưu tiên + nhãn cho mô hình
export function kindOf(key) {
  const root = String(key || "").replace(/\\/g, "/").split("/")[0].toLowerCase();
  if (/^01(?:[-_ ]|$)/.test(root)) return { kind: "concept", kindLabel: "THẺ KHÁI NIỆM", weight: 1.3 };
  if (/^02(?:[-_ ]|$)/.test(root)) return { kind: "faq", kindLabel: "FAQ", weight: 1.15 };
  if (/^03(?:[-_ ]|$)/.test(root)) return { kind: "book", kindLabel: "ĐOẠN SÁCH", weight: 1.0 };
  if (/^04(?:[-_ ]|$)/.test(root)) return { kind: "web", kindLabel: "THÔNG TIN WEBSITE", weight: 1.0 };
  return { kind: "doc", kindLabel: "TÀI LIỆU", weight: 1.0 };
}

function bookOfKey(key) {
  const parts = String(key || "").replace(/\\/g, "/").toLowerCase().split("/");
  const booksIndex = parts.indexOf("03-sach");
  return booksIndex >= 0 ? parts[booksIndex + 1] || "" : "";
}

function selectBookChunks(chunks) {
  let selectedBook = "", bestScore = -Infinity;
  for (const chunk of chunks) {
    if (kindOf(chunk.key).kind !== "book") continue;
    const book = bookOfKey(chunk.key);
    if (book && chunk.score > bestScore) {
      selectedBook = book;
      bestScore = chunk.score;
    }
  }
  return {
    bookKey: selectedBook || null,
    chunks: selectedBook ? chunks.filter((chunk) => bookOfKey(chunk.key) === selectedBook) : [],
  };
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

function folderRange(prefix) {
  const folder = prefix.replace(/\/+$/, "");
  return { folder: { $gte: `${folder}/`, $lt: `${folder}0` } };
}

async function searchFolder(env, query, prefix, maxResults, matchThreshold) {
  const inst = env.AI_SEARCH.get(env.AI_SEARCH_INSTANCE);
  const filters = folderRange(prefix);
  const opts = {
    query,
    ai_search_options: {
      retrieval: {
        retrieval_type: env.RETRIEVAL_TYPE || "hybrid",
        filters,
        // "max": điểm chuẩn hóa 0–1 (lấy cao hơn giữa vector và từ khóa) nên MATCH_THRESHOLD có ý nghĩa.
        // "rrf" (mặc định của Cloudflare) cho điểm theo thứ hạng rất nhỏ, cần hạ MATCH_THRESHOLD nếu dùng.
        ...((env.RETRIEVAL_TYPE || "hybrid") === "hybrid" && env.FUSION_METHOD ? { fusion_method: env.FUSION_METHOD } : {}),
        max_num_results: maxResults,
        match_threshold: matchThreshold,
      },
      reranking: env.RERANK === "1"
        ? { enabled: true, model: env.RERANK_MODEL || "@cf/baai/bge-reranker-base", match_threshold: Number(env.RERANK_THRESHOLD || 0.2) }
        : { enabled: false },
    },
  };
  let res;
  try { res = await inst.search(opts); }
  catch (e) {
    // Giữ bộ lọc thư mục nếu các tùy chọn khác không được chấp nhận.
    res = await inst.search({ query, ai_search_options: { retrieval: { filters } } });
  }
  const list = (res && (res.chunks || res.data)) || [];
  return list.map(normChunk).filter((c) => c.key && c.text);
}

// Bước 2: tìm thẻ QA; câu khớp duy nhất có thể được trả trực tiếp.
export async function findQuestionCard(env, query, bookId = null) {
  const selectedBookId = bookId && BOOK_FOLDERS[bookId] ? bookId : null;
  const qaFolder = selectedBookId
    ? `02-faq/book-qa/${selectedBookId}`
    : "02-faq/book-qa";
  const hits = await searchFolder(
    env,
    qaSearchQuery(query),
    qaFolder,
    Number(env.QA_MAX_RESULTS || 12),
    Number(env.QA_MATCH_THRESHOLD || env.MATCH_THRESHOLD || 0.3),
  );
  const queryTerms = searchTerms(query);
  const exactQuery = normalizeQuestion(query);
  let best = null;
  const exactMatches = new Map();
  const conflictingIds = new Set();
  const prefixMatches = [];
  const keys = [...new Set(hits.map((hit) => hit.key))].slice(0, 8);
  const files = await Promise.all(keys.map(async (key) => {
    let object;
    try { object = await env.KB_BUCKET.get(key); }
    catch (e) {
      console.log(JSON.stringify({ ev: "qa-object-error", key, err: String(e && e.message || e).slice(0, 200) }));
      return null;
    }
    if (!object) return null;
    try { return { key, data: JSON.parse(await object.text()) }; }
    catch (e) {
      console.log(JSON.stringify({ ev: "qa-json-error", key, err: String(e && e.message || e).slice(0, 200) }));
      return null;
    }
  }));
  const considerFile = (file) => {
    if (!file) return;
    const { key, data } = file;
    if (!Array.isArray(data.cards)) return;
    const cardBookId = String(data.book_id || "").toLowerCase();
    if (!BOOK_FOLDERS[cardBookId]) return;
    if (selectedBookId && cardBookId !== selectedBookId) return;
    for (const card of data.cards) {
      const question = String(card.question || "").trim();
      if (!question) continue;
      const aliases = Array.isArray(card.aliases) ? card.aliases.map(String) : [];
      const sourceIds = Array.isArray(card.source_ids) ? card.source_ids.map(String) : [];
      const sourceEntries = sourceIds.map((id) => data.sources && data.sources[id]).filter(Boolean);
      const sourceTitles = sourceEntries.map((source) => source.title).filter(Boolean);
      const text = [question, ...aliases, ...sourceTitles].join(" ");
      const terms = searchTerms(text);
      const overlap = queryTerms.size ? [...queryTerms].filter((term) => terms.has(term)).length / queryTerms.size : 0;
      const headingAliases = sourceTitles
        .map((title) => title.split(/[:：–—-]/, 1)[0].trim())
        .filter(Boolean)
        .flatMap((title) => [title, `mô hình ${title}`]);
      if (card.heading_alias) headingAliases.push(String(card.heading_alias));
      const acronymQuestionMatch = aliases.some((alias) => {
        const acronym = normalizeQuestion(alias);
        return /^\d+[a-z]$/.test(acronym)
          && new RegExp(`(^|\\s)${acronym}(\\s|$)`).test(exactQuery)
          && /(^|\s)(mo hinh|la gi|gom gi|gom nhung gi)(\s|$)/.test(exactQuery);
      });
      const hit = hits.find((item) => item.key === key);
      const score = (hit ? hit.score : 0) + overlap * 0.25;
      const queryWords = exactQuery.split(" ");
      const cardWords = normalizeQuestion(question).split(" ");
      let prefixLength = 0;
      while (prefixLength < queryWords.length && queryWords[prefixLength] === cardWords[prefixLength]) prefixLength++;
      const specificPrefixMatch = prefixLength >= 4
        && queryWords.slice(0, prefixLength).filter((term) => term.length > 3).length >= 2;
      const base = {
        bookId: cardBookId,
        bookTitle: String(data.title || ""),
        key,
        question,
        aliases,
        sourceIds,
        sourceTitles,
        sourceEntries,
        answer: String(card.answer || "").trim(),
        score,
        overlap,
      };
      if (acronymQuestionMatch
        || [question, ...aliases, ...sourceTitles, ...headingAliases].some((candidate) => normalizeQuestion(candidate) === exactQuery)) {
        const identity = `${cardBookId}:${normalizeQuestion(question)}`;
        const previous = exactMatches.get(identity);
        if (!previous) exactMatches.set(identity, base);
        else if (
          previous.answer !== base.answer ||
          normalizeQuestion(previous.question) !== normalizeQuestion(base.question)
        ) conflictingIds.add(identity);
      }
      if (specificPrefixMatch && base.answer && base.sourceEntries.length) prefixMatches.push(base);
      if (!best || score > best.score) best = base;
    }
  };
  for (const file of files) considerFile(file);
  const prefixAnswers = new Set(prefixMatches.map((match) => match.answer));
  const exactMatchIsUsable = exactMatches.size === 1 && !conflictingIds.size
    && [...exactMatches.values()].some((match) => match.answer && match.sourceEntries.length);
  if (selectedBookId && !exactMatchIsUsable
    && (exactMatches.size > 1 || conflictingIds.size || prefixAnswers.size > 1 || !best || best.overlap < 0.3)) {
    try {
      const listing = await env.KB_BUCKET.list({ prefix: qaFolder, limit: 1000 });
      const fullKey = (listing.objects || []).find((object) => /_FULL\.json$/i.test(object.key))?.key;
      if (fullKey && !keys.includes(fullKey)) {
        const object = await env.KB_BUCKET.get(fullKey);
        if (object) {
          try { considerFile({ key: fullKey, data: JSON.parse(await object.text()) }); }
          catch (e) {
            console.log(JSON.stringify({ ev: "qa-json-error", key: fullKey, err: String(e && e.message || e).slice(0, 200) }));
          }
        }
      }
    } catch (e) {
      console.log(JSON.stringify({ ev: "qa-list-error", prefix: qaFolder, err: String(e && e.message || e).slice(0, 200) }));
    }
  }
  if (exactMatches.size === 1 && !conflictingIds.size) {
    const [match] = exactMatches.values();
    if (match.answer && match.sourceEntries.length) return { ...match, exact: true };
  }
  if (prefixMatches.length) {
    const ordered = prefixMatches.sort((a, b) => b.overlap - a.overlap || b.score - a.score);
    const match = ordered[0];
    const competingAnswer = ordered.find((candidate) => candidate.answer !== match.answer);
    if (!competingAnswer || match.overlap - competingAnswer.overlap >= 0.1) return { ...match, exact: true };
    return { ...match, exact: false, ambiguous: true };
  }
  if (exactMatches.size > 1 || conflictingIds.size) return { ...exactMatches.values().next().value, exact: false, ambiguous: true };
  return best;
}

export const BOOK_FOLDERS = {
  aifb: "ai-first-business",
  aiec: "nen-kinh-te-tri-tue",
};

export const BOOK_TITLES = {
  aifb: "AI First Business",
  aiec: "Nền Kinh tế Trí tuệ",
};

function searchTerms(text) {
  const normalized = String(text || "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  return new Set(normalized.split(/[^a-z0-9]+/).filter((term) => term.length > 2));
}

function normalizeQuestion(text) {
  return String(text || "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function qaSearchQuery(query) {
  const normalized = normalizeQuestion(query);
  if (/^sau khoa an toan\b/.test(normalized) && /nhung khoa nao/.test(normalized)) {
    return "Sáu khóa an toàn gồm những khóa nào?";
  }
  return query;
}

// Bước 3: chỉ tìm trong sách; có thẻ QA thì giới hạn tìm vào đúng cuốn sách đó.
export async function searchKB(env, query, bookFolder = null) {
  const prefix = bookFolder ? `03-sach/${bookFolder}` : "03-sach";
  return searchFolder(
    env,
    query,
    prefix,
    Number(env.MAX_RESULTS || 12),
    Number(env.MATCH_THRESHOLD || 0.3),
  );
}

// Bước 4: chỉ gom đoạn sách thuộc một cuốn, cắt theo giới hạn chữ
export async function buildContext(env, chunks, opts = {}) {
  const selected = selectBookChunks(chunks);
  chunks = selected.chunks;
  const { labels } = await loadMaps(env);
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
  const found = [...byKey.values()].sort((a, b) => b.score - a.score);
  const best = found.length ? found[0].score : 0;
  const docs = []; let words = 0;
  for (const d of found) {
    if (docs.length >= maxDocs) break;
    if (best && d.score < best * Number(env.RELATIVE_CUTOFF || 0.45)) continue;
    const raw = d.parts.join("\n\n");
    const text = cleanText(raw);
    const w = text.split(/\s+/).length;
    if (words + w > maxWords && docs.length) continue;
    docs.push({ key: d.key, kind: d.kind, kindLabel: d.kindLabel, score: +d.score.toFixed(3), label: labels[d.key] || labelFromText(raw) || labelFromKey(d.key), text });
    words += w;
  }
  return { docs, best, bookKey: selected.bookKey, chunks };
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
