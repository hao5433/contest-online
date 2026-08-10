import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, require_role
from app.core.errors import commit_or_400
from app.db.session import get_db
from app.models.chapter import Chapter
from app.models.choice import Choice
from app.models.exam import Exam
from app.models.question import Difficulty, Question, QuestionType
from app.models.subject import Subject
from app.models.user import User, UserRole
from app.schemas.question import QuestionCreate, QuestionListRead, QuestionRead, QuestionUpdate

router = APIRouter(prefix="/api/questions", tags=["questions"])


async def _validate_subject_and_chapter(db: AsyncSession, subject_id: int, chapter_id: int | None) -> None:
    if not await db.get(Subject, subject_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
    if chapter_id is not None:
        chapter = await db.get(Chapter, chapter_id)
        if not chapter or chapter.subject_id != subject_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Chapter does not belong to this subject")


def _validate_choice_shape(question: Question) -> None:
    if len(question.choices) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A question needs at least 2 choices")
    correct_count = sum(1 for choice in question.choices if choice.is_correct)
    if correct_count == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A question needs at least 1 correct choice")
    if question.question_type == QuestionType.single_choice and correct_count != 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="single_choice questions must have exactly 1 correct choice",
        )


@router.get("", response_model=QuestionListRead)
async def list_questions(
    subject_id: int | None = None,
    chapter_id: int | None = None,
    difficulty: Difficulty | None = None,
    is_approved: bool | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    filters = []
    if subject_id is not None:
        filters.append(Question.subject_id == subject_id)
    if chapter_id is not None:
        filters.append(Question.chapter_id == chapter_id)
    if difficulty is not None:
        filters.append(Question.difficulty == difficulty)
    if is_approved is not None:
        filters.append(Question.is_approved == is_approved)

    total = (await db.execute(select(func.count()).select_from(Question).where(*filters))).scalar_one()
    items_result = await db.execute(
        select(Question)
        .options(selectinload(Question.choices))  # QuestionRead includes choices - avoid a lazy-load at serialization time
        .where(*filters)
        .order_by(Question.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return QuestionListRead(items=items_result.scalars().all(), total=total, page=page, page_size=page_size)


@router.post("", response_model=QuestionRead, status_code=status.HTTP_201_CREATED)
async def create_question(
    payload: QuestionCreate,
    current_user: User = Depends(require_role(UserRole.teacher, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    await _validate_subject_and_chapter(db, payload.subject_id, payload.chapter_id)

    question = Question(
        subject_id=payload.subject_id,
        chapter_id=payload.chapter_id,
        content=payload.content,
        difficulty=payload.difficulty,
        question_type=payload.question_type,
        image_url=payload.image_url,
        created_by=current_user.id,
        is_approved=False,
    )
    question.choices = [
        Choice(content=c.content, is_correct=c.is_correct, order_index=idx)
        for idx, c in enumerate(payload.choices)
    ]
    _validate_choice_shape(question)

    db.add(question)
    await db.commit()
    # No db.refresh() here: it would expire (un-load) the `choices` we just
    # assigned above, and QuestionRead needs to read `.choices` right after
    # this returns - outside any await context, so a lazy reload would crash
    # with MissingGreenlet. expire_on_commit=False keeps everything we
    # already have in memory (id included, populated during flush) valid.
    return question


@router.get("/{question_id}", response_model=QuestionRead)
async def get_question(
    question_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    question = await db.get(Question, question_id, options=[selectinload(Question.choices)])
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    return question


@router.put("/{question_id}", response_model=QuestionRead)
async def update_question(
    question_id: int,
    payload: QuestionUpdate,
    current_user: User = Depends(require_role(UserRole.teacher, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    # Eager-load choices *before* replacing the collection below - assigning
    # a brand-new list to `.choices` needs the current contents loaded first
    # (so the delete-orphan cascade knows what to remove), and an implicit
    # lazy-load at that point would hit the same MissingGreenlet problem as
    # a lazy-load during response serialization.
    question = await db.get(Question, question_id, options=[selectinload(Question.choices)])
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    await _validate_subject_and_chapter(db, payload.subject_id, payload.chapter_id)

    question.subject_id = payload.subject_id
    question.chapter_id = payload.chapter_id
    question.content = payload.content
    question.difficulty = payload.difficulty
    question.question_type = payload.question_type
    question.image_url = payload.image_url
    question.is_approved = False  # any edit requires re-approval
    question.choices = [
        Choice(content=c.content, is_correct=c.is_correct, order_index=idx)
        for idx, c in enumerate(payload.choices)
    ]
    _validate_choice_shape(question)

    await db.commit()
    # No db.refresh() - see the comment in create_question above.
    return question


async def _question_is_used_in_any_exam(db: AsyncSession, question_id: int, subject_id: int) -> bool:
    """`Exam.question_ids` is a plain JSON list, not a real foreign key, so
    deleting a question that's in some exam's pool would otherwise succeed
    silently - and then crash that exam for every student who tries to take
    it (db.get() returns None for the dangling id, then .content 500s).
    Scoped to the question's own subject since a pool can only ever draw
    from questions in the same subject."""
    result = await db.execute(select(Exam.question_ids).where(Exam.subject_id == subject_id))
    return any(question_id in (question_ids or []) for (question_ids,) in result.all())


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    question_id: int,
    current_user: User = Depends(require_role(UserRole.teacher, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    question = await db.get(Question, question_id)
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    if await _question_is_used_in_any_exam(db, question_id, question.subject_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete: this question is used by one or more exams")
    await db.delete(question)
    await commit_or_400(db, "Cannot delete: this question is used by one or more exams")


@router.patch("/{question_id}/approve", response_model=QuestionRead)
async def approve_question(
    question_id: int,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    question = await db.get(Question, question_id, options=[selectinload(Question.choices)])
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    question.is_approved = True
    await db.commit()
    # No db.refresh() - see the comment in create_question above.
    return question


@router.post("/import", status_code=status.HTTP_201_CREATED)
async def import_questions(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(UserRole.teacher, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    """Bulk-imports questions from an Excel workbook (.xlsx).

    Expected header row (case-insensitive column names), one row per question:

        subject_id       (required, int)
        chapter_id        (optional, int)
        content           (required, text)
        difficulty        (required: easy | medium | hard)
        question_type     (required: single_choice | multi_choice)
        image_url         (optional)
        choice_1..choice_6 (at least 2 must be filled in)
        correct_choices   (required, 1-based indices of the correct choice
                            columns, comma-separated, e.g. "1" or "1,3")

    Imported questions are created with is_approved=False, same as manual
    creation - an admin still has to approve them via PATCH .../approve.
    """
    try:
        df = pd.read_excel(file.file)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Could not read Excel file: {exc}")

    df.columns = [str(c).strip().lower() for c in df.columns]
    required_columns = {"subject_id", "content", "difficulty", "question_type"}
    missing = required_columns - set(df.columns)
    if missing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Missing required columns: {sorted(missing)}")

    choice_columns = sorted(c for c in df.columns if c.startswith("choice_"))
    created: list[Question] = []

    for row_idx, row in df.iterrows():
        excel_row_number = row_idx + 2  # +1 for 0-index, +1 for the header row

        try:
            difficulty = Difficulty(str(row["difficulty"]).strip().lower())
            question_type = QuestionType(str(row["question_type"]).strip().lower())
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Row {excel_row_number}: {exc}")

        raw_correct = row.get("correct_choices", "")
        correct_indices = {
            int(token.strip()) for token in str(raw_correct).split(",") if token.strip().isdigit()
        }

        choices = []
        for position, column in enumerate(choice_columns, start=1):
            value = row.get(column)
            if pd.isna(value) or str(value).strip() == "":
                continue
            choices.append(Choice(content=str(value).strip(), is_correct=position in correct_indices, order_index=position - 1))

        chapter_id_raw = row.get("chapter_id")
        chapter_id = int(chapter_id_raw) if chapter_id_raw is not None and not pd.isna(chapter_id_raw) else None
        image_url_raw = row.get("image_url")
        image_url = str(image_url_raw).strip() if image_url_raw is not None and not pd.isna(image_url_raw) else None

        question = Question(
            subject_id=int(row["subject_id"]),
            chapter_id=chapter_id,
            content=str(row["content"]).strip(),
            difficulty=difficulty,
            question_type=question_type,
            image_url=image_url,
            created_by=current_user.id,
            is_approved=False,
            choices=choices,
        )
        try:
            _validate_choice_shape(question)
        except HTTPException as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Row {excel_row_number}: {exc.detail}")

        db.add(question)
        created.append(question)

    await db.commit()
    return {"imported": len(created)}
