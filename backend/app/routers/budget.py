from fastapi import APIRouter, Depends, HTTPException
from app.auth.firebase import verify_token
from app.db.firestore import get_db
from app.models.budget import BudgetState
from app.models.user_program import UserProgram

router = APIRouter(prefix="/api/v1/user-programs", tags=["budget"])


@router.get("/{up_id}/budget/{task_id}", response_model=BudgetState)
async def get_budget(up_id: str, task_id: str, user=Depends(verify_token)):
    db = get_db()
    doc = db.collection("userPrograms").document(up_id).get()
    if not doc.exists:
        raise HTTPException(404)
    up = UserProgram(**doc.to_dict())
    if up.user_uid != user["uid"]:
        raise HTTPException(403)

    budget_id = f"{up_id}_{task_id}"
    bdoc = db.collection("budgetStates").document(budget_id).get()
    if not bdoc.exists:
        tasks = up.program_snapshot.get("tasks", [])
        task = next((t for t in tasks if t["id"] == task_id), None)
        if not task:
            raise HTTPException(404, "Task not found in snapshot")
        return BudgetState(
            user_program_id=up_id,
            task_id=task_id,
            total_budget=task.get("total_budget", 0),
        )
    return BudgetState(**bdoc.to_dict())
