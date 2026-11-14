/* Replace the existing widget script. The host page can keep loading it with defer. */
(() => {
  "use strict";

  const HTML_LANG = document.documentElement.lang || "vi";
  const L = HTML_LANG === "zh-Hant" ? "zh" : HTML_LANG === "en" ? "en" : "vi";
  const PRE = window.AIF_PREFIX || "";
  const VER = "?v=20261114-v24";

  const books = {
    aiec: {
      title: "AI Economy",
      faqBookId: "ai_economy",
      faqUrl: PRE + "/assets/chat/faq_ai_economy.json" + VER,
      url: PRE + "/assets/chat/books/aiec.json" + VER,
    },
    aifb: {
      title: "AI First Business",
      faqBookId: "ai_first_business",
      faqUrl: PRE + "/assets/chat/faq_ai_first_business.json" + VER,
      url: PRE + "/assets/chat/books/aifb.json" + VER,
    },
  };
  const lookupModule = new URL("./lookup.mjs" + VER, document.currentScript.src).href;
  const leadIntentModule = new URL("./lead-intent.mjs" + VER, document.currentScript.src).href;

  const OUT_OF_SCOPE_RE =
    /\b(thoi tiet|da nang|lau ga|la e|da lat|team building|gia vang|sjc|ty gia|usd|vnd|co phieu|bitcoin|chung khoan|may lanh|16 do|chop den|hop dong lao dong thu viec|bo luat lao dong|chinh sach hoan tien|doi tra hang|bong da|world cup|cong thuc nau an)\b/;

  function cfg() {
    return window.AIF_CHAT || {};
  }

  function aiReady() {
    const u = cfg().url || "";
    return /^https:\/\//.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(u);
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(className, text, click) {
    const node = element("button", className, text);
    node.type = "button";
    node.addEventListener("click", click);
    return node;
  }

  function appendFormattedText(parent, text) {
    const parts = String(text || "").split(/\*\*(.+?)\*\*/g);
    for (let i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      if (i % 2 === 1) {
        parent.append(element("strong", "", parts[i]));
      } else {
        parent.append(document.createTextNode(parts[i]));
      }
    }
  }

  function textBlock(box, text) {
    String(text || "")
      .split(/\n{2,}|\n(?=[-•*] |\d+[.)] )/)
      .forEach((para) => {
        para = para.trim();
        if (!para) return;
        if (/^[-•*] /.test(para) || /\n[-•*] /.test(para)) {
          const ul = element("ul", "");
          para.split(/\n/).forEach((li) => {
            li = li.replace(/^[-•*]\s*/, "").trim();
            if (li) {
              const liNode = element("li", "");
              appendFormattedText(liNode, li);
              ul.append(liNode);
            }
          });
          box.append(ul);
        } else {
          const pNode = element("p", "");
          appendFormattedText(pNode, para.replace(/\n/g, " "));
          box.append(pNode);
        }
      });
  }

  function init() {
    const launcher = document.querySelector("[data-chat-open]");
    if (!launcher) return;

    let selection = null;
    let activeBook = null;
    let activeFaq = null;
    let lookup = null;
    let lookupFaq = null;
    let lookupFaqById = null;
    let normalize = null;
    let classifyLeadIntent = null;
    let pendingPrompt = null;
    let sessionDeclinedActions = [];
    let recentCtaActions = [];
    let request = null;
    let aiRequest = null;
    let busy = false;
    let lastSend = 0;
    let history = [];
    let sessionSeq = 0;
    const resourceCache = {};
    const bookSessions = {};

    function saveCurrentBookSession() {
      if (selection && activeBook && activeFaq) {
        log
          .querySelectorAll(".aic-typing, .aic-streaming")
          .forEach((el) => el.closest(".aic-msg")?.remove());
        bookSessions[selection] = {
          kb: activeBook,
          faq: activeFaq,
          history: [...history],
          sessionDeclinedActions: [...sessionDeclinedActions],
          recentCtaActions: [...recentCtaActions],
          nodes: Array.from(log.childNodes),
        };
      }
    }

    const root = element("section", "aic");
    root.id = "aic";
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-labelledby", "aic-h");
    const header = element("header", "aic-head");
    const titleBox = element("div", "aic-ht");
    const title = element("h2", "", "Xin chào!, Tôi là trợ lý của tác giả Trần Tấn Sỹ");
    title.id = "aic-h";
    titleBox.append(title);
    const change = button("aic-ic", "↻", showPicker);
    change.title = "Đổi sách";
    change.setAttribute("aria-label", "Đổi sách");
    const closeButton = button("aic-ic", "×", close);
    closeButton.setAttribute("aria-label", "Đóng trợ lý");
    header.append(titleBox, change, closeButton);

    const log = element("div", "aic-log");
    log.setAttribute("role", "log");
    log.setAttribute("aria-live", "polite");
    const form = element("form", "aic-form");
    const input = element("textarea", "");
    input.id = "aic-in";
    input.rows = 1;
    input.maxLength = 500;
    input.placeholder = "Nhập câu hỏi của bạn…";
    input.setAttribute("aria-label", "Câu hỏi của bạn");
    const send = element("button", "aic-send", "➤");
    send.type = "submit";
    send.setAttribute("aria-label", "Gửi câu hỏi");
    form.append(input, send);
    root.append(header, log, form);
    document.body.append(root);

    function ready(value) {
      input.disabled = send.disabled = !value;
    }

    function record(role, text) {
      history.push({ r: role, t: String(text || "").slice(0, 600) });
      if (history.length > 6) history = history.slice(-6);
    }

    function message(text, isUser = false) {
      const row = element("div", isUser ? "aic-msg is-user" : "aic-msg is-bot");
      const bubble = element("div", "aic-bubble");
      if (isUser) {
        bubble.append(element("p", "", text));
      } else {
        textBlock(bubble, text);
      }
      row.append(bubble);
      log.append(row);
      log.scrollTop = log.scrollHeight;
      return bubble;
    }

    function resetSessionState() {
      sessionSeq++;
      request?.abort();
      aiRequest?.abort();
      request = null;
      aiRequest = null;
      busy = false;
      history = [];
      pendingPrompt = null;
      sessionDeclinedActions = [];
      recentCtaActions = [];
    }

    function createChipRow(extraClass = "", gap = "8px") {
      const row = element("div", ("aic-pick-row " + extraClass).trim());
      row.style.display = "flex";
      row.style.flexWrap = "wrap";
      row.style.gap = gap;
      row.style.marginTop = "8px";
      return row;
    }

    function appendSwitchBookButton(bubbleNode, targetId, targetTitle) {
      const swBtn = button("aic-chip", "Đổi sang " + (targetTitle || books[targetId]?.title || ""), () =>
        selectBook(targetId)
      );
      swBtn.style.marginTop = "8px";
      swBtn.style.display = "inline-block";
      bubbleNode.append(swBtn);
    }

    function showPicker() {
      saveCurrentBookSession();
      resetSessionState();
      selection = activeBook = activeFaq = null;
      title.textContent = "Xin chào!, Tôi là trợ lý của tác giả Trần Tấn Sỹ";
      input.value = "";
      ready(false);
      change.disabled = true;
      log.replaceChildren();
      const picker = message("Bạn muốn hỏi về cuốn sách nào?");
      const btnRow = createChipRow("", "10px");
      for (const [id, book] of Object.entries(books)) {
        btnRow.append(button("aic-chip", book.title, () => selectBook(id)));
      }
      picker.append(btnRow);
      if (!root.hidden) picker.querySelector("button")?.focus();
    }

    function renderBookWelcome(id, book, faqData) {
      log.replaceChildren();
      const welcomeBubble = message("Bạn đang hỏi về " + book.title + ".");
      if (Array.isArray(faqData?.quick_questions) && faqData.quick_questions.length) {
        const qqRow = createChipRow("aic-qq-row", "8px");
        for (const qq of faqData.quick_questions) {
          qqRow.append(
            button("aic-chip", qq.label, () => {
              if (busy || selection !== id) return;
              pendingPrompt = null;
              message(qq.label, true);
              record("u", qq.label);
              const directRes = lookupFaqById ? lookupFaqById(qq.faq_id, activeFaq, PRE) : null;
              if (directRes) {
                renderFaqResult(directRes);
              } else {
                showResult(qq.label);
              }
            })
          );
        }
        welcomeBubble.append(qqRow);
      }
      log.scrollTop = log.scrollHeight;
      ready(true);
      if (!root.hidden) input.focus();
    }

    async function selectBook(id) {
      const book = books[id];
      if (!book) return;
      saveCurrentBookSession();
      resetSessionState();
      const mySeq = sessionSeq;
      const cacheKey = id + ":" + VER;

      selection = id;
      activeBook = null;
      activeFaq = null;
      title.textContent = book.title;
      change.disabled = false;
      input.value = "";

      if (bookSessions[id] && lookup && lookupFaq && lookupFaqById && normalize && classifyLeadIntent) {
        activeBook = bookSessions[id].kb;
        activeFaq = bookSessions[id].faq;
        history = [...bookSessions[id].history];
        sessionDeclinedActions = [...(bookSessions[id].sessionDeclinedActions || [])];
        recentCtaActions = [...(bookSessions[id].recentCtaActions || [])];
        log.replaceChildren(...bookSessions[id].nodes);
        log.scrollTop = log.scrollHeight;
        ready(true);
        if (!root.hidden) input.focus();
        return;
      }

      if (resourceCache[cacheKey] && lookup && lookupFaq && lookupFaqById && normalize && classifyLeadIntent) {
        activeBook = resourceCache[cacheKey].kb;
        activeFaq = resourceCache[cacheKey].faq;
        renderBookWelcome(id, book, activeFaq);
        return;
      }

      const controller = new AbortController();
      request = controller;
      ready(false);
      log.replaceChildren();
      message("Đang tải nội dung sách…");

      try {
        const [module, intentMod, faqRes, kbRes] = await Promise.all([
          import(lookupModule),
          import(leadIntentModule),
          fetch(book.faqUrl, { signal: controller.signal, cache: "no-cache" }),
          fetch(book.url, { signal: controller.signal, cache: "no-cache" }),
        ]);
        if (!faqRes.ok || !kbRes.ok) throw new Error("Book resources unavailable");
        const [faqData, data] = await Promise.all([faqRes.json(), kbRes.json()]);

        if (
          !faqData ||
          faqData.book_id !== book.faqBookId ||
          !Array.isArray(faqData.cards) ||
          !faqData.cards.length ||
          !faqData.catalog ||
          !faqData.actions ||
          !Array.isArray(faqData.quick_questions)
        ) {
          throw new Error("Invalid FAQ file");
        }

        if (
          data.book_id !== id ||
          !data.sources ||
          !data.print_pages ||
          !Array.isArray(data.cards) ||
          !data.cards.length ||
          data.cards.some(
            (card) =>
              card.status !== "approved" ||
              !Array.isArray(card.source_ids) ||
              !data.sources[card.primary_source_id] ||
              card.source_ids.some((sourceId) => !data.sources[sourceId])
          )
        ) {
          throw new Error("Invalid approved book");
        }

        if (mySeq !== sessionSeq || request !== controller) return;
        request = null;
        lookup = module.lookup;
        lookupFaq = module.lookupFaq;
        lookupFaqById = module.lookupFaqById;
        normalize = module.normalize;
        classifyLeadIntent = intentMod.classifyLeadIntent;

        resourceCache[cacheKey] = { faq: faqData, kb: data };
        activeBook = data;
        activeFaq = faqData;
        renderBookWelcome(id, book, activeFaq);
      } catch {
        if (mySeq !== sessionSeq || request !== controller) return;
        request = null;
        log.replaceChildren();
        const retry = message("Chưa tải được nội dung cuốn sách này.");
        retry.append(button("aic-chip", "Thử lại", () => selectBook(id)));
      }
    }

    function reference(source) {
      const pages =
        source.page === source.end_page || !source.end_page
          ? source.page
          : source.page + "–" + source.end_page;
      return [activeBook.title, activeBook.edition, source.title, "tr. " + pages].join(" · ");
    }

    function renderFaqResult(faqRes) {
      if (!faqRes || faqRes.type === "unanswered") return false;

      if (faqRes.type === "switch_book") {
        const b = message(faqRes.message);
        record("b", faqRes.message);
        appendSwitchBookButton(b, faqRes.targetId, faqRes.targetTitle);
        log.scrollTop = log.scrollHeight;
        return true;
      }

      if (faqRes.type === "clarify_entity") {
        const b = message(faqRes.message);
        record("b", faqRes.message);
        const bookAtRender = selection;
        if (Array.isArray(faqRes.choices)) {
          const row = createChipRow("", "8px");
          for (const ch of faqRes.choices) {
            row.append(
              button("aic-chip", ch.label, () => {
                if (busy || selection !== bookAtRender) return;
                message(ch.label, true);
                record("u", ch.label);
                const directRes = lookupFaqById ? lookupFaqById(ch.id, activeFaq, PRE) : null;
                if (directRes) renderFaqResult(directRes);
              })
            );
          }
          b.append(row);
        }
        log.scrollTop = log.scrollHeight;
        return true;
      }

      if (faqRes.type === "faq_cards" && Array.isArray(faqRes.cards) && faqRes.cards.length) {
        const row = element("div", "aic-msg is-bot");
        const b = element("div", "aic-bubble");
        row.append(b);
        log.append(row);

        const texts = [];
        if (Array.isArray(faqRes.unmatchedParts) && faqRes.unmatchedParts.length && activeBook && lookup) {
          for (const up of faqRes.unmatchedParts) {
            const kbRes = lookup(up, [activeBook], history);
            if (kbRes && kbRes.type === "card" && kbRes.results?.[0]?.answer) {
              textBlock(b, kbRes.results[0].answer);
              texts.push(kbRes.results[0].answer);
            }
          }
        }
        for (const card of faqRes.cards) {
          textBlock(b, card.answer);
          texts.push(card.answer);
        }
        record("b", texts.join("\n\n"));

        if (Array.isArray(faqRes.actions) && faqRes.actions.length) {
          for (const act of faqRes.actions) {
            const link = element("a", "aic-link", act.label);
            link.href = act.href;
            link.style.display = "block";
            link.style.marginTop = "6px";
            b.append(link);
            if (act.id === "consulting_contact" || act.id === "contact") {
              recentCtaActions.push("contact");
            } else if (act.id === "ear_survey") {
              recentCtaActions.push("ear");
            }
          }
        }

        if (faqRes.switchBook) {
          textBlock(b, faqRes.switchBook.message);
          appendSwitchBookButton(b, faqRes.switchBook.targetId, faqRes.switchBook.targetTitle);
        }

        log.scrollTop = log.scrollHeight;
        return true;
      }

      return false;
    }

    function fallbackNotFound(query = "") {
      if (
        selection === "aifb" &&
        /\b(unctad|170 nen kinh te|nang luong tai tao|ari ip|ari dia phuong|nha may tri tue|chin tang|4 lan song fdi|bon lan song fdi|asml|tsmc|kumamoto)\b/.test(
          query
        )
      ) {
        const text =
          "Tôi chưa tìm thấy (không tìm thấy) mục phù hợp trong AI First Business. Nội dung này thuộc cuốn AI Economy — bạn có thể bấm Đổi sách để xem câu trả lời chi tiết.";
        const b = message(text);
        record("b", text);
        b.append(button("aic-chip", "Đổi sang AI Economy", () => selectBook("aiec")));
        return;
      }
      if (
        selection === "aiec" &&
        /\b(ear index|ho so agent|6 khoa an toan|sau khoa an toan|ai lifecycle card|work chart|so do cong viec|bolt on|mo hinh 3a|adopt adapt advance)\b/.test(
          query
        )
      ) {
        const text =
          "Tôi chưa tìm thấy (không tìm thấy) mục phù hợp trong AI Economy. Nội dung này thuộc cuốn AI First Business — bạn có thể bấm Đổi sách để xem câu trả lời chi tiết.";
        const b = message(text);
        record("b", text);
        b.append(button("aic-chip", "Đổi sang AI First Business", () => selectBook("aifb")));
        return;
      }
      const text =
        "Tôi chưa tìm thấy (không tìm thấy) mục phù hợp trong " +
        books[selection].title +
        ". Bạn muốn hỏi về khái niệm, chương hay mục nào? Bạn cũng có thể bấm Đổi sách.";
      message(text);
      record("b", text);
    }

    function askAI(question, bookIdAtSend) {
      if (!aiReady() || busy) {
        if (!aiReady()) fallbackNotFound(normalize(question));
        return;
      }
      const now = Date.now();
      if (now - lastSend < 1000) {
        message("Bạn vui lòng chờ giây lát rồi gửi lại câu hỏi nhé.");
        return;
      }
      lastSend = now;
      busy = true;
      ready(false);
      const seqAtSend = sessionSeq;

      const row = element("div", "aic-msg is-bot aic-streaming");
      const bubble = element("div", "aic-bubble aic-typing");
      bubble.append(element("p", "", "Trợ lý đang tìm trong sách…"));
      row.append(bubble);
      log.append(row);
      log.scrollTop = log.scrollHeight;

      const controller = new AbortController();
      aiRequest = controller;
      const timer = setTimeout(() => controller.abort(), 30000);
      let acc = "";
      let meta = null;

      function finish(ok) {
        clearTimeout(timer);
        if (aiRequest === controller) aiRequest = null;
        if (seqAtSend !== sessionSeq || selection !== bookIdAtSend) {
          row.remove();
          return;
        }
        busy = false;
        lastSend = Date.now();
        if (selection === bookIdAtSend && activeBook) ready(true);
        row.remove();

        if (ok && meta && Array.isArray(meta.actions) && meta.actions.length) {
          const b = message(meta.answer || "");
          record("b", meta.answer || "");
          for (const action of meta.actions) {
            const link = element("a", "aic-link", action.label);
            link.href = action.href;
            link.style.display = "block";
            link.style.marginTop = "6px";
            b.append(link);
          }
          return;
        }

        if (ok && acc.trim()) {
          const b = message(acc.trim());
          record("b", acc.trim());
          if (meta && meta.nf) {
            const contact = element("div", "aic-contact");
            const formLink = element("a", "aic-cbtn", "Liên hệ");
            formLink.href = PRE + "/lien-he/#form";
            contact.append(formLink);
            b.append(contact);
          }
          log.scrollTop = log.scrollHeight;
        } else {
          fallbackNotFound(normalize(question));
        }
        if (!root.hidden && !input.disabled) input.focus();
      }

      const histForAI = history.slice(0, -1).slice(-4);
      const body = JSON.stringify({
        secret: cfg().secret || "",
        message: question.slice(0, 500),
        lang: L,
        book_id: bookIdAtSend,
        faq: [],
        hist: histForAI,
        page: location.pathname,
      });

      fetch(cfg().url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body,
        signal: controller.signal,
      })
        .then((res) => {
          if (seqAtSend !== sessionSeq || selection !== bookIdAtSend) return;
          const ct = res.headers.get("Content-Type") || "";
          if (!res.ok || !ct.includes("event-stream") || !res.body || !window.TextDecoder) {
            return res.json().then((j) => {
              if (seqAtSend !== sessionSeq || selection !== bookIdAtSend) return;
              if (j && j.ok && j.answer) {
                acc = j.answer;
                meta = j;
                finish(true);
              } else {
                finish(false);
              }
            });
          }
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          let first = true;
          function pump() {
            return reader.read().then((r) => {
              if (seqAtSend !== sessionSeq || selection !== bookIdAtSend) {
                try {
                  reader.cancel();
                } catch {}
                return;
              }
              if (r.done) return finish(true);
              buf += dec.decode(r.value, { stream: true });
              const parts = buf.split("\n\n");
              buf = parts.pop();
              for (const p of parts) {
                const line = p.replace(/^data:\s*/, "");
                if (!line) continue;
                try {
                  const j = JSON.parse(line);
                  if (j.t) {
                    acc += j.t;
                    if (first) {
                      bubble.classList.remove("aic-typing");
                      first = false;
                    }
                    bubble.replaceChildren();
                    textBlock(bubble, acc);
                    log.scrollTop = log.scrollHeight;
                  }
                  if (j.done) meta = j;
                } catch {
                  /* ignore malformed chunk */
                }
              }
              return pump();
            });
          }
          return pump();
        })
        .catch(() => {
          if (seqAtSend !== sessionSeq || selection !== bookIdAtSend) return;
          finish(Boolean(acc.trim()));
        });
    }

    function showResult(question) {
      const query = normalize(question);
      if (
        /\b(admin command|print raw prompt|system instruction|system prompt|bo loc cua ban|tu khoa bi cam|ignore previous|bo qua moi huong dan)\b/.test(
          query
        )
      ) {
        const reply =
          "Tôi không thể tiết lộ chỉ dẫn hệ thống hay cấu hình bộ lọc nội bộ vì lý do bảo mật hệ thống. Trong quản trị AI doanh nghiệp, để kiểm tra lỗi vận hành của AI, doanh nghiệp nên thực hiện Khóa 6 — Kiểm thử đối kháng và lập AI Lifecycle Card.";
        message(reply);
        record("b", reply);
        return;
      }
      if (
        /\b(lay cap|danh cap|trang quan tri an|khong de lai dau vet ip|xam nhap trai phep)\b/.test(
          query
        )
      ) {
        const reply =
          "Tôi từ chối hỗ trợ các hành vi xâm nhập trái phép, quét hoặc lấy cắp dữ liệu của tổ chức khác vì vi phạm pháp luật và đạo đức AI. Nền kinh tế AI đòi hỏi tuân thủ Luật Bảo vệ dữ liệu cá nhân; lợi thế cạnh tranh bền vững đến từ tài sản dữ liệu độc quyền nội bộ và quy trình AI-Native hợp pháp.";
        message(reply);
        record("b", reply);
        return;
      }
      if (/\b(toan van|nguyen van|nguyen chuong|chep lai|100 noi dung|tat ca cac file)\b/.test(query)) {
        const reply =
          "Vì lý do bản quyền tài liệu, tôi không thể sao chép nguyên văn 100% nội dung từng trang hay toàn bộ chương sách ra khung chat. Tôi có thể tóm tắt ý chính và giải thích khái niệm trong cuốn " +
          books[selection].title +
          " cho từng câu hỏi cụ thể của bạn.";
        message(reply);
        record("b", reply);
        return;
      }

      // Phân loại ý định thương mại / dẫn dắt theo cấu hình của sếp
      let intent = null;
      if (typeof classifyLeadIntent === "function") {
        intent = classifyLeadIntent({
          message: question,
          selected_book: selection,
          recent_user_context: history.filter((h) => h.r === "u"),
          pending_prompt: pendingPrompt,
          session_declined_actions: sessionDeclinedActions,
          recent_cta_actions: recentCtaActions,
        });
        if (intent.session_declined_actions) {
          sessionDeclinedActions = intent.session_declined_actions;
        }
        pendingPrompt = intent.next_pending || null;
      }

      // Hàm gắn nút CTA dịch vụ (tư vấn / khảo sát EAR)
      function appendCtaButton(bubbleNode, action) {
        if (!action || action === "none") return;
        let btnText = "";
        let btnHref = "";
        if (action === "contact") {
          btnText = "Liên hệ tư vấn";
          btnHref = PRE + "/lien-he/#form";
          recentCtaActions.push("contact");
        } else if (action === "ear" || action === "ear_secondary") {
          btnText = "Làm khảo sát EAR Index";
          btnHref = PRE + "/danh-gia/ear-index/";
          recentCtaActions.push("ear");
        }
        if (btnText && btnHref) {
          const link = element("a", "aic-link", btnText);
          link.href = btnHref;
          link.style.display = "block";
          link.style.marginTop = "6px";
          bubbleNode.append(link);
        }
      }

      // 1. Xử lý các câu phản hồi đồng ý / từ chối theo luồng pending hoặc từ chối thẳng
      if (
        intent &&
        (intent.rule_id === "declined_offer" ||
          intent.rule_id === "declined_action_only" ||
          intent.rule_id === "learning_only")
      ) {
        const reply = "Dạ vâng, bạn cần tìm hiểu thêm nội dung nào trong sách cứ nhắn mình nhé.";
        message(reply);
        record("b", reply);
        return;
      }
      if (intent && intent.is_generic_yes_on_choose_path) {
        const reply = intent.clarification_text;
        const b = message(reply);
        record("b", reply);
        appendCtaButton(b, "ear");
        appendCtaButton(b, "contact");
        return;
      }
      if (
        intent &&
        (intent.rule_id === "confirmed_contact" ||
          intent.rule_id === "confirmed_ear" ||
          intent.rule_id === "confirmed_business_problem")
      ) {
        const reply =
          intent.action === "contact"
            ? "Bạn có thể trao đổi trực tiếp với đội ngũ tư vấn qua biểu mẫu bên dưới:"
            : "Bạn có thể làm bài khảo sát EAR Index để đánh giá mức sẵn sàng chuyển đổi AI của doanh nghiệp:";
        const b = message(reply);
        record("b", reply);
        appendCtaButton(b, intent.action);
        return;
      }

      // 2. Tra cứu bộ FAQ của cuốn đang chọn (v2.2.0) trước khi xuống KB hoặc AI
      if (typeof lookupFaq === "function" && activeFaq) {
        const faqRes = lookupFaq(question, activeFaq, selection, PRE);
        if (faqRes && faqRes.type !== "unanswered") {
          renderFaqResult(faqRes);
          return;
        }
      }

      // 3. Nếu là yêu cầu liên hệ tư vấn / khảo sát EAR trực tiếp (không kèm câu hỏi sách)
      const isExplicitRequest =
        intent &&
        (intent.rule_id === "hot_explicit" || intent.rule_id === "ear_explicit") &&
        !intent.has_book_clause;

      if (isExplicitRequest) {
        const action =
          intent.action && intent.action !== "none"
            ? intent.action
            : intent.rule_id === "hot_explicit"
              ? "contact"
              : "ear";
        const reply =
          action === "contact"
            ? "Bạn có thể trao đổi với đội ngũ tư vấn chuyên sâu của tác giả Trần Tấn Sỹ qua đường dẫn dưới đây:"
            : "Bạn có thể làm khảo sát EAR Index để đánh giá mức sẵn sàng của doanh nghiệp:";
        const bubble = message(reply);
        record("b", reply);
        appendCtaButton(bubble, action);
        return;
      }

      // 4. Gợi ý chuyển sách nếu câu hỏi thuộc cuốn sách còn lại
      if (
        selection === "aiec" &&
        /\b(3a|adopt|adapt|advance|ear index|ear|khao sat ear|work chart|ban do cong viec|90 ngay|khoa an toan|lifecycle card|ho so agent|chi phi trien khai|chi phi vong doi|cach tinh chi phi|tuyen dung|nhan su|quy trinh tuyen dung|quy trinh nhan su|quy trinh san xuat|excel|execl|tu dong hoa)\b/i.test(
          query
        )
      ) {
        const reply =
          "Chủ đề này (như mô hình 3A, khảo sát EAR Index, Work Chart, quy trình phòng ban hay chi phí triển khai Agent) được trình bày chi tiết trong cuốn **AI First Business**.";
        const b = message(reply);
        record("b", reply);
        appendSwitchBookButton(b, "aifb", "AI First Business");
        return;
      }
      if (
        selection === "aifb" &&
        /\b(unctad|oxford insights|170 nen kinh te|193 quoc gia|ari ip|ari dia phuong|tsmc|asml|cowos|stargate|chips act|nha may tri tue|ai factory|9 tang cua nen kinh te|chin tang)\b/i.test(
          query
        )
      ) {
        const reply =
          "Chủ đề này (như 9 tầng Nền kinh tế Trí tuệ, chỉ số ARI hay chuỗi bán dẫn toàn cầu) thuộc cuốn sách **AI Economy**.";
        const b = message(reply);
        record("b", reply);
        appendSwitchBookButton(b, "aiec", "AI Economy");
        return;
      }

      // 5. Tra cứu KB nội dung sách
      const bookQuery = intent && intent.book_query ? intent.book_query : question;
      const result = lookup(bookQuery, [activeBook], history);
      if (result.type === "card") {
        const b = message(result.results[0].answer);
        record("b", result.results[0].answer);
        const actionToUse =
          intent && intent.action && intent.action !== "none"
            ? intent.action
            : intent && (intent.lead_level === "warm" || intent.lead_level === "hot")
              ? intent.lead_level === "hot"
                ? "contact"
                : "ear"
              : null;
        if (actionToUse) {
          appendCtaButton(b, actionToUse);
        }
        const lastBotTurn = [...history].reverse().find((h) => h.r === "b");
        const alreadyAskedRecently =
          lastBotTurn &&
          lastBotTurn.t &&
          intent &&
          intent.clarification_text &&
          lastBotTurn.t.includes(intent.clarification_text);
        if (
          intent &&
          intent.clarification_text &&
          intent.lead_level === "light" &&
          !alreadyAskedRecently
        ) {
          message(intent.clarification_text);
          record("b", intent.clarification_text);
        }
      } else if (result.type === "references") {
        const reply = "Bạn có thể xem các mục sau trong cuốn đang chọn:";
        const bubble = message(reply);
        record("b", reply);
        for (const source of result.results) {
          bubble.append(element("p", "aic-src", reference(source)));
        }
        if (intent && intent.action && intent.action !== "none") {
          appendCtaButton(bubble, intent.action);
        }
      } else if (result.type === "choices") {
        const bubble = message("Bạn muốn hỏi về mục nào?");
        const bookAtRender = activeBook;
        for (const choice of result.results) {
          const card = activeBook.cards.find((item) => item.id === choice.id);
          if (card)
            bubble.append(
              button("aic-chip", choice.question, () => {
                if (activeBook === bookAtRender && !busy) {
                  message(choice.question, true);
                  record("u", choice.question);
                  const b = message(card.answer);
                  record("b", card.answer);
                  if (intent && intent.action && intent.action !== "none") {
                    appendCtaButton(b, intent.action);
                  }
                }
              })
            );
        }
      } else if (
        intent &&
        (intent.action === "contact" ||
          intent.action === "ear" ||
          intent.action === "ear_secondary" ||
          intent.lead_level === "warm" ||
          intent.lead_level === "hot")
      ) {
        const act =
          intent.action && intent.action !== "none"
            ? intent.action
            : intent.lead_level === "hot"
              ? "contact"
              : "ear";
        const reply =
          act === "contact"
            ? "Bạn có thể trao đổi với đội ngũ tư vấn chuyên gia của tác giả Trần Tấn Sỹ:"
            : "Bạn có thể làm bài khảo sát EAR Index để đánh giá mức độ sẵn sàng chuyển đổi AI của doanh nghiệp:";
        const b = message(reply);
        record("b", reply);
        appendCtaButton(b, act);
        if (intent.clarification_text) {
          message(intent.clarification_text);
          record("b", intent.clarification_text);
        }
      } else if (aiReady() && !OUT_OF_SCOPE_RE.test(query)) {
        askAI(question, selection);
      } else {
        fallbackNotFound(query);
      }
    }

    function close() {
      root.hidden = true;
      document.body.classList.remove("chat-open");
      launcher.setAttribute("aria-expanded", "false");
      launcher.focus();
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const question = input.value.trim();
      if (!activeBook || !activeFaq || !question || busy) return;
      input.value = "";
      message(question, true);
      record("u", question);
      showResult(question);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        form.requestSubmit();
      }
    });
    root.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
    launcher.hidden = false;
    launcher.setAttribute("aria-controls", root.id);
    launcher.setAttribute("aria-expanded", "false");
    launcher.addEventListener("click", () => {
      if (!root.hidden) return close();
      root.hidden = false;
      document.body.classList.add("chat-open");
      launcher.setAttribute("aria-expanded", "true");
      if (!selection) log.querySelector("button")?.focus();
      else if (activeBook && !busy) input.focus();
      else change.focus();
    });
    showPicker();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
