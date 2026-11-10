# AI First Business — 7.8. Trở lại câu chuyện mở đầu: Trợ lý Báo giá AI, phiên bản đã sửa (phần 1/2)
Nguồn: AI First Business, mục 7.8
Chương 7: AI Agent: đơn vị vận hành mới

Hãy quay lại công ty vật liệu xây dựng ở đầu chương, nơi Trợ lý Báo giá AI trả lời sai chiết khấu ba lần liên tiếp, trong khi đối thủ đã báo giá xong từ lâu. Áp dụng đầy đủ khung Hồ Sơ Agent và bảy bước triển khai vừa trình bày, đội ngũ phụ trách dự án đã làm lại từ đầu, lần này theo đúng trình tự.

Ở bước xác định vai trò, họ nhận ra sai lầm đầu tiên: Tác nhân AI trước đó được mô tả chỉ bằng một câu duy nhất trong bản đề xuất dự án, “hỗ trợ báo giá cho khách hàng”, không có phòng ban chủ quản rõ ràng, không có người chịu trách nhiệm cuối cùng nếu nó trả lời sai. Lần này, Tác nhân được đặt tên cụ thể, gán trực thuộc phòng kinh doanh, báo cáo trực tiếp cho trưởng phòng kinh doanh, và được quy định rõ: không được phép tự động gửi báo giá cuối cùng cho khách hàng mà không qua một bước xác nhận của nhân viên phụ trách tài khoản đó.

Ở bước xác định mục tiêu, thay vì mục tiêu mơ hồ “báo giá nhanh hơn”, đội ngũ đặt ra chỉ số cụ thể: dưới mười lăm phút cho một yêu cầu báo giá tiêu chuẩn, độ chính xác về chính sách chiết khấu đạt một trăm phần trăm khi đối chiếu với bảng giá chính thức, và tỷ lệ

phải chuyển cho con người xử lý không vượt quá hai mươi phần trăm tổng số yêu cầu.

Ở bước chuẩn bị dữ liệu - phần tốn nhiều công sức nhất trong toàn bộ dự án - nhóm phát hiện ra nguyên nhân gốc rễ của sai sót trước đó: bảng chiết khấu cho đại lý hạng B tồn tại ở ba phiên bản khác nhau, nằm rải rác trong email, một tệp bảng tính cũ, và trí nhớ của một nhân viên kinh doanh kỳ cựu đã nghỉ việc từ sáu tháng trước. Không có gì ngạc nhiên khi Tác nhân AI trả lời khác nhau ở ba lần hỏi, nó không hề “sai”, nó chỉ đang trung thực phản ánh sự hỗn loạn vốn có sẵn trong chính dữ liệu nguồn của doanh nghiệp trước khi AIxuất hiện. Đội ngũ dành gần ba tuần để thống nhất một bảng chiết khấu duy nhất, có chủ sở hữu rõ ràng, và cam kết mọi thay đổi trong tương lai đều phải cập nhật vào đúng một nguồn duy nhất đó.
