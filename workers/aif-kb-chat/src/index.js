// aif-kb-chat 2.0 · Trợ lý AI First Business (tầng AI của chatbot trên aifirstbusiness.vn)
// Luồng: viết lại câu hỏi -> thẻ QA định tuyến -> chỉ tìm đoạn sách -> mô hình trả lời -> luồng chữ + nguồn.
//   POST /        câu hỏi từ website (giữ nguyên định dạng bản cũ: {secret, message, lang, faq, hist, page})
//   POST /debug   xem câu hỏi viết lại + tài liệu tìm được (header Authorization: Bearer <ADMIN_TOKEN>)
//   GET  /        kiểm tra tình trạng

import { systemPrompt, userMessage, MSG } from "./prompts.js";
import { isFollowUpQuestion, rewriteQuery, findQuestionCard, BOOK_FOLDERS, BOOK_TITLES, searchKB, buildContext, sourceLine, loadMaps } from "./retrieve.js";
import { startStream, toClientStream, directClientStream } from "./generate.js";

const VERSION = "2.0.0";

function corsHeaders(req, env) {
  const origin = req.headers.get("Origin") || "";
  const list = String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ok = list.includes(origin)
    // Bản xem thử trên tài khoản Cloudflare của anh Sỹ (vd. https://aifirstbusiness-website.trantansy.workers.dev)
    || (/^https:\/\/[a-z0-9.-]+$/.test(origin) && String(env.ALLOWED_ORIGIN_SUFFIXES || "").split(",").map((x) => x.trim()).filter(Boolean).some((suf) => origin.endsWith(suf)))
    || (env.ALLOW_LOCALHOST === "1" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  return { ok, headers: { "Access-Control-Allow-Origin": ok ? origin : (list[0] || "*"), "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400", "Vary": "Origin" } };
}
function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(headers || {}) } });
}
function cleanHist(h) {
  return (Array.isArray(h) ? h : []).slice(-4).map((x) => ({ r: x && x.r === "u" ? "u" : "b", t: String((x && x.t) || "").replace(/\s+/g, " ").slice(0, 600) })).filter((x) => x.t);
}
function normalizeBookId(value) {
  const id = String(value || "").toLowerCase();
  if (id === "aif" || id === "ai_first_business" || id === "ai-first-business") return "aifb";
  if (id === "economy" || id === "ai_economy" || id === "ai-economy") return "aiec";
  return BOOK_FOLDERS[id] ? id : null;
}
export function isConsultationRequest(question) {
  const q = String(question || "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  const hasNegation = /\b(chua|khong|dung|thoi|chua muon|khong muon|chua can|khong can|chi muon|chi doc|doc them)\b/.test(q);
  if (hasNegation) return false;
  const asksForConsultation = /\b(tu van|consult(?:ation|ing)?)\b|諮詢/.test(q);
  const asksForAction = /\b(muon|can|xin|dat lich|hen|lien he|ket noi|book|schedule|contact|request|need|want|arrange)\b|預約|聯絡/.test(q);
  const asksForDefinition = /\b(agent tu van|tu van khach hang|tro ly tu van|tu van cho sep|la gi|nghia la gi|giai thich|khai niem|khung nao|buoc nao|thu tu|nhu the nao|the nao|ra sao|lam sao|gom nhung|bao nhieu|adopt|adapt|advance|3a|sandbox|work chart|lifecycle card|ho so agent|khoa an toan|what is|what does|meaning of)\b|是什麼/.test(q);
  return asksForConsultation && asksForAction && !asksForDefinition;
}
export function isAmbiguousBusinessModelQuestion(question) {
  const q = String(question || "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  if (/\b(3a|ai native|ai-native|chin tang)\b/.test(q)) return false;
  const mentionsBusiness = /\b(doanh nghiep|cong ty|to chuc)\b/.test(q);
  const mentionsModel = /\bmo hinh\b/.test(q);
  const mentionsAI = /\b(ai|tri tue nhan tao)\b/.test(q);
  return mentionsBusiness && mentionsModel && mentionsAI;
}
function consultationPayload(lang) {
  const options = {
    vi: {
      answer: "Anh/chị có thể chọn một trong hai cách để trao đổi về nhu cầu của doanh nghiệp:",
      actions: [
        { label: "Liên hệ tư vấn", href: "/lien-he/#form" },
        { label: "Làm khảo sát EAR Index", href: "/danh-gia/ear-index/" },
      ],
    },
    en: {
      answer: "Choose either option to discuss your organization's AI needs:",
      actions: [
        { label: "Contact for consultation", href: "/en/lien-he/#form" },
        { label: "Take the EAR Index assessment", href: "/en/danh-gia/ear-index/" },
      ],
    },
    zh: {
      answer: "您可以選擇以下任一方式，討論企業的 AI 需求：",
      actions: [
        { label: "聯絡顧問", href: "/zh/lien-he/#form" },
        { label: "進行 EAR Index 評估", href: "/zh/danh-gia/ear-index/" },
      ],
    },
  };
  return { ok: true, ...options[lang] };
}
function clarificationPayload(lang, bookId) {
  const questions = {
    aifb: {
      vi: "Bạn muốn hỏi về ba nấc chiến lược triển khai AI (Adopt, Adapt, Advance) hay bốn mô hình kinh doanh AI-Native?",
      en: "Are you asking about the three AI strategy levels (Adopt, Adapt, Advance) or the four AI-Native business models?",
      zh: "您想了解 AI 導入的三個策略層級（Adopt、Adapt、Advance），還是四種 AI-Native 商業模式？",
    },
    aiec: {
      vi: "Bạn muốn hỏi về chín tầng của Nền Kinh tế Trí tuệ hay một mô hình cụ thể khác trong cuốn sách?",
      en: "Are you asking about the nine layers of the Intelligence Economy or another specific model in the book?",
      zh: "您想了解智慧經濟的九個層次，還是書中的其他特定模型？",
    },
  };
  return { ok: true, answer: questions[bookId][lang] || questions[bookId].vi, clarification: true };
}

// Toàn bộ bước tìm tài liệu (dùng chung cho /  và /debug)
export async function retrieve(env, { question, hist, lang, bookId = null }) {
  const historyForAnswer = isFollowUpQuestion(question) ? hist : [];
  let exactQaCard = null, qaSearchError = null;
  try { exactQaCard = await findQuestionCard(env, question, bookId); }
  catch (e) {
    qaSearchError = String(e && e.message || e);
    console.log(JSON.stringify({ ev: "qa-search-error", err: qaSearchError.slice(0, 300) }));
  }
  if (exactQaCard && exactQaCard.exact) {
    const docs = exactQaCard.sourceEntries.map((source) => {
      const sourceBookId = String(source.book_id || exactQaCard.bookId).toLowerCase();
      const sourceBookTitle = String(source.book_title || BOOK_TITLES[sourceBookId] || exactQaCard.bookTitle);
      const location = source.kind === "section" && source.number ? `mục ${source.number}`
        : source.kind === "chapter" && source.number ? `chương ${source.number}`
          : source.number ? `${source.kind} ${source.number}`
            : source.page ? `trang ${source.page}` : source.title;
      return { kind: "book", label: `${sourceBookTitle}, ${location}`, text: exactQaCard.answer };
    });
    return {
      query: question,
      rewritten: question,
      historyForAnswer,
      docs,
      best: 1,
      chunks: [],
      book: exactQaCard.bookTitle,
      searchError: null,
      qaSearchError,
      qaCard: {
        bookId: exactQaCard.bookId,
        key: exactQaCard.key,
        question: exactQaCard.question,
        sourceIds: exactQaCard.sourceIds,
      },
      directAnswer: exactQaCard.answer,
    };
  }
  const rw = await rewriteQuery(env, question, hist, lang);
  let chunks = [], searchError = null;
  const qaCard = exactQaCard && !exactQaCard.ambiguous
    && (exactQaCard.exact || exactQaCard.overlap >= 0.3) ? exactQaCard : null;
  const bookFolder = BOOK_FOLDERS[bookId] || (qaCard ? BOOK_FOLDERS[qaCard.bookId] : null);
  const bookQuery = qaCard
    ? [qaCard.question, ...qaCard.aliases, ...qaCard.sourceTitles].join(" ")
    : rw.query;
  try { chunks = await searchKB(env, bookQuery, bookFolder); } catch (e) { searchError = String(e && e.message || e); }
  const context = await buildContext(env, chunks);
  const book = context.docs.length ? context.docs[0].label.split(",")[0].trim() : context.bookKey;
  return {
    ...rw,
    ...context,
    historyForAnswer,
    book,
    searchError,
    qaSearchError,
    qaCard: qaCard && { bookId: qaCard.bookId, key: qaCard.key, question: qaCard.question, sourceIds: qaCard.sourceIds },
  };
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const C = corsHeaders(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: C.headers });

    if (req.method === "GET" && url.pathname === "/") {
      const maps = await loadMaps(env);
      return json({ ok: true, service: "aif-kb-chat", version: VERSION, ai: !!env.AI, search: !!env.AI_SEARCH, instance: env.AI_SEARCH_INSTANCE, model: env.MODEL, kb_files: Object.keys(maps.labels).length }, 200, C.headers);
    }

    let body;
    try { body = JSON.parse(await req.text()); } catch (e) { return json({ ok: false, error: "json" }, 400, C.headers); }
    const lang = ["vi", "en", "zh"].includes(body.lang) ? body.lang : "vi";
    const question = String(body.message || body.question || "").replace(/\s+/g, " ").trim().slice(0, 500);
    if (!question) return json({ ok: false, error: "empty" }, 400, C.headers);
    const hist = cleanHist(body.hist);
    const bookId = normalizeBookId(body.book_id !== undefined ? body.book_id : body.book);
    // Công cụ kiểm tra cho quản trị: xem tìm được tài liệu nào
    if (req.method === "POST" && url.pathname === "/debug") {
      if (!env.ADMIN_TOKEN || req.headers.get("Authorization") !== "Bearer " + env.ADMIN_TOKEN) return json({ ok: false, error: "admin" }, 401, C.headers);
      if ((body.book_id !== undefined || body.book !== undefined) && !bookId) return json({ ok: false, error: "invalid-book" }, 400, C.headers);
      const r = await retrieve(env, { question, hist, lang, bookId });
      return json({ ok: true, rewritten: r.rewritten, query: r.query, book: r.book, qaCard: r.qaCard, qaSearchError: r.qaSearchError, searchError: r.searchError, best: r.best,
        chunks: r.chunks.map((c) => ({ key: c.key, score: +c.score.toFixed(3), words: c.text.split(/\s+/).length, details: c.details })),
        used: r.docs.map((d) => ({ key: d.key, label: d.label, kind: d.kind, score: d.score, preview: d.text.slice(0, 200) })),
        src: sourceLine(r.docs, lang) }, 200, C.headers);
    }

    if (req.method !== "POST" || (url.pathname !== "/" && url.pathname !== "/chat")) return json({ ok: false, error: "not-found" }, 404, C.headers);
    if (!C.ok) return json({ ok: false, error: "origin" }, 403, C.headers);
    const chatSecret = env.CHAT_SECRET || env.CHAT_CLIENT_TOKEN;
    if (!chatSecret || body.secret !== chatSecret) return json({ ok: false, error: "secret" }, 403, C.headers);
    if (!bookId) return json({ ok: false, error: "book-required" }, 400, C.headers);
    const ip = req.headers.get("CF-Connecting-IP") || "0";
    if (env.CHAT_LIMITER) {
      const { success } = await env.CHAT_LIMITER.limit({ key: ip });
      if (!success) return json({ ok: true, answer: MSG[lang].busy, nf: true }, 200, C.headers);
    }

    if (isConsultationRequest(question)) return json(consultationPayload(lang), 200, C.headers);
    if (isAmbiguousBusinessModelQuestion(question)) return json(clarificationPayload(lang, bookId), 200, C.headers);
    if (!env.AI || !env.AI_SEARCH) return json({ ok: false, error: "missing-binding" }, 500, C.headers);

    const t0 = Date.now();
    const r = await retrieve(env, { question, hist, lang, bookId });
    if (r.directAnswer) {
      const src = sourceLine(r.docs, lang);
      return new Response(directClientStream(r.directAnswer, {
        src,
        onDone: ({ text }) => console.log(JSON.stringify({
          ev: "qa-direct-answer",
          q: question,
          card: r.qaCard && r.qaCard.key,
          chars: text.length,
          ms: Date.now() - t0,
        })),
      }), { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", ...C.headers } });
    }
    if (!r.docs.length) {
      console.log(JSON.stringify({ ev: "nf", q: question, rw: r.rewritten, err: r.searchError, ms: Date.now() - t0 }));
      return json({ ok: true, answer: r.searchError ? MSG[lang].err : MSG[lang].nf, nf: true, src: "" }, 200, C.headers);
    }

    const messages = [
      { role: "system", content: systemPrompt(lang) },
      { role: "user", content: userMessage({ docs: r.docs, hist: r.historyForAnswer, question, rewritten: r.rewritten, lang, book: r.book }) },
    ];
    let aiStream;
    try { aiStream = await startStream(env, messages); }
    catch (e) {
      console.log(JSON.stringify({ ev: "ai-error", err: String(e && e.message || e).slice(0, 300) }));
      return json({ ok: true, answer: MSG[lang].err, nf: true }, 200, C.headers);
    }
    const meta = {
      src: sourceLine(r.docs, lang),
      faq: [],
      lang,
      onDone: ({ nf, text }) => console.log(JSON.stringify({ ev: "answer", q: question, rw: r.rewritten, used: r.docs.map((d) => d.key), nf, chars: text.length, ms: Date.now() - t0 })),
    };
    return new Response(toClientStream(aiStream, meta), { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", ...C.headers } });
  },
};
