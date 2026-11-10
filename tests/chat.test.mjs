import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import worker from "../workers/aif-kb-chat/src/index.js";
import { _resetMaps, sourceLine, kindOf } from "../workers/aif-kb-chat/src/retrieve.js";
import { MemR2, MemKV, limiter, readSSE, sseStream } from "./helpers.mjs";
import { loadKB, mockSearch } from "./kbsearch.mjs";

const KB = loadKB(new URL("../kb/AIF-KB", import.meta.url).pathname);
const ORIGIN = "https://aifirstbusiness.vn";

async function makeEnv(over = {}) {
  const r2 = new MemR2(), kv = new MemKV();
  const labels = {}, ids = {};
  for (const d of KB) {
    await r2.put(d.key, new TextEncoder().encode(d.text));
    const m = /^Nguồn:\s*(.+)$/m.exec(d.text); labels[d.key] = m ? m[1] : d.key;
    const f = /faq-0*(\d+)/.exec(d.key); if (f) ids[f[1]] = d.key;
    const w = /\/(w\d+)-/.exec(d.key); if (w) ids[w[1].toUpperCase()] = d.key;
  }
  await kv.put("kb:labels", JSON.stringify(labels)); await kv.put("kb:ids", JSON.stringify(ids));
  const calls = { ai: [], search: [] };
  const env = {
    AI_SEARCH_INSTANCE: "aif-kb", ALLOWED_ORIGINS: "https://aifirstbusiness.vn,https://www.aifirstbusiness.vn", ALLOWED_ORIGIN_SUFFIXES: ".trantansy.workers.dev", CHAT_SECRET: "sec",
    MODEL: "m-main", FALLBACK_MODEL: "m-fb", REWRITE: "1", REWRITE_MODEL: "m-rw", REWRITE_TIMEOUT_MS: "500",
    MAX_RESULTS: "12", MATCH_THRESHOLD: "0.3", MAX_DOCS: "7", MAX_CONTEXT_WORDS: "2400", RELATIVE_CUTOFF: "0.45", ADMIN_TOKEN: "adm",
    KB_BUCKET: r2, KB_STATE: kv, AI_SEARCH: mockSearch(KB, calls.search),
    AI: { async run(model, opts) {
      calls.ai.push({ model, opts });
      if (model === "m-rw") return { response: "AI First Business là gì? | Mô hình 3A" };
      return sseStream(env._answer || ["AI First Business ", "là doanh nghiệp ", "đặt AI vào trung tâm."]);
    } },
    ...over,
  };
  env._calls = calls;
  return env;
}
const ask = (env, body, headers = {}) => worker.fetch(new Request("https://w.dev/", { method: "POST", headers: { Origin: ORIGIN, "Content-Type": "text/plain", ...headers }, body: JSON.stringify({ secret: "sec", lang: "vi", faq: [], hist: [], page: "/", ...body }) }), env);

beforeEach(() => _resetMaps());

test("GET / báo tình trạng", async () => {
  const env = await makeEnv();
  const j = await (await worker.fetch(new Request("https://w.dev/"), env)).json();
  assert.equal(j.ok, true); assert.equal(j.search, true); assert.ok(j.kb_files > 100);
});

test("CORS: preflight và chặn origin lạ, sai secret", async () => {
  const env = await makeEnv();
  const pre = await worker.fetch(new Request("https://w.dev/", { method: "OPTIONS", headers: { Origin: ORIGIN } }), env);
  assert.equal(pre.status, 204); assert.equal(pre.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.equal((await ask(env, { message: "AI First là gì" }, { Origin: "https://evil.com" })).status, 403);
  assert.equal((await ask(env, { message: "AI First là gì", secret: "x" })).status, 403);
  const pv = await worker.fetch(new Request("https://w.dev/", { method: "OPTIONS", headers: { Origin: "https://aifirstbusiness-website.trantansy.workers.dev" } }), env);
  assert.equal(pv.headers.get("Access-Control-Allow-Origin"), "https://aifirstbusiness-website.trantansy.workers.dev");
});

test("trả lời dạng luồng đúng định dạng chat.js, có nguồn tên sách + mục", async () => {
  const env = await makeEnv();
  const res = await ask(env, { message: "AI First Business là gì?" });
  assert.match(res.headers.get("Content-Type"), /event-stream/);
  const ev = await readSSE(res);
  const last = ev.at(-1);
  assert.equal(ev.slice(0, -1).map((e) => e.t).join(""), "AI First Business là doanh nghiệp đặt AI vào trung tâm.");
  assert.equal(last.done, true); assert.equal(last.nf, false);
  assert.match(last.src, /AI First Business \((mục|chương)/);
  assert.ok(!/faq-|\.md/.test(last.src), "nguồn không lộ tên tệp");
  const main = env._calls.ai.find((c) => c.model === "m-main");
  assert.equal(main.opts.stream, true);
  assert.match(main.opts.messages[1].content, /TÀI LIỆU:\n\[1\]/);
  assert.ok(!/^Nguồn:/m.test(main.opts.messages[1].content), "bỏ dòng Nguồn khỏi ngữ cảnh");
  assert.ok(env._calls.search[0].opts.query.includes("Mô hình 3A"));
});

test("ký hiệu [NF] bị cắt giữa hai mảnh vẫn được ẩn, nf=true, không ghi nguồn", async () => {
  const env = await makeEnv();
  env._answer = ["Sách chưa đề cập nội dung này. [", "NF]"];
  const ev = await readSSE(await ask(env, { message: "AI First Business có nói về giá vàng?" }));
  const text = ev.filter((e) => e.t).map((e) => e.t).join("");
  assert.ok(!text.includes("[")); assert.equal(ev.at(-1).nf, true); assert.equal(ev.at(-1).src, "");
});

test("định dạng luồng OpenAI (choices.delta) cũng đọc được", async () => {
  const env = await makeEnv();
  env.AI.run = async (model) => model === "m-rw" ? { response: "x" } : sseStream(["Xin ", "chào"], "openai");
  const ev = await readSSE(await ask(env, { message: "AI First Business là gì?" }));
  assert.equal(ev.filter((e) => e.t).map((e) => e.t).join(""), "Xin chào");
});

test("không tìm thấy tài liệu -> JSON nf, không gọi mô hình trả lời", async () => {
  const env = await makeEnv({ REWRITE: "0" });
  const j = await (await ask(env, { message: "zzzz qqqq xxxx" })).json();
  assert.equal(j.nf, true); assert.match(j.answer, /chưa có nội dung/);
  assert.equal(env._calls.ai.length, 0);
});

test("FAQ khách đã chọn luôn được đưa vào đầu ngữ cảnh", async () => {
  const env = await makeEnv({ REWRITE: "0" });
  const ev = await readSSE(await ask(env, { message: "Làm sao nhận biết chuyển đổi AI thực chất", faq: ["12"] }));
  const msg = env._calls.ai.find((c) => c.model === "m-main").opts.messages[1].content;
  assert.match(msg, /\[1\] FAQ — AI First Business, mục 11\.3/);
  assert.ok(ev.at(-1).faq.includes(12));
});

test("mô hình chính lỗi -> dùng mô hình dự phòng", async () => {
  const env = await makeEnv({ REWRITE: "0" });
  const run = env.AI.run;
  env.AI.run = async (model, o) => { if (model === "m-main") throw new Error("down"); return run(model, o); };
  const ev = await readSSE(await ask(env, { message: "AI First Business là gì?" }));
  assert.equal(ev.at(-1).done, true);
  assert.ok(env._calls.ai.some((c) => c.model === "m-fb"));
});

test("viết lại câu hỏi quá thời gian -> vẫn tìm bằng câu gốc", async () => {
  const env = await makeEnv({ REWRITE_TIMEOUT_MS: "50" });
  const run = env.AI.run;
  env.AI.run = async (model, o) => model === "m-rw" ? new Promise(() => {}) : run(model, o);
  const ev = await readSSE(await ask(env, { message: "AI First Business là gì?" }));
  assert.equal(ev.at(-1).done, true);
});

test("giới hạn tần suất -> thông báo bận", async () => {
  const env = await makeEnv({ CHAT_LIMITER: limiter(1) });
  await (await ask(env, { message: "AI First Business là gì?" })).text();
  const j = await (await ask(env, { message: "AI First Business là gì?" })).json();
  assert.match(j.answer, /nhiều câu hỏi/);
});

test("/debug cần ADMIN_TOKEN và trả về tài liệu đã dùng", async () => {
  const env = await makeEnv({ REWRITE: "0" });
  const bad = await worker.fetch(new Request("https://w.dev/debug", { method: "POST", body: JSON.stringify({ message: "ROI hai tầng" }) }), env);
  assert.equal(bad.status, 401);
  const j = await (await worker.fetch(new Request("https://w.dev/debug", { method: "POST", headers: { Authorization: "Bearer adm" }, body: JSON.stringify({ message: "ROI hai tầng là gì" }) }), env)).json();
  assert.ok(j.used.length > 0 && j.used.length <= 7); assert.ok(j.src);
});

test("nguồn dịch sang tiếng Anh/Trung; phân loại thư mục", () => {
  const docs = [{ label: "AI First Business, mục 4.4 và 12.6; Nền Kinh tế Trí tuệ, chương 8" }, { label: "AI First Business, mục 2.2" }, { label: "AI First Business, mục 2.2" }, { label: "Website aifirstbusiness.vn" }];
  assert.equal(sourceLine(docs, "vi"), "AI First Business (mục 4.4 và 12.6; mục 2.2); Nền Kinh tế Trí tuệ (chương 8)");
  assert.equal(sourceLine(docs, "en"), "AI First Business (section 4.4 and 12.6; section 2.2); AI Economy (chapter 8)");
  assert.equal(kindOf("01-the-khai-niem/3a.md").kind, "concept");
  assert.equal(kindOf("02-faq/faq-001.md").kind, "faq");
  assert.equal(kindOf("03-sach/ai-first-business/4.4.md").kind, "book");
  assert.equal(kindOf("04-website/w1.md").kind, "web");
  assert.equal(kindOf("05-tai-lieu-khac/bao-gia.pdf").kind, "doc");
});

test("CORS: không nhận workers.dev của tài khoản khác", async () => {
  const env = await makeEnv();
  assert.equal((await ask(env, { message: "AI First là gì" }, { Origin: "https://aifirstbusiness-x.attacker.workers.dev" })).status, 403);
});
