# Project Rules (AGENTS.md)

## Quy tắc thiết kế UI/UX
- **Tuyệt đối không dùng Emoji (như 📷, 🎵) làm icon trong code**: Luôn luôn thiết kế và sử dụng các hình ảnh định dạng SVG chất lượng cao, đồng bộ với theme của ứng dụng.

## Quy tắc kiểm tra tính đúng đắn logic (Logic Bug Check)
- **Kiểm tra chéo theo checklist của prompt_check_logic_bugs.md**: Trước khi hoàn thành bất kỳ tính năng mới hay cập nhật nào, luôn luôn chạy kiểm tra chéo theo checklist trong file [`prompt_check_logic_bugs.md`](file:///d:/SU26/EXE201/TournaStream/prompt_check_logic_bugs.md) bao gồm:
  1. **Data Flow**: Kiểm tra đường đi của dữ liệu từ Frontend -> Backend -> DB -> Frontend.
  2. **Status Flow**: Kiểm tra sự chuyển đổi trạng thái khi thực hiện CRUD, lọc và hiển thị.
  3. **Moderation Flow**: Luồng duyệt của giáo viên/admin (Approve/Reject/Draft).
  4. **Authorization**: Phân quyền truy cập ứng với từng vai trò người dùng (student, staff, teacher, admin).
  5. **Cache**: Cơ chế cập nhật và giải phóng cache.
  6. **UI Consistency**: Tính nhất quán trong thông báo, phản hồi và hiển thị biểu diễn dữ liệu.
  7. **Error Handling**: Xử lý lỗi, dọn dẹp file mồ côi khi ghi DB lỗi.

- Bắt buộc thực hiện kiểm tra theo quy tắc trên mỗi khi thay đổi, bổ sung hoặc cập nhật tính năng trong dự án.
