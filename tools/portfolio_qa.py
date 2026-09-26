"""Disposable fixture and persistence checks for the local portfolio editor UI."""
import json
import re
import secrets
import sys
from pathlib import Path
import httpx
from PIL import Image, ImageDraw
from sqlalchemy import delete, select
from jose import jwt

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "Backend"))
from app.core.config import ROOT
from app.core.database import SessionLocal
from app.models import Activity, Project, Session
from app.services.images import remove_project_images

STATE = ROOT / "storage" / "portfolio-qa.json"
BASE = "http://127.0.0.1:4000"


def prepare():
    if STATE.exists():
        raise RuntimeError("Clean up the previous portfolio QA fixture first.")
    nonce = secrets.token_hex(8)
    image_path = ROOT / "storage" / ("portfolio-qa-" + nonce + ".png")
    image = Image.new("RGB", (960, 540), "#101620")
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((80, 65, 880, 475), radius=30, fill="#182533", outline="#d6b26b", width=4)
    draw.text((135, 130), "PORTFOLIO EDITOR / DISPOSABLE QA", fill="#d6b26b", font_size=28)
    draw.text((135, 200), "Angular + FastAPI", fill="white", font_size=46)
    draw.text((135, 310), "Images, project details, and a live demo", fill="#a0b0c2", font_size=25)
    image.save(image_path)
    state = {"slug": "portfolio-qa-" + nonce, "name": "Portfolio editor QA " + nonce,
             "image_path": str(image_path), "sessions": []}
    STATE.write_text(json.dumps(state), encoding="utf-8")
    print(json.dumps({key: state[key] for key in ("slug", "name", "image_path")}))


def verify(stage):
    state = json.loads(STATE.read_text(encoding="utf-8"))
    credentials = (ROOT / "storage" / "owner-credentials.txt").read_text(encoding="utf-8")
    email = re.search(r"^Email: (.+)$", credentials, re.M)[1].strip()
    password = re.search(r"^Password: (.+)$", credentials, re.M)[1].strip()
    with httpx.Client(base_url=BASE, headers={"Origin": BASE}, timeout=30) as client:
        login = client.post("/api/auth/login", json={"email": email, "password": password})
        login.raise_for_status()
        token = login.json()["access_token"]
        state["sessions"].append(jwt.get_unverified_claims(token)["sid"])
        STATE.write_text(json.dumps(state), encoding="utf-8")
        client.headers["Authorization"] = "Bearer " + token
        response = client.get("/api/portfolio/projects", params={"q": state["name"], "limit": 100})
        response.raise_for_status()
        projects = [p for p in response.json()["items"] if p["slug"] in (state["slug"], state["slug"] + "-updated")]
        assert len(projects) == 1, "The UI should create one portfolio project."
        project = projects[0]
        assert project["is_portfolio"] and project["screenshots"]
        assert project["live_url"] == "https://example.com/portfolio-demo"
        assert project["github_url"] == "https://example.com/portfolio-source"
        if stage != "created":
            assert project["slug"] == state["slug"] + "-updated"
            expected_description = "Updated directly from the landing page project manager." if stage == "landing-updated" else "Updated from the public portfolio detail page."
            assert project["description"] == expected_description
        with SessionLocal() as db:
            stored = db.get(Project, project["id"])
            assert stored.name == project["name"] and stored.description == project["description"]
            assert stored.screenshots == project["screenshots"]
        with httpx.Client(base_url=BASE, timeout=30) as visitor:
            public = visitor.get("/api/public/projects/" + project["slug"])
            if stage == "draft":
                assert not project["is_public"] and public.status_code == 404
                assert visitor.get(project["screenshots"][0]).status_code == 401
            else:
                assert project["is_public"] and public.status_code == 200
                assert public.json()["description"] == project["description"]
                assert visitor.get(project["screenshots"][0]).status_code == 200
        print(json.dumps({"stage": stage, "id": project["id"], "slug": project["slug"],
                          "published": project["is_public"], "image_count": len(project["screenshots"]),
                          "database_persistence": "passed", "visitor_access": "passed"}))


def cleanup():
    if not STATE.exists():
        return
    state = json.loads(STATE.read_text(encoding="utf-8"))
    with SessionLocal() as db:
        projects = db.scalars(select(Project).where(Project.slug.in_([state["slug"], state["slug"] + "-updated"]))).all()
        for project in projects:
            assert project.name.startswith(state["name"])
            remove_project_images(project)
            db.execute(delete(Activity).where(Activity.resource_type == "project", Activity.resource_id == project.id))
            db.delete(project)
        for session_id in state["sessions"]:
            session = db.get(Session, session_id)
            if session:
                session.revoked = True
        db.commit()
    image_path = Path(state["image_path"]).resolve()
    assert image_path.parent == (ROOT / "storage").resolve() and image_path.name.startswith("portfolio-qa-")
    image_path.unlink(missing_ok=True)
    STATE.unlink()
    print("Removed only this run's disposable portfolio project, image, activity, and test sessions.")


if __name__ == "__main__":
    command = sys.argv[1]
    if command == "prepare":
        prepare()
    elif command == "cleanup":
        cleanup()
    else:
        verify(command)
