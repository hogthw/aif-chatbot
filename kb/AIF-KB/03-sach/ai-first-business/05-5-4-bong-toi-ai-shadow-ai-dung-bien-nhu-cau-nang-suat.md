# AI First Business — 5.4. Bóng tối AI (Shadow AI): đừng biến nhu cầu năng suất thành hành vi bí mật
Nguồn: AI First Business, mục 5.4
Chương 5: Bảo vệ dữ liệu trong doanh nghiệp AI-First

Một nhân viên kinh doanh đang gấp rút chuẩn bị hồ sơ dự thầu. Công cụ AI nội bộ chỉ tóm tắt được đoạn văn bản ngắn, trong khi một công cụ công cộng đọc được toàn bộ hồ sơ đối thủ trong vài phút. Khi áp lực đủ lớn, quy định “không dùng AI bên ngoài” rất dễ bị bỏ qua, không phải vì nhân viên coi thường quy định, mà vì khoảng cách giữa chính sách và nhu cầu công việc đã quá lớn, giống hệt tình huống người bác sĩ ở mục 5.3.

Ba việc cần triển khai đồng thời để xử lý tận gốc vấn đề này. Nhìn thấy đúng thực tế: lập danh mục đầy đủ công cụ đang được dùng, kể cả những Tác nhân do phòng ban tự xây mà chưa qua bộ phận công nghệ thông tin trung tâm. Phân loại theo trường hợp sử dụng thay vì theo tên công cụ: cùng một công cụ có thể an toàn cho việc này nhưng rủi ro cho việc khác, như trường hợp Tác nhân tóm tắt bệnh án ở mục trước. Và cung cấp một lựa chọn thay thế đủ nhanh,

đủ tiện, vì cấm đoán tuyệt đối hiếm khi hiệu quả, nó chỉ đẩy hành vi vào bóng tối, khó phát hiện hơn.

Một cách phân loại thực tế, dễ áp dụng trong vận hành hằng ngày, là nguyên tắc ba mức xanh, vàng, đỏ:

Bảng 5.2. Nguyên tắc ba mức Xanh - Vàng - Đỏ

c Loại dữ liệu điển hình Cách sử dụng được phép

Xan | Nội dung công khai, dữ liệu giảlập | Dùng bất kỳ công cụ AI nào đã liệt kê h an toàn

Vàn | Dữ liệu nội bộ đã ẩn danh hóa Chỉ dùng trong môi trường AI cấp g doanh nghiệp, có kiểm soát

Đỏ | Dữ liệu cá nhân nhạy cảm, bí mật | Không đưa vào công cụ công cộng; kinh doanh, mã nguồn trọng yếu cần phê duyệt và kiến trúc riêng

Điều nhân viên cần biết không chí là “được dùng công cụ nào”, mà quan trọng hơn là “loại dữ liệu nào được phép đưa vào công cụ đó”. Một bệnh án đầy đủ, như trong tình huống ở mục 5.3, thuộc thẳng vào mức đỏ, bất kể công cụ được dùng có nằm trong danh mục đã phê duyệt cho mục đích khác hay không.
