// widget-adapter.mjs · nối widget hiện có với FAQ 2.5.0 (Worker hoặc tra cục bộ trong trình duyệt).
// Widget giữ giao diện của mình; chỉ cần gọi session.ask()/session.pick() và vẽ kết quả bằng render().

import { route, byId, kbById } from "./router.mjs";

// targets: ánh xạ target_ref của FAQ sang hành động thật của website.
//   existing_website_contact   -> nút Liên hệ mua sách hiện có
//   sample_of_answered_book    -> catalog.sample của cuốn đang mở
//   existing_ear_survey        -> trang khảo sát EAR
//   existing_consulting_contact-> form tư vấn
export function createSession({ mode = "worker", endpoint = "/api/chat", faqUrls, kbUrls, targets }) {
  let bookId = null, faq = null, kb = null, seq = 0;

  async function selectBook(id) {               // gọi khi chọn sách hoặc bấm Đổi sách
    bookId = id; faq = kb = null; const my = ++seq;
    if (mode === "local") {
      const [f, k] = await Promise.all([fetch(faqUrls[id]).then(r => r.json()), kbUrls?.[id] ? fetch(kbUrls[id]).then(r => r.json()) : null]);
      if (my !== seq) return null;              // người đọc đã đổi sách trong lúc tải
      if (f.book_id !== id) throw new Error("FAQ không đúng cuốn");
      faq = f; kb = k;
    }
    return id;
  }
  function reset() { bookId = faq = kb = null; seq++; }

  async function call(payload) {
    const my = ++seq, forBook = bookId;
    let out;
    if (mode === "local") {
      out = payload.faq_id ? { results: [byId(payload.faq_id, faq)] }
          : payload.kb_id ? { results: [kbById(payload.kb_id, kb)] }
          : route(payload.question, faq, kb);
    } else {
      const res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ book_id: forBook, request_id: my, ...payload }) });
      out = await res.json();
    }
    if (my !== seq || forBook !== bookId) return null;   // phản hồi của phiên cũ: bỏ qua
    return out;
  }

  return {
    selectBook, reset,
    ask: question => call({ question }),
    pick: option => call(option.kb_id ? { kb_id: option.kb_id } : { faq_id: option.faq_id }),
    actionsFor: result => actionButtons(result, faq?.actions ?? {}, targets),
  };
}

// Trả về danh sách nút {label, href | onClick} cho một kết quả.
export function actionButtons(result, actions, targets) {
  const name = result?.action;
  if (!name) return [];
  const def = actions[name] ?? {};
  const items = def.items ?? [name];
  return items.map(key => {
    const a = actions[key] ?? {};
    return { label: a.label ?? key, target: targets?.[a.target_ref] ?? null };
  }).filter(b => b.target);
}

// Gợi ý vẽ: answer hỗ trợ **in đậm**; source hiển thị dòng nhỏ; options là nút bấm gọi session.pick(option).
//   card / kb_card       -> answer + source + actionButtons
//   choices              -> answer + options
//   switch_book          -> answer + nút "Đổi sách" (không tự đổi phiên)
//   topic_not_found      -> answer + options (toc, sample)
//   no_match             -> answer + options; KHÔNG hiện câu Zalo
//   card có flow="consulting" -> hiện hai CTA Làm khảo sát EAR / Liên hệ tư vấn; không tự gửi dữ liệu
export function toHtml(text) {
  return String(text).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]))
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}
