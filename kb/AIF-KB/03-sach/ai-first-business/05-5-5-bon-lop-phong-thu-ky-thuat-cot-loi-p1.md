# AI First Business — 5.5. Bốn lớp phòng thủ kỹ thuật cốt lõi (phần 1/2)
Nguồn: AI First Business, mục 5.5
Chương 5: Bảo vệ dữ liệu trong doanh nghiệp AI-First

Một tệp dữ liệu mật trong máy chủ được canh gác cẩn thận vẫn có thể bị sao chép sang thiết bị di động hay tải lên một công cụ AI công cộng chỉ trong vài cú nhấp chuột. Chiến lược cần chuyển từ bảo vệ vị trí lưu trữ sang bảo vệ chính dữ liệu, xuyên suốt ba trạng thái: khi lưu trữ, khi truyền tải, và khi đang được xử lý. Mã hóa là cần thiết nhưng không đủ, nếu một người dùng có quyền hợp lệ chủ động gửi dữ liệu ra ngoài, như người bác sĩ ở mục 5.3, mã hóa ở tầng lưu trữ không ngăn được hành động đó.

Bốn lớp phòng thủ cần phối hợp đồng thời. Cụ thể là:

Lớp thứ 1 Kiểm kê và phân loại: không thể bảo vệ thứ mình không biết đang tồn tại. Cần bản đồ đầy đủ về dữ liệu, hệ thống AI, và luồng di chuyển giữa các hệ thống, dữ liệu đến từ đâu, ai là chủ sở hữu, có chuyển ra khỏi doanh nghiệp hoặc ra nước ngoài hay không.

Lớp thứ 2 Danh tính riêng biệt và quyền tối thiểu: mỗi người dùng, ứng dụng và Tác nhân AI cần danh tính riêng, không dùng chung tài khoản. Quyền hạn cần tách theo hành động: đọc, tạo, sửa, gửi, xóa, giao dịch. Một Tác nhân tóm tắt bệnh án, như ở ví dụ mục 5.3, không cần quyền soạn thư gửi ra ngoài bệnh viện, nếu quyền hạn được thiết kế đúng từ đầu, tình huống rò rỉ dữ liệu qua thư giới thiệu chuyển viện đã không thể xảy ra theo cùng cách đó.

Lớp thứ 3 Kiểm soát nội dung theo ngữ cảnh: hệ thống chống rò rỉ dữ liệu phù hợp thời đại AI cần nhìn được nội dung dán vào câu lệnh, không chỉ tệp đính kèm email. Cùng một bảng giá có thể được mở để làm việc nhưng không được tải lên công cụ công cộng.

Lớp thứ 4 Giám sát, lưu vết và khả năng phục hồi: doanh nghiệp cần biết ai hoặc Tác nhân nào đã truy cập dữ liệu gì, gửi đi đâu. Giám sát tốt phát hiện hành vi bất thường ngay khi đang diễn ra, đọc quá nhiều tệp, thử kết nối tên miền lạ. Nếu bệnh viện ở ví dụ trên có hệ thống giám sát đủ tốt, việc Tác nhân bất ngờ xử lý nội dung thư giới thiệu chuyển viện, một loại tác vụ nằm ngoài mục tiêu ban đầu, lẽ ra đã được gắn cờ cảnh báo ngay từ lần đầu tiên xảy ra, thay vì kéo dài âm thầm trong nhiều tháng.
