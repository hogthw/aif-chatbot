# Nền Kinh tế Trí tuệ — 2.3. Chu trình sản xuất và hai dây chuyền (phần 1/2)
Nguồn: Nền Kinh tế Trí tuệ, mục 2.3
Chương 2: Bên trong nhà máy trí tuệ

Mục đích Tạo ra mô hình Phục vụ người dùng _— Rất lớn, theo từng Tăng theo lượng sử Chi phí đợt dụng

~. Nơi điện rẻ, đất rộng. Gần người dùng và Nơi đặt : ng ẽ ố

thị trường Nhucẩuđiện Cực lớn, tập trung Phân tán, liên tục Độ trễ Không quan trọng Cần thấp

Hình 2.3. Hai dây chuyền của nhà máy trí tuệ: huấn luyện và suy luận

Nguồn: Tổng hợp của tác giả.

Một nhà máy trí tuệ tạo ra giá trị qua một chu trình năm bước (Hình 2.3). Dữ liệu được thu thập, làm sạch và gắn nhãn; mô hình được huấn luyện trước trên lượng dữ liệu lớn để trở thành mô hình nền tảng; mô hình nền tảng được tỉnh chỉnh bằng dữ liệu chuyên ngành và các quy tắc an toàn; mô hình đã tỉnh chỉnh được triển khai để trả lời yêu cầu của người dùng; và cuối cùng được tích hợp vào các tác nhân AI làm việc trong doanh nghiệp. Giống dầu thô phải qua nhà máy lọc trước khi thành xăng, dữ liệu thô chỉ có giá trị sau khi đi qua chu trình này.

Bên trong chu trình ấy có hai dây chuyền khác nhau về kỹ thuật, cơ cấu chi phí và nơi đặt:

1. Dây chuyền huấn luyện

- Mụctiêu: tạo ra mô hình mới, đòi hỏi hàng chục nghìn GPU chạy liên tục nhiều tuần đến nhiều tháng.

s Cơcấu chi phí: chủ yếu là vốn. Chi phí huấn luyện một mô hình hàng đầu tăng khoảng 2,4 lần mỗi năm kể từ 2016 và được dự báo vượt 1 tỷ USD mỗi lần vào năm 2027.” Trong đó phần cứng chiếm khoảng một nửa đến hai phần ba, nhân lực khoảng một phần ba, còn tiền điện chỉ khoảng 2-6%.

- Đặctính vận hành: các chip phải trao đổi dữ liệu với độ trễ rất thấp, và hệ thống phải chịu được lỗi. Khi Meta huấn luyện mô hình Llama 3 trên 16.384 chip, hệ thống gặp 419 lần gián đoạn trong 54 ngày, khoảng ba giờ một lần, nhưng vẫn giữ được hơn 90% thời gian huấn luyện hữu ích nhờ lưu điểm kiểm tra và tự khởi động lại.°
