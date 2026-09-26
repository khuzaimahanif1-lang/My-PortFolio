import csv
import io
from fastapi import APIRouter, Depends, Query, Response
from ..dependencies import current_user
from ..core.database import get_db
from ..services.analytics import report
router = APIRouter(tags=["Analytics"])
@router.get("/reports")
def reports(days: int = Query(180, ge=7, le=730), user=Depends(current_user), db=Depends(get_db)):
    return report(db, user, days)
@router.get("/reports/export")
def export(days: int = Query(180, ge=7, le=730), user=Depends(current_user), db=Depends(get_db)):
    data = report(db, user, days)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Metric", "Value"])
    writer.writerows(data["kpis"].items())
    writer.writerow([])
    writer.writerow(["Month", "Projects created", "Activity", "Learning minutes", "Completed tasks"])
    for month in data["monthly"]:
        writer.writerow([month["month"],month["projects"],month["activity"],month["learning_minutes"],month["completed_tasks"]])
    return Response(output.getvalue(), media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="king-ai-report.csv"'})

