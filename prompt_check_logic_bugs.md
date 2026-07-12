# Prompt Kiểm Tra Lỗi Logic Nghiệp Vụ (Data Flow Bug Detection)

> Sử dụng prompt dưới đây để kiểm tra từng tính năng trong project. Copy prompt phù hợp, thay `[TÊN TÍNH NĂNG]` bằng tính năng cần kiểm tra.

---

## Prompt Tổng Quát (Dùng cho bất kỳ tính năng nào)

```
Kiểm tra project này giúp tôi, không cần code, chỉ cần phân tích và báo cáo lỗi.

Hãy kiểm tra tính năng [TÊN TÍNH NĂNG] theo checklist sau:

### 1. Kiểm tra đường đi dữ liệu (Data Flow)
- Frontend gửi dữ liệu gì lên Backend? (request body, FormData, params)
- Backend nhận dữ liệu đó và LƯU vào trường nào trong Database?
- Khi Frontend load lại dữ liệu, nó ĐỌC từ trường nào?
- Có trường nào Backend lưu vào nhưng Frontend KHÔNG đọc ra không? (ví dụ: pendingDraft, tempData, draft...)

### 2. Kiểm tra trạng thái (Status Flow)
- Có bao nhiêu trạng thái (status) trong tính năng này? Liệt kê tất cả.
- Khi thực hiện thao tác CRUD (tạo/sửa/xóa), trạng thái có thay đổi không?
- Frontend có bộ lọc (filter) theo trạng thái không? Bộ lọc mặc định là gì?
- Có trường hợp nào dữ liệu bị ẩN do bộ lọc mặc định không khớp với trạng thái thực tế không?

### 3. Kiểm tra luồng kiểm duyệt (Moderation Flow)
- Tính năng này có cơ chế duyệt (approve/reject) không?
- Nếu có, khi nội dung đã Published được sửa lại:
  + Backend lưu bản sửa vào đâu? (trực tiếp hay vào bản nháp/draft?)
  + Trạng thái có chuyển về Pending_Review hay giữ nguyên Published?
  + Người duyệt (Teacher/Admin) có nhìn thấy nội dung sửa đổi không?
  + Người duyệt có giao diện để so sánh bản cũ vs bản mới không?

### 4. Kiểm tra phân quyền (Authorization)
- Các role nào có quyền truy cập tính năng này? (student, staff, teacher, admin)
- Mỗi role gọi đến endpoint nào?
- Middleware authorize() có đúng cho từng route không?
- Có route nào bị thiếu middleware protect/authorize không?

### 5. Kiểm tra Cache
- Tính năng này có sử dụng Redis cache không?
- Khi dữ liệu thay đổi (create/update/delete), cache có được invalidate đúng không?
- Có trường hợp nào Frontend nhận dữ liệu cũ từ cache sau khi đã cập nhật không?
- ETag/304 có hoạt động đúng không? Client có bị nhận dữ liệu cũ do ETag cache không?

### 6. Kiểm tra giao diện Frontend
- Sau khi thao tác thành công, Frontend có reload/refetch dữ liệu mới không?
- Dữ liệu hiển thị trên form có khớp với dữ liệu thực tế trong DB không?
- Có thông báo lỗi/thành công phù hợp cho người dùng không?
- Message thành công có gây hiểu lầm không? (ví dụ: hiện "Cập nhật thành công" nhưng thực tế chỉ lưu bản nháp)

### 7. Kiểm tra xử lý lỗi (Error Handling)
- Nếu upload file thất bại giữa chừng, dữ liệu có bị lưu dở dang không?
- Nếu Cloudinary upload thành công nhưng DB save thất bại, file trên cloud có bị orphan không?
- Frontend có hiển thị đúng message lỗi từ Backend không?

Trả lời dưới dạng bảng tóm tắt các vấn đề tìm thấy, mỗi vấn đề ghi rõ:
- Tệp liên quan (đường dẫn)
- Dòng code cụ thể
- Mô tả vấn đề
- Mức độ nghiêm trọng (Critical / Major / Minor)
```

---

## Các Prompt Cụ Thể Cho Từng Tính Năng Trong SuViet360

### Prompt 1: Kiểm tra tính năng Lesson (Bài học)

```
Kiểm tra project này giúp tôi, không cần code, chỉ phân tích và báo lỗi.

Hãy kiểm tra toàn bộ luồng CRUD + duyệt của tính năng LESSON (Bài học):

1. Staff tạo lesson mới → Backend lưu vào DB với status gì? → Teacher có thấy không?
2. Staff sửa lesson đang Pending_Review → dữ liệu cập nhật trực tiếp hay vào pendingDraft?
3. Staff sửa lesson đã Published → dữ liệu cập nhật trực tiếp hay vào pendingDraft?
4. Teacher duyệt (approve) lesson có pendingDraft → draft có được apply đúng không?
5. Teacher reject lesson có pendingDraft → draft có bị xóa sạch không? File Cloudinary cũ có bị orphan không?
6. Frontend Staff có hiển thị trường hasPendingDraft để Staff biết đang chờ duyệt không?
7. Frontend Teacher có hiển thị nội dung từ pendingDraft để so sánh với bản gốc không?
8. Cache có được invalidate đúng sau mỗi thao tác approve/reject không?

Kiểm tra các file:
- server/src/controllers/lessonController.js
- server/src/services/lessonService.js  
- server/src/models/Lesson.js
- server/src/routes/lessonRoutes.js
- client/app/staff/page.tsx (phần lesson)
- client/app/teacher/page.tsx
- client/lib/teacherReviewApi.ts
```

### Prompt 2: Kiểm tra tính năng Blog

```
Kiểm tra project này giúp tôi, không cần code, chỉ phân tích và báo lỗi.

Hãy kiểm tra toàn bộ luồng CRUD của tính năng BLOG:

1. Ai có quyền tạo/sửa/xóa blog? Route có đúng middleware authorize không?
2. Blog có cơ chế duyệt (approve/reject) giống lesson/podcast không? Nếu không, tại sao?
3. Khi sửa blog, dữ liệu có được lưu đúng và Frontend có hiển thị lại đúng không?
4. Blog public API có lọc theo status Published không? Hay hiển thị cả bản nháp?
5. Cache Redis có được sử dụng và invalidate đúng không?
6. Có trường hợp nào blog bị ẩn do bộ lọc mặc định trên giao diện không?

Kiểm tra các file:
- server/src/controllers/ (file liên quan đến blog)
- server/src/routes/blogRoutes.js
- server/src/models/ (model Blog)
- client/app/blog/
- client/app/staff/page.tsx (phần blog)
```

### Prompt 3: Kiểm tra tính năng Subscription (Gói đăng ký)

```
Kiểm tra project này giúp tôi, không cần code, chỉ phân tích và báo lỗi.

Hãy kiểm tra toàn bộ luồng của tính năng SUBSCRIPTION:

1. User mua gói → Backend xử lý thanh toán và cập nhật subscription ra sao?
2. Sau khi thanh toán thành công, quyền truy cập của user có được cập nhật ngay không?
3. Khi subscription hết hạn, hệ thống có tự động thu hồi quyền truy cập không?
4. Frontend có kiểm tra trạng thái subscription trước khi cho phép truy cập nội dung premium không?
5. Có race condition nào khi user mua gói đồng thời từ nhiều thiết bị không?
6. Dữ liệu thanh toán có được validate đầy đủ ở Backend không? (tránh giả mạo)

Kiểm tra các file:
- server/src/routes/subscriptionRoutes.js
- server/src/controllers/ (file liên quan subscription)
- server/src/models/ (model Subscription/User)
- client/app/subscription/
```

### Prompt 4: Kiểm tra tính năng Progress (Tiến trình học)

```
Kiểm tra project này giúp tôi, không cần code, chỉ phân tích và báo lỗi.

Hãy kiểm tra toàn bộ luồng của tính năng PROGRESS (Tiến trình học tập):

1. Khi user hoàn thành podcast/lesson, Backend ghi nhận XP và progress ra sao?
2. Có kiểm tra trùng lặp không? (user spam complete nhiều lần có bị cộng XP nhiều lần không?)
3. Leaderboard có phản ánh đúng XP thực tế của user không?
4. Frontend có cập nhật realtime XP sau khi hoàn thành không? Hay phải refresh trang?
5. Nếu podcast/lesson bị xóa sau khi user đã complete, progress có bị ảnh hưởng không?
6. API endpoint có được bảo vệ đúng (chỉ authenticated user) không?

Kiểm tra các file:
- server/src/routes/progressRoutes.js
- server/src/controllers/ (file liên quan progress)
- server/src/models/ (model Progress/User)
- client/app/leaderboard/
- client/app/podcasts/[id]/page.tsx (phần complete)
```

### Prompt 5: Kiểm tra tính năng Notification (Thông báo)

```
Kiểm tra project này giúp tôi, không cần code, chỉ phân tích và báo lỗi.

Hãy kiểm tra toàn bộ luồng của tính năng NOTIFICATION:

1. Khi podcast mới được approve, thông báo có được tạo đúng cho những user đã follow category không?
2. Redis Pub/Sub có hoạt động đúng để gửi realtime notification không?
3. Nếu Redis bị disconnect, thông báo có bị mất không? Có fallback không?
4. User follow/unfollow category → dữ liệu followedCategories có được cập nhật đúng không?
5. Frontend có hiển thị notification realtime không? Hay phải refresh trang?
6. Notification có bị trùng lặp không? (approve podcast 2 lần có gửi 2 notification không?)

Kiểm tra các file:
- server/src/routes/notificationRoutes.js
- server/src/controllers/ (file liên quan notification)
- server/src/models/Notification.js
- server/src/controllers/podcastController.js (phần approve - gửi notification)
- client/ (component hiển thị notification)
```

### Prompt 6: Kiểm tra tính năng Authentication (Xác thực)

```
Kiểm tra project này giúp tôi, không cần code, chỉ phân tích và báo lỗi.

Hãy kiểm tra toàn bộ luồng của tính năng AUTHENTICATION:

1. Đăng ký: Email có được validate đúng format không? Có kiểm tra email trùng không?
2. Đăng nhập: Password có được hash đúng cách không? JWT token có expiry hợp lý không?
3. Forgot password: Token reset có expiry không? Có bị brute-force không?
4. Verify email: Flow xác minh email có hoạt động end-to-end không?
5. CSRF protection: Token CSRF có được kiểm tra đúng trên mọi route mutation (POST/PUT/DELETE) không?
6. Cookie security: httpOnly, secure, sameSite có được set đúng không?
7. Có route nào quên middleware protect() mà lẽ ra phải yêu cầu đăng nhập không?

Kiểm tra các file:
- server/src/routes/authRoutes.js
- server/src/controllers/ (file liên quan auth)
- server/src/middleware/auth.js
- server/src/models/User.js
- client/app/login/, register/, forgot-password/, reset-password/, verify-email/
- client/hooks/useAuth
```

---

## Prompt Kiểm Tra Toàn Bộ Project (Full Audit)

```
Kiểm tra project này giúp tôi, không cần code, chỉ phân tích và báo cáo toàn bộ lỗi.

Hãy thực hiện FULL AUDIT cho toàn bộ project theo các bước sau:

### Bước 1: Liệt kê tất cả tính năng
Đọc toàn bộ routes, controllers, models và liệt kê tất cả tính năng của hệ thống.

### Bước 2: Với mỗi tính năng, kiểm tra 7 hạng mục
1. **Data Flow**: Dữ liệu đi từ Frontend → Backend → DB → Backend → Frontend có khớp nhau không?
2. **Status Flow**: Trạng thái có chuyển đổi đúng không? Bộ lọc UI có ẩn dữ liệu không?
3. **Moderation Flow**: Luồng duyệt có đồng bộ giữa Backend và Frontend không?
4. **Authorization**: Phân quyền có đúng và đủ không?
5. **Cache**: Cache có được invalidate đúng không?
6. **Error Handling**: Xử lý lỗi có đầy đủ không?
7. **UI Consistency**: Thông báo và hiển thị có chính xác không?

### Bước 3: Tổng hợp kết quả
Trình bày dưới dạng bảng với các cột:
| Tính năng | Vấn đề | File | Dòng | Mức độ | Giải pháp đề xuất |

Ưu tiên báo cáo các lỗi Critical và Major trước.
```

---

## Mẹo Sử Dụng

> [!TIP]
> - Chạy từng prompt riêng lẻ cho từng tính năng để AI phân tích sâu hơn.
> - Prompt "Full Audit" nên dùng khi muốn có cái nhìn tổng thể, nhưng kết quả có thể bị nông hơn.
> - Sau khi nhận kết quả, hãy yêu cầu AI **đi sâu vào từng lỗi cụ thể** nếu cần hiểu rõ hơn.

> [!IMPORTANT]
> Các prompt này tập trung vào **lỗi logic nghiệp vụ** (Business Logic Bug) — loại lỗi mà compiler, linter, và unit test cơ bản **KHÔNG thể phát hiện được**. Đây là loại lỗi chỉ bộc lộ khi truy vết đường đi thực tế của dữ liệu xuyên suốt từ UI → API → Database → API → UI.
