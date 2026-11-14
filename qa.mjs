import assert from "node:assert/strict";
import {readFileSync, writeFileSync} from "node:fs";
import {lookup, normalize} from "./lookup.mjs";

const url = path => new URL(path, import.meta.url);
const read = path => JSON.parse(readFileSync(url(path), "utf8"));
const manifest = read("manifest.json");
const maps = read("book-map.json");
const full = manifest.books.map(book => read(book.full_path));
const report = [];

function check(name, callback) {
  callback();
  report.push({name, status:"pass"});
}

for (const [index, meta] of manifest.books.entries()) {
  const book = full[index];
  const map = maps[index];
  check(meta.book_id + " / source identity", () => {
    assert.equal(book.book_id, meta.book_id);
    assert.equal(book.edition, meta.edition);
    assert.equal(book.source_file, map.source_file);
    assert.equal(map.pages.length, [309, 240][index]);
    assert.equal(new Set(book.cards.map(c => c.id)).size, book.cards.length);
    for (const [offset, page] of map.pages.entries()) {
      assert.equal(page.pdf_page, offset + 1);
      assert.ok(book.sources[page.region_id]);
    }
  });
  for (const unit of meta.units) {
    const data = read(unit.filename);
    check(meta.book_id + " / " + unit.region_id, () => {
      assert.equal(data.book_id, book.book_id);
      assert.equal(data.edition, book.edition);
      assert.equal(data.region.id, unit.region_id);
      assert.equal(data.cards.length, unit.cards);
      assert.deepEqual(data.cards, book.cards.filter(c => c.region_id === unit.region_id));
      for (const card of data.cards) {
        assert.equal(card.chapter, unit.chapter);
        assert.ok(card.source_ids.includes(card.primary_source_id));
        assert.equal(book.sources[card.primary_source_id].parent_id, unit.region_id);
        for (const id of card.source_ids) assert.deepEqual(data.sources[id], book.sources[id]);
      }
    });
  }
  for (const card of book.cards) {
    check(card.id + " / canonical question", () => {
      const result = lookup(card.question, full);
      assert.equal(result.type, "card", card.question);
      assert.equal(result.results[0].id, card.id);
    });
    check(card.id + " / no accents", () => {
      const result = lookup(normalize(card.question), [book]);
      assert.equal(result.type, "card", card.question);
      assert.equal(result.results[0].id, card.id);
    });
  }
  for (const entry of map.entries) {
    const label = {section:"mục", figure:"hình", table:"bảng"}[entry.kind];
    if (!label) continue;
    check(entry.id + " / locator", () => {
      const result = lookup(label + " " + entry.number, [book]);
      assert.ok(result.results.some(r => r.sourceId === entry.id && r.page === entry.print_page));
      if (entry.kind === "section") {
        assert.ok(book.cards.some(c => c.primary_source_id === entry.id && c.answer.trim().length > 20));
      }
    });
  }
}

const samples = [
  ["work chart khác gì sơ đồ tổ chức", full, "card", "aifb-section-8.2"],
  ["công thức ari địa phương", full, "card", "aiec-section-A.3"],
  ["cách tính điểm EAR", full, "card", "aifb-section-12.3"],
  ["ARI-IP dưới 3 điểm", full, "card", "aiec-section-B.3"],
  ["mô hình 3A có phải đi tuần tự?", full, "card", "aifb-section-2.2"],
  ["3 loại thất bại sandbox", full, "card", "aifb-section-11.7"],
  ["hình 4.1 ở trang nào?", [full[1]], "references", "aifb-figure-4.1"],
  ["mục 8.2", full, "references", "aifb-section-8.2"],
  ["mục 8.2", [full[0]], "references", "aiec-section-8.2"],
  ["trang 72", [full[1]], "references", "aifb-ch04"],
  ["chép lại toàn văn chương 7", full, "unanswered"],
  ["thời tiết Đà Nẵng hôm nay", full, "unanswered"]
];
for (const [query, scope, type, source] of samples) {
  check("sample / " + query, () => {
    const result = lookup(query, scope);
    assert.equal(result.type, type, query);
    if (source) assert.ok(result.results.some(r => r.sourceId === source || r.source_ids?.includes(source)), query);
  });
}
writeFileSync(url("qa-results.json"), JSON.stringify({total:report.length, passed:report.length, cases:report},null,2)+"\n");
console.log(report.length + " cases passed");
