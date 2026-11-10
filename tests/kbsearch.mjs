// AI Search giả: tìm theo từ khóa trên thư mục KB cục bộ (để test luồng, không đo chất lượng thật)
import fs from "node:fs"; import path from "node:path";
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
export function loadKB(dir) {
  const out = [];
  (function rec(d, rel) {
    for (const n of fs.readdirSync(d)) {
      if (n.startsWith("_")) continue;
      const p = path.join(d, n), r = rel ? rel + "/" + n : n;
      if (fs.statSync(p).isDirectory()) rec(p, r); else if (/\.(md|txt)$/.test(n)) out.push({ key: r, text: fs.readFileSync(p, "utf8") });
    }
  })(dir, "");
  return out;
}
export function mockSearch(kb, calls) {
  return {
    get: (name) => ({
      async search(opts) {
        calls && calls.push({ name, opts });
        const q = norm(opts.query).split(/\W+/).filter((w) => w.length > 2);
        const res = kb.map((d) => {
          const t = norm(d.text); let hit = 0;
          for (const w of q) if (t.includes(w)) hit++;
          return { id: d.key, type: "text", score: q.length ? hit / q.length : 0, text: d.text, item: { key: d.key, timestamp: 0, metadata: {} } };
        }).filter((c) => c.score >= (opts.ai_search_options?.retrieval?.match_threshold ?? 0.3)).sort((a, b) => b.score - a.score);
        return { search_query: opts.query, chunks: res.slice(0, opts.ai_search_options?.retrieval?.max_num_results || 10) };
      },
    }),
  };
}
