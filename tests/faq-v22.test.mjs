import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { lookupFaq, lookupFaqById, lookup } from "../lookup.mjs";
import { classifyLeadIntent } from "../lead-intent.mjs";

const faqAifbPath = fileURLToPath(
  new URL("../web-patch/assets/chat/faq_ai_first_business.json", import.meta.url)
);
const faqAiecPath = fileURLToPath(
  new URL("../web-patch/assets/chat/faq_ai_economy.json", import.meta.url)
);
const kbAifbPath = fileURLToPath(
  new URL("../web-patch/assets/chat/books/aifb.json", import.meta.url)
);

const faqAifb = JSON.parse(fs.readFileSync(faqAifbPath, "utf8"));
const faqAiec = JSON.parse(fs.readFileSync(faqAiecPath, "utf8"));
const kbAifb = JSON.parse(fs.readFileSync(kbAifbPath, "utf8"));

test("FAQ v2.2.0: cấu hình chuẩn 49 thẻ Economy, 52 thẻ Business, 6 câu gợi ý mỗi cuốn", () => {
  assert.equal(faqAiec.version, "2.2.0");
  assert.equal(faqAiec.book_id, "ai_economy");
  assert.equal(faqAiec.cards.length, 49);
  assert.equal(faqAiec.quick_questions.length, 6);

  assert.equal(faqAifb.version, "2.2.0");
  assert.equal(faqAifb.book_id, "ai_first_business");
  assert.equal(faqAifb.cards.length, 52);
  assert.equal(faqAifb.quick_questions.length, 6);

  for (const qq of faqAiec.quick_questions) {
    const res = lookupFaqById(qq.faq_id, faqAiec);
    assert.ok(res && res.cards[0].id === qq.faq_id);
  }
  for (const qq of faqAifb.quick_questions) {
    const res = lookupFaqById(qq.faq_id, faqAifb);
    assert.ok(res && res.cards[0].id === qq.faq_id);
  }
});

test("FAQ v2.2.0: toàn bộ 635 câu hỏi và alias của 101 thẻ khớp chính xác", () => {
  for (const [faq, sel] of [
    [faqAifb, "aifb"],
    [faqAiec, "aiec"],
  ]) {
    for (const card of faq.cards) {
      const queries = [card.question, ...(card.aliases || [])].filter(Boolean);
      for (const q of queries) {
        const r = lookupFaq(q, faq, sel);
        assert.equal(r.type, "faq_cards", `Expected faq_cards for [${sel}] "${q}"`);
        assert.equal(r.cards[0].id, card.id, `Expected card ${card.id} for [${sel}] "${q}"`);
      }
    }
  }
});

test("FAQ v2.2.0: kiểm thử bảng nghiệm thu trên staging, cập nhật 2.1 và 2.2", () => {
  // Cùng hỏi “Phù hợp với trình độ nào?” ở hai khung
  const rEcoLvl = lookupFaq("Phù hợp với trình độ nào?", faqAiec, "aiec");
  const rBusLvl = lookupFaq("Phù hợp với trình độ nào?", faqAifb, "aifb");
  assert.equal(rEcoLvl.cards[0].id, "level");
  assert.equal(rBusLvl.cards[0].id, "level");
  assert.notEqual(rEcoLvl.cards[0].answer, rBusLvl.cards[0].answer);

  // Adapt là gì? / adapt la gi
  assert.equal(lookupFaq("Adapt là gì?", faqAifb, "aifb").cards[0].id, "adapt");
  assert.equal(lookupFaq("adapt la gi", faqAifb, "aifb").cards[0].id, "adapt");

  // Đổi sách khi gọi đích danh cuốn khác hoặc thuật ngữ riêng
  assert.equal(lookupFaq("Theo AI First Business, Adapt là gì?", faqAiec, "aiec").type, "switch_book");
  assert.equal(lookupFaq("EAR Index là gì?", faqAiec, "aiec").type, "switch_book");
  assert.equal(lookupFaq("Nhà máy trí tuệ là gì?", faqAifb, "aifb").type, "switch_book");
  assert.equal(lookupFaq("Cho tôi đọc thử AI Economy", faqAifb, "aifb").type, "switch_book");

  // So sánh hai cuốn và ARI vs EAR
  assert.equal(lookupFaq("Nên đọc cuốn nào trước?", faqAiec, "aiec").cards[0].id, "choose");
  assert.equal(lookupFaq("Nên đọc cuốn nào trước?", faqAifb, "aifb").cards[0].id, "choose");
  assert.equal(lookupFaq("ARI khác gì EAR Index?", faqAiec, "aiec").cards[0].id, "ari_vs_ear");
  assert.equal(lookupFaq("ARI khác gì EAR Index?", faqAifb, "aifb").cards[0].id, "ari_vs_ear");

  // Giá và đổi trả
  const pEco = lookupFaq("Giá bao nhiêu?", faqAiec, "aiec");
  assert.equal(pEco.cards[0].id, "price");
  assert.match(pEco.cards[0].answer, /355\.000/);
  assert.deepEqual(pEco.actions.map((a) => a.label), ["Liên hệ"]);

  const pBus = lookupFaq("Giá bao nhiêu?", faqAifb, "aifb");
  assert.equal(pBus.cards[0].id, "price");
  assert.match(pBus.cards[0].answer, /330\.000/);
  assert.deepEqual(pBus.actions.map((a) => a.label), ["Liên hệ"]);

  // Chi phí triển khai AI không trả giá sách
  assert.equal(lookupFaq("Chi phí triển khai AI bao nhiêu?", faqAifb, "aifb").type, "unanswered");

  // B2B bulk mua sách doanh nghiệp + VAT chỉ hiện Liên hệ
  const rBulk = lookupFaq("Mua sách cho doanh nghiệp, có hóa đơn VAT không?", faqAifb, "aifb");
  assert.equal(rBulk.cards[0].id, "bulk");
  assert.deepEqual(rBulk.actions.map((a) => a.label), ["Liên hệ"]);

  // consulting_next hiện hai CTA dịch vụ
  const rCons = lookupFaq("Đọc xong tôi nên tự đánh giá EAR hay trao đổi với đội tư vấn?", faqAifb, "aifb");
  assert.equal(rCons.cards[0].id, "consulting_next");
  assert.deepEqual(rCons.actions.map((a) => a.label), ["Làm khảo sát EAR", "Liên hệ tư vấn"]);

  // Câu nhiều ý: Adapt là gì? Sách giá bao nhiêu?
  const rMulti = lookupFaq("Adapt là gì? Sách giá bao nhiêu?", faqAifb, "aifb");
  assert.deepEqual(rMulti.cards.map((c) => c.id), ["adapt", "price"]);
  assert.deepEqual(rMulti.actions.map((a) => a.label), ["Liên hệ"]);

  // Cơ hội và rủi ro nhiều chủ thể hoặc chưa rõ chủ thể
  const rOppMulti = lookupFaq("Cơ hội và rủi ro AI với quốc gia và doanh nghiệp", faqAifb, "aifb");
  assert.deepEqual(rOppMulti.cards.map((c) => c.id), ["national", "company"]);
  const rOppUnclear = lookupFaq("Cơ hội và rủi ro của AI là gì?", faqAifb, "aifb");
  assert.equal(rOppUnclear.type, "clarify_entity");
});

