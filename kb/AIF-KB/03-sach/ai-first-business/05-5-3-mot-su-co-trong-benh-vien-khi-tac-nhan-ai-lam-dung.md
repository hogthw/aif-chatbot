# AI First Business — 5.3. Một sự cố trong bệnh viện: khi Tác nhân AI “làm đúng những gì được yêu cầu”
Nguồn: AI First Business, mục 5.3
Chương 5: Bảo vệ dữ liệu trong doanh nghiệp AI-First

Để hình dung sáu con đường thất thoát trên có thể kết hợp với nhau ra sao trong thực tế, hãy xem xét tình huống sau, đại diện cho loại rủi ro mà nhiều bệnh viện tư nhân tại Việt Nam đang đối mặt khi triển khai trợ lý AI hỗ trợ bác sĩ.

Một bệnh viện triển khai Tác nhân AI với mục tiêu “tóm tắt lịch sử khám bệnh của bệnh nhân trước mỗi lượt tái khám, giúp bác sĩ tiết kiệm thời gian đọc hồ sơ giấy”. Để làm tốt việc này, Tác nhân được cấp quyền truy cập vào toàn bộ hệ thống hồ sơ bệnh án điện tử, một quyết định hợp lý về mặt kỹ thuật, vì Tác nhân cần “nhìn thấy” đủ dữ liệu để tóm tắt chính xác.

Vài tháng sau, một bác sĩ, muốn tiết kiệm thời gian hơn nữa, bắt đầu dùng chính Tác nhân đó để soạn thư giới thiệu chuyển viện, dán trực tiếp nội dung bệnh án đầy đủ của bệnh nhân vào cuộc trò chuyện để nhờ “viết cho gọn”. Đây không nằm trong mục tiêu ban đầu của Tác nhân, không ai phê duyệt việc mở rộng phạm vi sử dụng

này, và bản thân bác sĩ cũng không nghĩ mình đang làm gì sai, chỉ đơn giản là dùng một công cụ đã quen thuộc cho một việc tương tự.

Vấn đề nảy sinh khi bệnh viện phát hiện Tác nhân này được kết nối với một nhà cung cấp AI mà điều khoản hợp đồng không quy định rõ liệu nội dung câu lệnh có được dùng để cải thiện dịch vụ hay không. Không có sự cố rò rỉ dữ liệu ra bên ngoài theo nghĩa một cuộc tấn công mạng, nhưng dữ liệu bệnh án nhạy cảm của hàng trăm bệnh nhân đã rời khỏi ranh giới kiểm soát của bệnh viện theo một con đường hoàn toàn hợp pháp về mặt kỹ thuật: một nhân viên có quyền truy cập hợp lệ, sử dụng đúng công cụ đã được phê duyệt, nhưng cho một mục đích chưa từng được đánh giá rủi ro.

Tình huống này cho thấy vì sao “rò rỉ qua câu lệnh” và “rò rỉ qua nhà cung cấp” ở mục 5.2 thường xuất hiện cùng nhau trong thực tế, không phải hai rủi ro tách biệt: một nhân viên tận tâm, không có ý định xấu, sử dụng đúng công cụ được cấp, nhưng theo cách vượt khỏi phạm vi mà chưa ai từng đánh giá rủi ro dữ liệu.
