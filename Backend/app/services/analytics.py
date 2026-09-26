from collections import Counter
from datetime import datetime, timedelta
from sqlalchemy import select
from ..models import Project, Task, Note, Goal, Activity, LearningEntry, now
from ..repositories.resources import view

def report(db, user, days=180):
    projects = db.scalars(select(Project).where(Project.owner_id == user.id)).all()
    tasks = db.scalars(select(Task).where(Task.owner_id == user.id)).all()
    goals = db.scalars(select(Goal).where(Goal.owner_id == user.id)).all()
    notes = db.scalars(select(Note).where(Note.owner_id == user.id)).all()
    activity = db.scalars(select(Activity).where(Activity.owner_id == user.id, Activity.created_at >= now()-timedelta(days=days))
        .order_by(Activity.created_at.desc())).all()
    learning = db.scalars(select(LearningEntry).where(LearningEntry.owner_id == user.id,
        LearningEntry.created_at >= now()-timedelta(days=days))).all()
    tech = Counter(t for p in projects for t in p.technologies)
    months = []
    year, month = now().year, now().month
    month_count = min(24, max(1, (days + 29) // 30))
    for offset in range(month_count - 1, -1, -1):
        absolute = year*12 + month-1-offset
        stamp = f"{absolute//12:04d}-{absolute%12+1:02d}"
        months.append({"month": stamp, "label": datetime(absolute//12,absolute%12+1,1).strftime("%b"),
            "projects": sum(p.created_at.strftime("%Y-%m")==stamp for p in projects),
            "activity": sum(a.created_at.strftime("%Y-%m")==stamp for a in activity),
            "learning_minutes": sum(e.minutes for e in learning if e.created_at.strftime("%Y-%m")==stamp),
            "completed_tasks": sum(t.status=="COMPLETED" and t.updated_at.strftime("%Y-%m")==stamp for t in tasks)})
    return {"kpis": {"total_projects": len(projects), "completed_projects": sum(p.status=="COMPLETED" for p in projects),
        "active_projects": sum(p.status=="IN_PROGRESS" for p in projects),
        "planned_projects": sum(p.status=="PLANNED" for p in projects), "technologies": len(tech),
        "total_tasks": len(tasks), "completed_tasks": sum(t.status=="COMPLETED" for t in tasks),
        "notes": len(notes), "total_goals": len(goals), "completed_goals": sum(g.progress==100 for g in goals),
        "learning_hours": round(sum(e.minutes for e in learning)/60,1),
        "project_progress": round(sum(p.progress for p in projects)/len(projects)) if projects else 0},
        "monthly": months, "technologies": [{"name": k, "count": v} for k,v in tech.most_common()],
        "project_status": dict(Counter(p.status for p in projects)), "task_status": dict(Counter(t.status for t in tasks)),
        "goal_progress": [{"name": g.title, "progress": g.progress} for g in goals],
        "recent_projects": [view(p) for p in sorted(projects, key=lambda p:p.updated_at, reverse=True)[:4]],
        "activity": [view(a) for a in activity[:15]], "days": days, "generated_at": now().isoformat()+"Z"}
