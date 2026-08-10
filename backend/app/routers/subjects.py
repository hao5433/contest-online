from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_role
from app.core.errors import commit_or_400
from app.db.session import get_db
from app.models.chapter import Chapter
from app.models.subject import Subject
from app.models.user import User, UserRole
from app.schemas.chapter import ChapterCreate, ChapterRead, ChapterUpdate
from app.schemas.subject import SubjectCreate, SubjectRead, SubjectUpdate

# Everyone authenticated can read; only teacher/admin can write.
router = APIRouter(prefix="/api/subjects", tags=["subjects"])
chapter_router = APIRouter(prefix="/api/chapters", tags=["chapters"])


async def _get_subject_or_404(db: AsyncSession, subject_id: int) -> Subject:
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
    return subject


@router.get("", response_model=list[SubjectRead])
async def list_subjects(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Subject).order_by(Subject.id))
    return result.scalars().all()


@router.post("", response_model=SubjectRead, status_code=status.HTTP_201_CREATED)
async def create_subject(
    payload: SubjectCreate,
    current_user: User = Depends(require_role(UserRole.teacher, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    subject = Subject(name=payload.name, description=payload.description)
    db.add(subject)
    await db.commit()
    await db.refresh(subject)
    return subject


@router.get("/{subject_id}", response_model=SubjectRead)
async def get_subject(
    subject_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    return await _get_subject_or_404(db, subject_id)


@router.put("/{subject_id}", response_model=SubjectRead)
async def update_subject(
    subject_id: int,
    payload: SubjectUpdate,
    current_user: User = Depends(require_role(UserRole.teacher, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    subject = await _get_subject_or_404(db, subject_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(subject, field, value)
    await db.commit()
    await db.refresh(subject)
    return subject


@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subject(
    subject_id: int,
    current_user: User = Depends(require_role(UserRole.teacher, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    subject = await _get_subject_or_404(db, subject_id)
    await db.delete(subject)
    await commit_or_400(db, "Cannot delete: this subject still has exams referencing it")


@router.get("/{subject_id}/chapters", response_model=list[ChapterRead])
async def list_chapters(
    subject_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await _get_subject_or_404(db, subject_id)
    result = await db.execute(select(Chapter).where(Chapter.subject_id == subject_id).order_by(Chapter.order_index))
    return result.scalars().all()


@router.post("/{subject_id}/chapters", response_model=ChapterRead, status_code=status.HTTP_201_CREATED)
async def create_chapter(
    subject_id: int,
    payload: ChapterCreate,
    current_user: User = Depends(require_role(UserRole.teacher, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    await _get_subject_or_404(db, subject_id)
    chapter = Chapter(subject_id=subject_id, name=payload.name, order_index=payload.order_index)
    db.add(chapter)
    await db.commit()
    await db.refresh(chapter)
    return chapter


async def _get_chapter_or_404(db: AsyncSession, chapter_id: int) -> Chapter:
    chapter = await db.get(Chapter, chapter_id)
    if not chapter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")
    return chapter


@chapter_router.put("/{chapter_id}", response_model=ChapterRead)
async def update_chapter(
    chapter_id: int,
    payload: ChapterUpdate,
    current_user: User = Depends(require_role(UserRole.teacher, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    chapter = await _get_chapter_or_404(db, chapter_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(chapter, field, value)
    await db.commit()
    await db.refresh(chapter)
    return chapter


@chapter_router.delete("/{chapter_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chapter(
    chapter_id: int,
    current_user: User = Depends(require_role(UserRole.teacher, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    chapter = await _get_chapter_or_404(db, chapter_id)
    await db.delete(chapter)
    await commit_or_400(db, "Cannot delete: this chapter still has questions referencing it")
