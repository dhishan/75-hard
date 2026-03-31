from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException
from app.auth.firebase import verify_token
from app.db.firestore import get_db
from app.models.daily_log import DailyLog, DailyLogUpsert, TaskCompletion
from app.models.user_program import UserProgram
from app.models.program import TaskDefinition, TaskType
from app.services.points import calc_task_points, calc_shields
from app.services.penalty import apply_to_user_program

router = APIRouter(prefix="/api/v1/user-programs", tags=["daily-logs"])


def _get_up_or_403(db, up_id: str, user_uid: str) -> UserProgram:
    doc = db.collection("userPrograms").document(up_id).get()
    if not doc.exists:
        raise HTTPException(404, "UserProgram not found")
    up = UserProgram(**doc.to_dict())
    if up.user_uid != user_uid:
        raise HTTPException(403)
    return up


@router.get("/{up_id}/logs/{log_date}", response_model=DailyLog)
async def get_log(up_id: str, log_date: date, user=Depends(verify_token)):
    db = get_db()
    _get_up_or_403(db, up_id, user["uid"])
    doc = (
        db.collection("userPrograms").document(up_id)
        .collection("dailyLogs").document(str(log_date)).get()
    )
    if not doc.exists:
        return DailyLog(user_program_id=up_id, date=log_date)
    return DailyLog(**doc.to_dict())


@router.put("/{up_id}/logs/{log_date}", response_model=DailyLog)
async def upsert_log(up_id: str, log_date: date, body: DailyLogUpsert, user=Depends(verify_token)):
    db = get_db()
    up = _get_up_or_403(db, up_id, user["uid"])

    # Load task definitions from program snapshot
    snapshot_tasks = up.program_snapshot.get("tasks", [])
    task_map: dict[str, TaskDefinition] = {
        t["id"]: TaskDefinition(**t) for t in snapshot_tasks
    }

    # Calculate points per task
    enriched: list[TaskCompletion] = []
    total_points = 0
    for tc in body.task_completions:
        task = task_map.get(tc.task_id)
        if task:
            tc = calc_task_points(task, tc)
        total_points += tc.points_earned
        enriched.append(tc)

    # Determine completeness: all required tasks met
    required_ids = {tid for tid, t in task_map.items() if t.is_required}
    completed_ids = {tc.task_id for tc in enriched if tc.completed}
    is_complete = required_ids.issubset(completed_ids)

    # Penalty processing
    penalty_applied = 0
    if not is_complete:
        missed = list(required_ids - completed_ids)
        up, event = apply_to_user_program(up, missed_task_ids=missed, log_date=log_date)
        penalty_applied = event.days_added
        up.total_points_earned += total_points
        up.shield_tokens_available = calc_shields(
            up.total_points_earned, up.program_snapshot.get("points_per_shield", 1500)
        )
        db.collection("userPrograms").document(up_id).set(up.model_dump(mode="json"))
    else:
        up_ref = db.collection("userPrograms").document(up_id)
        up.total_points_earned += total_points
        up.shield_tokens_available = calc_shields(
            up.total_points_earned, up.program_snapshot.get("points_per_shield", 1500)
        )
        up_ref.set(up.model_dump(mode="json"))

    log = DailyLog(
        user_program_id=up_id,
        date=log_date,
        is_complete=is_complete,
        penalty_applied=penalty_applied,
        task_completions=enriched,
        summary_points=total_points,
    )
    db.collection("userPrograms").document(up_id).collection("dailyLogs").document(str(log_date)).set(
        log.model_dump(mode="json")
    )
    return log


@router.get("/{up_id}/logs", response_model=list[DailyLog])
async def list_logs(up_id: str, user=Depends(verify_token)):
    db = get_db()
    _get_up_or_403(db, up_id, user["uid"])
    docs = db.collection("userPrograms").document(up_id).collection("dailyLogs").stream()
    return [DailyLog(**d.to_dict()) for d in docs]


@router.delete("/{up_id}/logs/{log_date}", status_code=204)
async def delete_log(up_id: str, log_date: date, user=Depends(verify_token)):
    db = get_db()
    _get_up_or_403(db, up_id, user["uid"])
    db.collection("userPrograms").document(up_id).collection("dailyLogs").document(str(log_date)).delete()
