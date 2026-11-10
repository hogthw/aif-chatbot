# AI First Business — 9.1. Vận hành & Sản xuất (phần 1/2)
Nguồn: AI First Business, mục 9.1
Chương 9: Bản đồ chuyển đổi theo phòng ban

Trong một nhà máy hay một trung tâm vận hành, thứ đáng sợ nhất là sự bất ngờ. AI trong lĩnh vực vận hành, về bản chất, là công cụ biến sự bất ngờ thành sự dự đoán được.

Một công ty gia công cơ khí chính xác tại Khu công nghiệp Việt Nam - Singapore minh họa rõ điều này. Trước đây, việc phát hiện một lô sản phẩm sai kích thước thường chỉ xảy ra ở bước kiểm tra chất lượng cuối cùng, khi cả lô hàng đã hoàn thành, chi phí sửa chữa hoặc loại bỏ đã phát sinh đầy đủ. Sau khi lắp đặt cảm biến đo kích thước liên tục ngay trên dây chuyền cắt gọt, kết hợp với một hệ thống AI học được mẫu hình sai lệch bình thường của từng loại máy, đội vận hành bắt đầu nhận được cảnh báo sớm ngay khi một máy có dấu hiệu lệch chuẩn dần, trước khi sản phẩm lỗi thực sự được tạo ra. Trong sáu tháng đầu vận hành, số lô hàng phải loại bỏ hoàn toàn vì sai kích thước giảm rõ rệt so với cùng kỳ năm trước, dù bản thân máy móc không hề được thay mới, chỉ có cách phát hiện vấn đề đã thay đổi, từ “phát hiện sau khi đã xảy ra” sang “phát hiện trước khi kịp xảy ra”.

Chỉ số đo lường cho khối vận hành gồm thời gian ngừng máy ngoài kế hoạch, tỷ lệ lô hàng lỗi được phát hiện trước khi hoàn thành so với sau khi hoàn thành, và tỷ lệ cảnh báo đúng so với cảnh báo sai của hệ thống giám sát.

Điều kiện hấp thụ cần có là dữ liệu cảm biến đồng bộ, đủ lịch sử để mô hình học được mẫu hình bình thường và bất thường, cùng một đội vận hành có kỷ luật ghi chép sự cố, nếu đội vận hành không quen ghi lại chính xác thời điểm và nguyên nhân mỗi lần dừng máy trong

quá khứ, hệ thống AI sẽ thiếu dữ liệu nền để học được thế nào là “bình thường” cho từng loại máy cụ thể.
