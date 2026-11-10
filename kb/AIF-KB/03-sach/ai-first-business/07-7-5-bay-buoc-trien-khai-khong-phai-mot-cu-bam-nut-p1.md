# AI First Business — 7.5. Bảy bước triển khai, không phải một cú bấm nút (phần 1/2)
Nguồn: AI First Business, mục 7.5
Chương 7: AI Agent: đơn vị vận hành mới

Hồ Sơ Agent ở mục 7.2 trả lời câu hỏi một Tác nhân AI nên là gì: súu thành phần tĩnh trên giấy. Câu hỏi tiếp theo, khó hơn nhiều, là làm sao đưa sáu thành phần đó vào vận hành thật mà không bỏ sót thứ gì. Vì vậy bảy bước dưới đây là một trình tự bắt buộc, không phải một danh sách kiểm tra có thể làm theo thứ tự tùy ý hay làm song song cho nhanh. Xác định sai vai trò ở bước 1 kéo theo mục tiêu sai ở bước 2; chuẩn bị dữ liệu ở bước 3 mà bỏ qua sẽ khiến bước 4 kết nối công cụ vào một Tác nhân đang "đoán" thay vì biết; và thiết lập ranh giới ở bước 5 chỉ có ý nghĩa khi đã rõ Tác nhân được phép biết gì, làm gì. Bước 7 vì vậy không phải điểm kết thúc: nó là vòng quay lại bắt buộc của cả trình tự.

Bảng 7.1. Bảy bước triển khai một Tác nhân AI

1 Xác định vaitrò | Thường bị viết qua loa, không neo vào cấu trúc tổ chức

2 Xác định mục | Nhiều tổ chức không quen đặt chỉ số hiệu suất cho một tiêu hệ thống tự động Chuẩn bị dữ liệu | Đòi hỏi công sức dọn dẹp và khai thác tri thức

4 Kếtnốicôngcụ | Cần thận trọng, không cấp quyền vượt mức cần thiết

5 Thiết lập ranh | Bị bỏ quên nhiều nhất vì ít ai muốn nghĩ đến kịch bản giới thất bại lúc mới bắt đầu

6 Thiết kế lịch | Cần hình dung Tác nhân chạy theo nhịp làm việc thật trình vận hành

7 Đo lường và cải | Dễ bị coi là “đã xong” sau khi Tác nhân chạy được lần tiến đầu, trong khi đây là một vòng lặp liên tục
