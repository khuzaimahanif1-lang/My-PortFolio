"""Prepare and remove isolated records for chat-image and portfolio visual checks."""
import io
import json
import re
import secrets
import sys
from pathlib import Path

import httpx
from PIL import Image, ImageDraw

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "Backend"))
from app.core.config import ROOT
from app.core.database import SessionLocal
from app.models import Activity, Attachment, Conversation, Notification, Project, User
from sqlalchemy import delete, select

BASE = "http://127.0.0.1:4000"
STATE = ROOT / "storage" / "ui-content-qa.json"


def request(client, method, path, **kwargs):
    response = client.request(method, "/api/" + path, **kwargs)
    response.raise_for_status()
    return response


def owner_client():
    credentials = (ROOT / "storage" / "owner-credentials.txt").read_text(encoding="utf-8")
    email = re.search(r"^Email: (.+)$", credentials, re.M)[1].strip()
    password = re.search(r"^Password: (.+)$", credentials, re.M)[1].strip()
    client = httpx.Client(base_url=BASE, headers={"Origin": BASE}, timeout=30)
    response = request(client, "POST", "auth/login", json={"email": email, "password": password}).json()
    client.headers["Authorization"] = "Bearer " + response["access_token"]
    return client, response["user"]["id"]


def picture(label, color):
    image = Image.new("RGB", (180, 100), color)
    ImageDraw.Draw(image).text((15, 40), label, fill="white")
    output = io.BytesIO()
    image.save(output, "PNG")
    return output.getvalue()


def prepare():
    if STATE.exists():
        raise RuntimeError("A QA fixture already exists; clean it before preparing another.")
    nonce = secrets.token_hex(6)
    state = {"nonce": nonce, "email": "image-qa-" + nonce + "@example.com", "message_ids": [], "attachment_ids": []}

    def save():
        STATE.write_text(json.dumps(state, indent=2), encoding="utf-8")

    owner, owner_id = owner_client()
    state["owner_id"] = owner_id
    save()
    guest = httpx.Client(base_url=BASE, headers={"Origin": BASE}, timeout=30)
    try:
        password = secrets.token_urlsafe(18)
        response = request(guest, "POST", "auth/signup", json={"full_name": "Image layout QA " + nonce, "email": state["email"], "password": password, "confirm_password": password}).json()
        guest.headers["Authorization"] = "Bearer " + response["access_token"]
        state["guest_id"] = response["user"]["id"]
        state["guest_name"] = response["user"]["full_name"]
        save()
        state["conversation_id"] = request(owner, "POST", "conversations", json={"user_id": state["guest_id"]}).json()["id"]
        save()
        for client, label, color in [(owner, "Your first image", "#ad8134"), (guest, "Received image", "#356788"), (owner, "Your second image", "#8d672c")]:
            attachment = request(client, "POST", "uploads", data={"conversation_id": state["conversation_id"]}, files={"file": ("qa.png", picture(label, color), "image/png")}).json()
            state["attachment_ids"].append(attachment["id"])
            save()
            message = request(client, "POST", "conversations/" + state["conversation_id"] + "/messages", json={"attachment_id": attachment["id"]}).json()
            state["message_ids"].append(message["id"])
            save()
        for client in (owner, guest):
            messages = request(client, "GET", "conversations/" + state["conversation_id"] + "/messages").json()["items"]
            assert len(messages) == 3
            assert [message["sender_id"] for message in messages] == [owner_id, state["guest_id"], owner_id]
            assert len({message["attachment_id"] for message in messages}) == 3
            for message in messages:
                assert request(client, "GET", "uploads/" + message["attachment_id"]).headers["content-type"] == "image/webp"
        print("PASS: both users receive three separate images with the original sender IDs.")
        state["slug"] = "ui-content-qa-" + nonce
        project = request(owner, "POST", "projects", json={"name": "Portfolio image QA " + nonce, "slug": state["slug"], "short_description": "A temporary project used to verify public images, details and links.", "description": "Public project detail verification.", "live_url": BASE + "/projects/" + state["slug"], "github_url": "https://example.com/source", "is_public": True, "technologies": ["Angular", "Python"]}).json()
        state["project_id"] = project["id"]
        save()
        project = request(owner, "POST", "projects/" + project["id"] + "/screenshots", files={"file": ("cover.png", picture("Portfolio cover", "#785e39"), "image/png")}).json()
        state["cover_url"] = project["screenshots"][0]
        state["home_slug"] = state["slug"] + "-home"
        save()
        with httpx.Client(base_url=BASE, timeout=30) as visitor:
            public = request(visitor, "GET", "public/projects/" + state["slug"]).json()
            assert public["live_url"] == project["live_url"] and public["screenshots"] == project["screenshots"]
            assert visitor.get(state["cover_url"]).status_code == 200
        print("PASS: visitors can access the published project details, links and uploaded cover without signing in.")
        print("Prepared disposable visual QA records.")
    except Exception:
        owner.close()
        guest.close()
        cleanup()
        raise
    finally:
        owner.close()
        guest.close()


def cleanup():
    if not STATE.exists():
        print("No visual QA fixture to remove.")
        return
    state = json.loads(STATE.read_text(encoding="utf-8"))
    owner, owner_id = owner_client()
    assert owner_id == state["owner_id"]
    project_ids = []
    try:
        with SessionLocal() as db:
            projects = db.scalars(select(Project).where(Project.owner_id == owner_id, Project.slug.in_([state.get("slug", ""), state.get("home_slug", "")]))).all()
            for project in projects:
                assert project.slug.startswith("ui-content-qa-" + state["nonce"])
                project_ids.append(project.id)
        for project_id in project_ids:
            request(owner, "DELETE", "projects/" + project_id)
        with SessionLocal() as db:
            for attachment in db.scalars(select(Attachment).where(Attachment.id.in_(state["attachment_ids"]))):
                path = (ROOT / "storage" / "uploads" / attachment.filename).resolve()
                assert path.parent == (ROOT / "storage" / "uploads").resolve()
                path.unlink(missing_ok=True)
            if state.get("conversation_id"):
                db.execute(delete(Notification).where(Notification.link == "/workspace/messages?conversation=" + state["conversation_id"]))
                db.execute(delete(Conversation).where(Conversation.id == state["conversation_id"]))
            db.execute(delete(Activity).where(Activity.resource_id.in_(state["message_ids"] + project_ids)))
            db.execute(delete(User).where(User.email == state["email"]))
            db.commit()
        STATE.unlink()
        print("Removed only this run's disposable conversation, images, projects and account.")
    finally:
        owner.close()


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in ("prepare", "cleanup"):
        raise SystemExit("Usage: ui_content_qa.py prepare|cleanup")
    (prepare if sys.argv[1] == "prepare" else cleanup)()
