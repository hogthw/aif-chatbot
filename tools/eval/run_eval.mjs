// Chạy 40 câu hỏi kiểm thử (từ file Test KB) qua chatbot thật và ghi kết quả ra CSV để so với cột "Ý chính".
//
// Cách chạy (PowerShell, trong thư mục aif-chatbot):
//   $env:CHAT_URL="https://aif-kb-chat.trantansy.workers.dev"
//   $env:ADMIN_TOKEN="<mã ADMIN_TOKEN đã đặt>"
//   node tools/eval/run_eval.mjs
// Kết quả: tools/eval/ket-qua-<ngày giờ>.csv (mở bằng Excel)
//
// Câu "Multi-turn" (ô ghi "Lượt 1: ... -> Lượt 2: ...") được hỏi lần lượt, lượt sau kèm lịch sử lượt trước.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const URL_BASE = (process.env.CHAT_URL || "https://aif-kb-chat.trantansy.workers.dev").replace(/\/$/, "");
const ADMIN = process.env.ADMIN_TOKEN || "";
const SECRET = process.env.CHAT_SECRET || "";
const ORIGIN = process.env.ORIGIN || "https://aifirstbusiness.vn";
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null; // vd ONLY=1,5,12
const cases = JSON.parse(fs.readFileSync(path.join(here, "cases.json"), "utf8"));

if (!SECRET) {
  throw new Error("Hãy đặt CHAT_SECRET trong biến môi trường trước khi chạy bộ đánh giá.");
}

async function ask(question, hist) {
  const t0 = Date.now();
  const res = await fetch(URL_BASE + "/", {
    method: "POST",
    headers: { "Content-Type": "text/plain", Origin: ORIGIN },
    body: JSON.stringify({ secret: SECRET, message: question, lang: "vi", faq: [], hist, page: "/eval" }),
  });
  const ct = res.headers.get("Content-Type") || "";
  if (!ct.includes("event-stream")) {
    const j = await res.json().catch(() => ({}));
    return { answer: j.answer || j.error || `HTTP ${res.status}`, nf: !!j.nf, src: j.src || "", ms: Date.now() - t0, firstMs: Date.now() - t0 };
  }
  const reader = res.body.getReader(); const dec = new TextDecoder();
  let buf = "", answer = "", done = {}, firstMs = 0;
  for (;;) {
    const { value, done: end } = await reader.read();
    if (end) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n"); buf = parts.pop();
    for (const p of parts) {
      const m = /^data:\s*(.*)$/s.exec(p.trim()); if (!m) continue;
      const j = JSON.parse(m[1]);
      if (j.t) { if (!firstMs) firstMs = Date.now() - t0; answer += j.t; }
      if (j.done) done = j;
    }
  }
  return { answer: answer.trim(), nf: !!done.nf, src: done.src || "", ms: Date.now() - t0, firstMs };
}

async function debug(question, hist) {
  if (!ADMIN) return null;
  const res = await fetch(URL_BASE + "/debug", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + ADMIN },
    body: JSON.stringify({ message: question, lang: "vi", hist }),
  });
  return res.ok ? res.json() : { error: res.status };
}

const csvCell = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
const rows = [["STT", "Chủ đề", "Kịch bản", "Câu hỏi", "Câu hỏi viết lại", "Tài liệu tìm được (điểm)", "Câu trả lời mới", "Nguồn hiển thị", "Không trả lời (nf)", "Thời gian chữ đầu (ms)", "Tổng thời gian (ms)", "Ý chính (đáp án tham chiếu)", "Kết quả cũ", "Lỗi cũ", "Đánh giá mới (điền tay: Pass/Fail)", "Ghi chú"]];

for (const c of cases) {
  if (ONLY && !ONLY.has(c.stt)) continue;
  // Câu nhiều lượt trong file test ghi chung một ô: "Lượt 1: ... -> Lượt 2: ..." -> hỏi lượt 1 trước, lượt 2 kèm lịch sử
  const turns = c.cau_hoi.split(/\s*->\s*/).map((t) => t.replace(/^Lượt\s*\d+\s*:\s*/i, "").trim()).filter(Boolean);
  let hist = [];
  process.stdout.write(`#${c.stt} ${c.cau_hoi.slice(0, 60).replace(/\s+/g, " ")}… `);
  try {
    let first = "";
    for (const t of turns.slice(0, -1)) {
      const r0 = await ask(t, hist);
      first += `[${t}] ${r0.answer}\n`;
      hist = hist.concat([{ r: "u", t }, { r: "b", t: r0.answer.slice(0, 600) }]).slice(-4);
      await new Promise((r) => setTimeout(r, Number(process.env.DELAY_MS || 8000)));
    }
    const q = turns.at(-1);
    const [d, r] = [await debug(q, hist), await ask(q, hist)];
    if (first) r.answer = "LƯỢT TRƯỚC: " + first + "\nLƯỢT CUỐI: " + r.answer;
    const used = d && d.used ? d.used.map((u) => `${u.label} (${u.score})`).join(" | ") : "";
    rows.push([c.stt, c.chu_de, c.kich_ban, c.cau_hoi, d ? d.rewritten : "", used, r.answer, r.src, r.nf ? "có" : "", r.firstMs, r.ms, c.y_chinh, c.ket_qua_cu, c.loi_cu, "", ""]);
    console.log(`${r.nf ? "NF" : "OK"} ${r.ms}ms`);
  } catch (e) {
    rows.push([c.stt, c.chu_de, c.kich_ban, c.cau_hoi, "", "", "LỖI: " + e.message, "", "", "", "", c.y_chinh, c.ket_qua_cu, c.loi_cu, "", ""]);
    console.log("LỖI", e.message);
  }
  await new Promise((r) => setTimeout(r, Number(process.env.DELAY_MS || 8000))); // tránh chạm giới hạn 8 câu/phút/IP
}
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
const out = path.join(here, `ket-qua-${stamp}.csv`);
fs.writeFileSync(out, "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n"), "utf8");
console.log("\nĐã ghi:", out);
