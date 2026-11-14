# Hai bộ FAQ cho hai khung chat · 2.5.0

## Cấu hình

| Lựa chọn mở chat | File FAQ | Kho nội dung |
|---|---|---|
| AI Economy | faq_ai_economy.json · 64 thẻ | KB AI Economy |
| AI First Business | faq_ai_first_business.json · 68 thẻ | KB AI First Business |

Mỗi file chứa câu trả lời công khai, các cụm hỏi mẫu, nguồn biên tập, thông tin cuốn, hành động và sáu câu gợi ý. Hai file hoạt động độc lập. Dữ liệu chính sách thương mại có thể được quản lý chung ở bước biên tập rồi xuất sang mỗi file khi phát hành. Giá Economy 355.000 ₫, giá web 248.500 ₫. Giá Business 330.000 ₫, giá web 231.000 ₫. Mức giảm 30%. Mua tại Việt Nam không áp dụng đổi trả theo chính sách đã cung cấp. Với giao sai hoặc lỗi, hướng dẫn bấm Liên hệ để kiểm tra.

## Luồng truy vấn

1. Khi chọn sách, đặt book_id từ lựa chọn có sẵn. Chỉ tải hoặc truy vấn FAQ và KB của ID đó. Gắn book_id vào mỗi request nếu dùng Worker. Worker kiểm tra ID theo danh sách cho phép và tự chọn nguồn tương ứng.
2. Hiện nút gợi ý từ quick_questions của file. Khi bấm nút, tra trực tiếp faq_id trong file của phiên hiện tại. Gõ tự do thì chuẩn hóa dấu, chữ thường và khoảng trắng. Ưu tiên khớp câu đầy đủ. Với câu dài, chỉ dùng khớp cụm đủ cụ thể và có đúng ngữ cảnh. Cụm rất ngắn như “đọc thử” chỉ dùng riêng hoặc khi rõ đang hỏi về sách.
3. Xử lý riêng câu về giá sách, mua, giao hàng, thanh toán và đổi trả. Dùng thẻ hoặc buy_fallback trong file của phiên hiện tại. “Chi phí triển khai AI” thuộc luồng nội dung hoặc tư vấn, “giá cuốn này” thuộc luồng mua sách. Với yêu cầu đặt lịch tư vấn Go AI hoặc làm khảo sát EAR rõ ràng, chuyển luồng sẵn có. FAQ mua sách dùng nút Liên hệ của website hiện hữu, không dùng Zalo.
4. Nếu câu hỏi gọi đích danh cuốn khác về nội dung, giá hoặc đọc thử, mời bấm Đổi sách. Riêng câu so sánh hoặc hỏi cuốn nào đọc trước, trả thẻ choose có sẵn trong từng file. Thẻ này là thông tin giới thiệu đã biên tập, luôn nói hai cuốn đọc độc lập. Nếu hỏi giá hoặc link mẫu cả hai, trả phần của cuốn hiện tại và mời đổi sách để xem cuốn còn lại.
5. Nếu FAQ không khớp, tìm trong KB của phiên hiện tại. Nếu kết quả yếu hoặc có nhiều cách hiểu, hỏi một câu làm rõ hoặc cho biết chưa có căn cứ trong cuốn. Với câu nhiều ý rõ ràng như “Adapt là gì? Sách giá bao nhiêu?”, trả từng ý theo cùng book_id. Trả thẻ đã biên tập, ghi nguồn khi có. Câu trả lời nội dung thường 60–100 từ, tối đa 120 từ cho ca phức tạp, chưa tính nguồn. Thông tin giao dịch và gợi ý có thể ngắn hơn.
6. Khi đổi sách hoặc làm mới về màn chọn sách, xóa ngữ cảnh sách cũ và câu gợi ý đang chờ. Hủy hoặc bỏ qua phản hồi của phiên cũ đến muộn, kể cả yêu cầu tải JSON. Nếu tài nguyên một cuốn lỗi, hiện thông báo thử lại cho cuốn đó. Giữ cache theo book_id và phiên bản.

## Đưa lên Cloudflare

Ở widget xử lý tại trình duyệt, nạp file theo tùy chọn sách trước lookup hoặc fallback hiện tại. Với luồng xử lý toàn bộ ở Worker, đóng gói cả hai file trong bản build và chỉ lấy file từ ánh xạ book_id của request. Dùng cấu hình build hoặc Static Assets hiện có. FAQ chạy bằng câu trả lời cố định và so khớp, không cần thêm LLM hay cơ sở dữ liệu. Các hành động đọc thử dùng URL catalog.sample và hành động contact trỏ đến href/callback Liên hệ mua sách thực tế. Triển khai đồng bộ widget, dữ liệu và định tuyến trên staging, sau đó phát hành cùng phiên bản. [Cloudflare Static Assets](https://developers.cloudflare.com/workers/static-assets/)

## Kiểm thử trên staging

| Ca | Kết quả |
|---|---|
| Cùng hỏi “Phù hợp với trình độ nào?” ở hai khung | Câu trả lời khác nhau theo đối tượng của từng cuốn |
| Economy · “Tác giả là ai và có uy tín không?” | Tên Trần Tấn Sỹ và kinh nghiệm liên quan |
| Business · “Nội dung chính và góc tiếp cận là gì?” | Trả phần triển khai và quản trị doanh nghiệp |
| Business · “Giá trị thực tiễn” và “Có ví dụ công việc thực tế không?” | FAQ thực tiễn và ví dụ, nguồn đúng cuốn |
| Economy · “Việt Nam có cơ hội gì đến năm 2035?” | Thẻ vietnam, Chương 7 |
| Economy · “ARI và ARI-IP dùng cho ai?” | Thẻ ari, Chương 8 và Phụ lục A–B |
| Business · “Adapt là gì?” hoặc “adapt la gi” | Thẻ adapt, đúng nấc Thích ứng, nguồn mục 2.2 |
| Economy · “Theo AI First Business, Adapt là gì?” | Mời đổi sách |
| Economy · “EAR Index là gì?” | Không lấy thẻ Business, mời đổi sách nếu hệ thống nhận diện thuật ngữ riêng |
| Business · “Nhà máy trí tuệ là gì?” | Chỉ dùng KB Business nếu có căn cứ, nếu thiếu thì hỏi làm rõ hoặc gợi ý đổi sang Economy |
| Business · “Cho tôi đọc thử AI Economy” | Mời đổi sách, không đổi phiên tự động |
| “Nên đọc cuốn nào trước?” ở hai khung | Hai cuốn đọc độc lập, gợi ý theo mối quan tâm |
| “Giá bao nhiêu?” và “Có đổi trả không?” ở hai khung | Đúng giá từng cuốn, chỉ CTA Liên hệ |
| “Chi phí triển khai AI bao nhiêu?” | Không trả giá sách |
| “Cho tôi đặt lịch tư vấn chuyển đổi AI” | Luồng tư vấn đang có |
| Đổi sách khi phản hồi cũ chưa về | Câu trả lời cũ không xuất hiện trong khung mới |
| Kiểm tra Network khi mở từng khung | Chỉ truy vấn nguồn của book_id đang chọn |
| Xóa hoặc làm lỗi file một cuốn trên staging | Báo thử lại, không tự chuyển sang file còn lại |

## Nguồn và duyệt nội dung

Hai bản thảo và hai lời giới thiệu đã cung cấp là nguồn nội dung. Giá và chính sách, đường dẫn đọc thử lấy theo chỉ dẫn chủ dự án. Chưa xác nhận số trang bản thương mại, ISBN, định dạng điện tử, đánh giá và mức độ dùng AI trong biên tập. Các thẻ có câu trả lời dự phòng. Trước khi phát hành cần thử đích Liên hệ và hai URL đọc thử từ widget. Bản này là dữ liệu và đặc tả tích hợp, Dev nghiệm thu hành vi trên staging.

## Cập nhật 2.1 · Mục đích đọc và tác động kinh tế xã hội

| Câu hỏi nghiệm thu ở cả hai khung | Thẻ | Điểm phân biệt cần kiểm tra |
|---|---|---|
| Có hướng dẫn thực hành cụ thể không? | read_apply | Economy phân tích nhiệm vụ trong một nghề. Business thử nghiệm trên quy trình báo giá. |
| Muốn xem ví dụ trước khi mua sách | read_example | Economy gợi ví dụ đầu tư hoặc việc làm. Business gợi ví dụ tác nhân báo giá và phòng ban. |
| Tôi muốn hiểu bản chất AI | read_depth | Economy giải thích hạ tầng, huấn luyện, suy luận và chi phí. Business giải thích tác nhân, công cụ và quyền quyết định. |
| Sách có bàn sâu về đạo đức, an toàn, tác động xã hội không? | read_risk | Economy nói về phân bổ lợi ích và rủi ro xã hội. Business nói về quản trị, quyền và trách nhiệm. |
| Có định nghĩa từng khái niệm không? | read_beginner | Economy dẫn Phụ lục C. Business dẫn Phụ lục E. |
| AI tái cấu trúc nền kinh tế ra sao? | restructure | Economy trả lời về chi phí, vốn và chuỗi giá trị. Business trả lời từ cấp độ doanh nghiệp. |
| AI ảnh hưởng đến sự phát triển kinh tế xã hội như thế nào? | social | Economy bàn năng suất, việc làm và thu nhập. Business bàn tổ chức công việc và cơ hội học nghề. |
| Cơ hội và rủi ro AI với quốc gia / doanh nghiệp / người dân | national / company / citizen | Kiểm tra từng chủ thể và từng khung. Nếu người đọc nêu nhiều chủ thể, trả từng phần đã nhận diện trong cùng file. Nếu chưa rõ, hỏi họ muốn bắt đầu ở cấp nào. |

Với câu hỏi vĩ mô không gọi tên sách khi đang trong Business, trả góc nhìn doanh nghiệp và có thể gợi ý người đọc tự chọn Đổi sách. Với câu gọi tên rõ cuốn còn lại, áp dụng quy tắc đổi sách ở trên. Chỉ hiển thị nút đọc thử của cuốn đang chọn.

## Cập nhật 2.2 · Thẩm định nội dung và luồng B2B

- `bulk` dẫn về **Liên hệ** mua sách. Câu hỏi về VAT, in logo và chiết khấu số lượng chỉ được tiếp nhận để xác nhận; chatbot không cam kết các điều kiện này. Câu hỏi kết hợp số lượng sách và hóa đơn ưu tiên thẻ bulk.
- `consulting_choices` hiển thị hai CTA đã có là **Làm khảo sát EAR** và **Liên hệ tư vấn**. Ánh xạ hai target_ref theo widget. Thẻ chỉ dùng khi người đọc hỏi bước hỗ trợ sau đọc sách còn chưa rõ hướng. Yêu cầu rõ ràng như “cho tôi khảo sát EAR” hoặc “đặt lịch tư vấn cho công ty tôi” đi thẳng đến hành động tương ứng. Câu hỏi mua số lượng lớn vẫn đi luồng mua sách. Nếu một lượt có hai ý rõ ràng, xử lý từng ý và gắn nhãn nút theo mục đích.
- Thẻ ari_vs_ear và series là các câu trả lời giới thiệu cố định trong từng file. Với câu so sánh đúng mẫu, xử lý như thẻ choose trước kiểm tra nhắc tên cuốn khác. Không truy xuất chéo KB.
- Bản chốt in AI Economy ngày 03/11/2026 ghi mốc khóa dữ liệu 30/10/2026. Thẻ `currency` công bố ngày này như mốc dữ liệu. ISBN, năm phát hành và tổng số trang cần xác minh theo ấn bản đang bán. Chỉ công bố vai trò AI trong biên soạn khi có xác nhận của tác giả. Các mô tả pháp lý dùng phạm vi của sách.
- Nghiệm thu thêm: “Mua sách cho doanh nghiệp, có hóa đơn VAT không?” chỉ hiện Liên hệ mua sách; “Đọc xong tôi nên tự đánh giá EAR hay trao đổi với đội tư vấn?” hiện hai CTA dịch vụ; “ARI khác gì EAR Index?” trả đúng cấp độ đánh giá; “AI có phải bong bóng không?” đi FAQ Economy và giải thích định giá, công suất, nhu cầu; “SME có áp dụng được không?” đi FAQ Business và dẫn mục 3.8; “Sách do AI viết à?” không suy diễn từ chất lượng dẫn nguồn; “Sách bao nhiêu trang?” nêu cấu trúc đã biết và hướng kiểm tra ấn bản.

## Cập nhật 2.3 · Ưu tiên các câu hỏi trước khi mua

Hai file giữ cấu trúc dữ liệu và ID thẻ từ 2.2.0. Mỗi cuốn bổ sung 12 thẻ. Nút gợi ý đầu tiên mở giới thiệu cuốn sách, hai nút kế tiếp mở đối tượng đọc và giá trị sau khi đọc.

### Định tuyến cần kiểm tra trước khi phát hành

1. Lấy `book_id` từ cuốn đã chọn. Chuẩn hóa cả câu hỏi, `question` và `aliases` theo cùng một cách. Chuyển chữ thường, chuẩn hóa Unicode, bỏ dấu tiếng Việt, đổi đ thành d, thay dấu câu bằng khoảng trắng, rồi gộp khoảng trắng. Ví dụ, “Ai nên đọc cuốn sách này ?” thành `ai nen doc cuon sach nay`.
2. Nút gợi ý tra thẳng `faq_id`. Câu gõ tự do ưu tiên khớp toàn câu trong chỉ mục FAQ của đúng cuốn. Khớp `overview`, `level` hay một thẻ trước mua thì trả nguyên `answer` và `action` từ thẻ. Chỉ truy xuất nội dung chương sách khi chưa có câu FAQ phù hợp.
3. Với câu dài có một ý rõ, cho phép khớp cụm có ranh giới từ và đủ ngữ cảnh. Cụm ngắn như “AI”, “sách” hoặc “giá” đứng giữa câu chưa đủ để định tuyến. Câu nhiều ý rõ ràng xử lý theo từng ý. Nếu nhiều thẻ cùng có thể đúng và chưa phân biệt được, dùng `clarify`.
4. Bỏ câu dự phòng mời nhắn Zalo trong widget, Worker và nội dung mặc định. Với câu chưa rõ, dùng `clarify`. Với câu nội dung ngoài phạm vi, báo chưa có căn cứ trong cuốn đang chọn. Với câu mua sách rõ ràng nhưng chưa có thẻ cụ thể, dùng `buy_fallback` và nút **Liên hệ** mua sách.
5. Trên staging, kiểm tra widget và Worker đang dùng cùng bản đang phát hành. Kiểm tra phản hồi thực tế có đúng `book_id` và ID thẻ trong bảng dưới đây, sau đó kiểm tra nút bấm trên giao diện. Nếu một nút gợi ý đúng nhưng câu gõ tương đương sai, kiểm tra chỉ mục alias và thứ tự định tuyến trước khi chỉnh nội dung.

### Ca nghiệm thu ưu tiên

| Câu gõ tự do | Khung | Thẻ hoặc luồng | Kết quả cần thấy |
|---|---|---|---|
| Ai nên đọc cuốn sách này ? | Cả hai | `level` | Câu đầu nêu đối tượng đọc của cuốn đang mở. |
| Cuốn này nói về chủ đề gì? | Cả hai | `overview` | AE nói về tái cấu trúc kinh tế. AFB nói về chiến lược và vận hành doanh nghiệp. |
| cuon nay noi ve chu de gi | Cả hai | `overview` | Kết quả tương đương câu có dấu. |
| sách nói gì vậy | Cả hai | `overview` | Trả lời trực tiếp và mở đúng chương đọc thử. |
| người mới đọc được ko? | Cả hai | `level` | Trả lời theo cuốn đang chọn. |
| Đọc xong được gì? | Cả hai | `practice` | AE cho cách phân tích một quyết định kinh tế hoặc nghề nghiệp. AFB cho cách chọn và thử một bài toán trong doanh nghiệp. |
| Sách có mục lục không? | Cả hai | `toc` | Nêu cấu trúc. AE có 13 chương, AFB có 12 chương. |
| Đọc cuốn này khác gì đọc tin tức AI hằng ngày? | AE | `daily_news` | Nêu cách sách kết nối vốn, hạ tầng và việc làm. |
| Nghề của tôi dễ bị AI thay thế không? | AE | `my_job` | Gợi phân tích theo nhiệm vụ và dẫn Chương 9–10. |
| Dữ liệu đến ngày nào? | AE | `currency` | Nêu mốc 30/10/2026. |
| Công ty chỉ có Excel có áp dụng được không? | AFB | `excel_sme` | Nêu một việc nhỏ có baseline và người kiểm tra. |
| Sách có checklist hoặc mẫu điền để tôi tự bắt đầu không? | AFB | `templates` | Dẫn đúng phụ lục và lộ trình 90 ngày. |
| Tôi chỉ mua một cuốn. Nên chọn AE hay AFB? | Cả hai | `choose` | Hai cuốn đọc độc lập, chọn theo mục đích. |
| Cho tôi đọc thử AI Economy | AFB | Đổi sách | Mời người đọc đổi sách, giữ phiên hiện tại đến khi họ chọn. |
| Còn hàng không? | Cả hai | `availability` | Chỉ hướng đến **Liên hệ** mua sách để xác nhận. |
| Giá bao nhiêu? | Cả hai | `price` | AE giá web 248.500 ₫. AFB giá web 231.000 ₫. Chỉ dùng nút **Liên hệ** cho mua hàng. |
| Adapt là gì? | AFB | `adapt` | Trả đúng nghĩa trong AFB. |
| Chi phí triển khai AI bao nhiêu? | Cả hai | Nội dung hoặc tư vấn | Giữ đúng phạm vi câu hỏi triển khai AI. |

Trong 7 ngày, chạy bảng nghiệm thu trên staging với cả nút gợi ý và câu gõ tự do. Ưu tiên hai câu trong ảnh trước khi phát hành. Mốc ngày xuất bản, số trang bản thương mại, ISBN và giá trị của các nút thực tế cần được kiểm tra tại nguồn tương ứng.

## Cập nhật 2.4 · Trợ lý Tác giả

- Giữ ID và cấu trúc cũ. Hai file có thêm `combo`, `digital_templates` và `signed_talk`. AFB có thêm `failed_examples`. Thẻ `bulk` tiếp tục phục vụ đơn số lượng lớn. Hai thẻ `combo` và `choose` được xét trước quy tắc nhắc tên sách khác vì chúng có nội dung cố định về cả hai cuốn. Câu hỏi một cuốn đích danh vẫn đi theo quy tắc chọn sách.
- Với thẻ khớp về nội dung, render nguyên câu trả lời đã biên tập, gồm ngữ cảnh đi kèm số liệu. 280 MW ở Đồng Nai là yêu cầu khảo sát. Tỷ lệ khoảng 6% là phần công trình trong phép tính vòng đời ở Chương 2. Mốc 12 phút chỉ áp dụng cho báo giá tiêu chuẩn trong tình huống của Chương 7. Khoản lỗ 328 triệu USD của Zillow là lỗ ròng hợp nhất trong một quý.
- Với `consulting_choices`, mở rộng `items` theo thứ tự thành **Làm khảo sát EAR** và **Liên hệ tư vấn**. Kiểm tra hai nút thực tế trên `ear`, `first_step`, `roi`, `pilot` và `agent` của AFB. Dùng `read_sample` cho các thẻ đọc sâu của AE và hướng dẫn đọc AFB. Với yêu cầu hành động rõ ràng, luồng khảo sát hoặc tư vấn trực tiếp đã có vẫn được ưu tiên. Hiển thị nút chỉ là lời mời. Hệ thống chỉ ghi lead tư vấn khi biểu mẫu gửi thành công hoặc người làm khảo sát yêu cầu được liên hệ.
- Phân biệt biểu mẫu in trong sách và quyền tải file mềm. Với câu hỏi về giao hàng, hóa đơn, file tải, bản ký tặng, tọa đàm hoặc ưu đãi số lượng, dùng nội dung đã duyệt và nút **Liên hệ**. Các cam kết về COD, VAT, tốc độ giao, thời gian phản hồi, bồi hoàn, ngưỡng số lượng và quà tặng cần được xác nhận trước khi công bố.
- Giá web theo mức giảm 30% của cấu hình 2.3.0. Trước khi phát hành, đối chiếu lại giá từng cuốn và điều kiện ưu đãi với người phụ trách bán hàng. Nếu đổi mức giảm, cập nhật đồng thời catalog, thẻ giá, câu hỏi mua số lượng, và số cộng hai cuốn trong thẻ combo. Hai cuốn theo giá web hiện hành cộng lại là 479.500 ₫. Ưu đãi combo cần xác nhận riêng.

| Ca staging | Kết quả |
|---|---|
| “Mua combo AI Economy và AI First Business” ở cả hai khung | Trả `combo`, nêu tổng hai giá web và hiện **Liên hệ**. |
| “Mua sách kèm tọa đàm tác giả” và “Có link tải mẫu không?” | Trả đúng thẻ, tiếp nhận để xác nhận, hiện **Liên hệ**. |
| “Nhà máy trí tuệ là gì?” trong AE | Trả `factory`, nêu rõ tình huống khảo sát và hiện **Đọc thử** của AE. |
| “EAR Index là gì?” và “Đo hiệu quả đầu tư AI như thế nào?” trong AFB | Trả `ear` hoặc `roi`, hiện đúng hai nút dịch vụ. |
| “Sách có checklist hoặc mẫu điền để tôi tự bắt đầu không?” trong AFB | Trả `templates`, dẫn phụ lục và hiện **Đọc thử**. |
| “Có COD không?” và “Sách giao lỗi” ở cả hai khung | Trả đúng thẻ giao dịch, dùng **Liên hệ** và thông tin đã duyệt. |
| “Sách nói về gì?” và “Ai nên đọc?” ở cả hai khung | Trả đúng cuốn khi gõ trực tiếp và khi bấm nút gợi ý. |

Trong 7 ngày, nghiệm thu bộ câu hỏi trên và kiểm tra đích các nút trên staging trước khi phát hành. Đây là hướng dẫn triển khai. Các quyết định pháp lý và bảo mật cần được chuyên gia phụ trách xem xét.

## Cập nhật 2.5 · Bộ định tuyến zero-LLM và câu hỏi tự do

### Nguyên nhân lỗi trong hai ảnh chụp

Hai file 2.4.0 đã có thẻ cho “Ai nên đọc cuốn sách này?” và “Cuốn này nói về chủ đề gì?”. Khung chat trên website vẫn trả sai vì ba lý do: (1) KB chương sách được tra trước FAQ, nên câu “Ai nên đọc” khớp nhầm thẻ Lời mở đầu hoặc Lời tựa; (2) bản đang chạy chưa nạp FAQ 2.4.0, thư mục KB trên máy vẫn giữ bản FAQ cũ; (3) câu dự phòng còn mời nhắn Zalo, trái quy định từ 2.3. Bản 2.5.0 sửa cả dữ liệu lẫn thứ tự định tuyến.

### Có gì trong gói

| File | Vai trò |
|---|---|
| `faq_ai_economy.json` · 96 thẻ | Giữ nguyên 64 thẻ cũ và ID, thêm 32 thẻ, `signals`, khối `routing` |
| `faq_ai_first_business.json` · 102 thẻ | Giữ nguyên 68 thẻ cũ và ID, thêm 34 thẻ, `signals`, khối `routing` |
| `router.mjs` | Bộ định tuyến dùng chung cho trình duyệt và Worker, không gọi LLM |
| `worker.js`, `wrangler.toml` | Worker API `/api/chat`, tầng ngữ nghĩa tùy chọn, ghi câu chưa khớp |
| `widget-adapter.mjs` | Nối widget hiện có: chọn sách, bỏ phản hồi muộn, ánh xạ nút |
| `test-router.mjs` | 103 ca nghiệm thu và kiểm tra cấu trúc |

### Thứ tự định tuyến mới

1. Chuẩn hóa: chữ thường, giữ song song bản có dấu và không dấu, mở rộng viết tắt (`ko`, `dc`, `sv`, `dn`, `cty`, `ntn`, `bn`…). Khi người đọc gõ có dấu, “giá” không còn khớp “tác giả”.
2. Khớp toàn câu với `question`/`aliases` → trả thẻ.
3. Câu nhắc tên cuốn còn lại → chỉ nhận thẻ trong `cross_book_allowed` (choose, combo, ari_vs_ear, series, author…), còn lại trả `switch_book`. Không tự đổi phiên.
4. Câu dạng “Sách có nói về X không?” → tìm X trong FAQ, rồi trong KB chương của cùng cuốn. Không thấy thì trả `topic_not_found`, nói rõ chưa thấy mục riêng về X.
5. Chấm `signals`: mỗi thẻ có các nhóm khái niệm; thẻ chỉ đủ điều kiện khi mọi nhóm đều có cụm khớp, bị loại khi có cụm `exclude`. Hai thẻ sát điểm nhau → hiện `choices` để người đọc chọn.
6. KB chương sách cùng `book_id`: khớp đúng câu, khớp cụm, rồi tìm theo âm tiết và cặp âm tiết có trọng số. Từ không có trong cuốn làm giảm độ tin cậy, nên câu như “điện hạt nhân” không bị gán bừa.
7. Tầng ngữ nghĩa tùy chọn ở Worker: Workers AI `@cf/baai/bge-m3` + Vectorize, namespace theo `book_id`. Điểm ≥ 0,80 và cách thẻ thứ hai ≥ 0,03 thì trả thẻ; 0,70–0,80 thì hỏi “Có phải bạn muốn hỏi…”.
8. Không khớp → `no_match` kèm 4 nút gợi ý. Không có câu Zalo ở bất kỳ nhánh nào.

Câu nhiều ý (“Adapt là gì? Sách giá bao nhiêu?”) được tách theo dấu câu và trả tối đa hai thẻ, bỏ các mảnh chào hỏi.

### Thẻ mới

- **Chân dung người đọc** (`persona_*`): sinh viên, chủ doanh nghiệp/CEO, quản lý, nhân sự, IT, nhà đầu tư (AFB), chính sách, khu công nghiệp, giảng viên, khởi nghiệp, tài chính – kế toán, bán hàng – marketing, sản xuất, nhân viên văn phòng (AFB). Mỗi thẻ trả lời theo cuốn đang mở và dẫn đúng chương, mục.
- **Câu suy luận trước khi mua**: `worth_it`, `not_for`, `read_time`, `industry`, `vs_other_books`, `what_is_ai`, `which_tool`, `howto_tools`, `implementation_cost`, `visuals`, `gift`.
- **AE**: `sovereignty`, `future_jobs`, `counterpoint`, `stock_advice`. **AFB**: `ai_replace`, `build_vs_buy`, `roadmap_90`, `career`.
- **Hội thoại và luồng**: `greeting`, `thanks`, `human`, `out_of_scope`, `consult_request` (`flow: "consulting"`).

Thẻ mới có trường `added_in: "2.5.0"`. Nội dung lấy từ hai bản in (AE v13.7, AFB V16.3) và KB chương; tác giả duyệt trước khi phát hành.

### Thay đổi so với 2.4

- `level` bỏ alias “sách có hợp với sinh viên không”, chuyển sang `persona_student`. `practice` bỏ “sách có đáng mua không” (sang `worth_it`) và “có dạy prompt không” (sang `howto_tools`).
- `buy` bỏ các alias mua số lượng và ký tên, chuyển về `bulk`, `signed_talk`.
- `price` có `exclude` để không bắt “chi phí triển khai”, “tác giả”, “cổ phiếu”, “đánh giá”.
- AE có thêm ba hành động `consulting_choices`, `ear_survey`, `consulting_contact` để yêu cầu tư vấn gõ trong khung AE đi đúng luồng.

### Triển khai 100% Cloudflare

Chế độ A · chỉ so khớp (miễn phí, không cần binding):

```js
import { route, byId } from "./router.mjs";
const faq = await (await fetch("/assets/chat/faq_ai_first_business.json")).json();
const kb  = await (await fetch("/assets/chat/books/aifb.json")).json();   // KB chương cùng cuốn
const out = route("Tôi là sinh viên, có nên đọc không?", faq, kb);       // { results: [...] }
```

Chế độ B · Worker có tầng ngữ nghĩa:

```bash
mkdir data && cp faq_ai_economy.json faq_ai_first_business.json data/
cp ../AIEC_AI_Economy_v13-7/AIEC_AI_Economy_v13-7_FULL.json data/kb_aiec.json
cp ../AIFB_AI_First_Business_v16-3/AIFB_AI_First_Business_v16-3_FULL.json data/kb_aifb.json
npx wrangler vectorize create aibooks-faq --dimensions=1024 --metric=cosine
npx wrangler secret put ADMIN_TOKEN
npx wrangler deploy
curl -X POST https://<worker>/admin/reindex -H "Authorization: Bearer <ADMIN_TOKEN>"
```

`POST /api/chat` nhận `{ book_id, question | faq_id | kb_id, request_id }`. `book_id` chấp nhận `ai_economy`, `ai_first_business` hoặc `aiec`, `aifb`; giá trị khác bị từ chối. Reindex tạo khoảng 1.500 vector 1024 chiều cho hai cuốn, nằm trong hạn mức lưu trữ của gói Workers Free. Embedding chỉ chạy khi các tầng so khớp không tìm ra thẻ, nên chi phí Workers AI dự kiến nằm trong 10.000 neuron miễn phí mỗi ngày. Kiểm tra lại hạn mức trên trang giá Cloudflare trước khi phát hành.

Phản hồi có `results[].type`: `card`, `kb_card`, `choices`, `switch_book`, `topic_not_found`, `no_match`. Widget vẽ `answer` (hỗ trợ `**đậm**`), `source`, nút theo `action`, và `options` cho `choices`/`no_match`/`topic_not_found`. Khi `flow = "consulting"`, hiện hai CTA dịch vụ, không tự gửi dữ liệu.

### Vòng cải thiện hằng tuần

Worker ghi câu `no_match`, `topic_not_found`, `choices` vào Analytics Engine `aibooks_chat_misses` (đã che email và số điện thoại). Mỗi tuần: lấy 30 câu xuất hiện nhiều nhất, thêm alias hoặc `signals` vào thẻ có sẵn; chỉ tạo thẻ mới khi nội dung chưa có. Sau khi sửa JSON, chạy `node test-router.mjs <kb_aiec.json> <kb_aifb.json>`, rồi gọi lại `/admin/reindex`.

### Nghiệm thu 2.5 trên staging

| Câu gõ | Khung | Kết quả cần thấy |
|---|---|---|
| AI NÊN ĐỌC CUỐN SÁCH NÀY ? | AFB | `level`, không hiện lựa chọn Lời tựa / CEO |
| Tôi là sinh viên, tôi có nên đọc cuốn sach này không? | AFB | `persona_student`, nói rõ sách viết cho người ra quyết định |
| Ai nên đọc cuốn sách này ? | AE | `level`, không trả Lời mở đầu |
| Cuốn này nói về chủ đề gì? | AE | `overview`, không có câu Zalo |
| mình là sv năm 2 thì đọc cuốn này có ích ko | AE | `persona_student` |
| tác giả là người thế nào | Cả hai | `author`, không trả giá |
| sách có nói về chip bán dẫn không | AE | Thẻ KB mục 5.2, mở đầu “Có.” |
| sách nói về điện hạt nhân không | AE | `topic_not_found` |
| Singapore làm AI thế nào | AE | Thẻ KB mục 6.5 |
| Nhà máy trí tuệ là gì? | AFB | `switch_book` sang AI Economy |
| tôi sợ dữ liệu bị lộ khi dùng AI | AFB | `security` |
| giá vàng hôm nay bao nhiêu | Cả hai | `out_of_scope` |
| Adapt là gì? Sách giá bao nhiêu? | AFB | Hai thẻ `adapt` + `price` |
| Đổi sách khi phản hồi cũ chưa về | Cả hai | Phản hồi cũ bị bỏ (so `request_id`) |

Chạy `test-router.mjs` trước khi đẩy lên staging: kết quả hiện tại 103/103 ca đạt, 0 lỗi cấu trúc (không trùng alias giữa hai thẻ, mọi nút gợi ý có thẻ, không câu trả lời nào nhắc Zalo, không thẻ nào quá 120 từ).
