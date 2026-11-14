// Bộ phân loại ý định (Lead Intent & Post-Answer Suggestion Engine) v1.0.0
// Không dùng LLM, không dùng DB, quy tắc khớp đầu tiên thắng (first_matching_rule_wins).

export const LEAD_INTENT_CONFIG = {
  schema_version: "1.0.0",
  locale: "vi-VN",
  book_answer_word_limits: {
    normal_min: 60,
    normal_max: 100,
    complex_max: 120,
    exclude_source_line: true,
  },
  aliases: {
    "cty": "công ty",
    "dn": "doanh nghiệp",
    "bên e": "bên em",
    "bên a": "bên anh",
    "giúp a": "giúp anh",
    "giúp e": "giúp em",
    "tvan": "tư vấn",
    "bgia": "báo giá",
    "execl": "excel",
    "exel": "excel",
    "tui": "tôi",
    "cty tui": "công ty tôi",
    "bên tui": "bên tôi",
    "ko": "không",
    "k": "không",
    "khg": "không",
    "hong": "không",
    "hông": "không",
    "hổng": "không",
    "kô": "không",
    "sất": "sát",
    "khảo sất": "khảo sát",
  },
  clause_break_words: [
    "nhưng",
    "tuy nhiên",
    "còn",
    "riêng",
    "thay vào đó",
    "và",
    "chứ",
    "mà",
  ],
  clause_break_punctuation: [".", "?", "!", ";", "\n", ","],
  context: {
    recent_user_turns: 3,
    context_max_age_minutes: 20,
    pending_valid_user_turns: 1,
    reset_on_book_change: true,
    repeat_cta_window_turns: 3,
  },
  groups: {
    request: [
      "cho tôi xin",
      "cho tôi",
      "cho xin",
      "xin",
      "gửi tôi",
      "gửi giúp",
      "giúp tôi",
      "giúp mình",
      "nhờ",
      "muốn",
      "cần",
      "cho mình",
      "cho bên tôi",
      "cho bên mình",
      "cho anh",
      "cho em",
    ],
    contact: [
      "tư vấn",
      "đặt lịch",
      "hẹn lịch",
      "gặp chuyên gia",
      "gặp tư vấn",
      "demo",
      "báo giá",
      "gọi lại",
      "liên hệ",
      "proposal",
      "đề xuất triển khai",
      "trao đổi trực tiếp",
      "kết nối chuyên gia",
      "tư vấn giúp",
      "contact",
      "quotation",
    ],
    directContact: [
      "đặt lịch giúp tôi",
      "gọi lại giúp tôi",
      "bên bạn có nhận làm không",
      "go ai có nhận triển khai không",
      "cho xin báo giá",
      "báo giá giúp tôi",
      "báo giá giúp anh",
      "báo giá giúp em",
      "cho tôi số hotline tư vấn",
      "bên bạn có thể tư vấn cho công ty tôi không",
      "gửi proposal cho bên tôi",
      "cho xin lịch demo",
      "book demo",
      "tư vấn giúp bên mình",
      "gọi cho tôi",
    ],
    ear: [
      "khảo sát ear",
      "ear index",
      "khảo sát",
      "bài đánh giá",
      "chấm ear",
      "bảng tự đánh giá",
      "đánh giá mức độ sẵn sàng",
    ],
    directEar: [
      "cho link ear",
      "cho link khảo sát",
      "cho xin link khảo sát",
      "gửi link khảo sát",
      "làm khảo sát ear",
      "chấm ear giúp tôi",
      "tự đánh giá mức sẵn sàng của công ty tôi",
      "công ty tôi đã sẵn sàng chưa",
      "công ty tôi sẵn sàng chưa",
      "đánh giá mức sẵn sàng cho bên tôi",
    ],
    self: [
      "tôi",
      "tui",
      "công ty tôi",
      "công ty tui",
      "doanh nghiệp tôi",
      "doanh nghiệp tui",
      "doanh nghiệp của tôi",
      "công ty của mình",
      "công ty mình",
      "bên tôi",
      "bên tui",
      "bên mình",
      "bên em",
      "bên anh",
      "đội tôi",
      "đội mình",
      "team tôi",
      "team mình",
      "xưởng tôi",
      "xưởng mình",
      "nhà máy tôi",
      "nhà máy bên tôi",
      "phòng nhân sự bên tôi",
      "đơn vị tôi",
      "chúng tôi",
      "tụi em",
    ],
    problem: [
      "thủ công quá",
      "quá thủ công",
      "làm thủ công",
      "thủ công",
      "nhập tay",
      "nhập liệu thủ công",
      "đối soát lâu",
      "đối soát đơn hàng",
      "đối soát",
      "hay sai",
      "nhiều lỗi",
      "quá tải",
      "khách chờ",
      "bỏ sót đơn",
      "thiếu người",
      "xử lý chậm",
      "mất thời gian",
      "mất hai ngày",
      "mất 2 ngày",
      "thiếu dữ liệu",
      "tồn kho lệch",
      "khó tuyển",
      "trễ đơn",
      "chậm phản hồi",
      "tốn nhân lực",
      "rò rỉ dữ liệu",
      "dữ liệu phân tán",
    ],
    plan: [
      "muốn áp dụng",
      "muốn thử ai",
      "muốn thử",
      "đang thử",
      "cần tự động hóa",
      "muốn tự động hóa",
      "muốn triển khai",
      "định triển khai",
      "dự kiến triển khai",
      "muốn dùng ai",
      "quý tới",
      "tháng sau",
      "trình sếp",
      "lập ngân sách",
      "đã có ngân sách",
      "đang tìm đối tác",
      "đang chọn giải pháp",
      "đang làm pilot",
      "đang dùng excel",
      "đã có erp",
      "đang dùng erp",
      "có dữ liệu",
      "chưa có dữ liệu",
      "chạy nội bộ",
      "muốn giảm thời gian",
      "cần giảm chi phí",
    ],
    cost: [
      "chi phí",
      "ngân sách",
      "báo giá",
      "giá bao nhiêu",
      "giá bên bạn",
      "hoàn vốn",
      "roi",
      "tiết kiệm được bao nhiêu",
      "bao lâu",
      "tốn bao nhiêu",
      "ước tính",
    ],
    readiness: [
      "sẵn sàng chưa",
      "mức sẵn sàng",
      "đánh giá sẵn sàng",
      "điều kiện triển khai",
      "thiếu dữ liệu",
      "chưa có dữ liệu",
      "chưa có erp",
      "đã có erp",
      "đang dùng excel",
      "đội it ít người",
      "chạy nội bộ",
      "sợ lộ dữ liệu",
      "bảo mật",
      "tích hợp",
      "on prem",
      "dữ liệu phân tán",
    ],
    application: [
      "áp dụng",
      "ứng dụng",
      "triển khai",
      "bắt đầu từ đâu",
      "làm thử",
      "chạy pilot",
      "thí điểm",
      "lộ trình",
      "tự động hóa",
      "có làm được không",
      "có làm được cho",
      "tích hợp được không",
      "đưa ai vào",
      "đào tạo nhân viên",
      "mất bao lâu",
      "tìm đối tác",
      "quy trình nào",
      "nên làm gì",
      "dùng thử",
      "tư vấn",
    ],
    book: [
      "là gì",
      "định nghĩa",
      "khái niệm",
      "nghĩa là gì",
      "theo sách",
      "trong sách",
      "tác giả",
      "chương nào",
      "trang nào",
      "dẫn nguồn",
      "trích dẫn",
      "số liệu trong sách",
      "ví dụ trong sách",
      "phân biệt",
      "khác nhau thế nào",
      "mục nào",
      "so sánh khái niệm",
    ],
    hypothetical: [
      "giả sử",
      "giả định",
      "ví dụ giả định",
      "tình huống minh họa",
      "lấy ví dụ",
      "nếu một doanh nghiệp",
      "nếu một xưởng",
      "nếu một công ty",
      "ví dụ một công ty",
    ],
    learningOnly: [
      "chỉ đọc sách",
      "chỉ muốn đọc",
      "chỉ muốn đọc thôi",
      "chỉ tìm hiểu",
      "chỉ hỏi về sách",
      "chỉ muốn hỏi",
      "chỉ hỏi",
      "chỉ hỏi thôi",
      "chỉ xem ví dụ",
      "chỉ tham khảo",
      "chưa có nhu cầu gì",
    ],
    noContact: [
      "không cần tư vấn",
      "chưa cần tư vấn",
      "không muốn tư vấn",
      "chưa muốn tư vấn",
      "ko cần tư vấn",
      "ko muốn tư vấn",
      "chứ không cần tư vấn",
      "chứ ko cần tư vấn",
      "chứ chưa cần tư vấn",
      "đừng liên hệ",
      "không liên hệ",
      "không muốn được liên hệ",
      "không cần báo giá",
      "chưa cần báo giá",
      "không cần demo",
      "chưa cần demo",
      "không muốn đặt lịch",
      "chưa muốn đặt lịch",
      "không muốn gọi lại",
      "không cần gọi lại",
    ],
    noEar: [
      "không muốn khảo sát",
      "chưa muốn khảo sát",
      "không cần khảo sát",
      "chưa cần khảo sát",
      "không muốn làm khảo sát",
      "chưa muốn làm khảo sát",
      "không cần làm khảo sát",
      "chưa cần làm khảo sát",
      "ko muốn làm khảo sát",
      "ko cần làm khảo sát",
      "không làm khảo sát",
      "ko làm khảo sát",
      "chưa làm khảo sát",
      "không làm ear",
      "bỏ qua khảo sát",
    ],
    yes: [
      "có",
      "được",
      "đồng ý",
      "ok",
      "okay",
      "vâng",
      "ừ",
      "được ạ",
      "có ạ",
      "ok nhé",
      "tiến hành đi",
      "làm luôn",
      "gửi giúp tôi",
      "cho tôi xin",
    ],
    no: [
      "không",
      "chưa",
      "thôi",
      "không ạ",
      "chưa ạ",
      "để sau",
      "bỏ qua",
      "chưa cần",
      "không cần",
    ],
    confirmedBusiness: [
      "bên tôi đang gặp",
      "đúng là công ty tôi",
      "bên mình đang bị",
      "đang xảy ra ở công ty tôi",
      "công ty mình đang gặp",
      "bên em đang gặp",
    ],
  },
  rules: [
    {
      id: "hot_explicit",
      level: "hot",
      action: "contact",
      clarification: null,
      when: { eligibleAny: ["directContact", "request+contact"] },
    },
    {
      id: "ear_explicit",
      level: "warm",
      action: "ear",
      clarification: null,
      when: { eligibleAny: ["directEar", "request+ear"] },
    },
    {
      id: "confirmed_contact",
      level: "hot",
      action: "contact",
      clarification: null,
      when: { pending: "contact", exactReply: "yes" },
    },
    {
      id: "confirmed_ear",
      level: "warm",
      action: "ear",
      clarification: null,
      when: { pending: "ear", exactReply: "yes" },
    },
    {
      id: "confirmed_business_problem",
      level: "warm",
      action: "ear",
      clarification: null,
      when: { pending: "problem", eligibleAny: ["confirmedBusiness"] },
    },
    {
      id: "declined_offer",
      level: "white",
      action: "none",
      clarification: null,
      when: {
        pendingAny: ["contact", "ear", "read_example", "choose_path"],
        exactReply: "no",
      },
    },
    {
      id: "declined_action_only",
      level: "white",
      action: "none",
      clarification: null,
      when: { onlyDeclinedAction: true },
    },
    {
      id: "confirmed_example",
      level: "white",
      action: "none",
      clarification: null,
      when: { pending: "read_example", exactReply: "yes" },
    },
    {
      id: "learning_only",
      level: "white",
      action: "none",
      clarification: null,
      when: { any: ["learningOnly"] },
    },
    {
      id: "warm_business",
      level: "warm",
      action: "ear",
      clarification: null,
      when: {
        eligibleAny: ["self+problem", "self+plan", "self+readiness"],
        allowRecentSelf: true,
      },
    },
    {
      id: "white_book",
      level: "white",
      action: "none",
      clarification: "read_example",
      when: { any: ["book", "hypothetical"] },
    },
    {
      id: "light_cost",
      level: "light",
      action: "ear_secondary",
      clarification: "cost",
      when: { eligibleAny: ["cost"] },
    },
    {
      id: "light_readiness",
      level: "light",
      action: "ear_secondary",
      clarification: "readiness",
      when: { eligibleAny: ["readiness", "ear"] },
    },
    {
      id: "light_problem",
      level: "light",
      action: "ear_secondary",
      clarification: "problem",
      when: { eligibleAny: ["problem", "plan"] },
    },
    {
      id: "light_application",
      level: "light",
      action: "ear_secondary",
      clarification: "application",
      when: { eligibleAny: ["application"] },
    },
    {
      id: "white_default",
      level: "white",
      action: "none",
      clarification: null,
      when: {},
    },
  ],
  actions: {
    none: { button: null, existing_target: null, placement: null, href: null },
    contact: {
      button: "Liên hệ tư vấn",
      existing_target: "contact",
      placement: "primary",
      href: "/lien-he/#form",
    },
    ear: {
      button: "Làm khảo sát EAR",
      existing_target: "ear",
      placement: "primary",
      href: "/danh-gia/ear-index/",
    },
    ear_secondary: {
      button: "Làm khảo sát EAR",
      existing_target: "ear",
      placement: "secondary",
      href: "/danh-gia/ear-index/",
    },
  },
  clarifications: {
    cost: {
      text: "Anh/chị muốn tìm hiểu cách tính chi phí hay cần ước tính cho một quy trình cụ thể?",
      pending: null,
    },
    readiness: {
      text: "Anh/chị đang tìm hiểu tiêu chí chung hay muốn đánh giá hệ thống hiện có của doanh nghiệp mình?",
      pending: null,
    },
    problem: {
      text: "Đây là tình huống đang xảy ra ở doanh nghiệp anh/chị hay là ví dụ để tham khảo?",
      pending: "problem",
    },
    application: {
      text: "Anh/chị muốn áp dụng trước vào quy trình nào của doanh nghiệp mình?",
      pending: null,
    },
    read_example: {
      text: "Anh/chị muốn xem một ví dụ trong sách về nội dung này không?",
      pending: "read_example",
      display_when: "Có thẻ ví dụ phù hợp trong cuốn đang chọn.",
    },
    contact: {
      text: "Anh/chị có muốn trao đổi trực tiếp với đội tư vấn về bài toán này không?",
      pending: "contact",
    },
    ear: {
      text: "Anh/chị có muốn tự đánh giá mức sẵn sàng của doanh nghiệp bằng EAR không?",
      pending: "ear",
    },
    choose_path: {
      text: "Anh/chị muốn đọc ví dụ trong sách, tự đánh giá bằng EAR hay trao đổi với đội tư vấn?",
      pending: "choose_path",
      display_when: "Tín hiệu còn mơ hồ sau khi đã hỏi một câu làm rõ.",
      options: [
        { id: "read_example", label: "Đọc ví dụ trong sách", action: "none" },
        { id: "ear", label: "Làm khảo sát EAR", action: "ear" },
        { id: "contact", label: "Liên hệ tư vấn", action: "contact" },
      ],
      on_generic_yes: "Anh/chị muốn chọn đọc ví dụ, làm khảo sát EAR hay liên hệ tư vấn?",
    },
  },
};

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function basicFold(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NORMALIZED_ALIASES = Object.entries(LEAD_INTENT_CONFIG.aliases).map(
  ([from, to]) => ({
    regex: new RegExp(`(?:^|\\s)${escapeRegex(basicFold(from))}(?=\\s|$)`, "g"),
    replacement: basicFold(to),
  })
);

export function normalizeIntentText(value) {
  let text = basicFold(value);
  if (!text) return "";
  for (const { regex, replacement } of NORMALIZED_ALIASES) {
    text = text.replace(regex, (match) =>
      match.startsWith(" ") ? " " + replacement : replacement
    );
  }
  return text.replace(/\s+/g, " ").trim();
}

const NORMALIZED_GROUPS = Object.fromEntries(
  Object.entries(LEAD_INTENT_CONFIG.groups).map(([groupName, phrases]) => [
    groupName,
    phrases.map((phrase) => normalizeIntentText(phrase)).filter(Boolean),
  ])
);

const NORMALIZED_BREAK_WORDS = LEAD_INTENT_CONFIG.clause_break_words.map((w) =>
  normalizeIntentText(w)
);

export function stripQuotedText(message) {
  return String(message || "")
    .replace(/^\s*>.*$/gm, " ")
    .replace(/"[^"\n]*"/g, " ")
    .replace(/“[^”\n]*”/g, " ")
    .replace(/「[^」\n]*」/g, " ");
}

const PHRASE_REGEX_CACHE = new Map();

export function hasPhrase(normalizedText, normalizedPhrase) {
  if (!normalizedText || !normalizedPhrase) return false;
  let re = PHRASE_REGEX_CACHE.get(normalizedPhrase);
  if (!re) {
    re = new RegExp(`(?:^|\\s)${escapeRegex(normalizedPhrase)}(?=\\s|$)`);
    PHRASE_REGEX_CACHE.set(normalizedPhrase, re);
  }
  return re.test(normalizedText);
}

export function findGroupMatches(normalizedText, groupName) {
  const phrases = NORMALIZED_GROUPS[groupName] || [];
  return phrases.filter((phrase) => hasPhrase(normalizedText, phrase));
}

export function matchesGroup(normalizedText, groupName) {
  return findGroupMatches(normalizedText, groupName).length > 0;
}

function splitNegatedRunOn(normalizedClause) {
  // Tách thêm theo mẫu phủ định trước cụm yêu cầu mới nếu người đọc viết liền và không có dấu câu
  const negPrefixes = [
    ...NORMALIZED_GROUPS.noContact,
    ...NORMALIZED_GROUPS.noEar,
  ].sort((a, b) => b.length - a.length);

  for (const neg of negPrefixes) {
    const re = new RegExp(`^(.*?(?:^|\\s)${escapeRegex(neg)})\\s+(.+)$`);
    const m = re.exec(normalizedClause);
    if (m && m[2]) {
      const rest = m[2].trim();
      const startsWithRequest = NORMALIZED_GROUPS.request.some((req) =>
        new RegExp(`^${escapeRegex(req)}(?:\\s|$)`).test(rest)
      ) || NORMALIZED_GROUPS.directContact.some((dc) =>
        new RegExp(`^${escapeRegex(dc)}(?:\\s|$)`).test(rest)
      ) || NORMALIZED_GROUPS.directEar.some((de) =>
        new RegExp(`^${escapeRegex(de)}(?:\\s|$)`).test(rest)
      );
      if (startsWithRequest) {
        return [m[1].trim(), rest];
      }
    }
  }
  return [normalizedClause];
}

const BOOK_COMMERCE_RE =
  /\b(mua sach|dat sach|dat mua sach|don sach|in logo|tang ban giam doc|gia sach|sach gia|cuon sach|cuon nay|doi tra|giao hang|phi ship|nhan sach|ebook|audiobook|sach noi|nha xuat ban|nxb|isbn|bao nhieu trang|chuong doc thu|doc thu)\b/;
const SERVICE_KEYWORD_RE = /\b(tu van|khao sat|ear|demo|go ai|trien khai ai|ap dung ai)\b/;

export function extractClauses(rawMessage) {
  const unquoted = stripQuotedText(rawMessage);
  const punctSegments = unquoted
    .split(/[.?!;\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const clauses = [];
  const breakWordsSorted = [...NORMALIZED_BREAK_WORDS].sort(
    (a, b) => b.length - a.length
  );
  const breakRe = new RegExp(
    `\\s+(?:${breakWordsSorted.map(escapeRegex).join("|")})\\s+`,
    "g"
  );

  for (const seg of punctSegments) {
    const normSeg = normalizeIntentText(seg);
    if (!normSeg) continue;
    const subParts = normSeg
      .split(breakRe)
      .map((s) => s.trim())
      .filter(Boolean);

    // Nếu câu nối bằng "và" có chủ ngữ self ở vế đầu (hợp lệ), cho phép vế sau kế thừa chủ ngữ trong cùng câu
    let sentenceSelf = null;
    for (const part of subParts) {
      const splitParts = splitNegatedRunOn(part);
      for (const sp of splitParts) {
        const selfMatches = findGroupMatches(sp, "self");
        const isBookCommerce = BOOK_COMMERCE_RE.test(sp) && !SERVICE_KEYWORD_RE.test(sp);
        const isBookOrHyp =
          isBookCommerce ||
          matchesGroup(sp, "book") ||
          matchesGroup(sp, "hypothetical") ||
          matchesGroup(sp, "learningOnly");
        const isNeg = isNegatedClauseText(sp);
        if (selfMatches.length > 0 && !isBookOrHyp && !isNeg) {
          sentenceSelf = selfMatches[0];
        }
        const effectiveText =
          !selfMatches.length && sentenceSelf && !isBookOrHyp && !isNeg
            ? `${sentenceSelf} ${sp}`
            : sp;
        clauses.push({
          raw: sp,
          text: effectiveText,
          isBookOrHypothetical: isBookOrHyp,
          negation: detectClauseNegation(sp),
        });
      }
    }
  }
  return applyCorrectionExclusions(clauses);
}

function detectClauseNegation(clauseText) {
  const noContactMatches = findGroupMatches(clauseText, "noContact");
  const noEarMatches = findGroupMatches(clauseText, "noEar");
  const generalNeg = /\b(khong can|chua can|khong muon|chua muon|dung|bo qua|chi hoi|chi muon hoi|ko can|ko muon|k can|k muon)\b/.test(
    clauseText
  );
  const hasCommercialTarget =
    matchesGroup(clauseText, "contact") ||
    matchesGroup(clauseText, "directContact") ||
    matchesGroup(clauseText, "ear") ||
    matchesGroup(clauseText, "directEar");

  if (!noContactMatches.length && !noEarMatches.length && !(generalNeg && hasCommercialTarget)) {
    return null;
  }

  const cancelsAllContact =
    noContactMatches.length > 0 ||
    /\b(khong can tu van|chua can tu van|khong muon tu van|chua muon tu van|dung lien he|khong lien he|khong muon duoc lien he|ko can tu van|ko muon tu van|k can tu van)\b/.test(
      clauseText
    ) ||
    (generalNeg && (matchesGroup(clauseText, "contact") || matchesGroup(clauseText, "directContact")));
  const cancelsAllEar =
    noEarMatches.length > 0 ||
    (generalNeg && (matchesGroup(clauseText, "ear") || matchesGroup(clauseText, "directEar")));

  const specificCancelled = [];
  if (/\b(bao gia|bgia)\b/.test(clauseText)) specificCancelled.push("bao gia");
  if (/\bdemo\b/.test(clauseText)) specificCancelled.push("demo");
  if (/\b(dat lich|hen lich)\b/.test(clauseText)) specificCancelled.push("dat lich");
  if (/\bgoi lai\b/.test(clauseText)) specificCancelled.push("goi lai");
  if (/\btu van\b/.test(clauseText)) specificCancelled.push("tu van");

  return {
    isNegated: true,
    cancelsAllContact,
    cancelsAllEar,
    specificCancelled,
  };
}

function isNegatedClauseText(clauseText) {
  return Boolean(detectClauseNegation(clauseText));
}

function applyCorrectionExclusions(clauses) {
  // Nếu người đọc khẳng định rồi phủ định cùng hành động trong tin nhắn, dùng phát biểu sau cùng.
  for (let j = 0; j < clauses.length; j++) {
    const neg = clauses[j].negation;
    if (!neg) continue;
    for (let i = 0; i < j; i++) {
      if (clauses[i].negation) continue;
      if (neg.cancelsAllContact && (matchesGroup(clauses[i].text, "contact") || matchesGroup(clauses[i].text, "directContact"))) {
        clauses[i].overridden = true;
      }
      if (neg.cancelsAllEar && (matchesGroup(clauses[i].text, "ear") || matchesGroup(clauses[i].text, "directEar"))) {
        clauses[i].overridden = true;
      }
      for (const spec of neg.specificCancelled) {
        if (hasPhrase(clauses[i].text, spec)) {
          clauses[i].overridden = true;
        }
      }
    }
  }
  return clauses;
}

function matchesRequestPlusTarget(clauseText, targetGroupName) {
  // Với request+contact hoặc request+ear, cụm yêu cầu phải đứng trước hành động và cách tối đa 6 từ đệm.
  const words = clauseText.split(/\s+/).filter(Boolean);
  const requests = NORMALIZED_GROUPS.request || [];
  const targets = NORMALIZED_GROUPS[targetGroupName] || [];

  for (const req of requests) {
    const reqWords = req.split(/\s+/);
    for (let i = 0; i <= words.length - reqWords.length; i++) {
      let reqOk = true;
      for (let k = 0; k < reqWords.length; k++) {
        if (words[i + k] !== reqWords[k]) {
          reqOk = false;
          break;
        }
      }
      if (!reqOk) continue;
      const reqEnd = i + reqWords.length;

      for (const tgt of targets) {
        const tgtWords = tgt.split(/\s+/);
        for (let j = reqEnd; j <= words.length - tgtWords.length; j++) {
          const fillerCount = j - reqEnd;
          if (fillerCount > 6) break;
          let tgtOk = true;
          for (let m = 0; m < tgtWords.length; m++) {
            if (words[j + m] !== tgtWords[m]) {
              tgtOk = false;
              break;
            }
          }
          if (tgtOk) return true;
        }
      }
    }
  }
  return false;
}

function checkOnlyDeclinedAction(normalizedUnquoted, clauses) {
  const hasNeg = clauses.some((c) => c.negation && c.negation.isNegated);
  if (!hasNeg) return false;
  const hasEligibleOther = clauses.some(
    (c) => !c.negation && !c.overridden && c.raw.trim().length > 0
  );
  if (hasEligibleOther) return false;

  let remainder = normalizedUnquoted;
  const allNegPhrases = [
    ...NORMALIZED_GROUPS.noContact,
    ...NORMALIZED_GROUPS.noEar,
  ].sort((a, b) => b.length - a.length);

  for (const phrase of allNegPhrases) {
    remainder = remainder.replace(
      new RegExp(`(?:^|\\s)${escapeRegex(phrase)}(?=\\s|$)`, "g"),
      " "
    );
  }
  remainder = remainder
    .replace(
      /\b(toi|minh|anh|chi|em|ben toi|ben minh|ben em|ben anh|cong ty toi|doanh nghiep toi|chung toi|hien tai|luc nay|bay gio|tam thoi|a|nhe|nha|dau|thoi|cam on|van|da)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();

  return remainder.length === 0;
}

function canBorrowRecentSelf(recentUserContext = []) {
  const now = Date.now();
  const maxAgeMs = LEAD_INTENT_CONFIG.context.context_max_age_minutes * 60 * 1000;
  const recent = (Array.isArray(recentUserContext) ? recentUserContext : []).slice(
    -LEAD_INTENT_CONFIG.context.recent_user_turns
  );
  return recent.some((turn) => {
    if (!turn) return false;
    if (turn.timestamp && now - turn.timestamp > maxAgeMs) return false;
    const text = normalizeIntentText(stripQuotedText(turn.message || turn.t || ""));
    return (
      Boolean(turn.confirmedBusiness) ||
      matchesGroup(text, "confirmedBusiness") ||
      (matchesGroup(text, "self") &&
        (matchesGroup(text, "problem") ||
          matchesGroup(text, "plan") ||
          matchesGroup(text, "readiness")))
    );
  });
}

function evaluateEligibleAny(expressions, eligibleClauses, allowRecentSelf, borrowedSelf) {
  for (const expr of expressions) {
    if (expr === "request+contact") {
      if (eligibleClauses.some((c) => matchesRequestPlusTarget(c.text, "contact"))) {
        return true;
      }
      continue;
    }
    if (expr === "request+ear") {
      if (eligibleClauses.some((c) => matchesRequestPlusTarget(c.text, "ear"))) {
        return true;
      }
      continue;
    }
    if (expr.includes("+")) {
      const parts = expr.split("+").map((s) => s.trim());
      for (const c of eligibleClauses) {
        const allMatch = parts.every((groupName) => {
          if (groupName === "self" && allowRecentSelf && borrowedSelf) {
            return true;
          }
          return matchesGroup(c.text, groupName);
        });
        if (allMatch) return true;
      }
      continue;
    }
    if (eligibleClauses.some((c) => matchesGroup(c.text, expr))) {
      return true;
    }
  }
  return false;
}

export function classifyLeadIntent({
  message = "",
  selected_book = null,
  recent_user_context = [],
  pending_prompt = null,
  session_declined_actions = [],
  recent_cta_actions = [],
} = {}) {
  const unquoted = stripQuotedText(message);
  const normalizedFull = normalizeIntentText(unquoted);
  const clauses = extractClauses(message);
  const eligibleClauses = clauses.filter(
    (c) => !c.isBookOrHypothetical && !c.negation && !c.overridden
  );
  const nonNegatedClauses = clauses.filter((c) => !c.negation && !c.overridden);
  const borrowedSelf = canBorrowRecentSelf(recent_user_context);

  const declinedSet = new Set(Array.isArray(session_declined_actions) ? session_declined_actions : []);
  for (const c of clauses) {
    if (c.negation?.cancelsAllContact) declinedSet.add("contact");
    if (c.negation?.cancelsAllEar) declinedSet.add("ear");
  }

  // Kiểm tra trường hợp pending === "choose_path" và người đọc trả lời đồng ý chung ("Được", "Có", "OK"...)
  if (pending_prompt === "choose_path" && matchesGroup(normalizedFull, "yes") &&
      NORMALIZED_GROUPS.yes.includes(normalizedFull)) {
    return {
      rule_id: "white_default",
      lead_level: "white",
      action: "none",
      clarification_id: "choose_path",
      clarification_text: LEAD_INTENT_CONFIG.clarifications.choose_path.on_generic_yes,
      next_pending: "choose_path",
      is_generic_yes_on_choose_path: true,
      session_declined_actions: Array.from(declinedSet),
      has_book_clause: clauses.some((c) => c.isBookOrHypothetical),
      book_query: extractBookQuery(message, clauses),
    };
  }

  let matchedRule = LEAD_INTENT_CONFIG.rules[LEAD_INTENT_CONFIG.rules.length - 1];

  for (const rule of LEAD_INTENT_CONFIG.rules) {
    const w = rule.when || {};
    let ok = true;

    if (w.pending !== undefined) {
      if (pending_prompt !== w.pending) ok = false;
    }
    if (ok && w.pendingAny !== undefined) {
      if (!w.pendingAny.includes(pending_prompt)) ok = false;
    }
    if (ok && w.exactReply !== undefined) {
      const groupPhrases = NORMALIZED_GROUPS[w.exactReply] || [];
      if (!groupPhrases.includes(normalizedFull)) ok = false;
    }
    if (ok && w.onlyDeclinedAction !== undefined) {
      if (checkOnlyDeclinedAction(normalizedFull, clauses) !== w.onlyDeclinedAction) {
        ok = false;
      }
    }
    if (ok && w.any !== undefined) {
      const anyMatched = w.any.some((groupName) =>
        nonNegatedClauses.some((c) => matchesGroup(c.text, groupName))
      );
      if (!anyMatched) ok = false;
    }
    if (ok && w.eligibleAny !== undefined) {
      const eligMatched = evaluateEligibleAny(
        w.eligibleAny,
        eligibleClauses,
        Boolean(w.allowRecentSelf),
        borrowedSelf
      );
      if (!eligMatched) ok = false;
    }

    if (ok) {
      matchedRule = rule;
      break;
    }
  }

  let action = matchedRule.action;
  let clarificationId = matchedRule.clarification;
  const isExplicitRequest =
    matchedRule.id === "hot_explicit" ||
    matchedRule.id === "ear_explicit" ||
    matchedRule.id === "confirmed_contact" ||
    matchedRule.id === "confirmed_ear";

  // Cập nhật session suppression
  if (matchedRule.id === "declined_offer") {
    if (pending_prompt === "contact") declinedSet.add("contact");
    if (pending_prompt === "ear") declinedSet.add("ear");
  }
  if (matchedRule.id === "hot_explicit" || matchedRule.id === "confirmed_contact") {
    declinedSet.delete("contact");
  }
  if (matchedRule.id === "ear_explicit" || matchedRule.id === "confirmed_ear") {
    declinedSet.delete("ear");
  }

  // Áp dụng session_suppression cho các gợi ý không phải yêu cầu trực tiếp
  if (!isExplicitRequest) {
    if (action === "contact" && declinedSet.has("contact")) {
      action = "none";
    } else if ((action === "ear" || action === "ear_secondary") && declinedSet.has("ear")) {
      action = "none";
    }
  }

  // Áp dụng repeat_cta_policy: tối đa 1 CTA gợi ý cùng loại trong 3 lượt, trừ khi yêu cầu trực tiếp
  if (!isExplicitRequest && action !== "none") {
    const targetType = LEAD_INTENT_CONFIG.actions[action]?.existing_target || action;
    const recentTargets = (Array.isArray(recent_cta_actions) ? recent_cta_actions : []).slice(
      -LEAD_INTENT_CONFIG.context.repeat_cta_window_turns
    );
    if (recentTargets.includes(targetType)) {
      action = "none";
    }
  }

  const clarificationObj = clarificationId
    ? LEAD_INTENT_CONFIG.clarifications[clarificationId] || null
    : null;

  return {
    rule_id: matchedRule.id,
    lead_level: matchedRule.level,
    action,
    clarification_id: clarificationId,
    clarification_text: clarificationObj ? clarificationObj.text : null,
    next_pending: clarificationObj ? clarificationObj.pending : null,
    action_config: LEAD_INTENT_CONFIG.actions[action] || LEAD_INTENT_CONFIG.actions.none,
    session_declined_actions: Array.from(declinedSet),
    has_book_clause: clauses.some((c) => c.isBookOrHypothetical),
    book_query: extractBookQuery(message, clauses),
  };
}

function extractBookQuery(rawMessage, clauses) {
  // Nếu tin nhắn có cả mệnh đề hỏi sách và mệnh đề yêu cầu liên hệ/demo (vd: "Adapt là gì? Cho tôi đặt lịch demo."),
  // tách phần câu hỏi sách để tra cứu chính xác thẻ sách.
  const bookClauses = clauses.filter((c) => c.isBookOrHypothetical);
  if (bookClauses.length > 0 && bookClauses.length < clauses.length) {
    return bookClauses.map((c) => c.raw).join(" ");
  }
  return rawMessage;
}

