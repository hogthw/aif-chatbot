# AI First Business — 5.7. Hợp đồng với nhà cung cấp cũng là một lớp bảo mật (phần 1/2)
Nguồn: AI First Business, mục 5.7
Chương 5: Bảo vệ dữ liệu trong doanh nghiệp AI-First

Đánh giá công cụ AI chỉ qua chất lượng câu trả lời và giá thuê bao là chưa đủ khi dữ liệu nội bộ có giá trị thực sự được đưa vào, đúng như bài học từ tình huống bệnh viện ở mục 5.3, nơi bản thân điều khoản hợp đồng chưa rõ ràng mới là lỗ hống thực sự, không phải bản thân công cụ AI. Hợp đồng cần làm rõ: câu lệnh, đầu ra, nhật ký và embeddings có được dùng để huấn luyện hay cải thiện dịch vụ hay không; dữ liệu lưu ở đâu, trong bao lâu; nhà thầu phụ nào có thể tiếp cận; dữ liệu được xóa thế nào khi chấm dứt hợp đồng; và doanh nghiệp có quyền nhận báo cáo kiểm toán hay chứng nhận bảo mật nào.

Cam kết “không lưu giữ dữ liệu để huấn luyện” là một điều khoản mạnh, nhưng không nên dùng như khẩu hiệu thay cho thẩm định, một hệ thống có thể không lưu câu lệnh dài hạn nhưng vẫn tạo nhật ký vận hành hay bản sao phục vụ an toàn hệ thống. Nguyên tắc chung: dữ liệu càng quan trọng, càng cần bằng chứng kỹ thuật và điều khoản hợp đồng cụ thể bằng văn bản, không chỉ lời giới thiệu bán hàng.

Tổng kết Chương 5: Niềm tin phải được thiết kế, không thể chỉ hy vọng mà có

AI tạo ra giá trị bằng cách đưa dữ liệu vào nhiều quyết định hơn, và biến chúng thành hành động nhanh hơn. Chính ưu điểm đó cũng là lý do rủi ro lan rộng nhanh hơn nếu không được kiểm soát.

Một nhân viên có quyền hợp lệ vẫn có thể vô tình đưa hợp đồng nhạy cảm vào công cụ công cộng, đúng như người bác sĩ ở mục 5.3 không hề có ý định làm sai. Một Tác nhân AI không mang ý định xấu vẫn có thể vượt ranh giới, đơn giản vì mục tiêu chưa đầy đủ và hệ thống còn khe hở, đúng như câu chuyện mở đầu chương này. Bảo vệ dữ liệu trong doanh nghiệp AI-First, vì vậy, không phải xây thêm một bức tường. Đó là thiết kế lại cách dữ liệu được phân loại, quyền hạn được thu hẹp, hành động được kiểm soát, và đồng thời bảo đảm doanh nghiệp có thể ngắt, điều tra, phục hồi ngay khi có điều bất thường. An ninh mạng bảo vệ hệ thống khỏi kẻ tấn công bên ngoài; bảo mật dữ liệu bảo vệ chính thông tin dù nó nằm ở đâu; bảo mật Tác nhân AI bảo đảm AI chỉ hành động trong đúng ranh giới cho phép. Ba lớp này không đối lập, chúng cùng tạo thành nền móng của niềm tin.
