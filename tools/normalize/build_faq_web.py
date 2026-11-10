#!/usr/bin/env python3
"""Chuyển faq.json + site.json (web v2.2.0) thành các tệp .md trong AIF-KB/02-faq và 04-website.
Mỗi tệp: dòng '# câu hỏi', dòng 'Nguồn: <tên sách>, mục ...', rồi nội dung."""
import json, re, sys, unicodedata, pathlib

SRC = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/home/claude/v16/afb/content/chat")
OUT = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "/home/claude/aif-chatbot/kb/AIF-KB")
BOOK = {"S1": "AI First Business", "S2": "Nền Kinh tế Trí tuệ"}

def slug(s, n=60):
    s = unicodedata.normalize("NFD", s.replace("đ", "d").replace("Đ", "D"))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:n].rstrip("-")

def ref_to_source(ref):
    out = []
    for part in ref.split(";"):
        part = part.strip().rstrip(".").strip()
        m = re.match(r"(S[12])\s+(.*)", part)
        if m:  # chỉ giữ tên sách + mục/chương; bỏ ghi chú như 'diễn giải triển khai'
            out.append(f"{BOOK[m.group(1)]}, {m.group(2)}")
    return "; ".join(out)

def main():
    faq = json.loads((SRC / "faq.json").read_text("utf-8"))
    groups = faq["groups"]
    d = OUT / "02-faq"; d.mkdir(parents=True, exist_ok=True)
    for x in faq["faq"]:
        src = ref_to_source(x["ref"])
        body = "\n\n".join(x["a"])
        txt = f"# {x['q']}\nNguồn: {src}\nChủ đề: {groups[str(x['g'])]}\n\n{body}\n"
        (d / f"faq-{x['id']:03d}-{slug(x['q'])}.md").write_text(txt, "utf-8")
    site = json.loads((SRC / "site.json").read_text("utf-8"))
    d = OUT / "04-website"; d.mkdir(parents=True, exist_ok=True)
    for x in site["items"]:
        link = ""
        if x.get("link"):
            link = f"\n\nLiên kết: {x['link'][1]} — https://aifirstbusiness.vn{x['link'][0]}"
        txt = f"# {x['q']}\nNguồn: Website aifirstbusiness.vn\nTừ khóa: {x.get('k','')}\n\n{x['a']}{link}\n"
        (d / f"{x['id'].lower()}-{slug(x['q'])}.md").write_text(txt, "utf-8")
    print("faq", len(faq["faq"]), "web", len(site["items"]))

if __name__ == "__main__":
    main()
