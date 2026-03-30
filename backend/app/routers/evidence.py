import uuid
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth.firebase import verify_token
from app.db.firestore import get_db
from app.models.daily_log import DailyLog, Evidence
from app.models.user_program import UserProgram
from app.services.storage import generate_upload_url, generate_download_url
from app.config import settings

router = APIRouter(prefix="/api/v1/user-programs", tags=["evidence"])


class EvidenceRequest(BaseModel):
    task_id: str
    type: str  # "photo" | "note"
    content_type: str = "image/jpeg"
    caption: str | None = None


class EvidenceResponse(BaseModel):
    evidence_id: str
    upload_url: str | None = None
    evidence: Evidence


@router.post("/{up_id}/logs/{log_date}/evidence", response_model=EvidenceResponse, status_code=201)
async def create_evidence(
    up_id: str, log_date: date, body: EvidenceRequest, user=Depends(verify_token)
):
    db = get_db()
    doc = db.collection("userPrograms").document(up_id).get()
    if not doc.exists or UserProgram(**doc.to_dict()).user_uid != user["uid"]:
        raise HTTPException(403)

    evidence_id = str(uuid.uuid4())
    object_path = f"{up_id}/{log_date}/{body.task_id}/{evidence_id}"
    upload_url = None
    url = None

    if body.type == "photo":
        upload_url = generate_upload_url(settings.gcs_bucket_evidence, object_path, body.content_type)
        url = generate_download_url(settings.gcs_bucket_evidence, object_path)

    evidence = Evidence(
        id=evidence_id,
        type=body.type,
        url=url,
        caption=body.caption,
        created_at=datetime.utcnow(),
    )

    # Persist to log sub-collection if log exists
    log_ref = db.collection("userPrograms").document(up_id).collection("dailyLogs").document(str(log_date))
    log_doc = log_ref.get()
    if log_doc.exists:
        log = DailyLog(**log_doc.to_dict())
        for tc in log.task_completions:
            if tc.task_id == body.task_id:
                tc.evidence.append(evidence)
                break
        log_ref.set(log.model_dump(mode="json"))

    return EvidenceResponse(evidence_id=evidence_id, upload_url=upload_url, evidence=evidence)


@router.delete("/{up_id}/logs/{log_date}/evidence/{evidence_id}", status_code=204)
async def delete_evidence(up_id: str, log_date: date, evidence_id: str, user=Depends(verify_token)):
    db = get_db()
    doc = db.collection("userPrograms").document(up_id).get()
    if not doc.exists or UserProgram(**doc.to_dict()).user_uid != user["uid"]:
        raise HTTPException(403)
    # Evidence object path stored in log — soft delete is acceptable here
    # Full delete would require re-fetching log and removing from task_completions
    log_ref = db.collection("userPrograms").document(up_id).collection("dailyLogs").document(str(log_date))
    log_doc = log_ref.get()
    if log_doc.exists:
        log = DailyLog(**log_doc.to_dict())
        for tc in log.task_completions:
            tc.evidence = [e for e in tc.evidence if e.id != evidence_id]
        log_ref.set(log.model_dump(mode="json"))
