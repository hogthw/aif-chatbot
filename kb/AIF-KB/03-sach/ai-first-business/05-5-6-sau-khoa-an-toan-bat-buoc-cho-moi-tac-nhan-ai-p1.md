# AI First Business — 5.6. Sáu khóa an toàn bắt buộc cho mọi Tác nhân AI (phần 1/2)
Nguồn: AI First Business, mục 5.6
Chương 5: Bảo vệ dữ liệu trong doanh nghiệp AI-First

Bài học từ sự cố mở đầu chương rất rõ ràng: không thể bảo vệ doanh nghiệp chỉ bằng một câu lệnh hệ thống yêu cầu Tác nhân “hãy hành động an toàn”. Ranh giới an toàn phải được cưỡng chế bởi một hệ thống kỹ thuật nằm ngoài bản thân mô hình.

Trong doanh nghiệp AI-First, bảo vệ dữ liệu chưa đủ. Khi AI chỉ đọc hoặc tạo nội dung, rủi ro chủ yếu nằm ở thông tin. Nhưng khi một Tác nhân AI có thể truy cập hệ thống, gọi công cụ và thực hiện hành động, doanh nghiệp phải kiểm soát thêm một câu hỏi: AI được phép làm gì với dữ liệu đó?

Một Tác nhân bán hàng kết nối email, hệ thống quản lý quan hệ khách hàng, bảng giá và phần mềm kế toán là ví dụ điển hình. Ở giai đoạn đầu, Tác nhân có thể được quyền đọc và chuẩn bị báo giá, nhưng chưa được tự gửi báo giá chính thức, xuất danh sách khách hàng hay thực hiện giao dịch. Khi độ tin cậy được chứng minh,

quyền có thể được mở rộng từng bước, với hạn mức và các điểm phê duyệt của con người.

Một câu lệnh yêu cầu Tác nhân “hãy hành động an toàn” không tạo ra ranh giới an toàn. Ranh giới phải được thiết kế thành những cơ chế mà chính Tác nhân không thể tự ý bỏ qua. Có sáu khóa cơ bản.

Khóa 1: Ranh giới nhiệm vụ. Tác nhân phải biết rõ mục tiêu, dữ liệu được sử dụng, công cụ được phép gọi và những hành động tuyệt đối không được thực hiện. Không giao những mục tiêu mở kiểu “hoàn thành bằng mọi cách”.

Khóa 2: Quyền tối thiểu. Tác nhân chỉ được cấp những quyền cần cho nhiệm vụ. Không cần Internet thì không có quyền Internet; chỉ cần đọc thì không có quyền sửa hoặc xóa; không cần gửi dữ liệu ra ngoài thì không có đường gửi ra ngoài.

Khóa 3: Phê duyệt của con người. Những hành động có hậu quả lớn hoặc khó đảo ngược (gửi dữ liệu nhạy cảm, chuyển tiền, ký kết, xóa dữ liệu, tạo cam kết với khách hàng) phải đi qua một điểm phê duyệt độc lập của con người.
