import uuid
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth.firebase import verify_token
from app.db.firestore import get_db
from app.models.user_program import UserProgram, UserProgramCreate


class UserProgramStatusUpdate(BaseModel):
    status: str

router = APIRouter(prefix="/api/v1/user-programs", tags=["user-programs"])


def _build_snapshot(db, program_id: str) -> dict:
    prog_doc = db.collection("programs").document(program_id).get()
    if not prog_doc.exists:
        raise HTTPException(404, "Program not found")
    prog = prog_doc.to_dict()
    tasks = [t.to_dict() for t in db.collection("programs").document(program_id).collection("tasks").stream()]
    prog["tasks"] = tasks
    return prog


@router.post("", response_model=UserProgram, status_code=201)
async def start_program(body: UserProgramCreate, user=Depends(verify_token)):
    db = get_db()
    snapshot = _build_snapshot(db, body.program_id)
    up_id = str(uuid.uuid4())
    now = datetime.utcnow()
    duration = snapshot.get("duration_days", 75)
    up = UserProgram(
        id=up_id,
        user_uid=user["uid"],
        program_id=body.program_id,
        program_snapshot=snapshot,
        start_date=body.start_date,
        base_days=duration,
        total_days_required=duration,
        current_day=1,
        created_at=now,
        updated_at=now,
    )
    db.collection("userPrograms").document(up_id).set(up.model_dump(mode="json"))
    return up


@router.get("", response_model=list[UserProgram])
async def list_user_programs(user=Depends(verify_token)):
    db = get_db()
    docs = db.collection("userPrograms").where("user_uid", "==", user["uid"]).stream()
    return [UserProgram(**d.to_dict()) for d in docs]


@router.get("/{up_id}", response_model=UserProgram)
async def get_user_program(up_id: str, user=Depends(verify_token)):
    db = get_db()
    doc = db.collection("userPrograms").document(up_id).get()
    if not doc.exists:
        raise HTTPException(404, "Not found")
    up = UserProgram(**doc.to_dict())
    if up.user_uid != user["uid"]:
        raise HTTPException(403)
    return up


@router.patch("/{up_id}", response_model=UserProgram)
async def update_status(up_id: str, body: UserProgramStatusUpdate, user=Depends(verify_token)):
    db = get_db()
    ref = db.collection("userPrograms").document(up_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(404)
    up = UserProgram(**doc.to_dict())
    if up.user_uid != user["uid"]:
        raise HTTPException(403)
    updates = {"status": body.status, "updated_at": datetime.utcnow().isoformat()}
    ref.update(updates)
    updated_doc = ref.get()
    return UserProgram(**updated_doc.to_dict())


@router.delete("/{up_id}", status_code=204)
async def delete_user_program(up_id: str, user=Depends(verify_token)):
    db = get_db()
    ref = db.collection("userPrograms").document(up_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(404)
    if UserProgram(**doc.to_dict()).user_uid != user["uid"]:
        raise HTTPException(403)
    # Delete all sub-collections (dailyLogs)
    logs = ref.collection("dailyLogs").stream()
    for log in logs:
        log.reference.delete()
    ref.delete()
