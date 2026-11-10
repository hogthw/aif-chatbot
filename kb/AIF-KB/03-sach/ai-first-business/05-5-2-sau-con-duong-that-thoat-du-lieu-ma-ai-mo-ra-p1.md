# AI First Business — 5.2. Sáu con đường thất thoát dữ liệu mà AI mở ra (phần 1/2)
Nguồn: AI First Business, mục 5.2
Chương 5: Bảo vệ dữ liệu trong doanh nghiệp AI-First

AI không xóa bỏ những rủi ro bảo mật cũ: mất thiết bị, tấn công mạng, nhân viên sao chép dữ liệu trước khi nghỉ việc. AI tạo thêm những con đường thất thoát hoàn toàn mới, thường nhanh hơn, khó quan sát hơn.

Rò rÍ qua câu lệnh là tình huống phổ biến nhất, và cũng dễ xảy ra nhất vì không đòi hỏi ý định xấu nào. Một nhân viên sao chép nguyên văn một hợp đồng, hồ sơ khách hàng, hay đoạn mã nguồn, rồi dán vào một công cụ AI công cộng chỉ để “làm nhanh hơn”. Hành động chỉ mất vài giây, không tạo tệp đính kèm, và phần lớn không bị hệ thống chống rò rỉ dữ liệu truyền thống phát hiện, vì các hệ thống đó vốn giám sát email và tệp đính kèm, không nhìn vào nội dung dán trực tiếp vào ô nhập liệu. Ngay khoảnh khắc dữ liệu rời khỏi trình duyệt, nó đã rời khỏi phạm vi quản trị của doanh nghiệp.

Rò rỉ qua đầu ra của hệ thống AI xảy ra khi một hệ thống tạo ra câu trả lời chứa thông tin nhạy cảm mà người nhận không có quyền biết, không chủ yếu vì mô hình “ghi nhớ” dữ liệu huấn luyện, mà thường vì AI lấy đúng dữ liệu từ kho nội bộ nhưng đưa cho sai người, do hệ thống chưa phân quyền đúng ở tầng dữ liệu.

Rò rỉ qua RAG, embeddings và cơ sở dữ liệu vector là con đường ít được chú ý nhưng ngày càng phổ biến. Kỹ thuật truy xuất tăng cường vẫn tạo ra một lớp dữ liệu mới: tài liệu bị chia nhỏ, chuyển thành embeddings, lập chỉ mục và truy xuất theo ngữ nghĩa. Nếu quyền truy cập chỉ được kiểm soát ở giao diện mà không áp dụng nhất quán ở từng nguồn tài liệu gốc, nhân viên có thể nhận được nội dung từ một thư mục lẽ ra không mở cho họ. Embeddings cần được bảo vệ nghiêm ngặt như một cơ sở dữ liệu sản xuất, không phải “dữ liệu phụ”.

Rò rỉ qua nhà cung cấp và chuỗi công nghệ phía sau là con đường dễ bị bỏ quên nhất. Một ứng dụng AI hiếm khi đứng một mình, phía sau có nhà cung cấp mô hình, nền tảng đám mây, công cụ tích hợp, kho lưu nhật ký, và không ít nhà thầu phụ. Một tuyên bố “không dùng dữ liệu khách hàng để huấn luyện” chưa đủ; cần biết tuyên bố
