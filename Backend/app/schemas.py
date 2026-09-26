from datetime import date
from typing import Literal
from pydantic import BaseModel, Field, EmailStr, field_validator, model_validator
from urllib.parse import urlparse

class Input(BaseModel):
    model_config = {"extra": "forbid"}

class PasswordInput(Input):
    password: str = Field(min_length=8, max_length=72)
    @field_validator("password")
    @classmethod
    def password_bytes(cls, value):
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must contain at most 72 UTF-8 bytes.")
        return value

class Signup(PasswordInput):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    confirm_password: str
    @model_validator(mode="after")
    def confirmation(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        return self

class Login(PasswordInput):
    email: EmailStr
    remember: bool = False

class Recovery(Input):
    email: EmailStr

class Reset(PasswordInput):
    token: str = Field(min_length=20, max_length=200)

class ChangePassword(PasswordInput):
    current_password: str = Field(min_length=1, max_length=72)

def valid_date(value):
    if value:
        date.fromisoformat(value)
    return value

def valid_url(value):
    if value:
        parts = urlparse(value)
        if parts.scheme not in ("http", "https") or not parts.netloc or parts.username:
            raise ValueError("Enter a valid HTTP or HTTPS URL.")
    return value

class ProjectInput(Input):
    name: str = Field(min_length=2, max_length=150)
    slug: str = Field(min_length=2, max_length=160, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    description: str = Field(default="", max_length=20000)
    short_description: str = Field(default="", max_length=300)
    category: str = Field(default="Full-stack", max_length=80)
    status: Literal["PLANNED", "IN_PROGRESS", "REVIEW", "COMPLETED"] = "PLANNED"
    progress: int = Field(default=0, ge=0, le=100)
    is_public: bool = False
    technologies: list[str] = Field(default_factory=list, max_length=30)
    tags: list[str] = Field(default_factory=list, max_length=30)
    features: list[str] = Field(default_factory=list, max_length=100)
    start_date: str = ""
    end_date: str = ""
    github_url: str = Field(default="", max_length=500)
    live_url: str = Field(default="", max_length=500)
    documentation: str = Field(default="", max_length=50000)
    architecture: str = Field(default="", max_length=20000)
    challenges: str = Field(default="", max_length=10000)
    solutions: str = Field(default="", max_length=10000)
    future_improvements: str = Field(default="", max_length=10000)
    screenshots: list[str] = Field(default_factory=list, max_length=12)
    logo_url: str = Field(default="", max_length=500)
    _dates = field_validator("start_date", "end_date")(valid_date)
    _urls = field_validator("github_url", "live_url", "logo_url")(valid_url)
    @field_validator("screenshots")
    @classmethod
    def images(cls, values):
        from .services.images import INTERNAL_IMAGE
        return [v if INTERNAL_IMAGE.fullmatch(v) else valid_url(v) for v in values]
    @field_validator("technologies", "tags", "features")
    @classmethod
    def list_text(cls, values):
        if any(len(v) > 500 for v in values):
            raise ValueError("List items must be shorter than 500 characters.")
        return values
    @model_validator(mode="after")
    def date_order(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("End date must follow start date.")
        return self

class ChecklistItem(Input):
    title: str = Field(min_length=1, max_length=300)
    done: bool = False

class TaskInput(Input):
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(default="", max_length=10000)
    project_id: str | None = None
    status: Literal["TODO", "IN_PROGRESS", "REVIEW", "COMPLETED"] = "TODO"
    priority: Literal["LOW", "MEDIUM", "HIGH", "URGENT"] = "MEDIUM"
    due_date: str = ""
    progress: int = Field(default=0, ge=0, le=100)
    tags: list[str] = Field(default_factory=list, max_length=30)
    subtasks: list[ChecklistItem] = Field(default_factory=list, max_length=100)
    _date = field_validator("due_date")(valid_date)

class CommentInput(Input):
    content: str = Field(min_length=1, max_length=2000)

class NoteInput(Input):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(default="", max_length=100000)
    category: str = Field(default="Personal", max_length=80)
    tags: list[str] = Field(default_factory=list, max_length=30)
    pinned: bool = False
    favorite: bool = False
    archived: bool = False

class GoalInput(Input):
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(default="", max_length=10000)
    deadline: str = ""
    priority: Literal["LOW", "MEDIUM", "HIGH", "URGENT"] = "MEDIUM"
    progress: int = Field(default=0, ge=0, le=100)
    milestones: list[ChecklistItem] = Field(default_factory=list, max_length=100)
    _date = field_validator("deadline")(valid_date)

class ProfileInput(Input):
    full_name: str = Field(min_length=2, max_length=100)
    bio: str = Field(default="", max_length=3000)
    title: str = Field(default="", max_length=150)
    location: str = Field(default="", max_length=100)

class PreferencesInput(Input):
    workspace_name: str = Field(default="", max_length=80)
    workspace_accent: Literal["gold", "blue", "violet", "green"] = "gold"
    email_notifications: bool = True
    message_notifications: bool = True
    reduced_motion: bool = False
    compact_sidebar: bool = False
    theme: Literal["dark", "light"] = "dark"

class MessageInput(Input):
    content: str = Field(default="", max_length=5000)
    attachment_id: str | None = None
    @model_validator(mode="after")
    def not_empty(self):
        if not self.content.strip() and not self.attachment_id:
            raise ValueError("Enter a message or attach an image.")
        return self

class ConversationInput(Input):
    user_id: str = Field(min_length=36, max_length=36)

class LearningInput(Input):
    topic: str = Field(min_length=2, max_length=150)
    minutes: int = Field(ge=1, le=1440)

class ContactInput(Input):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    message: str = Field(min_length=10, max_length=5000)

class AssistantInput(Input):
    kind: Literal["note", "project", "report"]
    text: str = Field(min_length=10, max_length=12000)

class PortfolioInput(Input):
    name: str = Field(min_length=2, max_length=100)
    title: str = Field(min_length=2, max_length=150)
    bio: str = Field(max_length=5000)
    location: str = Field(default="", max_length=100)
    email: str = ""
    github_url: str = Field(default="", max_length=500)
    linkedin_url: str = Field(default="", max_length=500)
    skills: list[str] = Field(default_factory=list, max_length=50)
    journey: list[dict[str, str]] = Field(default_factory=list, max_length=30)
    achievements: list[str] = Field(default_factory=list, max_length=30)
    vision: str = Field(default="", max_length=5000)
    _urls = field_validator("github_url", "linkedin_url")(valid_url)
    @field_validator("email")
    @classmethod
    def contact_email(cls, value):
        if value:
            from pydantic import TypeAdapter
            return str(TypeAdapter(EmailStr).validate_python(value))
        return value

