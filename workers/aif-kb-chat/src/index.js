// aif-kb-chat 2.0 · Trợ lý AI First Business (tầng AI của chatbot trên aifirstbusiness.vn)
// Luồng: viết lại câu hỏi -> AI Search (tìm lai + ưu tiên thẻ khái niệm/FAQ) -> mô hình trả lời theo System Prompt -> luồng chữ + nguồn.
//   POST /        câu hỏi từ website (giữ nguyên định dạng bản cũ: {secret, message, lang, faq, hist, page})
//   POST /debug   xem câu hỏi viết lại + tài liệu tìm được (header Authorization: Bearer <ADMIN_TOKEN>)
//   GET  /        kiểm tra tình trạng

import { systemPrompt, userMessage, MSG } from "./prompts.js";
import { rewriteQuery, searchKB, buildContext, sourceLine, faqIdsOf, loadMaps } from "./retrieve.js";
import { startStream, toClientStream } from "./generate.js";

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

// Toàn bộ bước tìm tài liệu (dùng chung cho /  và /debug)
export async function retrieve(env, { question, hist, lang, faq }) {
  const rw = await rewriteQuery(env, question, hist, lang);
  let chunks = [], searchError = null;
  try { chunks = await searchKB(env, rw.query); } catch (e) { searchError = String(e && e.message || e); }
  const { docs, best } = await buildContext(env, chunks, faq);
  return { ...rw, chunks, docs, best, searchError };
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
    const faq = (Array.isArray(body.faq) ? body.faq : []).slice(0, 3).map(String);

    // Công cụ kiểm tra cho quản trị: xem tìm được tài liệu nào
    if (req.method === "POST" && url.pathname === "/debug") {
      if (!env.ADMIN_TOKEN || req.headers.get("Authorization") !== "Bearer " + env.ADMIN_TOKEN) return json({ ok: false, error: "admin" }, 401, C.headers);
      const r = await retrieve(env, { question, hist, lang, faq });
      return json({ ok: true, rewritten: r.rewritten, query: r.query, searchError: r.searchError, best: r.best,
        chunks: r.chunks.map((c) => ({ key: c.key, score: +c.score.toFixed(3), words: c.text.split(/\s+/).length, details: c.details })),
        used: r.docs.map((d) => ({ key: d.key, label: d.label, kind: d.kind, score: d.score, preview: d.text.slice(0, 200) })),
        src: sourceLine(r.docs, lang) }, 200, C.headers);
    }

    if (req.method !== "POST" || (url.pathname !== "/" && url.pathname !== "/chat")) return json({ ok: false, error: "not-found" }, 404, C.headers);
    if (!C.ok) return json({ ok: false, error: "origin" }, 403, C.headers);
    if (!env.CHAT_SECRET || body.secret !== env.CHAT_SECRET) return json({ ok: false, error: "secret" }, 403, C.headers);
    if (!env.AI || !env.AI_SEARCH) return json({ ok: false, error: "missing-binding" }, 500, C.headers);

    const ip = req.headers.get("CF-Connecting-IP") || "0";
    if (env.CHAT_LIMITER) {
      const { success } = await env.CHAT_LIMITER.limit({ key: ip });
      if (!success) return json({ ok: true, answer: MSG[lang].busy, nf: true }, 200, C.headers);
    }

    const t0 = Date.now();
    const r = await retrieve(env, { question, hist, lang, faq });
    if (!r.docs.length) {
      console.log(JSON.stringify({ ev: "nf", q: question, rw: r.rewritten, err: r.searchError, ms: Date.now() - t0 }));
      return json({ ok: true, answer: r.searchError ? MSG[lang].err : MSG[lang].nf, nf: true, src: "" }, 200, C.headers);
    }

    const messages = [
      { role: "system", content: systemPrompt(lang) },
      { role: "user", content: userMessage({ docs: r.docs, hist, question, rewritten: r.rewritten, lang }) },
    ];
    let aiStream;
    try { aiStream = await startStream(env, messages); }
    catch (e) {
      console.log(JSON.stringify({ ev: "ai-error", err: String(e && e.message || e).slice(0, 300) }));
      return json({ ok: true, answer: MSG[lang].err, nf: true }, 200, C.headers);
    }
    const { ids } = await loadMaps(env);
    const meta = {
      src: sourceLine(r.docs, lang),
      faq: faqIdsOf(r.docs, ids),
      onDone: ({ nf, text }) => console.log(JSON.stringify({ ev: "answer", q: question, rw: r.rewritten, used: r.docs.map((d) => d.key), nf, chars: text.length, ms: Date.now() - t0 })),
    };
    return new Response(toClientStream(aiStream, meta), { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", ...C.headers } });
  },
};
