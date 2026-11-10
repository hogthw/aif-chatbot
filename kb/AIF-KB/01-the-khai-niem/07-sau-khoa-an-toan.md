# Thẻ khái niệm: Sáu khóa an toàn cho Tác nhân AI
Nguồn: AI First Business, mục 5.6
Từ khóa: sáu khóa an toàn, Tác nhân AI, AI Agent, quyền tối thiểu, phê duyệt của con người, ngắt khẩn cấp, kiểm thử đối kháng

Một câu lệnh yêu cầu Tác nhân "hãy hành động an toàn" không tạo ra ranh giới an toàn. Ranh giới phải được cưỡng chế bằng cơ chế kỹ thuật nằm ngoài bản thân mô hình, mà Tác nhân không thể tự bỏ qua. Sáu khóa:

1. Ranh giới nhiệm vụ: rõ mục tiêu, dữ liệu được dùng, công cụ được gọi và những hành động tuyệt đối không làm; không giao mục tiêu mở kiểu "hoàn thành bằng mọi cách".
2. Quyền tối thiểu: chỉ cấp quyền cần cho nhiệm vụ (không cần Internet thì không có Internet; chỉ cần đọc thì không có quyền sửa, xóa).
3. Phê duyệt của con người: hành động có hậu quả lớn hoặc khó đảo ngược (gửi dữ liệu nhạy cảm, chuyển tiền, ký kết, xóa dữ liệu, cam kết với khách hàng) phải qua điểm phê duyệt độc lập.
4. Hạn mức vận hành: giới hạn định lượng về số và giá trị giao dịch, số tệp, số lần gọi hệ thống, số bước liên tiếp; vượt ngưỡng thì dừng và chuyển cho người.
5. Giám sát và ngắt khẩn cấp: thấy được Tác nhân đang truy cập gì, gọi công cụ nào; thu hồi quyền hoặc cô lập ngay bằng cơ chế nằm ngoài quyền kiểm soát của nó.
6. Kiểm thử đối kháng: trước khi mở rộng, thử với chỉ dẫn độc hại, dữ liệu bất thường, yêu cầu vượt quyền, đường tắt vi phạm quy tắc.

Sáu khóa không phải sáu bước tuần tự mà là sáu rào chắn cùng tồn tại. Đây là điểm chuyển từ bảo vệ dữ liệu sang kiểm soát hành động của AI.
