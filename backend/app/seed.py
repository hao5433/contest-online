"""Run with `python -m app.seed` (from inside backend/, with DATABASE_URL
pointed at a running Postgres) to populate a fresh database with demo data.

Creates:
  - 1 admin, 1 teacher, 1 student account
  - 1 subject ("Toan roi rac" / "Toán rời rạc") with 2 chapters
  - 15 approved questions (5 easy / 5 medium / 5 hard) with choices
  - 1 classroom ("Lớp Demo") owned by the demo teacher, with the demo
    student enrolled - so the "giao đề cho 1 lớp" flow has something to
    demo out of the box

Safe to re-run: skips creating anything that already exists.
"""
import asyncio

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.chapter import Chapter
from app.models.choice import Choice
from app.models.class_enrollment import ClassEnrollment
from app.models.classroom import Classroom
from app.models.question import Difficulty, Question, QuestionType
from app.models.subject import Subject
from app.models.user import User, UserRole

# (chapter_index, difficulty, question_type, content, [(choice_text, is_correct), ...])
SAMPLE_QUESTIONS = [
    (0, Difficulty.easy, QuestionType.single_choice, "Tập hợp rỗng được kí hiệu là gì?",
        [("∅", True), ("{0}", False), ("{}", False), ("N", False)]),
    (0, Difficulty.easy, QuestionType.single_choice, "Phép toán A ∩ B cho ra kết quả là gì?",
        [("Giao của A và B", True), ("Hợp của A và B", False), ("Hiệu của A và B", False), ("Tích Descartes", False)]),
    (0, Difficulty.easy, QuestionType.single_choice, "|A ∪ B| = |A| + |B| khi nào?",
        [("Khi A ∩ B = ∅", True), ("Luôn luôn đúng", False), ("Khi A = B", False), ("Không bao giờ", False)]),
    (0, Difficulty.easy, QuestionType.multi_choice, "Chọn các phát biểu đúng về tập hợp:",
        [("Tập hợp không chứa phần tử trùng nhau", True), ("A ⊆ A luôn đúng", True),
         ("∅ ⊆ A luôn đúng", True), ("|A| luôn là số âm", False)]),
    (0, Difficulty.easy, QuestionType.single_choice, "Ký hiệu ⊆ biểu thị điều gì?",
        [("Tập hợp con", True), ("Phần tử thuộc", False), ("Hợp", False), ("Giao", False)]),
    (0, Difficulty.medium, QuestionType.single_choice, "Số tập con của một tập hợp có n phần tử là bao nhiêu?",
        [("2^n", True), ("n^2", False), ("n!", False), ("2n", False)]),
    (0, Difficulty.medium, QuestionType.single_choice, "Quan hệ tương đương phải thỏa mãn các tính chất nào?",
        [("Phản xạ, đối xứng, bắc cầu", True), ("Chỉ phản xạ", False), ("Chỉ đối xứng", False), ("Chỉ bắc cầu", False)]),
    (0, Difficulty.medium, QuestionType.multi_choice, "Chọn các tính chất của quan hệ thứ tự bộ phận:",
        [("Phản xạ", True), ("Phản đối xứng", True), ("Bắc cầu", True), ("Đối xứng", False)]),
    (0, Difficulty.medium, QuestionType.single_choice, "Ánh xạ song ánh là ánh xạ vừa:",
        [("Đơn ánh và toàn ánh", True), ("Chỉ đơn ánh", False), ("Chỉ toàn ánh", False),
         ("Không đơn ánh, không toàn ánh", False)]),
    (0, Difficulty.medium, QuestionType.single_choice, "Nguyên lý bù trừ dùng để tính gì?",
        [("|A ∪ B| khi biết |A|, |B|, |A ∩ B|", True), ("Số hoán vị", False), ("Số tổ hợp", False), ("Số chỉnh hợp", False)]),
    (1, Difficulty.hard, QuestionType.single_choice, "Số chỉnh hợp chập k của n phần tử được tính bằng công thức nào?",
        [("n!/(n-k)!", True), ("n!/(k!(n-k)!)", False), ("n!/k!", False), ("k!/(n-k)!", False)]),
    (1, Difficulty.hard, QuestionType.single_choice, "Trong lý thuyết đồ thị, một cây (tree) có n đỉnh thì có bao nhiêu cạnh?",
        [("n-1", True), ("n", False), ("n+1", False), ("2n", False)]),
    (1, Difficulty.hard, QuestionType.multi_choice, "Chọn các phát biểu đúng về đồ thị Euler:",
        [("Có đường đi Euler nếu có 0 hoặc 2 đỉnh bậc lẻ", True), ("Có chu trình Euler nếu mọi đỉnh có bậc chẵn", True),
         ("Đồ thị Euler luôn là đồ thị đầy đủ", False), ("Đồ thị Euler không thể có chu trình", False)]),
    (1, Difficulty.hard, QuestionType.single_choice, "Nguyên lý quy nạp toán học dùng để chứng minh:",
        [("Phát biểu đúng với mọi số tự nhiên n từ một điểm bắt đầu", True), ("Phát biểu chỉ đúng với n=1", False),
         ("Phát biểu sai với mọi n", False), ("Không dùng để chứng minh gì", False)]),
    (1, Difficulty.hard, QuestionType.single_choice, "Số cách sắp xếp n phần tử phân biệt thành một hàng là:",
        [("n!", True), ("n^2", False), ("2^n", False), ("n(n-1)", False)]),
]


async def _get_or_create_user(db: AsyncSession, email: str, password: str, full_name: str, role: UserRole) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        return user
    user = User(email=email, password_hash=hash_password(password), full_name=full_name, role=role)
    db.add(user)
    await db.flush()
    return user


async def run() -> None:
    # Schema is managed by Alembic (backend/alembic/) - run `alembic upgrade
    # head` first (docker-compose's backend command already does this on
    # every start, so this is a non-issue when seeding via `docker compose
    # exec backend python -m app.seed`).
    db = SessionLocal()
    try:
        admin = await _get_or_create_user(db, "admin@example.com", "Admin123!", "Quản trị viên", UserRole.admin)
        teacher = await _get_or_create_user(db, "teacher@example.com", "Teacher123!", "Giảng viên Demo", UserRole.teacher)
        student = await _get_or_create_user(db, "student@example.com", "Student123!", "Thí sinh Demo", UserRole.student)

        result = await db.execute(
            select(Classroom).where(Classroom.name == "Lớp Demo", Classroom.teacher_id == teacher.id)
        )
        classroom = result.scalar_one_or_none()
        if not classroom:
            classroom = Classroom(name="Lớp Demo", teacher_id=teacher.id)
            db.add(classroom)
            await db.flush()
        result = await db.execute(
            select(ClassEnrollment).where(
                ClassEnrollment.classroom_id == classroom.id, ClassEnrollment.student_id == student.id
            )
        )
        if result.scalar_one_or_none() is None:
            db.add(ClassEnrollment(classroom_id=classroom.id, student_id=student.id))

        result = await db.execute(select(Subject).where(Subject.name == "Toán rời rạc"))
        subject = result.scalar_one_or_none()
        if not subject:
            subject = Subject(
                name="Toán rời rạc",
                description="Nhập môn toán rời rạc: tập hợp, quan hệ, tổ hợp, đồ thị",
            )
            db.add(subject)
            await db.flush()

        result = await db.execute(
            select(Chapter).where(Chapter.subject_id == subject.id).order_by(Chapter.order_index)
        )
        chapters = result.scalars().all()
        if not chapters:
            chapters = [
                Chapter(subject_id=subject.id, name="Tập hợp và quan hệ", order_index=0),
                Chapter(subject_id=subject.id, name="Tổ hợp và đồ thị", order_index=1),
            ]
            db.add_all(chapters)
            await db.flush()

        existing_count = (
            await db.execute(select(func.count(Question.id)).where(Question.subject_id == subject.id))
        ).scalar_one()
        if existing_count == 0:
            for chapter_idx, difficulty, qtype, content, choice_defs in SAMPLE_QUESTIONS:
                question = Question(
                    subject_id=subject.id,
                    chapter_id=chapters[chapter_idx].id,
                    content=content,
                    difficulty=difficulty,
                    question_type=qtype,
                    created_by=teacher.id,
                    is_approved=True,
                )
                question.choices = [
                    Choice(content=text, is_correct=is_correct, order_index=idx)
                    for idx, (text, is_correct) in enumerate(choice_defs)
                ]
                db.add(question)

        await db.commit()

        print("Seed complete. Demo logins:")
        print(f"  Admin:   admin@example.com   / Admin123!   ({admin.full_name})")
        print(f"  Teacher: teacher@example.com / Teacher123! ({teacher.full_name})")
        print("  Student: student@example.com / Student123! (Thí sinh Demo)")
        print(f'  Classroom: "{classroom.name}" (id={classroom.id}) - student@example.com is enrolled')
    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(run())
