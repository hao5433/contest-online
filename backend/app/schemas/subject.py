from pydantic import BaseModel, ConfigDict


class SubjectBase(BaseModel):
    name: str
    description: str | None = None


class SubjectCreate(SubjectBase):
    pass


class SubjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class SubjectRead(SubjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
