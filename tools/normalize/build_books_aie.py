"""Cấu hình cuốn 'Nền Kinh tế Trí tuệ' (AI Economy): chương bắt đầu giữa trang, cuối chương có phần CHÚ THÍCH (bỏ)."""
AIE = {
    "dir": "03-sach/nen-kinh-te-tri-tue",
    "mode": "markers",
    "chapter_titles": {
        1: "Trí tuệ trở thành yếu tố sản xuất", 2: "Bên trong nhà máy trí tuệ", 3: "Dòng vốn AI đang chảy về đâu?",
        4: "Kiến trúc sư luật chơi", 5: "Những nước nhỏ và quyền lực từ sự khan hiếm", 6: "Quyền lực từ tốc độ chuyển hóa nguồn lực",
        7: "Việt Nam trong nền kinh tế AI: cửa sổ cơ hội đến năm 2035", 8: "Tám trụ cột sẵn sàng: Việt Nam đang đứng ở đâu?",
        9: "Tự động hóa và cơn địa chấn ngành nghề", 10: "Việt Nam trong kỷ nguyên AI: việc làm và kỹ năng",
        11: "Chín tháng để có một hệ thống máy chủ AI", 12: "Doanh nghiệp: nơi AI trở thành năng suất quốc gia",
        13: "Lựa chọn thuộc về chúng ta",
    },
    "skip_pages": [1, 2, 3],
    # (biểu thức, hành động, nhãn) — hành động: chapter | block | skip
    "markers": [
        (r"^CHƯƠNG\W*(\d{1,2})\s*:\s*(.+)$", "chapter", None),
        (r"^CHÚ THÍCH\b", "skip", None),
        (r"^TÀI LIỆU THAM KHẢO\b", "skip", None),
        (r"^LỜI MỞ ĐẦU\b", "block", ("Lời mở đầu", "Lời mở đầu")),
        (r"^GHI CHÚ PHƯƠNG PHÁP\b", "block", ("Ghi chú phương pháp", "Ghi chú phương pháp và ngày khóa dữ liệu")),
        (r"^BẢN ĐỒ KHUNG PHÂN TÍCH\b", "block", ("Bản đồ khung phân tích", "Bản đồ khung phân tích")),
        (r"^PHẦN (I{1,3}|IV)\s*:\s*(.+)$", "block", ("Phần {1}", "Phần {1}: {2}")),
        (r"^PHỤ LỤC ([A-C])\.\s*(.+)$", "block", ("Phụ lục {1}", "Phụ lục {1} – {2}")),
    ],
}
