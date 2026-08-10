# Hệ thống thi trực tuyến

Backend cho một hệ thống thi trực tuyến, xây dựng bằng **FastAPI + SQLAlchemy 2.0 (sync) + PostgreSQL + Redis + JWT**.

## Tổng quan chức năng

- **Quản lý người dùng phân quyền**: Admin / Giảng viên (Teacher) / Thí sinh (Student). Đăng ký công khai chỉ tạo tài khoản Thí sinh; Admin tạo tài khoản Giảng viên/Admin.
- **Ngân hàng câu hỏi**: theo Môn học (Subject) → Chương (Chapter) → Câu hỏi (Question, có độ khó easy/medium/hard, loại câu hỏi single/multi-choice), Giảng viên tạo câu hỏi, Admin duyệt (approve) trước khi câu hỏi được đưa vào đề thi. Hỗ trợ nhập câu hỏi hàng loạt từ file Excel.
- **Trộn đề tự động**: khi tạo đề thi, hệ thống tự chọn ngẫu nhiên đủ số câu hỏi đã được duyệt theo phân bố độ khó (`difficulty_distribution`) từ ngân hàng câu hỏi của môn học. Mỗi thí sinh khi vào thi được xáo thứ tự câu hỏi/đáp án riêng (seed theo attempt id, có thể tái lập).
- **Phòng thi**: đếm ngược thời gian real-time qua WebSocket, tự động nộp bài khi hết giờ, chống gian lận cơ bản (ghi nhận vi phạm chuyển tab / thoát fullscreen, giảng viên giám sát trực tiếp qua WebSocket).
- **Chấm điểm tự động & báo cáo**: so khớp chính xác đáp án đã chọn với đáp án đúng để tính điểm phần trăm; xuất báo cáo kết quả thi ra Excel và PDF.

## Kiến trúc & công nghệ

Python 3.11+, FastAPI (100% `async def`), SQLAlchemy 2.0 Async ORM (driver `asyncpg`), Pydantic v2, PostgreSQL 16, Redis 7 (client `redis.asyncio`), JWT (python-jose + passlib/bcrypt), Alembic (migration), openpyxl/pandas (Excel), reportlab (PDF), WebSocket gốc của FastAPI.

**Toàn bộ route là `async def`, DB là async thật (không phải `def` + threadpool).** Engine dùng `asyncpg` (`app/db/session.py`); Alembic (`alembic/env.py`) vẫn dùng 1 engine **sync** riêng (`psycopg2-binary`, vẫn có trong requirements) vì migration là việc chạy 1 lần, không cần async. Quy tắc quan trọng khi thêm route mới: mọi quan hệ ORM (`question.choices`, `attempt.exam`,...) phải được `selectinload()`/`joinedload()` ngay trong câu query, hoặc dùng `await obj.awaitable_attrs.<tên_quan_hệ>` - truy cập trực tiếp một quan hệ chưa nạp sẽ crash `MissingGreenlet`. Cẩn thận với `db.refresh(obj)` sau khi gán 1 quan hệ (ví dụ `question.choices = [...]`) - `refresh()` sẽ làm quan hệ đó bị "expire" trở lại, gây crash y như trên; bỏ `refresh()` nếu không thực sự cần (đã có `expire_on_commit=False`).

**Bcrypt là CPU-bound, phải chạy ngoài event loop.** `hash_password`/`verify_password` (`app/core/security.py`) là hàm đồng bộ mất ~150-300ms mỗi lần gọi; mọi call site trong route (`auth.py`: register/login/change-password, `users.py`: create_user, `classrooms.py`: import Excel) đều bọc qua `await run_in_threadpool(...)`. Thiếu bọc này thì 1 request login sẽ chiếm luôn event loop của cả worker trong suốt thời gian băm mật khẩu, làm nghẽn toàn bộ request khác (kể cả các query DB async khác) đang chạy song song trên worker đó - đã tự kiểm chứng bằng load test thực tế (200 request login đồng thời timeout hết trước khi fix, chạy mượt 100% sau khi fix). `app/seed.py` gọi trực tiếp (không bọc) vì đó là script CLI chạy 1 lần, không có event loop nào khác cần bảo vệ.

**Redis dùng cho 3 việc:** broadcast WebSocket qua pub/sub (đa-worker), ticket đăng nhập WebSocket ngắn hạn (`app/services/ws_tickets.py`), và rate-limit đăng nhập (`app/core/rate_limit.py`) - không còn là "đã cấp phát nhưng chưa dùng" như bản trước.

### Migration (Alembic)

Schema được quản lý bằng Alembic (`backend/alembic/`), không dùng `create_all()` nữa. `docker compose up` tự chạy `alembic upgrade head` trước khi start server (an toàn để chạy lại nhiều lần - no-op nếu đã ở bản mới nhất).

Khi sửa model (thêm cột/bảng mới), tạo migration:

```bash
docker compose exec backend alembic revision --autogenerate -m "mô tả thay đổi"
docker compose exec backend alembic upgrade head
```

Kiểm tra file migration được sinh ra trong `backend/alembic/versions/` trước khi commit - autogenerate không phải lúc nào cũng bắt đúng 100% (đặc biệt là đổi tên cột, thay đổi kiểu enum).

## Cấu trúc thư mục

```
backend/
  app/
    core/       # config, security (JWT/bcrypt), RBAC dependencies
    db/         # SQLAlchemy engine/session
    models/     # SQLAlchemy models (User, Subject, Chapter, Question, Choice, Exam, ExamAttempt, AttemptAnswer, Violation)
    schemas/    # Pydantic v2 schemas (Create/Update/Read)
    routers/    # auth, users, subjects, questions, exams, attempts, ws
    services/   # grading, shuffling, question_pool selection, Excel/PDF reports
    main.py     # FastAPI app, CORS, router registration
    seed.py     # demo data seeding script
  requirements.txt
  Dockerfile
docker-compose.yml
.env.example
```

## API Contract

Tất cả route REST nằm dưới tiền tố `/api`. WebSocket nằm dưới `/ws` (không có tiền tố `/api`).

### Auth (`/api/auth`)

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| POST | `/api/auth/register` | Công khai | Đăng ký - luôn tạo tài khoản `student` |
| POST | `/api/auth/login` | Công khai | Đăng nhập, trả `access_token` + `refresh_token` |
| POST | `/api/auth/refresh` | Công khai (cần refresh token) | Cấp lại `access_token` **và** `refresh_token` mới (refresh token dùng 1 lần - xoay vòng mỗi lần gọi, xem ghi chú dưới) |
| POST | `/api/auth/logout` | Công khai (cần refresh token) | Vô hiệu hoá refresh token đó ngay (204, kể cả nếu token đã hết hạn/không tồn tại) |
| GET | `/api/auth/me` | Đã đăng nhập | Thông tin tài khoản hiện tại |
| POST | `/api/auth/change-password` | Đã đăng nhập | Đổi mật khẩu (`{current_password, new_password}`); 400 nếu `current_password` sai |

**Refresh token lưu DB, không còn là JWT thuần** (bảng `refresh_tokens`, chỉ lưu hash SHA-256): mỗi refresh token chỉ dùng được 1 lần - gọi `/auth/refresh` sẽ vô hiệu hoá token cũ và trả token mới. Nếu 1 token **đã bị xoay vòng** mà vẫn bị gọi lại (dấu hiệu bị đánh cắp), toàn bộ refresh token của user đó bị vô hiệu hoá ngay (buộc đăng nhập lại ở mọi thiết bị). Access token vẫn là JWT stateless (không tra DB mỗi request) - đăng xuất không revoke được access token đang dùng, chỉ ảnh hưởng từ lần refresh tiếp theo.

### Users (`/api/users`) - chỉ Admin

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/users?role=&is_active=` | Danh sách người dùng, lọc theo role/is_active |
| POST | `/api/users` | Admin tạo tài khoản giảng viên/admin |
| PATCH | `/api/users/{id}` | Đổi `is_active` / `role` |

### Subjects & Chapters (`/api/subjects`, `/api/chapters`) - đọc: mọi người đã đăng nhập, viết: teacher/admin

| Method | Path | Mô tả |
|---|---|---|
| GET / POST | `/api/subjects` | Danh sách / tạo môn học |
| GET / PUT / DELETE | `/api/subjects/{id}` | Xem / sửa / xoá môn học |
| GET / POST | `/api/subjects/{id}/chapters` | Danh sách / tạo chương thuộc môn học |
| PUT / DELETE | `/api/chapters/{id}` | Sửa / xoá chương |

### Classrooms (`/api/classrooms`) - teacher/admin

Một lớp học thuộc về 1 giảng viên (người tạo). Đề thi có thể gán cho 1 lớp cụ thể (`Exam.classroom_id`) - khi đó
chỉ học sinh **đã được thêm vào lớp** mới thấy/làm được đề đó; để trống (`classroom_id = null`, mặc định) thì đề
thi hiện với mọi học sinh như trước.

| Method | Path | Mô tả |
|---|---|---|
| GET / POST | `/api/classrooms` | Danh sách lớp (giảng viên chỉ thấy lớp mình tạo, admin thấy tất cả) / tạo lớp mới |
| GET / PUT / DELETE | `/api/classrooms/{id}` | Xem / sửa tên / xoá lớp (403 nếu không phải chủ lớp và không phải admin) |
| GET | `/api/classrooms/{id}/students` | Danh sách học sinh trong lớp |
| POST | `/api/classrooms/{id}/students` | Thêm học sinh vào lớp bằng email (`{"email": "..."}`); 400 nếu email không tồn tại hoặc không phải role `student` |
| POST | `/api/classrooms/{id}/students/import` | Nhập danh sách học sinh từ file Excel (multipart) - xem định dạng dưới đây |
| DELETE | `/api/classrooms/{id}/students/{student_id}` | Gỡ học sinh khỏi lớp |

**Định dạng file Excel cho `/api/classrooms/{id}/students/import`** (dòng tiêu đề, không phân biệt hoa/thường):

```
full_name | email | password
```

- `full_name`, `email` (bắt buộc); `password` (tuỳ chọn - nếu bỏ trống, tài khoản mới dùng mật khẩu mặc định chung `Student123!`, có thể đổi bằng `POST /api/auth/change-password` sau khi đăng nhập)
- Nếu `email` đã có tài khoản học sinh: chỉ thêm vào lớp (bỏ qua `full_name`/`password` của dòng đó)
- Nếu `email` đã có tài khoản nhưng **không phải** học sinh: dòng đó lỗi, các dòng khác vẫn xử lý tiếp
- Nếu `email` chưa tồn tại: tạo tài khoản học sinh mới + thêm vào lớp; mật khẩu (mặc định hoặc lấy từ cột `password`) được trả về trong response để giáo viên biết và thông báo cho học sinh đổi lại - **không có gửi email tự động**
- Mỗi dòng xử lý độc lập (dùng savepoint) - 1 dòng lỗi không chặn các dòng còn lại

### Questions (`/api/questions`) - giảng viên tạo, admin duyệt

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/questions?subject_id=&chapter_id=&difficulty=&is_approved=&page=&page_size=` | Danh sách câu hỏi, có phân trang |
| POST | `/api/questions` | Tạo câu hỏi kèm mảng `choices` lồng trong 1 request |
| GET / PUT / DELETE | `/api/questions/{id}` | Xem / sửa (yêu cầu duyệt lại) / xoá câu hỏi |
| PATCH | `/api/questions/{id}/approve` | Admin duyệt câu hỏi |
| POST | `/api/questions/import` | Nhập câu hỏi hàng loạt từ file Excel (multipart) |

**Định dạng file Excel cho `/api/questions/import`** (dòng tiêu đề, không phân biệt hoa/thường):

```
subject_id | chapter_id | content | difficulty | question_type | image_url | choice_1 | choice_2 | ... | choice_6 | correct_choices
```

- `subject_id` (bắt buộc, số), `chapter_id` (tuỳ chọn, số)
- `content` (bắt buộc, nội dung câu hỏi)
- `difficulty`: `easy` | `medium` | `hard`
- `question_type`: `single_choice` | `multi_choice`
- `image_url` (tuỳ chọn)
- `choice_1`..`choice_6`: nội dung đáp án, cần tối thiểu 2 cột có giá trị
- `correct_choices`: chỉ số (1-based) của các đáp án đúng, phân tách bằng dấu phẩy, ví dụ `"1"` hoặc `"1,3"`

Mỗi dòng = 1 câu hỏi, được tạo với `is_approved=False` (vẫn cần Admin duyệt).

### Exams (`/api/exams`) - teacher/admin

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/exams` | Danh sách đề thi. Giảng viên chỉ thấy đề của mình; admin thấy tất cả; **học sinh chỉ thấy đề đã `published` và (`classroom_id` là null HOẶC đã được thêm vào lớp đó)** |
| POST | `/api/exams` | Tạo đề thi - `total_questions` và bộ câu hỏi được server tự chọn từ `difficulty_distribution`; có thể kèm `classroom_id` để giao cho 1 lớp; 400 nếu ngân hàng câu hỏi không đủ |
| GET | `/api/exams/{id}` | Chi tiết đề thi |
| PATCH | `/api/exams/{id}` | Sửa đề / đổi trạng thái `draft → published → closed` / đổi `classroom_id` |
| DELETE | `/api/exams/{id}` | Xoá đề thi |
| GET | `/api/exams/{id}/attempts` | Danh sách lượt thi của đề (tên/email học sinh, điểm, trạng thái, số vi phạm) - dùng để tìm lượt thi cần reset |
| GET | `/api/exams/{id}/statistics` | `{attempt_count, avg_score, pass_rate, score_distribution, per_question_accuracy}` |
| GET | `/api/exams/{id}/report/excel` | Xuất báo cáo kết quả dạng Excel (`.xlsx`) |
| GET | `/api/exams/{id}/report/pdf` | Xuất báo cáo kết quả dạng PDF |

### Làm bài thi - Thí sinh (`/api/exams/{id}/start`, `/api/attempts/...`)

| Method | Path | Mô tả |
|---|---|---|
| POST | `/api/exams/{id}/start` | Bắt đầu (hoặc tiếp tục) làm bài - trả `attempt_id`, `end_at`, danh sách câu hỏi đã xáo (không có `is_correct`); 400 nếu đã làm rồi |
| GET | `/api/attempts/me` | Lịch sử làm bài của thí sinh hiện tại (mọi đề đã/đang làm) |
| POST | `/api/attempts/{id}/answer` | Lưu tạm câu trả lời (autosave, chưa chấm điểm); 403 nếu không phải thí sinh sở hữu hoặc attempt không còn `in_progress` |
| POST | `/api/attempts/{id}/submit` | Nộp bài - chấm điểm toàn bộ, tính điểm %, chuyển trạng thái `graded` |
| GET | `/api/attempts/{id}/result` | Xem điểm + chi tiết từng câu. Với thí sinh: `details_locked=true` (chỉ thấy điểm, không thấy đúng/sai từng câu) khi đề còn `published` và chưa hết `end_time` - tránh lộ đáp án cho người chưa thi; giảng viên/admin luôn thấy đầy đủ |
| POST | `/api/attempts/{id}/violation` | Ghi nhận 1 lần vi phạm, tăng `violation_count`, broadcast tới WebSocket giám sát của đề thi |
| DELETE | `/api/attempts/{id}` | (teacher/admin) Xoá hẳn 1 lượt thi để thí sinh làm lại từ đầu - dùng khi gặp lỗi kỹ thuật giữa giờ |

### Realtime (WebSocket, không có tiền tố `/api`)

Kết nối WS cần 1 **ticket ngắn hạn** (60s, dùng 1 lần) thay vì JWT thật - lấy bằng `POST /api/auth/ws-ticket` (cần Bearer token bình thường), rồi nối `?ticket=...` vào URL WS. Sở dĩ không dùng thẳng access token: query string của WebSocket bị ghi nguyên vào log server (uvicorn, reverse proxy...) - JWT 30 phút nằm trong log là rủi ro thật, ticket 60s dùng 1 lần thì vô hại kể cả khi lộ.

| Path | Phía | Mô tả |
|---|---|---|
| `WS /ws/attempts/{attempt_id}?ticket=...` | Thí sinh | Server gửi `{"type":"tick","remaining_seconds":N}` mỗi ~5s, rồi `{"type":"time_up"}` và đóng kết nối khi hết giờ (tự động nộp bài). Client có thể gửi `{"type":"violation","violation_type":"tab_switch"}` |
| `WS /ws/exams/{exam_id}/monitor?ticket=...` | Giảng viên/Admin | Nhận `{"type":"violation",...}` và `{"type":"progress",...}` theo thời gian thực khi thí sinh làm bài |

Broadcast đi qua **Redis pub/sub** (`app/routers/ws.py`) - mỗi worker process có 1 subscriber loop riêng (khởi động trong `lifespan` của `main.py`), nên 1 vi phạm được ghi nhận ở worker nào cũng đến đúng kết nối giám sát của giáo viên dù đang ở worker khác. Trước đây (`ConnectionManager` in-memory thuần) không đúng khi chạy nhiều worker - đã sửa.

## Chạy bằng Docker (khuyến nghị)

```bash
cp .env.example .env          # rồi chỉnh JWT_SECRET_KEY, mật khẩu DB nếu cần
docker compose up --build
docker compose exec backend python -m app.seed
```

- Backend: http://localhost:8000 (Swagger UI tại `/docs`)
- Frontend (do agent khác xây dựng): http://localhost:5173
- Postgres: `localhost:5432`, Redis: `localhost:6379`

## Chạy không dùng Docker

```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Cần một Postgres đang chạy sẵn, ví dụ tạo database cục bộ:
#   createdb exam_system
export DATABASE_URL="postgresql+psycopg2://<user>:<pass>@localhost:5432/exam_system"
export REDIS_URL="redis://localhost:6379/0"     # tuỳ chọn ở scaffold này
export JWT_SECRET_KEY="dev-secret-change-me"

uvicorn app.main:app --reload --port 8000
python -m app.seed   # ở một terminal khác, cùng thư mục backend/, cùng biến môi trường
```

## Tài khoản demo (sau khi chạy `python -m app.seed`)

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Admin | `admin@example.com` | `Admin123!` |
| Giảng viên | `teacher@example.com` | `Teacher123!` |
| Thí sinh | `student@example.com` | `Student123!` |

Seed cũng tạo môn **"Toán rời rạc"** với 2 chương và 15 câu hỏi mẫu đã được duyệt (5 easy / 5 medium / 5 hard) - đủ để tạo ngay một đề thi thử, ví dụ `difficulty_distribution = {"easy": 5, "medium": 5, "hard": 5}`. Ngoài ra còn tạo lớp **"Lớp Demo"** (thuộc `teacher@example.com`) với `student@example.com` đã được thêm vào - đủ để thử ngay tính năng giao đề theo lớp.

## Ghi chú triển khai

- Mật khẩu băm bằng bcrypt (`passlib`); token JWT gồm `access_token` (ngắn hạn) và `refresh_token` (dài hạn), thuật toán HS256.
- Câu hỏi/đáp án không bao giờ lộ `is_correct` cho thí sinh trước khi nộp bài (schema riêng cho luồng làm bài trong `schemas/attempt.py`).
- Việc trộn câu hỏi/đáp án dùng Fisher-Yates có seed (theo `attempt_id`), nên vẫn tái lập được cùng thứ tự nếu thí sinh tải lại trang giữa lúc thi.
- Tự động nộp bài khi hết giờ được kiểm tra ở cả endpoint `/submit`, `/answer`, `/result` và trong vòng lặp WebSocket `/ws/attempts/{id}` - thí sinh không thể "né" việc chấm điểm chỉ bằng cách không bấm nộp bài.
- `ConnectionManager` trong `routers/ws.py` broadcast qua Redis pub/sub - hoạt động đúng khi chạy nhiều worker/instance (mỗi process giữ danh sách kết nối cục bộ riêng, nhận event qua Redis).
- Alembic quản lý schema (xem mục Migration ở trên); `create_all()` không còn được dùng.
# contest-online
