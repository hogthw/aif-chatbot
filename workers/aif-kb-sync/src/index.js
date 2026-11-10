// aif-kb-sync · đồng bộ Knowledge Base từ Google Drive sang R2 (AI Search đọc R2 để đánh chỉ mục)
//   - Tự chạy theo lịch (cron trong wrangler.jsonc)
//   - Chạy tay:   POST /sync          (header Authorization: Bearer <SYNC_TOKEN>)
//                 POST /sync?dry=1    (chỉ xem sẽ thay đổi gì, không ghi)
//                 POST /sync?force=1  (tải lại toàn bộ)
//   - Xem kết quả: GET /status        (cùng header)

import { runSync } from "./sync.js";

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
function authorized(req, env) {
  const h = req.headers.get("Authorization") || "";
  return !!env.SYNC_TOKEN && h === "Bearer " + env.SYNC_TOKEN;
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runSync(env).catch(async (e) => {
      await env.KB_STATE.put("sync:last", JSON.stringify({ started: new Date().toISOString(), fatal: String(e && e.message || e) }));
    }));
  },

  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/" ) return json({ ok: true, service: "aif-kb-sync", hint: "POST /sync hoặc GET /status kèm Authorization: Bearer <SYNC_TOKEN>" });
    if (!authorized(req, env)) return json({ ok: false, error: "Thiếu hoặc sai SYNC_TOKEN" }, 401);
    if (url.pathname === "/status" && req.method === "GET") {
      const last = JSON.parse((await env.KB_STATE.get("sync:last")) || "null");
      const labels = JSON.parse((await env.KB_STATE.get("kb:labels")) || "{}");
      return json({ ok: true, last, files: Object.keys(labels).length, labels });
    }
    if (url.pathname === "/sync" && req.method === "POST") {
      try {
        const r = await runSync(env, { dry: url.searchParams.get("dry") === "1", force: url.searchParams.get("force") === "1" });
        return json({ ok: true, ...r });
      } catch (e) {
        return json({ ok: false, error: String(e && e.message || e) }, 500);
      }
    }
    return json({ ok: false, error: "Không có đường dẫn này" }, 404);
  },
};
