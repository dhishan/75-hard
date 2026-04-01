import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from app.auth.firebase import verify_token
from app.db.firestore import get_db
from app.models.program import Program, ProgramCreate, ProgramWithTasks, TaskDefinition, TaskDefinitionCreate, TaskPatch

router = APIRouter(prefix="/api/v1/programs", tags=["programs"])


@router.post("", response_model=Program, status_code=201)
async def create_program(body: ProgramCreate, user=Depends(verify_token)):
    db = get_db()
    doc_id = str(uuid.uuid4())
    now = datetime.utcnow()
    program = Program(
        id=doc_id,
        owner_uid=user["uid"],
        created_at=now,
        updated_at=now,
        **body.model_dump(),
    )
    db.collection("programs").document(doc_id).set(program.model_dump(mode="json"))
    return program


@router.get("", response_model=list[Program])
async def list_programs(user=Depends(verify_token)):
    db = get_db()
    docs = (
        db.collection("programs")
        .where("owner_uid", "==", user["uid"])
        .stream()
    )
    return [Program(**d.to_dict()) for d in docs]


@router.get("/{program_id}", response_model=ProgramWithTasks)
async def get_program(program_id: str, user=Depends(verify_token)):
    db = get_db()
    doc = db.collection("programs").document(program_id).get()
    if not doc.exists:
        raise HTTPException(404, "Program not found")
    program = ProgramWithTasks(**doc.to_dict())
    if program.owner_uid != user["uid"] and not program.is_template:
        raise HTTPException(403, "Forbidden")
    tasks = [
        TaskDefinition(**t.to_dict())
        for t in db.collection("programs").document(program_id).collection("tasks").stream()
    ]
    tasks.sort(key=lambda t: t.order)
    program.tasks = tasks
    return program


@router.put("/{program_id}", response_model=Program)
async def update_program(program_id: str, body: ProgramCreate, user=Depends(verify_token)):
    db = get_db()
    ref = db.collection("programs").document(program_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(404, "Program not found")
    existing = Program(**doc.to_dict())
    if existing.owner_uid != user["uid"]:
        raise HTTPException(403, "Forbidden")
    updated = existing.model_copy(update={**body.model_dump(), "updated_at": datetime.utcnow()})
    ref.set(updated.model_dump(mode="json"))
    return updated


@router.delete("/{program_id}", status_code=204)
async def delete_program(program_id: str, user=Depends(verify_token)):
    db = get_db()
    doc = db.collection("programs").document(program_id).get()
    if not doc.exists:
        raise HTTPException(404, "Program not found")
    if Program(**doc.to_dict()).owner_uid != user["uid"]:
        raise HTTPException(403, "Forbidden")
    db.collection("programs").document(program_id).delete()


@router.post("/{program_id}/tasks", response_model=TaskDefinition, status_code=201)
async def add_task(program_id: str, body: TaskDefinitionCreate, user=Depends(verify_token)):
    db = get_db()
    doc = db.collection("programs").document(program_id).get()
    if not doc.exists:
        raise HTTPException(404, "Program not found")
    if Program(**doc.to_dict()).owner_uid != user["uid"]:
        raise HTTPException(403, "Forbidden")
    task_id = str(uuid.uuid4())
    task = TaskDefinition(
        id=task_id,
        program_id=program_id,
        **body.model_dump(),
    )
    db.collection("programs").document(program_id).collection("tasks").document(task_id).set(
        task.model_dump(mode="json")
    )
    return task


@router.patch("/{program_id}/tasks/{task_id}", response_model=TaskDefinition)
async def update_task(program_id: str, task_id: str, body: TaskPatch, user=Depends(verify_token)):
    db = get_db()
    prog_doc = db.collection("programs").document(program_id).get()
    if not prog_doc.exists:
        raise HTTPException(404, "Program not found")
    if Program(**prog_doc.to_dict()).owner_uid != user["uid"]:
        raise HTTPException(403, "Forbidden")
    task_ref = db.collection("programs").document(program_id).collection("tasks").document(task_id)
    task_doc = task_ref.get()
    if not task_doc.exists:
        raise HTTPException(404, "Task not found")
    task = TaskDefinition(**task_doc.to_dict())
    updates = body.model_dump(exclude_none=True)
    if updates:
        task_ref.update(updates)
    return task.model_copy(update=updates)


@router.delete("/{program_id}/tasks/{task_id}", status_code=204)
async def delete_task(program_id: str, task_id: str, user=Depends(verify_token)):
    db = get_db()
    doc = db.collection("programs").document(program_id).get()
    if not doc.exists:
        raise HTTPException(404)
    if Program(**doc.to_dict()).owner_uid != user["uid"]:
        raise HTTPException(403)
    db.collection("programs").document(program_id).collection("tasks").document(task_id).delete()
