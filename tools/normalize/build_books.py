#!/usr/bin/env python3
"""Chuẩn hóa văn bản OCR của 2 cuốn sách thành các tệp .md theo từng MỤC (x.y) cho AI Search.

Mỗi tệp ~250–480 chữ (một mục dài được chia thành nhiều phần), có:
    # <Tên sách> — <x.y. Tên mục> (phần k/n)
    Nguồn: <Tên sách>, mục x.y          <- Worker đồng bộ lấy dòng này làm trích dẫn
    Chương N: <tên chương>

Cách chạy:  python3 build_books.py <thư-mục-OCR-AFB> <thư-mục-OCR-AIE> <thư-mục-AIF-KB>
"""
import re, sys, json, collections, pathlib, unicodedata

TARGET, MAX_W, MIN_TAIL = 380, 480, 120

FIX = [
    ("chỉ phí", "chi phí"), ("Chỉ phí", "Chi phí"), ("chỉ tiết", "chi tiết"), ("chỉ tiêu vốn", "chi tiêu vốn"),
    ("chuyến đối", "chuyển đổi"), ("chuyển đối", "chuyển đổi"), ("chuyến đổi", "chuyển đổi"), ("thay đối", "thay đổi"),
    ("đối mới", "đổi mới"), ("đã đối", "đã đổi"), ("tố chức", "tổ chức"), ("Tố chức", "Tổ chức"), ("kính doanh", "kinh doanh"),
    ("tỉnh thần", "tinh thần"), ("tâm vóc", "tầm vóc"), ("hạ tâng", "hạ tầng"), ("YẾU TỔ", "YẾU TỐ"), ("không thế", "không thể"),
    ("có thế", "có thể"), ("để", "để"), ("EAR Index”", "EAR Index™"), ('EAR Index"', "EAR Index™"), ("EAR Index'", "EAR Index™"),
    ("Úng dụng", "Ứng dụng"), ("Vếu tố", "Yếu tố"), ("Bacâu", "Ba câu"), ("Banấc", "Ba nấc"), ("Bangành", "Ba ngành"),
    ("Kiếntrúc", "Kiến trúc"), ("Tácnhân", "Tác nhân"), ("Khung5", "Khung 5"), ("ĐoAI", "Đo AI"), ("đế trả lời", "để trả lời"),
    ("tài liêu", "tài liệu"), ("Tài liêu", "Tài liệu"), ("Điể m", "Điểm"), ("kiếm tra", "kiểm tra"), ("kiếm soát", "kiểm soát"),
    ("kiếm định", "kiểm định"), ("kiếm thử", "kiểm thử"), ("Kiếm tra", "Kiểm tra"), ("Kiếm soát", "Kiểm soát"), ("chấn đoán", "chẩn đoán"),
    ("bố trợ", "bổ trợ"), ("đợi ích", "(lợi ích"), ("tối thiếu", "tối thiểu"), ("bất kế", "bất kể"), ("bảo hiếm", "bảo hiểm"), ("Chươ ng", "Chương"),
]
DE = re.compile(r"(?<!hoàng )(?<!Hoàng )\b(đ|Đ)ế\b(?! (?:chế|quốc|vương|giày))")  # "đế" thường là "để" bị OCR mất dấu
AL = re.compile(r"(?<![A-Za-zÀ-ỹ])Al(?=[\s\-.,:;)”\"]|$)")  # "Al" do OCR đọc nhầm "AI"

def fix(t):
    for a, b in FIX:
        t = t.replace(a, b)
    t = AL.sub("AI", t)
    t = DE.sub(lambda m: m.group(1) + "ể", t)
    t = re.sub(r"^[«‹°e•]\s+(?=\S)", "• ", t)      # gạch đầu dòng
    t = re.sub(r"(?<=[a-zà-ỹ.,;:])[ŠS]S\b", "", t)  # chỉ số chú thích bị OCR thành 'ŠS'
    t = re.sub(r"(?<=[a-zà-ỹA-ZÀ-Ỹ)”\"%])([.,;:])\d{1,2}(?=\s|$)", r"\1", t)  # số chú thích dính sau dấu câu: 'năm.12' -> 'năm.'
    return re.sub(r"\s+", " ", t).strip()

OK_CH = re.compile(r"[\wÀ-ỹ\s.,;:!?()%\-–—“”\"'/+&…•]")
def garbage(t):
    """Mảnh chữ OCR từ hình vẽ/biểu đồ: nhiều ký tự lạ hoặc nhiều 'từ' 1 ký tự."""
    if not t: return True
    bad = sum(1 for c in t if not OK_CH.match(c))
    toks = t.split()
    one = sum(1 for w in toks if len(w) == 1 and not w.isdigit() and w not in "•–-")
    if re.search(r"_{3,}|[^\w\s.,”“\"'()…]{3,}", t): return True
    return bad / len(t) > 0.03 or (len(toks) >= 6 and one / len(toks) > 0.25)

def slug(s, n=50):
    s = unicodedata.normalize("NFD", s.replace("đ", "d").replace("Đ", "D"))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:n].rstrip("-")

SEC = re.compile(r"^(\d{1,2})\.(\d{1,2})\.\s*([^\d\s].*)$")       # tiêu đề mục trong thân sách (có dấu chấm sau số)
MINI_TOC = re.compile(r"^\d{1,2}\.\d{1,2}\s+\S")             # mục lục đầu chương (không có dấu chấm) -> bỏ

def pages(d):
    out = {}
    for f in sorted(pathlib.Path(d).glob("*.txt")):
        out[int(f.stem)] = f.read_text("utf-8")
    return out

def running_headers(pg):
    c = collections.Counter()
    for t in pg.values():
        ls = [l.strip() for l in t.split("\n") if l.strip()]
        if ls: c[ls[0]] += 1
    return {h for h, n in c.items() if n >= 3 and h not in ("PHẦN",)}

def blocks(text, headers):
    """Tách trang thành đoạn (ngăn bởi dòng trống); bỏ tiêu đề chạy, số trang."""
    ls = text.split("\n")
    first = next((i for i, l in enumerate(ls) if l.strip()), None)
    if first is not None and ls[first].strip() in headers:
        ls[first] = ""
    out, cur = [], []
    for l in ls + [""]:
        s = l.strip()
        if re.fullmatch(r"\d{1,3}|[\W\d]{1,4}", s or "x"):
            s = ""
        if not s:
            if cur: out.append(cur); cur = []
        elif cur and SEC.match(s) and len(s) < 140:
            out.append(cur); cur = [s]   # tiêu đề mục nằm dính với đoạn trước
        else:
            cur.append(s)
    return out

def chapter_titles(pg, ranges, headers):
    """Tên chương = tiêu đề chạy hay gặp nhất trong các trang của chương (trừ tên sách)."""
    book_hdr = max(((sum(1 for t in pg.values() if t.strip().startswith(h)), h) for h in headers), default=(0, ""))[1]
    out = {}
    for ch, (a, b) in ranges.items():
        c = collections.Counter()
        for p in range(a, b + 1):
            t = pg.get(p, "")
            ls = [l.strip() for l in t.split("\n") if l.strip()]
            if ls and ls[0] in headers and ls[0] != book_hdr:
                c[ls[0]] += 1
        if c: out[ch] = fix(c.most_common(1)[0][0])
    return out

def split_parts(paras):
    parts, cur, w = [], [], 0
    for p in paras:
        n = len(p.split())
        if cur and w + n > MAX_W and w >= 150:
            parts.append(cur); cur, w = [], 0
        cur.append(p); w += n
        if w >= TARGET:
            parts.append(cur); cur, w = [], 0
    if cur:
        if parts and w < MIN_TAIL: parts[-1].extend(cur)
        else: parts.append(cur)
    return parts

def build(book, cfg, pg, out_dir):
    headers = running_headers(pg)
    titles = {**chapter_titles(pg, cfg["chapters"], headers), **cfg.get("chapter_titles", {})}
    zones = sorted(cfg["zones"])  # (trang bắt đầu, loại, nhãn)
    def zone_of(p):
        z = None
        for s in zones:
            if s[0] <= p: z = s
        return z
    units = collections.OrderedDict()  # khóa -> {label, title, chapter, paras}
    cur_key = None
    sec_seen = set()
    for p in sorted(pg):
        z = zone_of(p)
        if not z or z[1] == "drop":
            cur_key = None; continue
        bl = blocks(pg[p], headers)
        page_ch = next((c for c, (a, e) in cfg["chapters"].items() if a <= p <= e), None)
        if cur_key and cur_key in units and units[cur_key].get("chapter") not in (None, page_ch):
            cur_key = None
        for b in bl:
            if z[1] == "block":
                k = ("block", z[2])
                if k not in units: units[k] = {"label": z[2], "title": z[3] if len(z) > 3 else z[2], "chapter": None, "paras": []}
                cur_key = k
            else:  # vùng chương
                if (MINI_TOC.match(b[0]) and not SEC.match(b[0])) or (SEC.match(b[0]) and page_ch and p == cfg["chapters"][page_ch][0]):
                    continue  # mục lục đầu chương (trang mở chương)
                m = SEC.match(b[0])
                if m and len(b[0]) < 140:
                    num = f"{int(m.group(1))}.{int(m.group(2))}"
                    if num not in sec_seen and int(m.group(1)) in cfg["chapters"]:
                        sec_seen.add(num)
                        # tiêu đề có thể xuống dòng: ghép thêm dòng sau nếu tiêu đề còn ngắn
                        title_lines, rest = [m.group(3)], b[1:]
                        while rest and len(" ".join(title_lines).split()) < 16 and len(rest[0].split()) <= 9 and not re.search(r"[.:]$", title_lines[-1]):
                            title_lines.append(rest.pop(0))
                        cur_key = ("sec", num)
                        units[cur_key] = {"label": f"mục {num}", "title": f"{num}. {fix(' '.join(title_lines))}", "chapter": int(m.group(1)), "paras": []}
                        if rest: units[cur_key]["paras"].append(fix(" ".join(rest)))
                        continue
                drop_re = cfg.get("drop_block")
                if drop_re and re.match(drop_re, b[0]):
                    cur_key = ("skip",); continue
                if cur_key is None or cur_key[0] in ("block",):
                    # phần mở đầu chương, trước mục x.1
                    ch = next((c for c, (a, e) in cfg["chapters"].items() if a <= p <= e), None)
                    if ch is None: continue
                    cur_key = ("intro", ch)
                    if cur_key not in units:
                        units[cur_key] = {"label": f"chương {ch}", "title": f"Chương {ch}: {titles.get(ch, '')} (mở đầu)".replace(":  (", " ("), "chapter": ch, "paras": []}
                if cur_key == ("skip",):
                    continue
            txt = fix(" ".join(b))
            if (len(txt.split()) < 4 and not txt.endswith(":")) or garbage(txt):
                continue  # mảnh chữ trong hình/biểu đồ
            units[cur_key]["paras"].append(txt)
        if z[1] == "block": cur_key = None
    return write_units(book, cfg, units, titles, out_dir)

def build_markers(book, cfg, pg, out_dir):
    headers = running_headers(pg)
    marks = [(re.compile(rx), act, lab) for rx, act, lab in cfg["markers"]]
    units = collections.OrderedDict(); titles = {}
    cur_key, ch, sec_seen = None, None, set()
    def unit(k, label, title, chapter):
        if k not in units: units[k] = {"label": label, "title": title, "chapter": chapter, "paras": []}
        return k
    for p in sorted(pg):
        if p in cfg.get("skip_pages", []): continue
        for b in blocks(pg[p], headers):
            first = fix(b[0])
            hit = None
            for rx, act, lab in marks:
                m = rx.match(first)
                if m: hit = (act, lab, m); break
            if hit:
                act, lab, m = hit
                rest = b[1:]
                if act == "skip":
                    cur_key = ("skip",); continue
                if act == "chapter":
                    ch = int(m.group(1)); t = m.group(2).strip()
                    if rest and len(rest[0].split()) <= 8 and t.isupper(): t += " " + rest.pop(0)
                    titles[ch] = t.capitalize() if t.isupper() else t
                    cur_key = unit(("intro", ch), f"chương {ch}", f"Chương {ch}: {titles[ch]} (mở đầu)", ch)
                else:
                    g = [x.strip().capitalize() if x and x.isupper() else x for x in m.groups()] if m.groups() else []
                    label = lab[0].format(None, *g); title = lab[1].format(None, *g)
                    cur_key = unit(("block", label), label, title, None); ch = None
                if rest:
                    txt = fix(" ".join(rest))
                    if not garbage(txt): units[cur_key]["paras"].append(txt)
                continue
            m = SEC.match(b[0])
            if m and len(b[0]) < 140 and ch and int(m.group(1)) == ch:
                num = f"{int(m.group(1))}.{int(m.group(2))}"
                if num not in sec_seen:
                    sec_seen.add(num)
                    title_lines, rest = [m.group(3)], b[1:]
                    while rest and len(" ".join(title_lines).split()) < 16 and len(rest[0].split()) <= 9 and not re.search(r"[.:]$", title_lines[-1]):
                        title_lines.append(rest.pop(0))
                    cur_key = unit(("sec", num), f"mục {num}", f"{num}. {fix(' '.join(title_lines))}", ch)
                    if rest: units[cur_key]["paras"].append(fix(" ".join(rest)))
                    continue
            if cur_key is None or cur_key == ("skip",): continue
            txt = fix(" ".join(b))
            if (len(txt.split()) < 4 and not txt.endswith(":")) or garbage(txt): continue
            units[cur_key]["paras"].append(txt)
    titles.update(cfg.get("chapter_titles", {}))
    # tiêu đề chương cho phần mở đầu
    for k, u in units.items():
        if k[0] == "intro": u["title"] = f"Chương {k[1]}: {titles.get(k[1], '')} (mở đầu)"
    return write_units(book, cfg, units, titles, out_dir)

def write_units(book, cfg, units, titles, out_dir):
    bdir = out_dir / cfg["dir"]; bdir.mkdir(parents=True, exist_ok=True)
    stats = []
    for k, u in units.items():
        paras = [p for p in u["paras"] if p]
        if sum(len(p.split()) for p in paras) < 40: continue
        parts = split_parts(paras)
        chap = f"Chương {u['chapter']}: {titles.get(u['chapter'], '')}".rstrip(": ") if u["chapter"] else ""
        base = (f"{u['chapter']:02d}-" if u["chapter"] else "00-") + (k[1].replace(".", "-") + "-" if k[0] == "sec" else "") + slug(u["title"] if k[0] != "sec" else u["title"].split(". ", 1)[-1])
        for j, part in enumerate(parts, 1):
            suffix = f" (phần {j}/{len(parts)})" if len(parts) > 1 else ""
            head = f"# {book} — {u['title']}{suffix}\nNguồn: {book}, {u['label']}\n" + (chap + "\n" if chap else "")
            name = base + (f"-p{j}" if len(parts) > 1 else "") + ".md"
            (bdir / name).write_text(head + "\n" + "\n\n".join(part) + "\n", "utf-8")
            stats.append((name, sum(len(p.split()) for p in part)))
    return units, stats

AFB = {
    "dir": "03-sach/ai-first-business",
    "chapters": {1: (11, 24), 2: (25, 40), 3: (41, 63), 4: (65, 82), 5: (83, 96), 6: (97, 112), 7: (113, 133),
                 8: (135, 148), 9: (149, 160), 10: (161, 177), 11: (179, 196), 12: (197, 213)},
    "chapter_titles": {8: "Từ “Sếp” sang “Nhạc trưởng”"},
    "zones": [(1, "drop"), (4, "block", "Bản đồ công cụ"), (5, "block", "Lời mở đầu"), (8, "block", "Dẫn nhập Phần I"),
              (11, "chapters"), (64, "block", "Dẫn nhập Phần II"), (65, "chapters"), (134, "block", "Dẫn nhập Phần III"),
              (135, "chapters"), (178, "block", "Dẫn nhập Phần IV"), (179, "chapters"), (214, "block", "Lời kết"),
              (217, "block", "Phụ lục A", "Phụ lục A – Mẫu chính sách sử dụng AI nội bộ"),
              (219, "block", "Phụ lục B", "Phụ lục B – Bộ công cụ thực hành Hồ Sơ Agent"),
              (226, "block", "Phụ lục C", "Phụ lục C – Đánh giá năng lực lực lượng lao động cấp tổ chức"),
              (228, "block", "Phụ lục D", "Phụ lục D – Bảng chấm điểm EAR Index™ đầy đủ"),
              (233, "block", "Phụ lục E", "Phụ lục E – Bảng thuật ngữ"), (237, "drop")],
}

if __name__ == "__main__":
    afb_dir, aie_dir, out = sys.argv[1], sys.argv[2], pathlib.Path(sys.argv[3])
    import importlib.util
    cfgs = [("AI First Business", AFB, afb_dir)]
    try:
        from build_books_aie import AIE
        cfgs.append(("Nền Kinh tế Trí tuệ", AIE, aie_dir))
    except ImportError:
        pass
    report = {}
    for book, cfg, d in cfgs:
        units, stats = (build_markers if cfg.get("mode") == "markers" else build)(book, cfg, pages(d), out)
        secs = sorted((k[1] for k in units if k[0] == "sec"), key=lambda s: tuple(map(int, s.split("."))))
        report[book] = {"files": len(stats), "words": sum(w for _, w in stats), "sections": secs,
                        "min": min(stats, key=lambda x: x[1]), "max": max(stats, key=lambda x: x[1])}
    print(json.dumps(report, ensure_ascii=False, indent=1))
