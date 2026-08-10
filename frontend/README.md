# Hệ thống thi trực tuyến — Frontend

Frontend cho hệ thống thi trực tuyến, xây dựng bằng Vite + React 18 + TypeScript +
TailwindCSS, giao tiếp với backend FastAPI qua REST và WebSocket.

## Cài đặt & chạy

```bash
cp .env.example .env   # chỉnh VITE_API_BASE_URL / VITE_WS_BASE_URL nếu cần
npm install
npm run dev             # http://localhost:5173
```

Scripts khác:

```bash
npm run build     # build production vào dist/
npm run preview   # preview bản build
npm run lint       # eslint
```

### Docker

```bash
docker build -t exam-frontend .
docker run -p 5173:5173 --env-file .env exam-frontend
```

## Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000/api` | Base URL của REST API backend |
| `VITE_WS_BASE_URL` | `ws://localhost:8000` | Base URL cho các kết nối WebSocket |

## Kiến trúc thư mục

```
src/
  api/          axios client + hàm gọi API theo resource (auth, users, subjects, questions, exams, attempts)
  store/        zustand store (auth: user, tokens, login/logout)
  hooks/        react-query hooks theo resource + hooks WebSocket (useAttemptSocket, useExamMonitorSocket)
  lib/          helpers thuần (utils.ts, ws.ts)
  types/        interface TypeScript khớp với API contract của backend
  components/   layout/, common/ (ProtectedRoute, Modal, Badge...), charts/, questions/, exams/, exam-room/
  pages/        các trang theo route, chia theo auth/, admin/, teacher/, student/
```

## Bản đồ route (route map)

| Route | Vai trò | Trang |
|---|---|---|
| `/login` | công khai | Đăng nhập |
| `/register` | công khai | Đăng ký (tự đăng ký = học sinh) |
| `/` | mọi vai trò đã đăng nhập | Chuyển hướng theo vai trò (`/admin`, `/teacher/exams`, `/student`) |
| `/admin` | admin | Quản lý người dùng |
| `/teacher/subjects` | admin, teacher | Quản lý môn học & chương |
| `/teacher/questions` | admin, teacher | Ngân hàng câu hỏi (lọc, tạo/sửa, nhập Excel, phê duyệt) |
| `/teacher/exams` | admin, teacher | Danh sách đề thi, tạo đề thi |
| `/teacher/exams/:id` | admin, teacher | Chi tiết đề thi: thống kê (biểu đồ), xuất Excel/PDF, giám sát trực tiếp |
| `/student` | student | Danh sách đề thi có thể làm + lịch sử làm bài |
| `/student/exam/:examId/room` | student | Phòng thi: đếm giờ, tự lưu câu trả lời, chống gian lận |
| `/student/exam/:examId/result/:attemptId` | student | Kết quả bài thi, chi tiết đúng/sai theo câu |
| `/not-authorized` | — | Trang 403 khi vai trò không khớp route |
| `*` | — | Trang 404 |

`ProtectedRoute` (`src/components/common/ProtectedRoute.tsx`) điều hướng về `/login`
nếu chưa đăng nhập, và hiển thị trang "không có quyền" nếu vai trò không khớp
danh sách `roles` được truyền vào.

## Ghi chú triển khai

- **Auth**: access/refresh token lưu trong `zustand` (persist vào `localStorage`).
  Axios interceptor tự đính `Authorization: Bearer`, và tự refresh 1 lần khi gặp 401.
- **Realtime**: `useAttemptSocket` (phòng thi học sinh) và `useExamMonitorSocket`
  (giám sát của giáo viên) tự kết nối lại sau 3s nếu mất kết nối; đồng hồ đếm giờ
  trong phòng thi có cơ chế dự phòng tính cục bộ từ `end_at` khi WebSocket rớt.
- **Chống gian lận**: theo dõi `visibilitychange` và `fullscreenchange`, báo vi phạm
  qua cả REST (`/attempts/{id}/violation`) và WebSocket, tự nộp bài khi vượt quá
  ngưỡng vi phạm (mặc định 3 lần, cấu hình tại `VIOLATION_THRESHOLD` trong
  `src/pages/student/ExamRoomPage.tsx`).
- **Biểu đồ**: dùng chung một màu chính (xanh dương) cho các biểu đồ độ lớn (phân bố
  điểm, độ chính xác từng câu) và cặp màu trạng thái xanh/đỏ cho biểu đồ đạt/không đạt.
