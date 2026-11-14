// node test-router.mjs [path/to/kb-aiec.json path/to/kb-aifb.json]
import { readFileSync } from "node:fs";
import { route, prepare, normalize } from "./router.mjs";

const here = new URL(".", import.meta.url);  // chạy: node test-router.mjs ../AIEC_AI_Economy_v13-7/AIEC_AI_Economy_v13-7_FULL.json ../AIFB_AI_First_Business_v16-3/AIFB_AI_First_Business_v16-3_FULL.json
const load = p => JSON.parse(readFileSync(p, "utf8"));
const AE = load(new URL("faq_ai_economy.json", here));
const AFB = load(new URL("faq_ai_first_business.json", here));
const [kbAePath, kbAfbPath] = process.argv.slice(2);
const KB = { ai_economy: kbAePath ? load(kbAePath) : null, ai_first_business: kbAfbPath ? load(kbAfbPath) : null };
const BOOK = { AE, AFB };

// [book, question, expected faq_id | "switch_book" | "no_match" | "kb_card" | "choices"]
const cases = [
  // --- the two screenshots
  ["AFB", "AI NÊN ĐỌC CUỐN SÁCH NÀY ?", "level"],
  ["AFB", "Tôi là sinh viên, tôi có nên đọc cuốn sach này không?", "persona_student"],
  ["AE", "Ai nên đọc cuốn sách này ?", "level"],
  ["AE", "Cuốn này nói về chủ đề gì?", "overview"],
  // --- guide 2.3 / 2.4 acceptance
  ["AE", "cuon nay noi ve chu de gi", "overview"], ["AFB", "sách nói gì vậy", "overview"],
  ["AE", "người mới đọc được ko?", "level"], ["AFB", "Đọc xong được gì?", "practice"],
  ["AE", "Sách có mục lục không?", "toc"], ["AFB", "Sách có mục lục không?", "toc"],
  ["AE", "Đọc cuốn này khác gì đọc tin tức AI hằng ngày?", "daily_news"],
  ["AE", "Nghề của tôi dễ bị AI thay thế không?", "my_job"], ["AE", "Dữ liệu đến ngày nào?", "currency"],
  ["AFB", "Công ty chỉ có Excel có áp dụng được không?", "excel_sme"],
  ["AFB", "Sách có checklist hoặc mẫu điền để tôi tự bắt đầu không?", "templates"],
  ["AE", "Tôi chỉ mua một cuốn. Nên chọn AE hay AFB?", "choose"],
  ["AFB", "Cho tôi đọc thử AI Economy", "switch_book"],
  ["AE", "Còn hàng không?", "availability"], ["AFB", "Giá bao nhiêu?", "price"], ["AE", "Giá bao nhiêu?", "price"],
  ["AFB", "Adapt là gì?", "adapt"], ["AFB", "adapt la gi", "adapt"],
  ["AFB", "Chi phí triển khai AI bao nhiêu?", "implementation_cost"],
  ["AE", "Chi phí triển khai AI bao nhiêu?", "implementation_cost"],
  ["AE", "Theo AI First Business, Adapt là gì?", "switch_book"], ["AE", "EAR Index là gì?", "switch_book"],
  ["AFB", "Nhà máy trí tuệ là gì?", "switch_book"], ["AE", "Nhà máy trí tuệ là gì?", "factory"],
  ["AE", "Nên đọc cuốn nào trước?", "choose"], ["AFB", "Nên đọc cuốn nào trước?", "choose"],
  ["AE", "Có đổi trả không?", "returns"], ["AFB", "Sách giao lỗi", "returns"], ["AE", "Có COD không?", "delivery"],
  ["AFB", "Cho tôi đặt lịch tư vấn chuyển đổi AI", "consult_request"],
  ["AE", "Mua combo AI Economy và AI First Business", "combo"], ["AFB", "Mua combo AI Economy và AI First Business", "combo"],
  ["AFB", "Mua sách kèm tọa đàm tác giả", "signed_talk"], ["AE", "Có link tải mẫu không?", "digital_templates"],
  ["AFB", "EAR Index là gì?", "ear"], ["AFB", "Đo hiệu quả đầu tư AI như thế nào?", "roi"],
  ["AE", "Tác giả là ai và có uy tín không?", "author"], ["AE", "Việt Nam có cơ hội gì đến năm 2035?", "vietnam"],
  ["AE", "ARI và ARI-IP dùng cho ai?", "ari"], ["AFB", "Mua sách cho doanh nghiệp, có hóa đơn VAT không?", "bulk"],
  ["AFB", "Đọc xong tôi nên tự đánh giá EAR hay trao đổi với đội tư vấn?", "consulting_next"],
  ["AE", "ARI khác gì EAR Index?", "ari_vs_ear"], ["AFB", "ARI khác gì EAR Index?", "ari_vs_ear"],
  ["AE", "AI có phải bong bóng không?", "bubble"], ["AFB", "SME có áp dụng được không?", "sme_fit"],
  ["AFB", "Sách do AI viết à?", "ai_use"], ["AE", "Sách bao nhiêu trang?", "edition"],
  // --- free-form & inference variants (new in 2.5)
  ["AE", "mình là sv năm 2 thì đọc cuốn này có ích ko", "persona_student"],
  ["AE", "em là sinh viên kinh tế, sách có hợp không ạ", "persona_student"],
  ["AFB", "Tôi là CEO một công ty 200 người, nên đọc phần nào?", "persona_owner"],
  ["AE", "tôi làm ở ban quản lý khu công nghiệp, sách này có ích gì", "persona_kcn"],
  ["AFB", "mình làm HR thì đọc được gì", "persona_hr"],
  ["AFB", "tôi là trưởng phòng kinh doanh, có nên đọc không", "persona_manager"],
  ["AE", "tôi là nhà đầu tư chứng khoán, cuốn này có giúp gì không", "investor_reader"],
  ["AE", "tôi là cán bộ sở kế hoạch đầu tư có nên đọc", "persona_policy"],
  ["AFB", "dân IT đọc có hợp không", "persona_it"],
  ["AE", "tôi là giảng viên đại học, có dùng làm tài liệu giảng dạy được không", "persona_lecturer"],
  ["AFB", "tôi đang khởi nghiệp, đọc có ích không", "persona_startup"],
  ["AFB", "Tôi làm kế toán, sách có ích không", "persona_finance"],
  ["AE", "tôi làm nhân viên văn phòng đọc có ích không", "everyday_reader"],
  ["AFB", "Tôi là nhân viên văn phòng, đọc có ích không?", "persona_staff"],
  ["AE", "Sách có nói về ngành dệt may không?", "industry"], ["AE", "sách có bàn về chip bán dẫn không", "kb_card"], ["AE", "Singapore làm AI thế nào", "kb_card"], ["AE", "Sách có ví dụ theo ngành không?", "industry"],
  ["AFB", "Sách có đáng tiền không?", "worth_it"], ["AE", "Ai không nên đọc cuốn này?", "not_for"],
  ["AFB", "đọc hết mất bao lâu", "read_time"], ["AE", "Khác gì sách AI nước ngoài?", "vs_other_books"],
  ["AFB", "nên dùng ChatGPT hay Gemini cho công ty", "which_tool"],
  ["AFB", "AI có thay thế nhân viên không?", "ai_replace"], ["AE", "AI có thay thế con người không?", "jobs"],
  ["AFB", "nên thuê ngoài hay tự xây AI", "build_vs_buy"], ["AFB", "lộ trình 90 ngày gồm những gì", "roadmap_90"],
  ["AE", "có data center trong nước là làm chủ AI chưa", "sovereignty"],
  ["AE", "nghề nào khó bị AI thay thế nhất", "future_jobs"],
  ["AFB", "Muốn mua làm quà tặng sếp thì chọn cuốn nào", "gift"],
  ["AE", "xin chào", "greeting"], ["AFB", "cảm ơn nhé", "thanks"],
  ["AE", "giá vàng hôm nay bao nhiêu", "out_of_scope"], ["AFB", "viết code python giúp tôi", "out_of_scope"],
  ["AFB", "cho tôi số điện thoại hoặc zalo", "human"],
  ["AFB", "Adapt là gì? Sách giá bao nhiêu?", ["adapt", "price"]],
  ["AE", "giao hàng mất bao lâu", "delivery"],
  ["AFB", "ship về Đà Nẵng mấy ngày", "delivery"],
  ["AFB", "mua 50 cuốn tặng nhân viên có chiết khấu không", "bulk"],
  ["AE", "cuốn này giá nhiêu vậy", "price"],
  ["AFB", "sách này viết cho ai", "level"],
  ["AE", "tóm tắt giúp mình nội dung cuốn sách", "overview"],
  ["AFB", "có ví dụ doanh nghiệp việt nam không", "examples"],
  ["AFB", "Shadow AI là gì", "security"],
  ["AE", "Vì sao điện quyết định dự án AI?", "capital"],
  ["AFB", "tác giả là người thế nào", "author"], ["AE", "tác giả là người thế nào", "author"],
  ["AE", "sách nói về điện hạt nhân không", "topic_not_found"], ["AE", "giá vàng hôm nay bao nhiêu", "out_of_scope"],
  ["AFB", "giá vàng hôm nay bao nhiêu", "out_of_scope"], ["AFB", "tôi sợ dữ liệu bị lộ khi dùng AI", "security"],
  ["AFB", "mình là sv năm 2 thì đọc cuốn này có ích ko", "persona_student"],
];

let pass = 0; const fails = [];
for (const [b, q, want] of cases) {
  const out = route(q, BOOK[b], KB[BOOK[b].book_id]);
  const got = out.results.map(r => r.faq_id ?? r.type);
  const ok = Array.isArray(want) ? JSON.stringify(got) === JSON.stringify(want) : got[0] === want;
  if (ok) pass++; else fails.push(`${b} | ${q}\n   want ${JSON.stringify(want)} got ${JSON.stringify(got)} ${JSON.stringify(out.results[0].options ?? "")}`);
}

// Structural checks: every quick question resolves, no Zalo text, no duplicate exact alias across cards, answer length.
const problems = [];
for (const faq of [AE, AFB]) {
  const p = prepare(faq);
  for (const qq of faq.quick_questions) if (!p.byId.has(qq.faq_id)) problems.push(`${faq.book_id}: quick ${qq.faq_id} missing`);
  if (/zalo/i.test(JSON.stringify(faq.cards.map(c => c.answer)))) problems.push(`${faq.book_id}: answer mentions Zalo`);
  for (const [k, ids] of p.exact) if (ids.size > 1) problems.push(`${faq.book_id}: alias "${k}" -> ${[...ids]}`);
  for (const c of faq.cards) {
    const words = c.answer.replace(/\*\*/g, "").split(/\s+/).length;
    if (words > 120) problems.push(`${faq.book_id}: ${c.id} answer ${words} words`);
    if (c.action && !faq.actions[c.action]) problems.push(`${faq.book_id}: ${c.id} action ${c.action} undefined`);
  }
}

console.log(`Routing cases: ${pass}/${cases.length} pass`);
fails.forEach(f => console.log(" FAIL " + f));
console.log(`Structural problems: ${problems.length}`);
problems.forEach(p => console.log(" - " + p));
process.exitCode = fails.length || problems.length ? 1 : 0;
