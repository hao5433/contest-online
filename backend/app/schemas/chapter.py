from pydantic import BaseModel, ConfigDict


class ChapterBase(BaseModel):
    name: str
    order_index: int = 0


class ChapterCreate(ChapterBase):
    pass


class ChapterUpdate(BaseModel):
    name: str | None = None
    order_index: int | None = None


class ChapterRead(ChapterBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subject_id: int
