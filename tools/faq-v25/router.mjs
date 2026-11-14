// router.mjs · FAQ 2.5.0 · zero-LLM router for the book chat (browser or Cloudflare Worker).
//   route(question, faq, kb?)                 -> { book_id, version, results: [...] }   (sync, deterministic)
//   byId(faqId, faq)                          -> result for a quick-question button
//   routeWithSemantic(question, faq, kb, env) -> same as route, plus Workers AI + Vectorize fallback (Worker only)
// faq = faq_<book>.json (2.5.0), kb = chapter KB FULL json of the SAME book (optional but recommended).

// ------------------------------------------------------------------ text
export function fold(value) {                       // no diacritics, đ->d, lowercase, punctuation->space
  return String(value ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/đ/g, "d").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
export const normalize = fold;                      // backward-compatible name
function soft(value) {                              // keeps Vietnamese diacritics
  return String(value ?? "").normalize("NFC").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}

// A "term" keeps both spellings so that "giá" never matches "giả" when the reader typed accents,
// while unaccented typing ("gia sach") still works.
function term(text, abbr) {
  let toks = soft(text).split(" ").filter(Boolean);
  if (abbr) toks = toks.flatMap(t => (abbr.get(fold(t)) ?? t).split(" "));
  const f = toks.map(fold);
  return { toks, fold: f, plain: toks.map((t, i) => t === f[i]), key: f.join(" ") };
}
function find(q, p) {                               // phrase p inside query q, token-aligned
  const n = p.toks.length;
  if (!n || n > q.toks.length) return false;
  outer: for (let i = 0; i + n <= q.toks.length; i++) {
    for (let j = 0; j < n; j++) {
      const a = i + j;
      if (q.toks[a] !== p.toks[j] && !((q.plain[a] || p.plain[j]) && q.fold[a] === p.fold[j])) continue outer;
    }
    return true;
  }
  return false;
}

// ------------------------------------------------------------------ prepare
const cache = new WeakMap();
const KB_STOP = new Set(("la gi co khong cua cho nao nhung nhu the va duoc ve trong toi minh em anh chi ban oi a ha nhe vay " +
  "nay sach cuon quyen ai doc noi ban de cap viet phan tich nhac ra sao the nao bao nhieu mot cac nguoi lam " +
  "sao tai vi khi thi se da dang con hay hoac neu den tu voi tren duoi o day do kia cai ma nen can phai muon biet hoi " +
  "giup xem them dung rat qua lai ra vao len gio bao nhieu hon nhat cung deu chi moi roi luon thuc su that ok khong").split(" "));

export function prepare(faq) {
  if (cache.has(faq)) return cache.get(faq);
  const r = faq.routing ?? {};
  const abbr = new Map(Object.entries(r.abbreviations ?? {}).map(([k, v]) => [fold(k), soft(v)]));
  const lexicon = r.lexicon ?? {};
  const expand = g => [...new Set(g.flatMap(x => x.startsWith("@") ? (lexicon[x] ?? []) : [x]))]
    .map(x => term(x)).filter(t => t.toks.length).sort((a, b) => b.key.length - a.key.length);
  const cards = faq.cards.map(c => ({
    ...c,
    _keys: [...new Set([c.question, ...(c.aliases ?? [])].filter(Boolean))].map(x => term(x)),
    _sets: [c.signals, ...(c.signals_alt ?? [])].filter(s => s?.length).map(set => set.map(expand)),
    _exclude: (c.exclude ?? []).map(x => term(x)),
  }));
  const exact = new Map();
  for (const c of cards) for (const k of c._keys) {
    if (!exact.has(k.key)) exact.set(k.key, new Set());
    exact.get(k.key).add(c.id);
  }
  const ob = r.other_book ?? {};
  const p = {
    faq, cards, exact, abbr,
    byId: new Map(cards.map(c => [c.id, c])),
    otherNames: (ob.names ?? []).map(x => term(x)),
    otherTerms: (ob.terms ?? []).map(x => term(x)),
    otherTitle: ob.title ?? "",
    crossAllowed: new Set(r.cross_book_allowed ?? []),
    synonyms: Object.entries(r.synonyms ?? {}).map(([k, v]) => [term(k), fold(v)]),
    th: { phrase_min_words: 2, phrase_min_chars: 10, kb_min_coverage: 0.5, kb_min_score: 4, ...(r.thresholds ?? {}) },
    noMatch: r.no_match ?? { answer: "Mình chưa tìm thấy nội dung khớp trong cuốn đang chọn.", suggest: [] },
    title: (faq.catalog?.title ?? "").split("–")[0].trim(),
  };
  cache.set(faq, p);
  return p;
}

// Vietnamese words are mostly two syllables: index syllables (minus stop syllables) and syllable pairs.
function grams(toks) {
  const out = toks.filter(t => t && !KB_STOP.has(t));
  for (let i = 0; i + 1 < toks.length; i++) {
    if (toks[i] && toks[i + 1] && !(KB_STOP.has(toks[i]) && KB_STOP.has(toks[i + 1]))) out.push(toks[i] + "_" + toks[i + 1]);
  }
  return out;
}
const kbCache = new WeakMap();
function prepareKb(kb) {
  if (kbCache.has(kb)) return kbCache.get(kb);
  const docs = kb.cards.map(c => {
    const src = kb.sources?.[c.primary_source_id];
    const w = new Map();
    const add = (text, weight) => {
      for (const t of grams(fold(text).split(" "))) w.set(t, Math.max(w.get(t) ?? 0, weight));
    };
    add(c.answer, 1); add(src?.title, 2); add([c.question, c.heading_alias, ...(c.aliases ?? [])].join(" "), 3);
    return { c, src, w };
  });
  const df = new Map();
  for (const d of docs) for (const t of d.w.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = t => Math.log(1 + docs.length / (df.get(t) ?? docs.length));
  const exact = new Map();
  for (const d of docs) for (const k of [d.c.question, d.c.heading_alias, ...(d.c.aliases ?? [])].filter(Boolean)) exact.set(fold(k), d);
  const out = { docs, idf, df, exact };
  kbCache.set(kb, out);
  return out;
}

// ------------------------------------------------------------------ scoring
function scoreSignals(card, q) {
  if (!card._sets.length || card._exclude.some(e => find(q, e))) return 0;
  let best = 0;
  for (const set of card._sets) {
    let len = 0, ok = true;
    for (const group of set) {
      const hit = group.find(ph => find(q, ph));
      if (!hit) { ok = false; break; }
      len += hit.key.length;
    }
    if (ok) best = Math.max(best, set.length * 100 + len + (card.priority ?? 0) * 10);
  }
  return best;
}
function scorePhrase(card, q, th) {
  if (card._exclude.some(e => find(q, e))) return 0;
  let best = 0;
  for (const k of card._keys) {
    if (k.key.length < th.phrase_min_chars || k.toks.length < th.phrase_min_words || k.key === q.key) continue;
    if (k.key.length > best && find(q, k)) best = k.key.length;
  }
  if (!best) return 0;
  return best / q.key.length >= 0.6 ? 900 + best : 150 + best;
}
export function _rank(faq, text) { const p = prepare(faq); return rank(p, term(text, p.abbr)).slice(0, 4).map(x => [x.card.id, x.score]); }
function rank(p, q, filter = () => true) {
  const out = [];
  for (const c of p.cards) {
    if (!filter(c)) continue;
    const s = Math.max(scorePhrase(c, q, p.th), scoreSignals(c, q));
    if (s > 0) out.push({ card: c, score: s });
  }
  return out.sort((a, b) => b.score - a.score);
}

// ------------------------------------------------------------------ results
const cardResult = (card, how) => ({ type: "card", faq_id: card.id, answer: card.answer, action: card.action ?? null,
  source: card.source ?? null, flow: card.flow ?? null, match: how });
const choices = (list, answer = "Bạn muốn hỏi ý nào?") => ({ type: "choices", answer,
  options: list.map(({ card }) => ({ faq_id: card.id, label: card.question })) });
const switchBook = p => ({ type: "switch_book", target: p.otherTitle,
  answer: `Câu này thuộc cuốn **${p.otherTitle}**. Bấm **Đổi sách** để hỏi trong khung ${p.otherTitle}.` });
function kbResult(d, how, prefix = "") {
  const s = d.src;
  const label = !s ? null : s.number
    ? (/^\d/.test(s.number) ? "Mục " : "Phụ lục ") + s.number + " · " + s.title.split(".")[0]
    : s.title;
  return { type: "kb_card", kb_id: d.c.id, answer: prefix + d.c.answer, action: "read_sample", match: how,
    source: label ? [label, s.page ? "tr. " + s.page : ""].filter(Boolean).join(" · ") : null };
}

// ------------------------------------------------------------------ chapter KB
function kbSearch(p, q, kb) {
  if (!kb?.cards?.length) return null;
  const K = prepareKb(kb);
  const ex = K.exact.get(q.key);
  if (ex) return kbResult(ex, "kb_exact");
  const content = q.fold.filter(t => !KB_STOP.has(t) && t.length > 1);
  let terms = grams(q.fold).filter(t => K.df.has(t));
  for (const [syn, rep] of p.synonyms) if (find(q, syn)) terms.push(...grams(rep.split(" ")).filter(t => K.df.has(t)));
  terms = [...new Set(terms)];
  if (!terms.length || !content.length) return null;
  // Words that never appear in this book lower the confidence.
  if (content.filter(t => K.df.has(t)).length / content.length < 0.5 && terms.length < 2) return null;
  // Coverage counts every query gram, unknown ones at maximum weight, so a specific term missing
  // from this book ("điện hạt nhân") keeps a loose match out.
  const maxIdf = Math.log(1 + K.docs.length);
  const unknownSyllable = t => t.split("_").some(x => !KB_STOP.has(x) && !K.df.has(x));
  const total = [...new Set(grams(q.fold))]
    .reduce((s, t) => s + (K.df.has(t) ? K.idf(t) : unknownSyllable(t) ? maxIdf : 0), 0) || 1;
  const scored = K.docs.map(d => {
    let s = 0, cov = 0;
    for (const t of terms) { const w = d.w.get(t); if (w) { s += K.idf(t) * w; cov += K.idf(t); } }
    return { d, s, cov: cov / total };
  }).filter(x => x.s >= p.th.kb_min_score && x.cov >= p.th.kb_min_coverage).sort((a, b) => b.s - a.s);
  return scored.length ? kbResult(scored[0].d, "kb_lexical") : null;
}

// "Sách có nói về X không?" -> look for X specifically.
const TOPIC = /^(?:(?:sach|cuon|quyen)(?: sach)?(?: nay)? (?:co )?|co )(?:noi|ban|de cap|viet|phan tich|nhac|giai thich|huong dan|day|ke|chia se)(?: gi)?(?: ve| den| toi| cach)? (.+?)(?: (?:khong|chua|nao|ko|the nao|ra sao|nhu the nao|gi|vay|a|nhi))*$/;
const GENERIC_TOPIC = /^(?:gi|cai gi|chu de gi|noi dung gi|van de gi|nhung gi|gi vay|nhieu khong|cho ai|ai)$/;
function topicOf(q) {
  const m = q.key.match(TOPIC);
  if (!m || GENERIC_TOPIC.test(m[1])) return null;
  return m[1].split(" ").some(t => !KB_STOP.has(t)) ? m[1] : null;
}
const TOPIC_SKIP = /^(persona_|overview$|level$|practice$|price$|buy$|clarify$|greeting$|thanks$|worth_it$|read_time$)/;

// ------------------------------------------------------------------ one clause
function routeClause(p, raw, kb) {
  const q = term(raw, p.abbr);
  if (!q.toks.length) return cardResult(p.byId.get("clarify"), "empty");

  const ex = p.exact.get(q.key);
  if (ex?.size === 1) return cardResult(p.byId.get([...ex][0]), "exact");

  if (p.otherNames.some(n => find(q, n))) {
    const allowed = rank(p, q, c => p.crossAllowed.has(c.id));
    return allowed.length ? cardResult(allowed[0].card, "cross_book") : switchBook(p);
  }
  const usesOtherTerm = p.otherTerms.some(t => find(q, t));

  const topic = topicOf(q);
  if (topic) {
    const tq = term(topic, p.abbr);
    const touches = c => c._sets.some(set => set.some(g => g.some(ph => find(tq, ph)))) || c._keys.some(k => k.toks.length > 1 && find(tq, k));
    const inFaq = rank(p, q, c => !TOPIC_SKIP.test(c.id) && touches(c));
    if (inFaq.length && inFaq[0].score >= 100) return cardResult(inFaq[0].card, "topic_faq");
    const inKb = kbSearch(p, tq, kb);
    if (inKb && !(usesOtherTerm && inKb.match === "kb_lexical")) return { ...inKb, match: "topic_kb", answer: "Có. " + inKb.answer };
    if (usesOtherTerm) return switchBook(p);
    return { type: "topic_not_found", topic,
      answer: `Mình chưa thấy mục riêng về “${topic}” trong cuốn **${p.title}**. Bạn có thể xem cấu trúc sách hoặc chương đọc thử để kiểm tra.`,
      options: [{ faq_id: "toc", label: "Xem cấu trúc sách" }, { faq_id: "sample", label: "Đọc thử" }] };
  }

  const ranked = rank(p, q);
  if (ranked.length) {
    const [a, b] = ranked;
    if (b && b.card.id !== a.card.id && a.score < 900 && a.score - b.score <= 5)
      return choices(ranked.filter(x => a.score - x.score <= 5).slice(0, 3));
    if (!(usesOtherTerm && a.score < 200)) return cardResult(a.card, a.score >= 900 ? "phrase" : "signals");
  }
  const fromKb = kbSearch(p, q, kb);
  if (fromKb && !(usesOtherTerm && fromKb.match === "kb_lexical")) return fromKb;
  if (usesOtherTerm) return switchBook(p);
  return { type: "no_match", answer: p.noMatch.answer,
    options: (p.noMatch.suggest ?? []).map(id => ({ faq_id: id, label: labelFor(p, id) })) };
}
const labelFor = (p, id) => p.faq.quick_questions?.find(x => x.faq_id === id)?.label ?? p.byId.get(id)?.question ?? id;

function splitClauses(question) {
  const parts = String(question).split(/[?!.;\n]+/).map(s => s.trim()).filter(s => fold(s));
  const out = [];
  for (const part of parts) {
    if (out.length && fold(part).split(" ").length <= 2) out[out.length - 1] += " " + part;
    else out.push(part);
  }
  return out.slice(0, 3);
}

// ------------------------------------------------------------------ public API
const FILLER = new Set(["greeting", "thanks", "clarify", "no_match", "out_of_scope", "topic_not_found"]);
const keyOf = r => r.faq_id ?? r.kb_id ?? r.type;

export function route(question, faq, kb = null) {
  const p = prepare(faq);
  const wrap = results => ({ book_id: faq.book_id, version: faq.version, results });
  const whole = routeClause(p, question, kb);
  if (whole.match === "exact") return wrap([whole]);
  const clauses = splitClauses(question);
  if (clauses.length > 1) {
    const seen = new Set();
    const parts = clauses.map(c => routeClause(p, c, kb))
      .filter(r => !FILLER.has(keyOf(r)))
      .filter(r => !seen.has(keyOf(r)) && seen.add(keyOf(r)));
    if (parts.length >= 2) return wrap(parts.slice(0, 2));
    if (parts.length === 1 && FILLER.has(keyOf(whole))) return wrap(parts);
  }
  return wrap([whole]);
}

export function byId(faqId, faq) {
  const c = prepare(faq).byId.get(faqId);
  return c ? cardResult(c, "button") : null;
}

// Worker-only semantic fallback. Index: Vectorize, 1024 dims, cosine, namespace = book_id,
// metadata { kind: "faq" | "kb", ref: card id }. Built by worker.js POST /admin/reindex.
export async function routeWithSemantic(question, faq, kb, env) {
  const out = route(question, faq, kb);
  const r0 = out.results[0];
  if (!["no_match", "topic_not_found"].includes(r0.type) || !env?.AI || !env?.VECTORIZE) return out;
  const p = prepare(faq);
  const th = { semantic_accept: 0.8, semantic_suggest: 0.7, semantic_margin: 0.03, ...p.th };
  try {
    const emb = await env.AI.run("@cf/baai/bge-m3", { text: [String(question).slice(0, 500)] });
    const vec = emb?.data?.[0];
    if (!vec) return out;
    const res = await env.VECTORIZE.query(vec, { topK: 8, namespace: faq.book_id, returnMetadata: "all" });
    const best = new Map();
    for (const m of res.matches ?? []) {
      const k = m.metadata?.kind + ":" + m.metadata?.ref;
      if (!best.has(k) || best.get(k).score < m.score) best.set(k, m);
    }
    const top = [...best.values()].sort((a, b) => b.score - a.score);
    if (!top.length || top[0].score < th.semantic_suggest) return out;
    const kbDoc = ref => kb && prepareKb(kb).docs.find(x => x.c.id === ref);
    const toResult = m => {
      if (m.metadata.kind === "faq") return p.byId.has(m.metadata.ref) ? cardResult(p.byId.get(m.metadata.ref), "semantic") : null;
      const d = kbDoc(m.metadata.ref);
      return d ? kbResult(d, "semantic") : null;
    };
    if (top[0].score >= th.semantic_accept && (!top[1] || top[0].score - top[1].score >= th.semantic_margin)) {
      const hit = toResult(top[0]);
      if (hit) return { ...out, results: [{ ...hit, score: Number(top[0].score.toFixed(3)) }] };
    }
    const opts = top.slice(0, 3).map(m => {
      if (m.metadata.kind === "faq") return p.byId.has(m.metadata.ref) ? { faq_id: m.metadata.ref, label: p.byId.get(m.metadata.ref).question } : null;
      const d = kbDoc(m.metadata.ref);
      return d ? { kb_id: d.c.id, label: d.c.question } : null;
    }).filter(Boolean);
    if (opts.length) return { ...out, results: [{ type: "choices", answer: "Có phải bạn muốn hỏi:", options: opts, match: "semantic" }] };
  } catch (e) { /* optional layer: keep deterministic answer */ }
  return out;
}

// Pick a chapter-KB card by id (for kb_id options in choices).
export function kbById(kbId, kb) {
  const d = kb && prepareKb(kb).docs.find(x => x.c.id === kbId);
  return d ? kbResult(d, "button") : null;
}
