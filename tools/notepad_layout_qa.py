"""Verify and remove only the disposable note written through the browser."""
import json
import re
import sys
from pathlib import Path
from sqlalchemy import delete, select

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "Backend"))
from app.core.config import ROOT
from app.core.database import SessionLocal
from app.models import Activity, Note, User

state_path = ROOT / "storage" / "notepad-layout-qa.json"
state = json.loads(state_path.read_text(encoding="utf-8"))
assert re.fullmatch(r"Notepad layout QA \d{13}", state["title"])
with SessionLocal() as db:
    notes = db.scalars(select(Note).where(Note.title == state["title"])).all()
    assert len(notes) <= 1, "The editor created duplicate notes."
    if sys.argv[1] == "verify":
        assert len(notes) == 1
        note = notes[0]
        assert db.get(User, note.owner_id).role == "OWNER"
        assert note.content == "Disposable UI check: inline writing, autosave and viewport layout."
        state["id"] = note.id
        state_path.write_text(json.dumps(state), encoding="utf-8")
        print(json.dumps({"note_count": 1, "database_persistence": "passed",
                          "pinned": note.pinned, "favorite": note.favorite, "archived": note.archived}))
    elif sys.argv[1] == "cleanup":
        for note in notes:
            assert note.id == state["id"]
            db.delete(note)
        db.execute(delete(Activity).where(Activity.resource_type == "note", Activity.resource_id == state["id"]))
        db.commit()
        state_path.unlink()
        print("Removed only this run's disposable note and its activity records.")
    else:
        raise ValueError("Expected verify or cleanup.")
