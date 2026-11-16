// Pure lookup & FAQ routing engine (v2.2.0 / v2.5.0).
// The caller loads the selected book's FAQ JSON and KB JSON before accepting questions.

import { route } from "./router.mjs";

export function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9.]+/g, " ")
    .trim();
}

function normPlain(value) {
  return normalize(value).replace(/\./g, " ").replace(/\s+/g, " ").trim();
}

const TYPO_MAP = [
  [/\bwebstie\b/g, "website"],
  [/\b(?:execl|exel)\b/g, "excel"],
  [/\b(?:ko|khg|hong|k)\b/g, "khong"],
  [/\btui\b/g, "toi"],
  [/\bcty\b/g, "cong ty"],
];

export function normalizeFaqQuery(value) {
  let s = normPlain(value);
  if (!s) return "";
  for (const [re, rep] of TYPO_MAP) {
    s = s.replace(re, rep);
  }
  return s.replace(/\s+/g, " ").trim();
}

function stripPolite(normStr) {
  if (!normStr) return "";
  return normStr
    .replace(
      /^(?:da\s+|vang\s+|oi\s+|ban\s+oi\s+|ad\s+oi\s+|admin\s+oi\s+|tro\s+ly\s+oi\s+|cho\s+(?:toi|minh|em|anh|chi)\s+(?:hoi|xin|biet)\s+|cho\s+(?:hoi|xin|biet)\s+|vay\s+|the\s+|con\s+)+/,
      ""
    )
    .replace(/\s+(?:nhe|nha|a|voi|vay|the|ha|nhi|vay\s+a|the\s+a|khong\s+a|duoc\s+khong\s+a)$/, "")
    .trim();
}

const OUT_OF_SCOPE_RE =
  /\b(thoi tiet|da nang|lau ga|la e|da lat|team building|gia vang|sjc|ty gia|usd|vnd|co phieu|bitcoin|chung khoan|may lanh|16 do|chop den|hop dong lao dong thu viec|bo luat lao dong|chinh sach hoan tien|doi tra hang|bong da|world cup|cong thuc nau an|admin command|print raw prompt|system instruction|system prompt|lay cap|danh cap|trang quan tri an|khong de lai dau vet ip|xam nhap trai phep)\b/;

const STOPWORDS = new Set(
  "la gi trong sach cua cho nao nhung nhu the va co khong duoc ve khi neu thi nen can muon lam sao tai vi ra o dau tu den voi cac mot nhieu hon nhat nay do ay vua roi dang se da viec cach diem phan loai muc buoc cong ty doanh nghiep to chuc ben minh chung toi ban em anh chi giup hay biet hoi tra loi ap dung trien khai su dung dung chuyen doi".split(
    " "
  )
);

const FOLLOWUP_RE =
  /\b(khau do|tieu chi nay|boi canh do|lo trinh vua roi|mo hinh do|khoan muc dau tien|vua liet ke|sai lam thu hai|vua noi|cau truc nhu vay|trong so do|nhu the|con tren|khoa nao|tru cot nao|vay voi|nhung neu|a quen)\b/;

const COMMERCE_CARD_IDS = new Set([
  "price",
  "buy",
  "delivery",
  "returns",
  "bulk",
  "buy_fallback",
]);

const EXTRA_CARD_ALIASES = {
  returns: [
    "co doi tra khong",
    "doi tra khong",
    "doi tra the nao",
    "co cho doi tra khong",
    "mua sach co doi tra khong",
  ],
  price: [
    "gia va cach mua",
    "gia cuon nay",
    "gia cuon sach nay",
    "cuon sach gia bao nhieu",
    "sach nay bao nhieu tien",
  ],
  sample: [
    "xem chuong doc thu",
    "link chuong doc thu",
    "doc thu sach",
    "doc thu cuon nay",
  ],
  ear: [
    "ear index giup lam gi",
    "ear index dung lam gi",
  ],
  ari: [
    "ari va ari ip dung lam gi",
    "ari dung lam gi",
    "ari va ari ip la gi",
  ],
  sme_fit: [
    "doanh nghiep nho bat dau sao",
    "sme bat dau sao",
  ],
  restructure: [
    "ai doi nen kinh te the nao",
    "ai thay doi nen kinh te the nao",
  ],
  bubble: [
    "dau tu ai co phai bong bong",
    "dau tu ai co phai bong bong khong",
  ],
  read_risk: [
    "sach co ban sau ve dao duc an toan va tac dong xa hoi khong",
  ],
  choose: [
    "co can doc ai first business truoc khong",
    "so sanh 2 cuon",
    "hai cuon sach khac nhau the nao",
    "doc cuon nao truoc",
  ],
  ari_vs_ear: [
    "ear index khac gi ari",
    "ear va ari khac nhau the nao",
    "so sanh ear index va ari",
    "phan biet ari va ear index",
  ],
};

// Kiểm tra xem câu hỏi có phải đang hỏi về chi phí triển khai / vận hành AI (chứ không phải giá mua sách)
export function isAiCostOrImplementationQuery(normQuery) {
  const q = normQuery || "";
  if (/\b(gia sach|mua sach|dat sach|don sach|cuon sach|cuon nay|in logo|bia sach|ebook|audiobook|phi ship|giao hang)\b/.test(q)) {
    return false;
  }
  if (
    /\b(chi phi|ngan sach|ton bao nhieu|het bao nhieu|bao gia|gia)\b/.test(q) &&
    /\b(trien khai|van hanh|dau tu|du an|he thong|mo hinh|agent|tac nhan|suy luan|huan luyen|token|pilot|sandbox|chuyen doi|go ai|tu van|vong doi|phan mem|erp|crm|tich hop|compute|ha tang)\b/.test(q)
  ) {
    return true;
  }
  if (/\bchi phi\b/.test(q) && !/\b(ship|giao hang|van chuyen)\b/.test(q)) {
    return true;
  }
  return false;
}

// Kiểm tra xem câu hỏi có phải yêu cầu đặt lịch tư vấn / báo giá dịch vụ / khảo sát EAR trực tiếp không
export function isDirectServiceIntentQuery(normQuery) {
  const q = normQuery || "";
  // Nếu hỏi về mua sách / đơn sách / hóa đơn mua sách thì không phải dịch vụ tư vấn
  if (/\b(mua sach|dat sach|dat mua|don sach|in logo|tang ban giam doc|gia sach|doi tra|phi ship|giao hang|nha xuat ban|nxb|isbn|bao nhieu trang|doc thu|chuong mau)\b/.test(q)) {
    return false;
  }
  // Nếu là câu hỏi phân vân sau khi đọc sách (thẻ consulting_next) thì để FAQ xử lý
  if (
    /\b(doc xong|sau khi doc)\b/.test(q) ||
    (/\b(tu danh gia|ear)\b/.test(q) && /\bhay\b/.test(q) && /\b(tu van|trao doi)\b/.test(q)) ||
    /\btu danh gia hay tu van\b/.test(q)
  ) {
    return false;
  }
  // Nếu là câu hỏi khái niệm sách ("là gì", "như thế nào", "ra sao", "khác nhau") thì không phải yêu cầu trực tiếp
  if (/\b(la gi|nghia la gi|khac nhau|khac gi|so sanh|trong sach|theo sach|chuong nao|muc nao|tai sao|vi sao)\b/.test(q)) {
    return false;
  }
  // Nếu có phủ định ("chưa cần", "không muốn"...) thì để lead-intent xử lý
  if (/\b(chua|khong|dung|thoi|bo qua|chi muon doc|chi doc|chi hoi)\b/.test(q) && /\b(tu van|khao sat|ear|demo|bao gia|lien he|dat lich)\b/.test(q)) {
    return true;
  }
  // Yêu cầu trực tiếp về tư vấn, demo, báo giá dịch vụ Go AI, hoặc xin link khảo sát EAR
  if (
    /\b(dat lich|hen lich|book demo|xin lich demo|goi lai giup|gap chuyen gia|gap tu van|gui proposal|nhan lam khong|nhan trien khai khong|bao gia tu go ai|xin bao gia|bao gia giup)\b/.test(q)
  ) {
    return true;
  }
  if (
    /\b(cho|xin|gui|muon|can|nho|giup)\b/.test(q) &&
    /\b(tu van|dat lich|demo|lien he tu van|link khao sat|link ear|khao sat ear|cham ear)\b/.test(q)
  ) {
    return true;
  }
  // Tình huống doanh nghiệp đang gặp vấn đề thực tế
  if (
    /\b(cong ty toi|doanh nghiep toi|ben toi|ben minh|ben em|ben anh|xuong toi|nha may toi)\b/.test(q) &&
    /\b(thu cong|nhap tay|nhap lieu|doi soat|hay sai|nhieu loi|qua tai|mat hai ngay|mat 2 ngay|dang dung excel|muon tu dong hoa|can tu dong hoa|san sang chua)\b/.test(q)
  ) {
    return true;
  }
  return false;
}

export function resolveActions(actionKey, faqData, pre = "", { disambiguateContact = false } = {}) {
  if (!actionKey || !faqData || !faqData.actions) return [];
  const def = faqData.actions[actionKey];
  if (!def) return [];
  if (Array.isArray(def.items)) {
    const out = [];
    for (const itemKey of def.items) {
      out.push(...resolveActions(itemKey, faqData, pre, { disambiguateContact }));
    }
    return out;
  }
  const targetRef = def.target_ref;
  if (targetRef === "sample_of_answered_book") {
    const fallbackSample =
      faqData.book_id === "ai_economy"
        ? pre + "/sach/nen-kinh-te-tri-tue/doc-thu/"
        : pre + "/sach/ai-first-business/doc-thu/";
    return [
      {
        id: "read_sample",
        label: def.label || "Đọc thử",
        href: faqData.catalog?.sample || fallbackSample,
      },
    ];
  }
  if (targetRef === "existing_website_contact") {
    return [
      {
        id: "contact",
        label: disambiguateContact ? "Liên hệ mua sách" : def.label || "Liên hệ",
        href: pre + "/lien-he/#form",
      },
    ];
  }
  if (targetRef === "existing_ear_survey") {
    return [
      {
        id: "ear_survey",
        label: def.label || "Làm khảo sát EAR",
        href: pre + "/danh-gia/ear-index/",
      },
    ];
  }
  if (targetRef === "existing_consulting_contact") {
    return [
      {
        id: "consulting_contact",
        label: def.label || "Liên hệ tư vấn",
        href: pre + "/lien-he/#form",
      },
    ];
  }
  return [];
}

export function lookupFaqById(faqId, faqData, pre = "") {
  if (!faqId || !faqData || !Array.isArray(faqData.cards)) return null;
  const card = faqData.cards.find((c) => c.id === faqId);
  if (!card) return null;
  return {
    type: "faq_cards",
    cards: [card],
    actions: resolveActions(card.action, faqData, pre),
  };
}

const cardAliasCache = new WeakMap();

function getCardAliasesNormalized(card, faqData) {
  if (cardAliasCache.has(card)) return cardAliasCache.get(card);
  const rawList = [
    card.question,
    ...(card.aliases || []),
    ...(EXTRA_CARD_ALIASES[card.id] || []),
  ];
  if (Array.isArray(faqData?.quick_questions)) {
    for (const qq of faqData.quick_questions) {
      if (qq.faq_id === card.id && qq.label) {
        rawList.push(qq.label);
      }
    }
  }
  const normalized = [...new Set(rawList.map(normalizeFaqQuery).filter(Boolean))];
  cardAliasCache.set(card, normalized);
  return normalized;
}

function isBulkBookQuery(q) {
  return (
    /\b(mua sach|dat sach|dat mua sach|don sach)\b.*\b(cong ty|doanh nghiep|ban giam doc|so luong lon|vat|hoa don|in logo)\b/.test(q) ||
    /\b(so luong lon|mua nhieu|cho cong ty|cho doanh nghiep|tang ban giam doc|in logo)\b.*\b(sach|hoa don|vat|uu dai|chiet khau)\b/.test(q) ||
    /\b(in logo len sach|mua sach co xuat hoa don vat|mua sach cho doanh nghiep|mua sach cho cong ty)\b/.test(q)
  );
}

function isOpportunityRiskQuery(q) {
  return (
    (/\bco hoi\b/.test(q) && /\brui ro\b/.test(q)) ||
    (/\bduoc gi\b/.test(q) && /\b(mat gi|doi mat rui ro|rui ro)\b/.test(q))
  );
}

function matchComparisonCard(q, strippedQ, faqData) {
  if (!faqData || !Array.isArray(faqData.cards)) return null;
  for (const id of ["choose", "ari_vs_ear", "series"]) {
    const card = faqData.cards.find((c) => c.id === id);
    if (!card) continue;
    const aliases = getCardAliasesNormalized(card, faqData);
    if (aliases.includes(q) || aliases.includes(strippedQ)) {
      return card;
    }
    for (const al of aliases) {
      if (al.split(" ").length >= 3 && ((" " + q + " ").includes(" " + al + " ") || (" " + strippedQ + " ").includes(" " + al + " "))) {
        return card;
      }
    }
  }
  // Kiểm tra thêm câu hỏi so sánh ARI và EAR tự nhiên
  if (/\bari\b/.test(q) && /\bear\b/.test(q) && /\b(khac|so sanh|phan biet|8 tru cot|tam tru cot)\b/.test(q)) {
    return faqData.cards.find((c) => c.id === "ari_vs_ear") || null;
  }
  // Kiểm tra câu hỏi so sánh 2 cuốn hoặc hỏi đọc cuốn nào trước
  if (
    (/\b(hai cuon|2 cuon|hai sach|2 sach)\b/.test(q) && /\b(khac|trung|so sanh|truoc|thu tu|chon|mua cuon nao|doc cuon nao)\b/.test(q)) ||
    (/\b(nen doc|nen mua|chon)\s+cuon\s+nao\b/.test(q)) ||
    (/\bdoc\s+(?:cuon\s+)?(?:ai economy|nen kinh te tri tue|ai first business)\s+truoc\b/.test(q))
  ) {
    return faqData.cards.find((c) => c.id === "choose") || null;
  }
  return null;
}

function checkBothBooksPriceOrSample(q, faqData, currentBookCode, pre) {
  const mentionsBoth =
    /\b(ca hai cuon|ca 2 cuon|hai cuon|2 cuon|ca hai sach|ca 2 sach|hai sach|2 sach|moi cuon)\b/.test(q) ||
    (/\b(ai economy|nen kinh te tri tue)\b/.test(q) && /\b(ai first business)\b/.test(q));
  if (!mentionsBoth) return null;

  const otherId = currentBookCode === "aiec" ? "aifb" : "aiec";
  const otherTitle = currentBookCode === "aiec" ? "AI First Business" : "AI Economy";

  if (/\b(doc thu|chuong mau|link mau|xem thu)\b/.test(q)) {
    const sampleCard = faqData.cards.find((c) => c.id === "sample");
    if (sampleCard) {
      return {
        type: "faq_cards",
        cards: [sampleCard],
        actions: resolveActions(sampleCard.action, faqData, pre),
        switchBook: {
          targetId: otherId,
          targetTitle: otherTitle,
          message: `Để xem chương đọc thử của cuốn **${otherTitle}**, bạn có thể bấm **Đổi sách**.`,
        },
      };
    }
  }
  if (/\b(gia|bao nhieu tien)\b/.test(q)) {
    const priceCard = faqData.cards.find((c) => c.id === "price");
    if (priceCard) {
      return {
        type: "faq_cards",
        cards: [priceCard],
        actions: resolveActions(priceCard.action, faqData, pre),
        switchBook: {
          targetId: otherId,
          targetTitle: otherTitle,
          message: `Để xem giá của cuốn **${otherTitle}**, bạn có thể bấm **Đổi sách**.`,
        },
      };
    }
  }
  return null;
}

function checkExplicitOtherBookMention(q, currentBookCode) {
  if (currentBookCode === "aiec") {
    if (/\b(ai first business|tai thiet doanh nghiep trong ky nguyen ai|cuon business|sach business)\b/.test(q)) {
      return {
        type: "switch_book",
        targetId: "aifb",
        targetTitle: "AI First Business",
        message:
          "Bạn đang ở khung chat của cuốn **AI Economy**. Để xem nội dung, chương đọc thử hoặc giá của cuốn **AI First Business**, vui lòng bấm **Đổi sách**.",
      };
    }
  } else {
    const mentionsAiEconomy = /\b(ai economy|cuon economy|sach economy)\b/.test(q);
    const mentionsNktttAsBook =
      /\b(cuon|sach|theo|trong|doc thu|chuong mau|xem thu|gia|mua|dat)\s+(?:cuon\s+|sach\s+)?nen kinh te tri tue\b/.test(q) ||
      /\bnen kinh te tri tue\s+(?:gia bao nhieu|noi ve gi|danh cho ai|doc thu|ban o dau|co doi tra khong|bao nhieu trang|xuat ban nam nao)\b/.test(q);
    if (mentionsAiEconomy || mentionsNktttAsBook) {
      return {
        type: "switch_book",
        targetId: "aiec",
        targetTitle: "AI Economy",
        message:
          "Bạn đang ở khung chat của cuốn **AI First Business**. Để xem nội dung, chương đọc thử hoặc giá của cuốn **AI Economy**, vui lòng bấm **Đổi sách**.",
      };
    }
  }
  return null;
}

function checkOpportunityRiskEntities(q, faqData) {
  if (!isOpportunityRiskQuery(q)) return null;

  const hasNational = /\b(quoc gia|dat nuoc|chinh phu|nha nuoc)\b/.test(q);
  const hasCompany = /\b(doanh nghiep|cong ty|to chuc)\b/.test(q);
  const hasCitizen = /\b(nguoi dan|nguoi lao dong|ca nhan|nhan vien)\b/.test(q);

  const matchedIds = [];
  if (hasNational) matchedIds.push("national");
  if (hasCompany) matchedIds.push("company");
  if (hasCitizen) matchedIds.push("citizen");

  if (matchedIds.length >= 1) {
    const cards = matchedIds
      .map((id) => faqData.cards.find((c) => c.id === id))
      .filter(Boolean);
    if (cards.length) {
      return {
        type: "faq_cards",
        cards,
        actions: [],
      };
    }
  }

  return {
    type: "clarify_entity",
    message:
      "Bạn muốn tìm hiểu cơ hội và rủi ro của AI ở cấp độ quốc gia, doanh nghiệp, hay người dân và người lao động?",
    choices: [
      { id: "national", label: "Quốc gia" },
      { id: "company", label: "Doanh nghiệp" },
      { id: "citizen", label: "Người dân và người lao động" },
    ],
  };
}

function matchSingleFaqCard(rawClause, faqData) {
  const q = normalizeFaqQuery(rawClause);
  if (!q) return null;
  const stripped = stripPolite(q);
  const aiCostGuard = isAiCostOrImplementationQuery(q);

  // Ưu tiên kiểm tra thẻ so sánh trước
  const compCard = matchComparisonCard(q, stripped, faqData);
  if (compCard) return compCard;

  // Ưu tiên kiểm tra câu hỏi B2B mua sách số lượng lớn + hóa đơn / công ty (thẻ bulk)
  if (!aiCostGuard) {
    const bulkCard = faqData.cards.find((c) => c.id === "bulk");
    if (bulkCard) {
      const bulkAliases = getCardAliasesNormalized(bulkCard, faqData);
      if (bulkAliases.includes(q) || bulkAliases.includes(stripped) || isBulkBookQuery(q)) {
        return bulkCard;
      }
    }
  }

  // Pass 1: Khớp chính xác câu hỏi hoặc alias (hoặc sau khi lược từ xã giao đầu/cuối)
  for (const card of faqData.cards) {
    if (aiCostGuard && COMMERCE_CARD_IDS.has(card.id)) continue;
    const aliases = getCardAliasesNormalized(card, faqData);
    if (aliases.includes(q) || (stripped && aliases.includes(stripped))) {
      return card;
    }
  }

  // Nếu là câu hỏi cơ hội & rủi ro (1 hoặc nhiều chủ thể hoặc chưa rõ chủ thể), để hàm chuyên biệt xử lý
  if (isOpportunityRiskQuery(q)) {
    return null;
  }

  // Nếu là yêu cầu dịch vụ tư vấn / khảo sát EAR trực tiếp thì không ép khớp mờ vào FAQ
  if (isDirectServiceIntentQuery(q)) {
    return null;
  }

  // Pass 2: Khớp cụm cụ thể trong câu dài (loại trừ thẻ clarify và kiểm soát chặt cụm ngắn như "đọc thử")
  const qWords = (stripped || q).split(" ").filter(Boolean);
  const contentWords = qWords.filter((w) => w.length > 1 && !STOPWORDS.has(w));

  let bestCard = null;
  let bestScore = 0;

  for (const card of faqData.cards) {
    if (card.id === "clarify") continue;
    if (aiCostGuard && COMMERCE_CARD_IDS.has(card.id)) continue;

    const aliases = getCardAliasesNormalized(card, faqData);
    for (const al of aliases) {
      const alWords = al.split(" ").filter(Boolean);
      // Cụm "đọc thử" (2 từ) trong câu dài: chỉ khớp khi rõ đang hỏi về sách/chương mẫu
      if (al === "doc thu" || al === "dat mua" || al === "gia ban") {
        if (al === "doc thu") {
          const isAboutBookSample =
            /\b(sach|cuon|chuong|link|mau|xem|trang|o dau|cho toi|cho minh|muon|xin)\b/.test(q) &&
            !/\b(tac nhan|agent|mo hinh|du lieu|sandbox|quy trinh|thu nghiem)\b/.test(q);
          if (!isAboutBookSample) continue;
        } else if (aiCostGuard) {
          continue;
        }
      }

      if (alWords.length >= 2 && ((" " + q + " ").includes(" " + al + " ") || (" " + stripped + " ").includes(" " + al + " "))) {
        const alContent = alWords.filter((w) => w.length > 1 && !STOPWORDS.has(w));
        const coverage = contentWords.length
          ? alContent.filter((w) => contentWords.includes(w)).length / contentWords.length
          : 1;
        // Chỉ nhận khi cụm khớp từ 3 từ trở lên, hoặc cụm 2 từ nhưng chiếm đa số từ khóa câu hỏi
        if (alWords.length >= 3 || coverage >= 0.5 || qWords.length <= 5) {
          const score = alWords.length * 10 + coverage * 5 + (card.id === "bulk" ? 3 : 0);
          if (score > bestScore) {
            bestScore = score;
            bestCard = card;
          }
        }
      }
    }
  }

  if (bestCard) return bestCard;

  // Pass 3: Dự phòng cho câu hỏi mua sách / đơn sách chung -> buy_fallback
  if (
    !aiCostGuard &&
    /\b(mua sach|dat sach|dat mua sach|don sach|don hang sach|ho tro mua sach|hoi ve don sach|sach ban o dau)\b/.test(q)
  ) {
    return faqData.cards.find((c) => c.id === "buy_fallback") || faqData.cards.find((c) => c.id === "buy") || null;
  }

  return null;
}

function checkExclusiveOtherBookTerms(q, currentBookCode) {
  if (currentBookCode === "aiec") {
    if (
      /\b(ear index|khao sat ear|mo hinh 3a|ba nac 3a|adopt adapt advance|\badapt\b|ho so agent|6 khoa an toan|sau khoa an toan|ai lifecycle card|work chart|so do cong viec|bolt on|shadow ai|roi hai tang|lo trinh 90 ngay|4 mo hinh kinh doanh ai native|bon mo hinh kinh doanh ai native|tu sep sang nhac truong)\b/.test(
        q
      ) &&
      !/\b(ari|so sanh|khac nhau|khac gi)\b/.test(q)
    ) {
      return {
        type: "switch_book",
        targetId: "aifb",
        targetTitle: "AI First Business",
        message:
          "Nội dung này thuộc cuốn **AI First Business**. Bạn có thể bấm **Đổi sách** để xem câu trả lời trong khung AI First Business.",
      };
    }
  } else {
    if (
      /\b(nha may tri tue|ai factory|ari ip|ari dia phuong|\bari\b|9 tang cua nen kinh te|chin tang kinh te|khung chin tang|bay trang thai cua mot con so|7 trang thai cua mot con so|tu hecta sang megawatt|stargate|unctad|oxford insights|170 nen kinh te|4 lan song fdi|bon lan song fdi|bong bong ai|ai co phai bong bong)\b/.test(
        q
      ) &&
      !/\b(ear|so sanh|khac nhau|khac gi)\b/.test(q)
    ) {
      return {
        type: "switch_book",
        targetId: "aiec",
        targetTitle: "AI Economy",
        message:
          "Nội dung này thuộc cuốn **AI Economy**. Bạn có thể bấm **Đổi sách** để xem câu trả lời trong khung AI Economy.",
      };
    }
  }
  return null;
}

function splitMultiIntentParts(question) {
  const cleaned = String(question || "")
    .replace(/[“”"]/g, " ")
    .trim();
  // Tách theo dấu kết câu (?, !, ;, xuống dòng, hoặc dấu chấm theo sau bởi khoảng trắng)
  const primaryParts = cleaned
    .split(/(?:[?!;\n]+|\.\s+)/)
    .map((s) => s.trim())
    .filter(Boolean);

  const result = [];
  for (const part of primaryParts) {
    // Nếu một phần có từ nối "và" nối hai câu hỏi độc lập
    const subParts = part
      .split(/\s+(?:và|va|cùng với|đồng thời|ngoài ra|bên cạnh đó)\s+/i)
      .map((s) => s.trim())
      .filter(Boolean);
    if (subParts.length > 1) {
      result.push(...subParts);
    } else {
      result.push(part);
    }
  }
  return result;
}

export function lookupFaq(question, faqData, selection = "aifb", pre = "") {
  if (!faqData || !Array.isArray(faqData.cards)) {
    return { type: "unanswered" };
  }
  const isAiec =
    selection === "aiec" ||
    selection === "ai_economy" ||
    faqData.book_id === "ai_economy";
  const currentBookCode = isAiec ? "aiec" : "aifb";

  const q = normalizeFaqQuery(question);
  if (!q) return { type: "unanswered" };
  const stripped = stripPolite(q);

  // 1. Kiểm tra thẻ so sánh (choose, ari_vs_ear, series) trước khi kiểm tra nhắc tên cuốn khác
  const compCard = matchComparisonCard(q, stripped, faqData);
  if (compCard) {
    return {
      type: "faq_cards",
      cards: [compCard],
      actions: resolveActions(compCard.action, faqData, pre),
    };
  }

  // 2. Kiểm tra hỏi giá hoặc chương đọc thử của cả hai cuốn
  const bothResult = checkBothBooksPriceOrSample(q, faqData, currentBookCode, pre);
  if (bothResult) return bothResult;

  // 3. Kiểm tra gọi đích danh cuốn sách còn lại
  const otherBookMention = checkExplicitOtherBookMention(q, currentBookCode);
  if (otherBookMention) return otherBookMention;

  // 4. Kiểm tra khớp chính xác toàn bộ câu hỏi với 1 thẻ FAQ duy nhất (kể cả câu hỏi mẫu có dấu chấm hoặc chữ "và")
  const aiCostGuard = isAiCostOrImplementationQuery(q);
  for (const card of faqData.cards) {
    if (aiCostGuard && COMMERCE_CARD_IDS.has(card.id)) continue;
    const aliases = getCardAliasesNormalized(card, faqData);
    if (aliases.includes(q) || (stripped && aliases.includes(stripped))) {
      return {
        type: "faq_cards",
        cards: [card],
        actions: resolveActions(card.action, faqData, pre),
      };
    }
  }

  // 4b. Câu hỏi kết hợp mua sách doanh nghiệp / số lượng lớn và hóa đơn / VAT / in logo / chiết khấu (không kèm yêu cầu tư vấn riêng) -> ưu tiên thẻ bulk
  if (!aiCostGuard) {
    const hasSeparateConsultingOrConcept =
      /\b(dat lich|hen lich|demo|khao sat|ear|adapt|3a|roi|agent|shadow ai|nha may tri tue|ari|bong bong|tu van)\b/.test(q);
    if (isBulkBookQuery(q) && !hasSeparateConsultingOrConcept) {
      const bulkCard = faqData.cards.find((c) => c.id === "bulk");
      if (bulkCard) {
        return {
          type: "faq_cards",
          cards: [bulkCard],
          actions: resolveActions(bulkCard.action, faqData, pre),
        };
      }
    }
  }

  // 5. Kiểm tra câu hỏi cơ hội & rủi ro theo chủ thể (quốc gia / doanh nghiệp / người dân)
  const oppRiskResult = checkOpportunityRiskEntities(q, faqData);
  if (oppRiskResult) return oppRiskResult;

  // 6. Kiểm tra câu ghép nhiều ý (ví dụ: "Adapt là gì? Sách giá bao nhiêu?", "Giá trị thực tiễn và có ví dụ công việc thực tế không?")
  const parts = splitMultiIntentParts(question);
  if (parts.length > 1) {
    const matchedCards = [];
    const unmatchedParts = [];
    const seenCardIds = new Set();
    let hasServiceContact = false;
    let hasServiceEar = false;

    for (const part of parts) {
      const partNorm = normalizeFaqQuery(part);
      if (!partNorm) continue;
      const card = matchSingleFaqCard(part, faqData);
      if (card && !seenCardIds.has(card.id)) {
        seenCardIds.add(card.id);
        matchedCards.push(card);
      } else if (!card && isDirectServiceIntentQuery(partNorm)) {
        if (/\b(khao sat|ear)\b/.test(partNorm) && !/\b(chua|khong|ko)\b/.test(partNorm)) {
          hasServiceEar = true;
        } else if (/\b(tu van|dat lich|demo|bao gia|lien he|proposal)\b/.test(partNorm) && !/\b(chua|khong|ko)\b/.test(partNorm)) {
          hasServiceContact = true;
        }
      } else if (!card) {
        unmatchedParts.push(part);
      }
    }

    if (
      matchedCards.length >= 2 ||
      (matchedCards.length >= 1 && (hasServiceContact || hasServiceEar || unmatchedParts.length >= 1))
    ) {
      const hasBookContactCard = matchedCards.some(
        (c) => c.action === "contact" || c.action === "sample_and_contact"
      );
      const disambiguateContact = hasBookContactCard && hasServiceContact;
      const allActions = [];
      const seenActionIds = new Set();

      for (const c of matchedCards) {
        const acts = resolveActions(c.action, faqData, pre, { disambiguateContact });
        for (const a of acts) {
          const key = a.id + ":" + a.label;
          if (!seenActionIds.has(key)) {
            seenActionIds.add(key);
            allActions.push(a);
          }
        }
      }
      if (hasServiceEar) {
        const key = "ear_survey:Làm khảo sát EAR";
        if (!seenActionIds.has(key)) {
          seenActionIds.add(key);
          allActions.push({
            id: "ear_survey",
            label: "Làm khảo sát EAR",
            href: pre + "/danh-gia/ear-index/",
          });
        }
      }
      if (hasServiceContact) {
        const key = "consulting_contact:Liên hệ tư vấn";
        if (!seenActionIds.has(key)) {
          seenActionIds.add(key);
          allActions.push({
            id: "consulting_contact",
            label: "Liên hệ tư vấn",
            href: pre + "/lien-he/#form",
          });
        }
      }

      return {
        type: "faq_cards",
        cards: matchedCards,
        unmatchedParts,
        actions: allActions,
        hasServiceContact,
        hasServiceEar,
      };
    }
  }

  // 7. Khớp câu đơn theo cụm cụ thể
  const singleCard = matchSingleFaqCard(question, faqData);
  if (singleCard) {
    return {
      type: "faq_cards",
      cards: [singleCard],
      actions: resolveActions(singleCard.action, faqData, pre),
    };
  }

  // 8. Kiểm tra thuật ngữ riêng của cuốn sách còn lại
  const exclusiveOther = checkExclusiveOtherBookTerms(q, currentBookCode);
  if (exclusiveOther) return exclusiveOther;

  // 9. Bộ định tuyến Router v2.5.0: khớp tín hiệu ngữ nghĩa (signals), câu khẩu ngữ, lỗi chính tả
  if (typeof route === "function") {
    try {
      const routerResult = route(question, faqData);
      const top = routerResult?.results?.[0];
      if (top && top.type === "card" && top.faq_id) {
        const card = faqData.cards.find((c) => c.id === top.faq_id);
        if (card) {
          return {
            type: "faq_cards",
            cards: [card],
            actions: resolveActions(card.action, faqData, pre),
          };
        }
      } else if (top && top.type === "switch_book") {
        return {
          type: "switch_book",
          message: top.answer,
          targetId: isAiec ? "aifb" : "aiec",
          targetTitle: isAiec ? "AI First Business" : "AI Economy",
        };
      } else if (top && top.type === "choices" && Array.isArray(top.options)) {
        return {
          type: "clarify_entity",
          message: top.answer,
          choices: top.options.map((o) => ({ id: o.faq_id, label: o.label })),
        };
      }
    } catch (_) {}
  }

  return { type: "unanswered" };
}

export function lookup(question, books, history = []) {
  const query = normalize(question);
  if (!query) return { type: "unanswered", results: [] };
  if (/\b(toan van|nguyen van|nguyen chuong|chep lai|100 noi dung|tat ca cac file)\b/.test(query)) {
    return { type: "unanswered", results: [] };
  }
  if (OUT_OF_SCOPE_RE.test(query)) {
    return { type: "unanswered", results: [] };
  }
  if (books.length === 1) {
    const bid = books[0].book_id;
    if (
      bid === "aiec" &&
      /\b(ear index|mo hinh 3a|adopt adapt advance|lo trinh 90 ngay|ma tran xay mua hop tac|shadow ai|bong toi ai|6 khoa an toan|sau khoa an toan|ai lifecycle card|work chart|cach tinh chi phi|chi phi vong doi|quy trinh tuyen dung|quy trinh nhan su)\b/.test(
        query
      ) &&
      !/\b(khung quoc gia|ai economy|nen kinh te tri tue|doi chieu|khac nhau)\b/.test(query)
    ) {
      return { type: "unanswered", results: [] };
    }
    if (
      bid === "aifb" &&
      /\b(unctad|oxford insights|170 nen kinh te|193 quoc gia|ari ip|ari dia phuong|tsmc|asml|cowos|stargate|chips act|nha may tri tue|ai factory|9 tang cua nen kinh te|chin tang cua nen kinh te)\b/.test(
        query
      ) &&
      !/\b(ear index|ai first business|doi chieu|khac nhau)\b/.test(query)
    ) {
      return { type: "unanswered", results: [] };
    }
  }

  const exactQuestions = books.flatMap((book) =>
    book.cards
      .filter((card) => normalize(card.question) === query)
      .map((card) => ({ bookId: book.book_id, ...card }))
  );
  if (exactQuestions.length === 1) return { type: "card", results: exactQuestions };
  if (exactQuestions.length > 1) {
    return {
      type: "choices",
      results: exactQuestions.map(({ id, bookId, question }) => ({ id, bookId, question })),
    };
  }

  const locator = query.match(/\b(hinh|bang|muc|chuong|trang) ([a-e]?\d{1,3}|[a-e])(?:\.(\d{1,2}))?\b/);
  if (locator && query.split(" ").length <= 7) {
    const [, label, first, second] = locator;
    const kind = { hinh: "figure", bang: "table", muc: "section", chuong: "chapter" }[label];
    const number = second ? first + "." + second : first;
    if (label === "trang") {
      const results = books.flatMap((book) => {
        const sourceId = book.print_pages[number];
        return sourceId
          ? [
              {
                bookId: book.book_id,
                sourceId,
                ...book.sources[sourceId],
                page: Number(number),
                end_page: Number(number),
              },
            ]
          : [];
      });
      return { type: results.length ? "references" : "unanswered", results };
    }
    const results = books.flatMap((book) =>
      Object.entries(book.sources)
        .filter(
          ([id, source]) =>
            source.kind === kind &&
            (kind === "chapter" ? id.endsWith("ch" + first.padStart(2, "0")) : source.number.toLowerCase() === number)
        )
        .map(([sourceId, source]) => ({ bookId: book.book_id, sourceId, ...source }))
    );
    return { type: results.length ? "references" : "unanswered", results: results.slice(0, 8) };
  }

  const common = new Set("la gi trong sach cua cho nao nhung nhu the va co khong duoc ve".split(" "));
  const terms = [...new Set(query.split(" ").filter((term) => term.length > 1 && !common.has(term)))];

  // Tier 1: Strict canonical & short-phrase match
  const candidates = books
    .flatMap((book) =>
      book.cards.map((card) => {
        const keys = [card.question, ...(card.aliases || [])].map(normalize).filter(Boolean);
        const exact = keys.includes(query) || normalize(card.heading_alias ?? "") === query;
        const phrase = keys.some((key) => key.length >= 3 && (" " + query + " ").includes(" " + key + " "));
        const cardTerms = new Set(keys.join(" ").split(" ").filter(Boolean));
        const covered = terms.length ? terms.filter((term) => cardTerms.has(term)).length / terms.length : 0;
        const rank = exact
          ? 3
          : phrase && covered >= 0.6
            ? 2
            : (phrase && covered >= 0.45) || (terms.length >= 2 && covered >= 0.75)
              ? 1
              : 0;
        return { bookId: book.book_id, ...card, rank, covered };
      })
    )
    .filter((card) => card.rank)
    .sort((a, b) => b.rank - a.rank || b.covered - a.covered);

  if (
    candidates.length &&
    (candidates.length === 1 ||
      candidates[0].rank > candidates[1].rank ||
      candidates[0].covered > candidates[1].covered + 0.15)
  ) {
    return { type: "card", results: candidates.slice(0, 1) };
  }

  // Tier 2: Natural-language phrase, bigram & distinctive-term matching
  let combinedQuery = query;
  if (Array.isArray(history) && history.length && FOLLOWUP_RE.test(query)) {
    const prevUser = [...history]
      .reverse()
      .find((h) => h && (h.r === "u" || h.role === "user") && normalize(h.t || h.content) !== query);
    if (prevUser) {
      combinedQuery = normalize((prevUser.t || prevUser.content) + " " + query);
    }
  }

  const qWords = combinedQuery.split(" ").filter(Boolean);
  const contentTerms = [...new Set(qWords.filter((t) => t.length > 1 && !STOPWORDS.has(t)))];
  const activeTerms = contentTerms.length ? contentTerms : terms;
  const bigrams = [];
  for (let i = 0; i < qWords.length - 1; i++) {
    if (
      qWords[i].length > 1 &&
      qWords[i + 1].length > 1 &&
      !(STOPWORDS.has(qWords[i]) && STOPWORDS.has(qWords[i + 1]))
    ) {
      bigrams.push(qWords[i] + " " + qWords[i + 1]);
    }
  }

  const nlCandidates = books
    .flatMap((book) =>
      book.cards.map((card) => {
        const keys = [card.question, ...(card.aliases || [])].map(normalize).filter(Boolean);
        const srcTitle = normalize(book.sources?.[card.primary_source_id]?.title || "");
        const ansNorm = normalize(card.answer || "");
        const headText = keys.join(" ") + " " + srcTitle;

        let maxKeyWords = 0;
        for (const k of keys) {
          const kwCount = k.split(" ").filter(Boolean).length;
          if (
            k.length >= 4 &&
            ((" " + query + " ").includes(" " + k + " ") || (" " + combinedQuery + " ").includes(" " + k + " "))
          ) {
            if (kwCount > maxKeyWords) maxKeyWords = kwCount;
          }
        }

        const headSet = new Set(headText.split(" ").filter(Boolean));
        const ansSet = new Set(ansNorm.split(" ").filter(Boolean));

        const headHits = activeTerms.filter((t) => headSet.has(t)).length;
        const ansHits = activeTerms.filter((t) => ansSet.has(t)).length;
        const bgHeadHits = bigrams.filter((bg) => (" " + headText + " ").includes(" " + bg + " ")).length;
        const bgAnsHits = bigrams.filter((bg) => (" " + ansNorm + " ").includes(" " + bg + " ")).length;

        const headCoverage = activeTerms.length ? headHits / activeTerms.length : 0;
        const score = maxKeyWords * 6 + bgHeadHits * 4 + headHits * 2.5 + bgAnsHits * 1.8 + ansHits * 0.6;

        const valid =
          maxKeyWords >= 2 ||
          bgHeadHits >= 2 ||
          (bgHeadHits >= 1 && headHits >= 2) ||
          (headHits >= 3 && headCoverage >= 0.45);
        return { bookId: book.book_id, ...card, score, maxKeyWords, headHits, bgHeadHits, valid };
      })
    )
    .filter((c) => c.valid)
    .sort((a, b) => b.score - a.score || b.maxKeyWords - a.maxKeyWords || b.headHits - a.headHits);

  if (nlCandidates.length) {
    if (
      nlCandidates.length === 1 ||
      nlCandidates[0].score >= nlCandidates[1].score * 1.12 ||
      nlCandidates[0].maxKeyWords > nlCandidates[1].maxKeyWords
    ) {
      return { type: "card", results: nlCandidates.slice(0, 1) };
    }
    return {
      type: "choices",
      results: nlCandidates.slice(0, 4).map(({ id, bookId, question }) => ({ id, bookId, question })),
    };
  }

  if (candidates.length) {
    return {
      type: "choices",
      results: candidates.slice(0, 4).map(({ id, bookId, question }) => ({ id, bookId, question })),
    };
  }

  const refTerms = activeTerms.filter((t) => t.length >= 3 && !/^(tui|toi|minh|xin|can|muon|nho|hoi|xem)$/.test(t));
  const references =
    refTerms.length >= 2
      ? books
          .flatMap((book) =>
            Object.entries(book.sources).map(([sourceId, source]) => {
              const title = new Set(normalize(source.title).split(" "));
              const score = refTerms.filter((term) => title.has(term)).length;
              return { bookId: book.book_id, sourceId, ...source, score };
            })
          )
          .filter((source) => source.score >= 2 && source.score / refTerms.length >= 0.6)
          .sort((a, b) => b.score - a.score)
      : [];
  if (references.length) {
    const refCards = references.flatMap((ref) => {
      const book = books.find((b) => b.book_id === ref.bookId);
      return (book?.cards || [])
        .filter((c) => c.primary_source_id === ref.sourceId)
        .map((c) => ({ bookId: ref.bookId, ...c }));
    });
    if (refCards.length === 1) return { type: "card", results: refCards };
    if (refCards.length > 1) {
      return {
        type: "choices",
        results: refCards.slice(0, 4).map(({ id, bookId, question }) => ({ id, bookId, question })),
      };
    }
  }
  return { type: "unanswered", results: [] };
}
