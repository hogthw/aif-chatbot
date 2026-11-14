// Gọi mô hình (Workers AI, có thể qua AI Gateway) và chuyển câu trả lời dạng luồng về trình duyệt.
// Định dạng gửi về giữ nguyên như bản cũ để chat.js trên website không phải đổi:
//   data: {"t":"đoạn chữ"}\n\n ...  data: {"done":true,"nf":false,"src":"...","faq":[12]}\n\n

import { gatewayOpts } from "./retrieve.js";

export async function startStream(env, messages) {
  const models = [env.MODEL, env.FALLBACK_MODEL].filter(Boolean);
  let lastErr;
  for (const m of models) {
    try {
      return await env.AI.run(m, { messages, stream: true, max_tokens: Number(env.MAX_TOKENS || 900), temperature: Number(env.TEMPERATURE || 0.2) }, gatewayOpts(env));
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("Không gọi được mô hình");
}

export function directClientStream(text, meta) {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(ctrl) {
      ctrl.enqueue(enc.encode("data: " + JSON.stringify({ t: text }) + "\n\n"));
      ctrl.enqueue(enc.encode("data: " + JSON.stringify({ done: true, nf: false, src: meta.src, faq: [] }) + "\n\n"));
      if (meta.onDone) meta.onDone({ text, nf: false });
      ctrl.close();
    },
  });
}

// Biến luồng SSE của Workers AI thành luồng {t} cho trình duyệt; bỏ ký hiệu [NF] (không tìm thấy) khỏi chữ hiển thị.
export function toClientStream(aiStream, meta) {
  const enc = new TextEncoder(), dec = new TextDecoder();
  let buf = "", hold = "", nf = false, total = "";
  const send = (ctrl, obj) => ctrl.enqueue(enc.encode("data: " + JSON.stringify(obj) + "\n\n"));
  const cleanLanguage = (text) => meta.lang === "zh"
    ? text
    : text.replace(/[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u{20000}-\u{2FA1F}\u{30000}-\u{323AF}]+/gu, "");
  const emit = (ctrl, text) => {
    let clean = cleanLanguage(text);
    if (total.endsWith(" ") && clean.startsWith(" ")) clean = clean.trimStart();
    if (clean) { total += clean; send(ctrl, { t: clean }); }
  };
  const handle = (ctrl, l) => {
    const m = /^data:\s*(.*)$/.exec(l.trim()); if (!m || m[1] === "[DONE]") return;
    let t = "";
    try {
      const j = JSON.parse(m[1]);
      t = typeof j.response === "string" ? j.response : (j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content) || "";
    } catch (e) { return; }
    if (!t) return;
    hold += t;
    if (hold.includes("[NF]")) { nf = true; hold = hold.replace(/\s*\[NF\]\s*/g, " "); }
    // Giữ lại phần đuôi có thể là "[NF" chưa trọn để không lộ ký hiệu ra màn hình
    const cut = hold.lastIndexOf("[");
    const safe = cut >= 0 && hold.length - cut < 5 ? hold.slice(0, cut) : hold;
    hold = hold.slice(safe.length);
    if (safe) emit(ctrl, safe);
  };
  return aiStream.pipeThrough(new TransformStream({
    transform(chunk, ctrl) {
      buf += dec.decode(chunk, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop();
      for (const l of lines) handle(ctrl, l);
    },
    flush(ctrl) {
      if (buf.trim()) handle(ctrl, buf);
      if (hold.includes("[NF]")) { nf = true; hold = hold.replace(/\s*\[NF\]\s*/g, " "); }
      if (hold.trim()) {
        emit(ctrl, hold);
      }
      total = total.trim();
      send(ctrl, { done: true, nf, src: nf ? "" : meta.src, faq: nf ? [] : meta.faq });
      if (meta.onDone) meta.onDone({ text: total, nf });
    },
  }));
}
