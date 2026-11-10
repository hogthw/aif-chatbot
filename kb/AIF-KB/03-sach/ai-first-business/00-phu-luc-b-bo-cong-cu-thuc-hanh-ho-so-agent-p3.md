# AI First Business — Phụ lục B – Bộ công cụ thực hành Hồ Sơ Agent (phần 3/4)
Nguồn: AI First Business, Phụ lục B

Hình dung cụ thể, dựng thử Trợ lý Báo giá AI bằng một công cụ kéo-thả thuộc Nhóm 1:

• Tạo một quy trình mới, điểm bắt đầu là tin nhắn yêu cầu báo giá từ bộ phận kinh doanh.

s Nối vào một khối “đọc dữ liệu” trỏ tới file bảng giá & tồn kho hợp nhất.

s Thêm một khối gọi mô hình AI, dán đúng nội dung Hồ Sơ Agent ở Mẫu 1 vào phần chỉ dẫn hệ thống.

s Thêm một điều kiện: nếu giá tính ra vượt khung chính sách, gửi cảnh báo cho người phụ trách thay vì tạo bản nháp bình thường, đây chính là nơi Ranh giới an toàn được hiện thực hóa bằng công cụ kéo-thả, không cần biết viết mã.

• Kết thúc quy trình bằng khối gửi bản nháp vào một tài liệu chờ duyệt.

Bản dựng thử năm bước trên có thể hoàn thành trong vài giờ. Phần tốn thời gian thật sự, đúng như đã nêu ở mục 7.2, là bước dọn dữ liệu (Tri thức) trước khi bắt tay vào dựng, không phải bước dựng quy trình.

Nhóm 2: Cần một ít kỹ thuật (Low-code)

Phù hợp khi đã có một Agent chạy ổn và muốn tỉnh chỉnh sâu hơn.

Các nền tảng ở nhóm này thường vẫn có giao diện kéo-thả nhưng

dễ tùy biến nguồn tri thức nội bộ hơn khi bảng giá, chính sách công

ty đã khá đồ sộ; một số mạnh về agent hội thoại nhiều bước cho

chăm sóc khách hàng hoặc tống đài AI; một số gắn thẳng vào dữ liệu

của một nền tảng quản lý khách hàng (CRM) cụ thể mà công ty đang

Nhóm 3: Cần đội ngũ kỹ thuật/lập trình

Dành cho doanh nghiệp cần tùy biến sâu hoặc xây sơ đồ tổ chức AI

nhiều Agent phối hợp như mục 7.11. Nhóm này gồm các bộ khung

lập trình cho phép dựng nhiều Agent phối hợp theo vai trò, kết nối

Agent với dữ liệu và phần mềm nội bộ theo chuẩn hóa, hoặc thiết

lập sẵn cơ chế ranh giới an toàn và bàn giao giữa các Agent.

- Mới bắt đầu, muốn thấy kết quả trong 1-2 tuần S› chọn

Nhóm 1, bắt đầu với đúng một quy trình như Trợ lý Báo giá AI trong chương.
