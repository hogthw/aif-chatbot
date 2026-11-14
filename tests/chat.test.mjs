import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import worker, { isConsultationRequest } from "../workers/aif-kb-chat/src/index.js";
import { _resetMaps, isFollowUpQuestion, sourceLine, kindOf } from "../workers/aif-kb-chat/src/retrieve.js";
import { REWRITE_PROMPT, systemPrompt } from "../workers/aif-kb-chat/src/prompts.js";
import { MemR2, MemKV, limiter, readSSE, sseStream } from "./helpers.mjs";
import { loadKB, mockSearch } from "./kbsearch.mjs";

const KB = loadKB(fileURLToPath(new URL("../kb/AIF-KB", import.meta.url)));
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
      if (model === "m-rw") return { response: env._rewriteResponse || "AI First Business là gì? | Mô hình 3A" };
      return sseStream(env._answer || ["AI First Business ", "là doanh nghiệp ", "đặt AI vào trung tâm."]);
    } },
    ...over,
  };
  env._calls = calls;
  return env;
}
const ask = (env, body, headers = {}) => worker.fetch(new Request("https://w.dev/", { method: "POST", headers: { Origin: ORIGIN, "Content-Type": "text/plain", ...headers }, body: JSON.stringify({ secret: "sec", lang: "vi", faq: [], hist: [], page: "/", book_id: "aifb", ...body }) }), env);

async function useQaSearch(env, qaKey, qaData, bookChunks) {
  await env.KB_BUCKET.put(qaKey, new TextEncoder().encode(JSON.stringify(qaData)));
  env.AI_SEARCH = {
    get: () => ({
      async search(opts) {
        env._calls.search.push({ name: "aif-kb", opts });
        const folder = opts.ai_search_options?.retrieval?.filters?.folder;
        if (folder?.$gte?.startsWith("02-faq/book-qa/")) {
          return qaKey.startsWith(folder.$gte)
            ? { chunks: [{ key: qaKey, text: "indexed QA question only", score: 0.9 }] }
            : { chunks: [] };
        }
        return { chunks: bookChunks.filter((chunk) => chunk.key.startsWith(folder?.$gte || "")) };
      },
    }),
  };
}

beforeEach(() => _resetMaps());

test("prompt yêu cầu câu trả lời rõ ràng, trực tiếp và đủ ý", () => {
  const prompt = systemPrompt("vi");
  assert.match(prompt, /Mở đầu bằng câu trả lời hoặc kết luận chính/);
  assert.match(prompt, /Nếu câu hỏi hỏi cách làm, trình bày các bước theo thứ tự/);
  assert.match(prompt, /60–100 từ/);
  assert.match(prompt, /tối đa 120 từ/);
  assert.match(prompt, /hai cách hiểu trở lên/);
  assert.match(prompt, /Mô hình 3A là Adopt \(Ứng dụng\), Adapt \(Thích ứng\) và Advance \(Làm chủ\)/);
  assert.match(prompt, /Nếu câu hỏi yêu cầu liệt kê thành phần, chỉ nêu tên được ghi rõ/);
  assert.match(REWRITE_PROMPT, /không viết lại thành Awareness - Augmentation - Autonomy/);
  assert.match(prompt, /Mọi dữ kiện phải có trong các đoạn trích của cuốn sách duy nhất/);
});

test("chỉ dùng lịch sử khi câu mới có tham chiếu tiếp nối rõ ràng", () => {
  assert.equal(isFollowUpQuestion("tôi đang sống như thế nào trong thời đại AI"), false);
  assert.equal(isFollowUpQuestion("Còn chi phí của cách đó thì sao?"), true);
  assert.equal(isFollowUpQuestion("What about that approach?"), true);
});

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

test("secret CHAT_CLIENT_TOKEN hiện có được chấp nhận nếu CHAT_SECRET chưa đặt", async () => {
  const env = await makeEnv({ CHAT_SECRET: "", CHAT_CLIENT_TOKEN: "sec", REWRITE: "0" });
  const res = await ask(env, { message: "AI First Business là gì?" });
  assert.match(res.headers.get("Content-Type"), /event-stream/);
});

test("trả lời dạng luồng đúng định dạng chat.js, có nguồn một cuốn sách", async () => {
  const env = await makeEnv();
  const res = await ask(env, { message: "AI First Business là gì?" });
  assert.match(res.headers.get("Content-Type"), /event-stream/);
  const ev = await readSSE(res);
  const last = ev.at(-1);
  assert.equal(ev.slice(0, -1).map((e) => e.t).join(""), "AI First Business là doanh nghiệp đặt AI vào trung tâm.");
  assert.equal(last.done, true); assert.equal(last.nf, false);
  assert.match(last.src, /^AI First Business(?: \(|$)/);
  assert.doesNotMatch(last.src, /Nền Kinh tế Trí tuệ/);
  assert.ok(!/faq-|\.md/.test(last.src), "nguồn không lộ tên tệp");
  const main = env._calls.ai.find((c) => c.model === "m-main");
  assert.equal(main.opts.stream, true);
  assert.match(main.opts.messages[1].content, /TÀI LIỆU:\n\[1\]/);
  assert.ok(!/^Nguồn:/m.test(main.opts.messages[1].content), "bỏ dòng Nguồn khỏi ngữ cảnh");
  assert.equal(env._calls.search.at(-1).opts.query, "AI First Business là gì?");
  assert.deepEqual(env._calls.search.at(-1).opts.ai_search_options.retrieval.filters, {
    folder: { $gte: "03-sach/ai-first-business/", $lt: "03-sach/ai-first-business0" },
  });
});

test("yêu cầu chọn sách và từ chối book_id không hợp lệ", async () => {
  const env = await makeEnv();
  const missing = await ask(env, { message: "Mô hình 3A là gì?", book_id: "" });
  assert.equal(missing.status, 400);
  assert.equal((await missing.json()).error, "book-required");
  const invalid = await ask(env, { message: "Mô hình 3A là gì?", book_id: "unknown" });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error, "book-required");
});

test("nhận diện nhu cầu tư vấn thực tế nhưng không nhầm câu hỏi định nghĩa", async () => {
  assert.equal(isConsultationRequest("Công ty tôi muốn được tư vấn triển khai AI"), true);
  assert.equal(isConsultationRequest("Tôi muốn đặt lịch tư vấn chuyển đổi AI"), true);
  assert.equal(isConsultationRequest("Tư vấn chuyển đổi AI là gì?"), false);
  assert.equal(isConsultationRequest("Tôi chưa cần tư vấn, chỉ muốn đọc thêm."), false);
  assert.equal(isConsultationRequest("What is AI consulting?"), false);

  const env = await makeEnv();
  const response = await ask(env, { message: "Công ty tôi muốn được tư vấn triển khai AI" });
  const result = await response.json();
  assert.equal(result.ok, true);
  assert.equal(result.actions.length, 2);
  assert.deepEqual(result.actions.map((action) => action.href), ["/lien-he/#form", "/danh-gia/ear-index/"]);
  assert.equal(env._calls.ai.length, 0);
  assert.equal(env._calls.search.length, 0);
});

test("câu hỏi chung về mô hình AI được làm rõ thay vì bịa cách mở rộng 3A", async () => {
  const env = await makeEnv();
  const aifb = await (await ask(env, {
    message: "mô hình AI cần ứng dụng trong doanh nghiệp",
    book_id: "aifb",
  })).json();
  assert.equal(aifb.clarification, true);
  assert.match(aifb.answer, /Adopt, Adapt, Advance/);
  assert.match(aifb.answer, /AI-Native/);

  const aiec = await (await ask(env, {
    message: "mô hình AI cần ứng dụng trong doanh nghiệp",
    book_id: "aiec",
  })).json();
  assert.equal(aiec.clarification, true);
  assert.match(aiec.answer, /chín tầng/);
  assert.doesNotMatch(aiec.answer, /AI First Business|3A/);
  assert.equal(env._calls.ai.length, 0);
  assert.equal(env._calls.search.length, 0);
});

test("book_id aiec giới hạn cả QA và truy xuất vào Nền Kinh tế Trí tuệ", async () => {
  const env = await makeEnv();
  const calls = [];
  env.AI_SEARCH = {
    get: () => ({
      async search(opts) {
        const folder = opts.ai_search_options?.retrieval?.filters?.folder;
        calls.push(folder);
        if (folder?.$gte?.startsWith("02-faq/book-qa/")) return { chunks: [] };
        return { chunks: [{
          key: "03-sach/nen-kinh-te-tri-tue/ch08.md",
          text: "Nguồn: Nền Kinh tế Trí tuệ, mục 8.5\nNội dung về nhân lực và hệ sinh thái nhân tài.",
          score: 0.9,
        }] };
      },
    }),
  };
  const res = await ask(env, { book_id: "aiec", message: "Nhân lực và hệ sinh thái nhân tài" });
  assert.match(res.headers.get("Content-Type"), /event-stream/);
  assert.deepEqual(calls, [
    { $gte: "02-faq/book-qa/aiec/", $lt: "02-faq/book-qa/aiec0" },
    { $gte: "03-sach/nen-kinh-te-tri-tue/", $lt: "03-sach/nen-kinh-te-tri-tue0" },
  ]);
  const events = await readSSE(res);
  assert.match(events.at(-1).src, /Nền Kinh tế Trí tuệ/);
  assert.doesNotMatch(events.at(-1).src, /AI First Business/);
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

test("câu trả lời tiếng Việt lọc chữ Hán bị lẫn nhưng tiếng Trung vẫn giữ nguyên", async () => {
  const env = await makeEnv();
  env._answer = ["Bản demo gây ấn tượng chỉ tập trung vào việc 展", "示 công nghệ."];
  const viEvents = await readSSE(await ask(env, { message: "Làm sao phân biệt demo với thử nghiệm AI tạo giá trị?" }));
  const viAnswer = viEvents.filter((event) => event.t).map((event) => event.t).join("");
  assert.doesNotMatch(viAnswer, /[\u3400-\u4DBF\u4E00-\u9FFF]/);
  assert.match(viAnswer, /Bản demo gây ấn tượng/);
  assert.match(viAnswer, /công nghệ\./);
  assert.doesNotMatch(env._calls.ai.find((call) => call.model === "m-main").opts.messages[0].content, /展示/);

  const zhEnv = await makeEnv();
  zhEnv._answer = ["展示"];
  const zhEvents = await readSSE(await ask(zhEnv, { message: "測試", lang: "zh" }));
  assert.equal(zhEvents.filter((event) => event.t).map((event) => event.t).join(""), "展示");
});

test("không tìm thấy tài liệu -> JSON nf, không gọi mô hình trả lời", async () => {
  const env = await makeEnv({ REWRITE: "0" });
  const j = await (await ask(env, { message: "zzzz qqqq xxxx" })).json();
  assert.equal(j.nf, true); assert.match(j.answer, /chưa có nội dung/);
  assert.equal(env._calls.ai.length, 0);
});

test("chỉ dùng một cuốn sách; bỏ qua FAQ, thẻ khái niệm và cuốn còn lại", async () => {
  const env = await makeEnv({ REWRITE: "0" });
  const chunks = [
    { key: "02-faq/faq-012.md", text: "Nguồn: AI First Business, mục 11.3\nCâu trả lời FAQ.", score: 1 },
    { key: "01-the-khai-niem/3a.md", text: "Thẻ khái niệm tổng hợp.", score: 0.95 },
    { key: "03-sach/ai-first-business/11-3.md", text: "Nguồn: AI First Business, mục 11.3\nNội dung cuốn AI First Business.", score: 0.8 },
    { key: "03-sach/nen-kinh-te-tri-tue/8-1.md", text: "Nguồn: Nền Kinh tế Trí tuệ, mục 8.1\nNội dung cuốn Nền Kinh tế Trí tuệ.", score: 0.7 },
    { key: "03-sach/ai-first-business/11-4.md", text: "Nguồn: AI First Business, mục 11.4\nNội dung bổ sung của AI First Business.", score: 0.5 },
  ];
  env.AI_SEARCH = { get: () => ({ search: async () => ({ chunks }) }) };
  const ev = await readSSE(await ask(env, { message: "Làm sao nhận biết chuyển đổi AI thực chất", faq: ["12"] }));
  const msg = env._calls.ai.find((c) => c.model === "m-main").opts.messages[1].content;
  assert.match(msg, /CUỐN SÁCH DUY NHẤT ĐƯỢC PHÉP DÙNG: AI First Business/);
  assert.match(msg, /Nội dung cuốn AI First Business/);
  assert.match(msg, /Nội dung bổ sung của AI First Business/);
  assert.doesNotMatch(msg, /FAQ|Thẻ khái niệm|Nền Kinh tế Trí tuệ/);
  assert.equal(ev.at(-1).src, "AI First Business (mục 11.3; mục 11.4)");
  assert.deepEqual(ev.at(-1).faq, []);
});

test("đoạn sách đánh số chương vẫn được nhận diện là nội dung sách; QA không liên quan không làm lệch truy vấn", async () => {
  const question = "Sáu khóa an toàn bắt buộc cho mọi Tác nhân AI gồm những khóa nào?";
  const env = await makeEnv();
  env._rewriteResponse = "Sáu khóa an toàn Mô hình 3A | Mô hình 3A";
  env._answer = ["Ranh giới nhiệm vụ, quyền tối thiểu, phê duyệt của con người, hạn mức vận hành, giám sát và ngắt khẩn cấp, kiểm thử đối kháng."];
  await useQaSearch(env, "02-faq/book-qa/aifb/ch02.json", {
    book_id: "aifb",
    title: "AI First Business",
    cards: [{
      question: "Mô hình 3A gồm gì và có phải đi theo thứ tự không?",
      answer: "QA không liên quan.",
      aliases: ["mô hình 3A"],
      source_ids: ["aifb-section-2.2"],
    }],
    sources: { "aifb-section-2.2": { kind: "section", number: "2.2", title: "Ba nấc chiến lược Adopt Adapt Advance" } },
  }, [
    {
      key: "03-sach/ai-first-business/05-5-6-sau-khoa-an-toan-bat-buoc-cho-moi-tac-nhan-ai-p1.md",
      text: "Nguồn: AI First Business, mục 5.6\nKhóa 1: Ranh giới nhiệm vụ. Khóa 2: Quyền tối thiểu. Khóa 3: Phê duyệt của con người.",
      score: 0.9,
    },
    {
      key: "03-sach/ai-first-business/05-5-6-sau-khoa-an-toan-bat-buoc-cho-moi-tac-nhan-ai-p2.md",
      text: "Nguồn: AI First Business, mục 5.6\nKhóa 4: Hạn mức vận hành. Khóa 5: Giám sát và ngắt khẩn cấp. Khóa 6: Kiểm thử đối kháng.",
      score: 0.85,
    },
  ]);

  const events = await readSSE(await ask(env, { message: question }));
  const prompt = env._calls.ai.find((call) => call.model === "m-main").opts.messages[1].content;
  assert.match(prompt, /Khóa 1: Ranh giới nhiệm vụ/);
  assert.match(prompt, /Khóa 6: Kiểm thử đối kháng/);
  assert.doesNotMatch(prompt, /Mô hình 3A|QA không liên quan/);
  assert.equal(env._calls.search.at(-1).opts.query, question);
  const answer = events.map((event) => event.t || "").join("");
  assert.ok(answer.includes("Ranh giới nhiệm vụ") && answer.toLowerCase().includes("kiểm thử đối kháng"));
  assert.equal(events.at(-1).src, "AI First Business (mục 5.6)");
  assert.equal(kindOf("03-sach/ai-first-business/01-1-2-example.md").kind, "book");
  assert.equal(kindOf("03-sach/ai-first-business/02-2-1-example.md").kind, "book");
});

test("không tìm thấy đoạn sách thì không dùng FAQ để trả lời", async () => {
  const env = await makeEnv({ REWRITE: "0" });
  env.AI_SEARCH = { get: () => ({ search: async () => ({ chunks: [
    { key: "02-faq/faq-012.md", text: "FAQ có nội dung liên quan.", score: 0.9 },
  ] }) }) };
  const res = await ask(env, { message: "Câu hỏi theo FAQ", faq: ["12"] });
  const j = await res.json();
  assert.equal(j.nf, true);
  assert.equal(env._calls.ai.length, 0);
});

test("thẻ JSON định tuyến đúng sách/mục nhưng không đưa câu trả lời thẻ vào prompt", async () => {
  const env = await makeEnv({ REWRITE: "0" });
  const qaKey = "02-faq/book-qa/aifb/ch01.json";
  await useQaSearch(env, qaKey, {
    book_id: "aifb",
    cards: [{
      question: "Bốn vị thế chiến lược của doanh nghiệp là gì?",
      answer: "DRAFT_ANSWER_MUST_NOT_REACH_MODEL",
      aliases: ["bốn vị thế"],
      source_ids: ["aifb-section-1.3"],
    }],
    sources: { "aifb-section-1.3": { title: "Bốn vị thế chiến lược của doanh nghiệp trong hệ sinh thái AI" } },
  }, [
    { key: "03-sach/ai-first-business/ch01.md", text: "Nguồn: AI First Business, mục 1.3\nNội dung đoạn sách về bốn vị thế chiến lược.", score: 0.9 },
    { key: "03-sach/nen-kinh-te-tri-tue/ch01.md", text: "Đoạn sách thuộc cuốn khác.", score: 0.99 },
  ]);
  const ev = await readSSE(await ask(env, { message: "Doanh nghiệp có những vị thế chiến lược nào?" }));
  const prompt = env._calls.ai.find((call) => call.model === "m-main").opts.messages[1].content;
  assert.match(prompt, /CUỐN SÁCH DUY NHẤT ĐƯỢC PHÉP DÙNG: AI First Business/);
  assert.match(prompt, /Nội dung đoạn sách về bốn vị thế chiến lược/);
  assert.doesNotMatch(prompt, /DRAFT_ANSWER_MUST_NOT_REACH_MODEL|Bốn vị thế chiến lược của doanh nghiệp trong hệ sinh thái AI/);
  assert.deepEqual(env._calls.search[0].opts.ai_search_options.retrieval.filters, {
    folder: { $gte: "02-faq/book-qa/aifb/", $lt: "02-faq/book-qa/aifb0" },
  });
  assert.deepEqual(env._calls.search.at(-1).opts.ai_search_options.retrieval.filters, {
    folder: { $gte: "03-sach/ai-first-business/", $lt: "03-sach/ai-first-business0" },
  });
  assert.ok(env._calls.search.at(-1).opts.query.includes("Bốn vị thế chiến lược của doanh nghiệp trong hệ sinh thái AI"));
  assert.equal(ev.at(-1).src, "AI First Business (mục 1.3)");
});

test("câu hỏi khớp chính xác QA trả đáp án đã duyệt, không gọi model", async () => {
  const env = await makeEnv({ REWRITE: "1" });
  const qaKey = "02-faq/book-qa/aifb/ch01.json";
  await useQaSearch(env, qaKey, {
    book_id: "aifb",
    title: "AI First Business",
    cards: [{
      question: "Lợi thế cạnh tranh của doanh nghiệp dịch chuyển như thế nào?",
      answer: "Câu trả lời QA đã duyệt.",
      aliases: ["lợi thế cạnh tranh AI"],
      source_ids: ["aifb-section-1.2"],
    }],
    sources: { "aifb-section-1.2": { kind: "section", number: "1.2", title: "Lợi thế cạnh tranh không biến mất" } },
  }, []);
  const events = await readSSE(await ask(env, {
    message: "LOI THE CANH TRANH CUA DOANH NGHIEP DICH CHUYEN NHU THE NAO!!!",
  }));
  assert.equal(events.filter((event) => event.t).map((event) => event.t).join(""), "Câu trả lời QA đã duyệt.");
  assert.equal(events.at(-1).src, "AI First Business (mục 1.2)");
  assert.equal(events.at(-1).nf, false);
  assert.equal(env._calls.ai.length, 0, "exact QA answer must bypass both rewrite and generation models");
  assert.equal(env._calls.search.length, 1, "only the QA lookup should run");
});

test("câu hỏi theo tiêu đề mục hoặc tên viết tắt trả lời bằng QA đã duyệt", async () => {
  const env = await makeEnv({ REWRITE: "1" });
  const qaKey = "02-faq/book-qa/aifb/ch02.json";
  await useQaSearch(env, qaKey, {
    book_id: "aifb",
    title: "AI First Business",
    cards: [{
      id: "aifb-qa-002",
      question: "Mô hình 3A gồm gì và có phải đi theo thứ tự không?",
      answer: "Adopt (Ứng dụng), Adapt (Thích ứng) và Advance (Làm chủ) là ba lựa chọn mức tham gia cho từng sáng kiến. Doanh nghiệp chọn mức phù hợp với bài toán và khả năng quản trị của mình.",
      aliases: ["3A", "adopt adapt advance"],
      source_ids: ["aifb-section-2.2"],
    }],
    sources: {
      "aifb-section-2.2": { kind: "section", number: "2.2", title: "Ba nấc chiến lược: Adopt – Adapt – Advance" },
    },
  }, []);
  for (const question of ["mô hình ba nấc chiến lược", "mô hình 3A là gì"]) {
    const events = await readSSE(await ask(env, { message: question }));
    const answer = events.filter((event) => event.t).map((event) => event.t).join("");
    assert.match(answer, /Adopt \(Ứng dụng\), Adapt \(Thích ứng\) và Advance \(Làm chủ\)/);
    assert.doesNotMatch(answer, /Xác định mục tiêu|Triển khai dự án|Đánh giá và điều chỉnh/);
    assert.equal(events.at(-1).src, "AI First Business (mục 2.2)");
  }
  assert.equal(env._calls.ai.length, 0, "heading- and acronym-matched QA should bypass rewrite and generation");
});

test("câu hỏi diễn đạt lại cụm khóa sách tìm QA mục 5.6 trong FULL khi Search lệch", async () => {
  const env = await makeEnv();
  const qaKey = "02-faq/book-qa/aifb/ch02.json";
  await useQaSearch(env, qaKey, {
    book_id: "aifb",
    title: "AI First Business",
    cards: [{
      question: "Mô hình 3A gồm gì và có phải đi theo thứ tự không?",
      answer: "QA không liên quan.",
      aliases: ["mô hình 3A"],
      source_ids: ["aifb-section-2.2"],
    }],
    sources: { "aifb-section-2.2": { kind: "section", number: "2.2", title: "Ba nấc chiến lược Adopt Adapt Advance" } },
  }, []);
  const fullKey = "02-faq/book-qa/aifb/AIFB_AI_First_Business_FULL.json";
  await env.KB_BUCKET.put(fullKey, new TextEncoder().encode(JSON.stringify({
    book_id: "aifb",
    title: "AI First Business",
    cards: [{
      question: "Sáu khóa an toàn cụ thể là những khóa nào?",
      answer: "Ranh giới nhiệm vụ; quyền tối thiểu; phê duyệt của con người; hạn mức vận hành; giám sát và ngắt khẩn cấp; kiểm thử đối kháng.",
      aliases: [],
      source_ids: ["aifb-section-5.6"],
    }],
    sources: {
      "aifb-section-5.6": { kind: "section", number: "5.6", title: "Sáu khóa an toàn bắt buộc cho mọi tác nhân AI" },
    },
  })));
  env.KB_BUCKET.list = async ({ prefix }) => ({
    objects: env.KB_BUCKET.keys().filter((key) => key.startsWith(prefix)).map((key) => ({ key })),
  });

  const events = await readSSE(await ask(env, {
    message: "Sáu khóa an toàn bắt buộc cho mọi Tác nhân AI gồm những khóa nào?",
  }));
  const answer = events.filter((event) => event.t).map((event) => event.t).join("");
  assert.match(answer, /Ranh giới nhiệm vụ/);
  assert.match(answer, /kiểm thử đối kháng/i);
  assert.equal(events.at(-1).src, "AI First Business (mục 5.6)");
  assert.equal(env._calls.ai.length, 0);
  assert.equal(env._calls.search[0].opts.query, "Sáu khóa an toàn gồm những khóa nào?");
  assert.equal(env._calls.search.length, 1);
});

test("cùng thẻ lặp trong JSON chương và FULL vẫn chỉ được coi là một câu trả lời", async () => {
  const env = await makeEnv({ REWRITE: "1" });
  const chapterKey = "02-faq/book-qa/aifb/ch01.json";
  const fullKey = "02-faq/book-qa/aifb/full.json";
  const data = {
    book_id: "aifb",
    title: "AI First Business",
    cards: [{
      question: "Bốn vị thế chiến lược trong hệ sinh thái AI là gì?",
      answer: "Bốn vị thế gồm Người dùng, Người thích nghi, Người Xây giải pháp và Người Làm chủ hạ tầng.",
      aliases: ["bốn vị thế chiến lược", "4 vị thế AI"],
      source_ids: ["aifb-section-1.3"],
    }],
    sources: { "aifb-section-1.3": { kind: "section", number: "1.3", title: "Bốn vị thế chiến lược trong hệ sinh thái AI" } },
  };
  await useQaSearch(env, chapterKey, data, []);
  await env.KB_BUCKET.put(fullKey, new TextEncoder().encode(JSON.stringify(data)));
  env.AI_SEARCH = {
    get: () => ({
      async search(opts) {
        env._calls.search.push({ name: "aif-kb", opts });
        return { chunks: [
          { key: chapterKey, text: "chapter card", score: 0.9 },
          { key: fullKey, text: "full card", score: 0.85 },
        ] };
      },
    }),
  };
  const events = await readSSE(await ask(env, { message: "Bốn vị thế chiến lược trong hệ sinh thái AI là gì?" }));
  assert.match(events[0].t, /Người dùng, Người thích nghi/);
  assert.equal(events.at(-1).src, "AI First Business (mục 1.3)");
  assert.equal(env._calls.ai.length, 0);
  assert.equal(env._calls.search.length, 1);
});

test("đáp án chuẩn duyệt rồi bỏ quên và ba câu hỏi hợp đồng được trả nguyên từ QA", async () => {
  const qaPath = fileURLToPath(new URL("../kb/AIF-KB/02-faq/book-qa/aifb/ch04.json", import.meta.url));
  const data = JSON.parse(readFileSync(qaPath, "utf8"));
  const cases = [
    {
      question: "Cách khắc phục duyệt rồi bỏ quên?",
      id: "aifb-qa-section-4.6",
      expected: ["chủ sở hữu giá trị", "đơn vị nghiệp vụ hưởng lợi", "30, 90 và 180–360 ngày", "thu hẹp"],
      absent: ["danh mục tác nhân"],
    },
    {
      question: "Ba câu hỏi trước khi ký hợp đồng AI là gì?",
      id: "aifb-qa-section-4.7",
      expected: ["chi phí thực tế", "phân tầng", "sáu tiêu chí", "kế hoạch rút lui"],
      absent: [],
    },
  ];
  for (const item of cases) {
    const env = await makeEnv({ REWRITE: "1" });
    await useQaSearch(env, "02-faq/book-qa/aifb/ch04.json", data, []);
    const events = await readSSE(await ask(env, { message: item.question }));
    const answer = events.filter((event) => event.t).map((event) => event.t).join("");
    for (const phrase of item.expected) assert.ok(answer.includes(phrase), `missing "${phrase}" in QA answer`);
    for (const phrase of item.absent) assert.ok(!answer.includes(phrase), `unexpected "${phrase}" in QA answer`);
    assert.equal(events.at(-1).src, item.id.endsWith("4.6") ? "AI First Business (mục 4.6)" : "AI First Business (mục 4.7)");
    assert.equal(env._calls.ai.length, 0);
  }
});

test("đáp án QA đối chiếu EAR và nhân lực dẫn đúng cả hai cuốn", async () => {
  const qaPath = fileURLToPath(new URL("../kb/AIF-KB/02-faq/book-qa/aifb/cross-book-comparisons.json", import.meta.url));
  const data = JSON.parse(readFileSync(qaPath, "utf8"));
  const env = await makeEnv({ REWRITE: "1" });
  await useQaSearch(env, "02-faq/book-qa/aifb/cross-book-comparisons.json", data, []);
  const events = await readSSE(await ask(env, { message: "EAR trụ cột 8 về Con người khác khung quốc gia trụ cột 4 về Nhân lực thế nào?" }));
  const answer = events.filter((event) => event.t).map((event) => event.t).join("");
  assert.match(answer, /ma trận kỹ năng theo vai trò/);
  assert.match(answer, /bảo vệ bậc thang kinh nghiệm/);
  assert.match(answer, /an toàn tâm lý/);
  assert.match(answer, /kỹ sư\/kỹ thuật viên tốt nghiệp mỗi năm/);
  assert.match(answer, /đào tạo lại gắn doanh nghiệp/);
  assert.match(answer, /thu hút, giữ chân chuyên gia/);
  assert.match(events.at(-1).src, /AI First Business \(mục 12\.2; trang 226\)/);
  assert.match(events.at(-1).src, /Nền Kinh tế Trí tuệ \(mục 8\.5\)/);
  assert.equal(env._calls.ai.length, 0);
});

test("thẻ QA không có đoạn sách tương ứng thì từ chối, không lấy sách còn lại hay câu trả lời nháp", async () => {
  const env = await makeEnv({ REWRITE: "0" });
  await useQaSearch(env, "02-faq/book-qa/aifb/ch01.json", {
    book_id: "aifb",
    cards: [{ question: "Câu hỏi QA", answer: "DRAFT_ANSWER_MUST_NOT_REACH_MODEL", aliases: [], source_ids: [] }],
  }, [
    { key: "03-sach/nen-kinh-te-tri-tue/ch01.md", text: "Đoạn sách thuộc cuốn khác.", score: 0.99 },
  ]);
  const result = await (await ask(env, { message: "Câu hỏi QA" })).json();
  assert.equal(result.nf, true);
  assert.equal(env._calls.ai.length, 0);
  assert.equal(env._calls.search.length, 2);
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

test("câu hỏi độc lập không kế thừa ngữ cảnh tác nhân AI từ lượt trước", async () => {
  const env = await makeEnv();
  env._rewriteResponse = "Tôi đang sống như thế nào trong thời đại AI | thời đại AI";
  const bookSearchQueries = [];
  env.AI_SEARCH = {
    get: () => ({
      async search(opts) {
        env._calls.search.push({ name: "aif-kb", opts });
        const folder = opts.ai_search_options?.retrieval?.filters?.folder?.$gte;
        if (folder === "02-faq/book-qa/") return { chunks: [] };
        bookSearchQueries.push(opts.query);
        return { chunks: [{
          key: "03-sach/ai-first-business/1-1.md",
          text: "Nguồn: AI First Business, mục 1.1\nNội dung độc lập về thời đại AI.",
          score: 0.9,
        }] };
      },
    }),
  };
  const oldContext = "ONLY_OLD_AGENT_CONTEXT";
  const events = await readSSE(await ask(env, {
    message: "tôi đang sống như thế nào trong thời đại AI",
    hist: [
      { r: "u", t: "Nếu nhân viên đang tự dùng công cụ AI bên ngoài, doanh nghiệp nên xử lý thế nào?" },
      { r: "b", t: oldContext },
    ],
  }));
  const rewriteInput = env._calls.ai.find((call) => call.model === "m-rw").opts.messages[1].content;
  const answerPrompt = env._calls.ai.find((call) => call.model === "m-main").opts.messages[1].content;
  assert.match(rewriteInput, /LỊCH SỬ:\n\(không có\)/);
  assert.doesNotMatch(bookSearchQueries[0], /ONLY_OLD_AGENT_CONTEXT|danh mục tác nhân/i);
  assert.doesNotMatch(answerPrompt, /LỊCH SỬ|ONLY_OLD_AGENT_CONTEXT|nhân viên|công cụ AI bên ngoài/);
  assert.match(answerPrompt, /Nội dung độc lập về thời đại AI/);
  assert.equal(events.at(-1).done, true);
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
  assert.equal(kindOf("03-sach/ai-first-business/05-5-6-topic.md").kind, "book");
  assert.equal(kindOf("04-website/w1.md").kind, "web");
  assert.equal(kindOf("05-tai-lieu-khac/bao-gia.pdf").kind, "doc");
});

test("CORS: không nhận workers.dev của tài khoản khác", async () => {
  const env = await makeEnv();
  assert.equal((await ask(env, { message: "AI First là gì" }, { Origin: "https://aifirstbusiness-x.attacker.workers.dev" })).status, 403);
});
