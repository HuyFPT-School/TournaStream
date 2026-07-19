# Hướng Dẫn Sử Dụng Các Thể Thức Thi Đấu (TournaStream)

Hệ thống TournaStream hỗ trợ 4 thể thức thi đấu phổ biến nhất trong thể thao truyền thống và thể thao điện tử (Esports). Dưới đây là hướng dẫn chi tiết cách thức hoạt động, cách tính điểm và trường hợp áp dụng cho từng thể thức.

---

## 1. Loại Trực Tiếp (Single Elimination)
* **Khái niệm**: Thể thức đấu loại trực tiếp (Knock-out). Một đội thua một trận đấu sẽ bị loại ngay lập tức khỏi giải đấu.
* **Cách hoạt động**:
  - Các đội được bốc thăm bắt cặp thi đấu ở vòng đấu đầu tiên.
  - Đội thắng sẽ đi tiếp vào vòng trong (Tứ kết, Bán kết, Chung kết).
  - Đội thua sẽ dừng bước và nhận thứ hạng tương ứng.
* **Thích hợp cho**:
  - Giải đấu có số lượng đội tham gia rất lớn (ví dụ: 16, 32, 64 đội) nhưng thời gian tổ chức ngắn.
  - Các giải đấu cần tính kịch tính cao ngay từ những trận đầu tiên.
* **Cách sử dụng trên TournaStream**:
  - Hệ thống tự động tạo nhánh đấu (bracket) trực quan.
  - Ban tổ chức (BTC) chỉ cần cập nhật tỉ số cho từng trận đấu, đội thắng sẽ tự động được đưa vào vòng tiếp theo.

---

## 2. Nhánh Thắng - Nhánh Thua (Double Elimination)
* **Khái niệm**: Thể thức nhánh thắng - nhánh thua (Double Elimination). Các đội có 2 cơ hội thi đấu (2 "mạng") trước khi chính thức bị loại.
* **Cách hoạt động**:
  - Tất cả các đội bắt đầu ở **Nhánh Thắng (Upper Bracket)**.
  - Nếu một đội thắng, họ tiếp tục đi tiếp ở Nhánh Thắng.
  - Nếu một đội thua ở Nhánh Thắng, họ **không bị loại ngay**, mà bị đẩy xuống **Nhánh Thua (Lower Bracket)** để tiếp tục thi đấu.
  - Nếu một đội thua thêm một lần nữa ở Nhánh Thua, họ sẽ chính thức bị loại khỏi giải đấu.
  - Trận chung kết tổng (**Grand Final**) sẽ diễn ra giữa đội vô địch Nhánh Thắng và đội vô địch Nhánh Thua. Đội từ Nhánh Thua phải thắng 2 loạt trận (gọi là *Bracket Reset*) mới vô địch, trong khi đội từ Nhánh Thắng chỉ cần thắng 1 loạt trận.
* **Thích hợp cho**:
  - Giải đấu chuyên nghiệp (như DOTA 2 The International, các giải đấu đối kháng, FPS...).
  - Đảm bảo tính công bằng cao nhất, tránh việc các đội mạnh bị loại sớm do một trận đấu sẩy chân.
* **Cách sử dụng trên TournaStream**:
  - Hệ thống tự động chuyển các đội thua từ Nhánh Thắng xuống Nhánh Thua.
  - BTC chỉ cần nhập điểm cho từng trận ở cả 2 nhánh đấu.

---

## 3. Vòng Bảng & Knock-out (Round Robin + Knock-out)
* **Khái niệm**: Kết hợp giữa thi đấu vòng tròn tính điểm và đấu loại trực tiếp.
* **Cách hoạt động**:
  - **Giai đoạn 1 (Vòng bảng)**: Các đội được chia vào các bảng đấu (1, 2 hoặc 4 bảng). Các đội trong cùng một bảng sẽ thi đấu vòng tròn tính điểm với nhau (thắng được 3 điểm hoặc 1 điểm tùy cấu hình, hòa được 1 điểm, thua 0 điểm).
  - **Giai đoạn 2 (Knock-out)**: Dựa trên bảng xếp hạng vòng bảng, hệ thống sẽ lấy ra các đội đứng đầu mỗi bảng (ví dụ: Top 2 mỗi bảng) để đưa vào nhánh đấu Loại trực tiếp (Knock-out) cho đến khi tìm được nhà vô địch.
* **Thích hợp cho**:
  - Giải đấu bóng đá chuyên nghiệp hoặc các giải đấu có từ 8 - 16 đội.
  - Muốn tạo cơ hội cho mỗi đội được thi đấu ít nhất 2-3 trận trước khi bị loại.
* **Cách sử dụng trên TournaStream**:
  - BTC chọn số bảng đấu và số đội đi tiếp ở mỗi bảng.
  - Sau khi kết thúc vòng bảng, hệ thống hỗ trợ nút bấm **"Xếp lịch Knockout từ Vòng bảng"** để tự động tạo nhánh đấu trực tiếp từ kết quả xếp hạng vòng bảng.

---

## 4. Giải Đấu Sinh Tồn (Battle Royale / PUBG / Free Fire)
* **Khái niệm**: Thể thức đặc thù cho các tựa game sinh tồn, nơi nhiều đội (thường từ 12 - 24 đội) cùng tham gia thi đấu trong một bản đồ lớn cùng một lúc.
* **Cách hoạt động**:
  - Giải đấu diễn ra qua nhiều trận (thường từ 3 - 10 trận).
  - Sau mỗi trận đấu, BTC sẽ cập nhật thứ hạng sinh tồn (Placement) và số lượng hạ gục (Kills) của từng đội.
  - Hệ thống tự động cộng điểm cho mỗi đội dựa trên **Điểm Hạng** và **Điểm Kill**.
  - Bảng xếp hạng chung cuộc sẽ cộng dồn tổng điểm của tất cả các trận đấu. Đội có tổng điểm cao nhất sau tất cả các trận sẽ đoạt chức vô địch.
* **Bảng điểm hạng tiêu chuẩn (PUBG)**:
  - Hạng 1 (Winner Winner Chicken Dinner): 10 điểm
  - Hạng 2: 6 điểm
  - Hạng 3: 5 điểm
  - Hạng 4: 4 điểm
  - Hạng 5: 3 điểm
  - Hạng 6 - 7: 2 điểm
  - Hạng 8 - 12: 1 điểm
  - Hạng 13 - 16: 0 điểm
  - Mỗi lượt hạ gục (Kill): +1 điểm
* **Cách sử dụng trên TournaStream**:
  - BTC chọn thể loại game **"Game Sinh tồn (PUBG)"** khi tạo giải đấu.
  - BTC có thể thay đổi cấu hình điểm hạng mặc định ở bước thiết lập thông tin.
  - Trong quá trình diễn ra giải, BTC chọn từng trận để nhập thứ hạng và số kill của từng đội. Hệ thống sẽ tự động cập nhật bảng xếp hạng tổng theo thời gian thực (Real-time).
