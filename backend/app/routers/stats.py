from datetime import date
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException
from app.auth.firebase import verify_token
from app.db.firestore import get_db
from app.models.user_program import UserProgram
from app.models.daily_log import DailyLog

router = APIRouter(prefix="/api/v1/user-programs", tags=["stats"])


def _get_up(db, up_id: str, user_uid: str) -> UserProgram:
    doc = db.collection("userPrograms").document(up_id).get()
    if not doc.exists:
        raise HTTPException(404)
    up = UserProgram(**doc.to_dict())
    if up.user_uid != user_uid:
        raise HTTPException(403)
    return up


def _get_logs(db, up_id: str) -> list[DailyLog]:
    docs = db.collection("userPrograms").document(up_id).collection("dailyLogs").stream()
    return sorted([DailyLog(**d.to_dict()) for d in docs], key=lambda l: l.date)


@router.get("/{up_id}/summary")
async def summary(up_id: str, user=Depends(verify_token)):
    db = get_db()
    up = _get_up(db, up_id, user["uid"])
    logs = _get_logs(db, up_id)
    complete_days = sum(1 for l in logs if l.is_complete)
    total_logged = len(logs)
    return {
        "current_day": up.current_day,
        "total_days_required": up.total_days_required,
        "days_remaining": up.total_days_required - up.current_day + 1,
        "complete_days": complete_days,
        "total_logged": total_logged,
        "compliance_pct": round(complete_days / total_logged * 100, 1) if total_logged else 0,
        "total_points_earned": up.total_points_earned,
        "shield_tokens_available": up.shield_tokens_available,
        "shields_used": up.shields_used,
        "failure_count": up.failure_count,
        "status": up.status,
    }


@router.get("/{up_id}/stats/heatmap")
async def heatmap(up_id: str, user=Depends(verify_token)):
    db = get_db()
    _get_up(db, up_id, user["uid"])
    logs = _get_logs(db, up_id)
    return [
        {
            "date": str(l.date),
            "is_complete": l.is_complete,
            "summary_points": l.summary_points,
            "task_count": len(l.task_completions),
            "completed_count": sum(1 for tc in l.task_completions if tc.completed),
        }
        for l in logs
    ]


@router.get("/{up_id}/stats/streaks")
async def streaks(up_id: str, user=Depends(verify_token)):
    db = get_db()
    _get_up(db, up_id, user["uid"])
    logs = _get_logs(db, up_id)

    current_streak = 0
    best_streak = 0
    streak_history = []

    for log in logs:
        if log.is_complete:
            current_streak += 1
            best_streak = max(best_streak, current_streak)
        else:
            if current_streak > 0:
                streak_history.append(current_streak)
            current_streak = 0

    return {
        "current_streak": current_streak,
        "best_streak": best_streak,
        "streak_history": streak_history + ([current_streak] if current_streak > 0 else []),
    }


@router.get("/{up_id}/stats/task-rates")
async def task_rates(up_id: str, user=Depends(verify_token)):
    db = get_db()
    up = _get_up(db, up_id, user["uid"])
    logs = _get_logs(db, up_id)

    counts: dict[str, dict] = defaultdict(lambda: {"completed": 0, "total": 0, "name": ""})
    task_names = {t["id"]: t["name"] for t in up.program_snapshot.get("tasks", [])}

    for log in logs:
        for tc in log.task_completions:
            counts[tc.task_id]["total"] += 1
            counts[tc.task_id]["name"] = task_names.get(tc.task_id, tc.task_id)
            if tc.completed:
                counts[tc.task_id]["completed"] += 1

    return [
        {
            "task_id": tid,
            "name": data["name"],
            "completion_rate": round(data["completed"] / data["total"] * 100, 1) if data["total"] else 0,
            "completed": data["completed"],
            "total": data["total"],
        }
        for tid, data in counts.items()
    ]


@router.get("/{up_id}/stats/points")
async def points_over_time(up_id: str, user=Depends(verify_token)):
    db = get_db()
    _get_up(db, up_id, user["uid"])
    logs = _get_logs(db, up_id)

    cumulative = 0
    result = []
    for log in logs:
        cumulative += log.summary_points
        result.append({"date": str(log.date), "daily_points": log.summary_points, "cumulative_points": cumulative})
    return result


@router.get("/{up_id}/stats/weight")
async def weight_trend(up_id: str, user=Depends(verify_token)):
    db = get_db()
    up = _get_up(db, up_id, user["uid"])
    logs = _get_logs(db, up_id)

    weight_task_id = next(
        (t["id"] for t in up.program_snapshot.get("tasks", []) if t.get("unit") in ("kg", "lbs")),
        None
    )
    if not weight_task_id:
        return []

    return [
        {"date": str(log.date), "weight": tc.logged_value, "unit": tc.logged_unit}
        for log in logs
        for tc in log.task_completions
        if tc.task_id == weight_task_id and tc.logged_value is not None
    ]


@router.get("/{up_id}/penalty-log")
async def penalty_log(up_id: str, user=Depends(verify_token)):
    db = get_db()
    up = _get_up(db, up_id, user["uid"])
    return up.penalty_log
