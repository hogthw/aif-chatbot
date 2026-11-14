// worker.js · Cloudflare Worker cho khung chat hai cuốn sách · FAQ 2.5.0
// Bindings (wrangler.toml): AI (Workers AI, tùy chọn), VECTORIZE (tùy chọn), MISSES (Analytics Engine, tùy chọn),
// secret ADMIN_TOKEN (chỉ cần cho /admin/reindex).
// Không gọi LLM sinh văn bản: mọi câu trả lời là thẻ đã biên tập trong FAQ hoặc KB chương.

import faqAE from "./data/faq_ai_economy.json";
import faqAFB from "./data/faq_ai_first_business.json";
import kbAE from "./data/kb_aiec.json";
import kbAFB from "./data/kb_aifb.json";
import { route, routeWithSemantic, byId, kbById, fold } from "./router.mjs";

const BOOKS = {
  ai_economy: { faq: faqAE, kb: kbAE },
  ai_first_business: { faq: faqAFB, kb: kbAFB },
};
const ALIAS_ID = { aiec: "ai_economy", aifb: "ai_first_business" };

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/api/chat") return chat(request, env, ctx);
    if (request.method === "POST" && url.pathname === "/admin/reindex") return reindex(request, env);
    return json({ error: "not_found" }, 404);
  },
};

async function chat(request, env, ctx) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad_json" }, 400); }
  const bookId = ALIAS_ID[body.book_id] ?? body.book_id;
  const book = BOOKS[bookId];                                   // allowlist: chỉ hai cuốn
  if (!book) return json({ error: "unknown_book" }, 400);
  const { faq, kb } = book;

  if (body.faq_id) {                                            // nút gợi ý / nút lựa chọn
    const r = byId(String(body.faq_id), faq);
    return r ? json({ book_id: bookId, version: faq.version, results: [r] }) : json({ error: "unknown_faq" }, 404);
  }
  if (body.kb_id) {
    const r = kbById(String(body.kb_id), kb);
    return r ? json({ book_id: bookId, version: faq.version, results: [r] }) : json({ error: "unknown_kb" }, 404);
  }
  const question = String(body.question ?? "").slice(0, 500);
  if (!fold(question)) return json({ book_id: bookId, version: faq.version, results: [byId("clarify", faq)] });

  const out = await routeWithSemantic(question, faq, kb, env);
  out.request_id = body.request_id ?? null;                    // widget dùng để bỏ phản hồi đến muộn

  // Ghi câu chưa khớp để biên tập bổ sung alias hằng tuần (không ghi thông tin định danh).
  const r0 = out.results[0];
  if (env.MISSES && ["no_match", "topic_not_found", "choices"].includes(r0.type)) {
    ctx.waitUntil(Promise.resolve(env.MISSES.writeDataPoint({
      blobs: [bookId, maskPersonal(question).slice(0, 300), r0.type, r0.match ?? ""], indexes: [bookId],
    })));
  }
  return json(out);
}

function maskPersonal(text) {
  return text.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]").replace(/(\+?\d[\d .-]{7,}\d)/g, "[số]");
}

// POST /admin/reindex  (Authorization: Bearer <ADMIN_TOKEN>) — nhúng lại FAQ + KB vào Vectorize.
async function reindex(request, env) {
  if (!env.ADMIN_TOKEN || request.headers.get("authorization") !== "Bearer " + env.ADMIN_TOKEN) return json({ error: "forbidden" }, 403);
  if (!env.AI || !env.VECTORIZE) return json({ error: "missing_bindings" }, 400);
  const items = [];
  for (const [bookId, { faq, kb }] of Object.entries(BOOKS)) {
    for (const c of faq.cards) {
      if (["clarify", "buy_fallback", "greeting", "thanks", "out_of_scope"].includes(c.id)) continue;
      const texts = [...new Set([c.question, ...(c.aliases ?? [])].filter(Boolean))].slice(0, 12);
      texts.forEach((t, i) => items.push({ id: `${bookId}:f:${c.id}:${i}`.slice(0, 64), ns: bookId, text: t, kind: "faq", ref: c.id }));
    }
    for (const c of kb.cards) {
      const texts = [c.question, c.heading_alias].filter(Boolean);
      texts.forEach((t, i) => items.push({ id: `${bookId}:k:${c.id}:${i}`.slice(0, 64), ns: bookId, text: t, kind: "kb", ref: c.id }));
    }
  }
  let done = 0;
  for (let i = 0; i < items.length; i += 50) {
    const batch = items.slice(i, i + 50);
    const emb = await env.AI.run("@cf/baai/bge-m3", { text: batch.map(x => x.text) });
    await env.VECTORIZE.upsert(batch.map((x, j) => ({
      id: x.id, values: emb.data[j], namespace: x.ns, metadata: { kind: x.kind, ref: x.ref, book_id: x.ns },
    })));
    done += batch.length;
  }
  return json({ ok: true, vectors: done, version: faqAE.version });
}
