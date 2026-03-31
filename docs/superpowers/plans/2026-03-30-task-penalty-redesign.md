# Task & Penalty Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded default tasks with a fully user-defined task builder, add frequency support, overhaul points to optional-only, and add configurable penalty modes (exponential days or program reset) with real point deduction for shields.

**Architecture:** Backend model and service changes first (frequency field, penalty modes, points deduction), then frontend multi-step program creation form (blank task builder + penalty config step). Tests drive every backend change.

**Tech Stack:** FastAPI, Pydantic v2, Firestore, React 18, TypeScript, Tailwind CSS

---

## File Map (changed / new files only)

```
backend/
├── app/
│   ├── models/
│   │   ├── program.py          # + TaskCategory enum, + TaskFrequency enum, frequency field, penalty_mode on ProgramCreate
│   │   └── user_program.py     # PenaltyEvent gains reset_triggered field
│   ├── routers/
│   │   └── daily_logs.py       # frequency-aware completion check
│   └── services/
│       ├── penalty.py          # reset mode + shield point deduction
│       └── points.py           # required tasks earn 0 points, new calc_shields
└── tests/
    ├── test_models.py          # frequency + category enum validation
    ├── test_points.py          # required=0 tests, shield deduction tests
    ├── test_penalty.py         # reset mode tests, shield deduction tests
    └── test_daily_logs.py      # frequency-aware integration tests

frontend/
└── src/
    ├── types/index.ts          # + TaskFrequency, TaskCategory union types, frequency field, penalty_mode literal
    └── pages/Programs.tsx      # multi-step form: details → tasks → penalty config
```

---

## Task 1: Add `TaskCategory` enum and `TaskFrequency` enum to backend models

**Files:**
- Modify: `backend/app/models/program.py`
- Test: `backend/tests/test_models.py`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_models.py
from app.models.program import TaskDefinition, TaskDefinitionCreate, TaskCategory, TaskFrequency, TaskType


def test_task_category_enum_values():
    valid = ["health", "fitness", "nutrition", "mindset", "personal_development",
             "professional_development", "finance", "relationships", "creativity", "other"]
    for v in valid:
        assert TaskCategory(v) == v


def test_task_frequency_enum_values():
    for v in ["daily", "weekly", "monthly", "period"]:
        assert TaskFrequency(v) == v


def test_task_definition_accepts_frequency():
    t = TaskDefinition(
        id="t1", program_id="p1", name="Test", category="fitness",
        type=TaskType.boolean, frequency="weekly",
    )
    assert t.frequency == TaskFrequency.weekly


def test_task_definition_frequency_defaults_daily():
    t = TaskDefinition(
        id="t1", program_id="p1", name="Test", category="fitness",
        type=TaskType.boolean,
    )
    assert t.frequency == TaskFrequency.daily


def test_task_definition_create_accepts_frequency():
    t = TaskDefinitionCreate(name="Test", category="fitness", type=TaskType.boolean, frequency="monthly")
    assert t.frequency == TaskFrequency.monthly


def test_task_definition_category_enum():
    t = TaskDefinition(
        id="t1", program_id="p1", name="Test", category="personal_development",
        type=TaskType.boolean,
    )
    assert t.category == TaskCategory.personal_development


def test_task_definition_rejects_invalid_category():
    import pytest
    with pytest.raises(Exception):
        TaskDefinition(
            id="t1", program_id="p1", name="Test", category="invalid_cat",
            type=TaskType.boolean,
        )
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && pytest tests/test_models.py -x -v
```
Expected: FAIL — `TaskCategory`, `TaskFrequency` do not exist yet.

- [ ] **Step 3: Implement enums and update fields**

```python
# backend/app/models/program.py — add after TaskType enum

class TaskCategory(str, Enum):
    health = "health"
    fitness = "fitness"
    nutrition = "nutrition"
    mindset = "mindset"
    personal_development = "personal_development"
    professional_development = "professional_development"
    finance = "finance"
    relationships = "relationships"
    creativity = "creativity"
    other = "other"


class TaskFrequency(str, Enum):
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"
    period = "period"
```

On `TaskDefinition`:
- Change `category: str` → `category: TaskCategory`
- Add `frequency: TaskFrequency = TaskFrequency.daily`

On `TaskDefinitionCreate`:
- Change `category: str` → `category: TaskCategory`
- Add `frequency: TaskFrequency = TaskFrequency.daily`

On `ProgramCreate`:
- Add `penalty_mode: str = "exponential"`

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && pytest tests/test_models.py -x -v
```
Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/program.py backend/tests/test_models.py
git commit -m "feat: add TaskCategory, TaskFrequency enums and penalty_mode to ProgramCreate"
```

---

## Task 2: Points overhaul — required tasks earn zero points

**Files:**
- Modify: `backend/app/services/points.py`
- Test: `backend/tests/test_points.py`

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/test_points.py`:

```python
def test_required_task_earns_zero_points():
    """Required tasks must always return 0 points regardless of completion."""
    task = _task(TaskType.boolean, cp=100, bp=50, is_required=True)
    tc = TaskCompletion(task_id="t1", completed=True)
    result = calc_task_points(task, tc)
    assert result.points_earned == 0
    assert result.bonus_earned is False


def test_optional_task_earns_points():
    task = _task(TaskType.boolean, cp=100, bp=0, is_required=False)
    tc = TaskCompletion(task_id="t1", completed=True)
    result = calc_task_points(task, tc)
    assert result.points_earned == 100


def test_required_duration_task_earns_zero():
    task = _task(TaskType.duration, target=20, cp=100, bp=50, is_required=True)
    tc = TaskCompletion(task_id="t1", completed=True, logged_value=31)
    result = calc_task_points(task, tc)
    assert result.points_earned == 0
    assert result.bonus_earned is False


def test_optional_duration_task_earns_bonus():
    task = _task(TaskType.duration, target=20, cp=100, bp=50, is_required=False)
    tc = TaskCompletion(task_id="t1", completed=True, logged_value=31)
    result = calc_task_points(task, tc)
    assert result.points_earned == 150
    assert result.bonus_earned is True
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/test_points.py::test_required_task_earns_zero_points -x -v
```
Expected: FAIL — currently required tasks earn `completion_points`.

- [ ] **Step 3: Implement**

In `backend/app/services/points.py`, rewrite `calc_task_points`:

```python
def calc_task_points(task: TaskDefinition, tc: TaskCompletion) -> TaskCompletion:
    tc = tc.model_copy()

    # Required tasks never earn points — only determine completion status
    if task.is_required:
        tc.points_earned = 0
        tc.bonus_earned = False
        if task.type == TaskType.budget:
            logged = tc.logged_value or 0
            tc.completed = task.total_budget is not None and logged <= task.total_budget
        elif task.type == TaskType.boolean:
            pass  # tc.completed already set by caller
        elif task.target_value is not None:
            logged = tc.logged_value or 0
            tc.completed = logged >= task.target_value * task.min_completion_pct
        return tc

    # Optional tasks: existing logic below
    if task.type != TaskType.budget and not tc.completed and tc.logged_value is None:
        tc.points_earned = 0
        tc.bonus_earned = False
        return tc

    if task.type == TaskType.budget:
        logged = tc.logged_value or 0
        met = task.total_budget is not None and logged <= task.total_budget
        tc.completed = met
    elif task.type == TaskType.boolean:
        met = tc.completed
    elif task.target_value is not None:
        logged = tc.logged_value or 0
        met = logged >= task.target_value * task.min_completion_pct
        tc.completed = met
    else:
        met = tc.completed

    if not met:
        tc.points_earned = 0
        tc.bonus_earned = False
        return tc

    tc.points_earned = task.completion_points

    if task.target_value is not None and task.bonus_points > 0:
        threshold = task.target_value * task.bonus_threshold_pct
        logged = tc.logged_value or 0
        if logged >= threshold:
            tc.bonus_earned = True
            tc.points_earned += task.bonus_points

    return tc
```

Also update the `_task` helper default in `test_points.py` to `is_required=False` so existing tests still get points:

```python
def _task(type=TaskType.boolean, target=None, cp=100, bp=50, btp=1.5, is_required=False):
    ...
```

- [ ] **Step 4: Run all points tests**

```bash
cd backend && pytest tests/test_points.py -x -v
```
Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/points.py backend/tests/test_points.py
git commit -m "feat: required tasks earn 0 points, only optional tasks earn points"
```

---

## Task 3: Shield point deduction — new `calc_shields` signature

**Files:**
- Modify: `backend/app/services/points.py`
- Modify: `backend/app/routers/daily_logs.py`
- Test: `backend/tests/test_points.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_points.py`:

```python
def test_calc_shields_simple():
    """shields_available = floor(total_points / points_per_shield) — no shields_used param"""
    # New 2-arg signature
    assert calc_shields(3000, 1500) == 2
    assert calc_shields(1499, 1500) == 0
    assert calc_shields(0, 1500) == 0
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend && pytest tests/test_points.py::test_calc_shields_simple -x -v
```
Expected: FAIL — `calc_shields` currently takes 3 args.

- [ ] **Step 3: Implement**

In `backend/app/services/points.py`:

```python
def calc_shields(total_points: int, points_per_shield: int) -> int:
    """Return available shield tokens based on current total_points."""
    return math.floor(total_points / points_per_shield)
```

Update both call sites in `backend/app/routers/daily_logs.py` — remove the `shields_used` arg:

```python
up.shield_tokens_available = calc_shields(
    up.total_points_earned, up.program_snapshot.get("points_per_shield", 1500)
)
```

Update existing shield tests in `test_points.py`:

```python
def test_shields_calculation():
    assert calc_shields(total_points=3000, points_per_shield=1500) == 2
    assert calc_shields(total_points=1499, points_per_shield=1500) == 0

def test_shields_cannot_go_negative():
    assert calc_shields(total_points=0, points_per_shield=1500) == 0
```

- [ ] **Step 4: Run all points tests**

```bash
cd backend && pytest tests/test_points.py -x -v
```
Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/points.py backend/app/routers/daily_logs.py backend/tests/test_points.py
git commit -m "feat: calc_shields now uses direct point deduction model, drop shields_used param"
```

---

## Task 4: Penalty — reset mode + shield point deduction

**Files:**
- Modify: `backend/app/models/user_program.py`
- Modify: `backend/app/services/penalty.py`
- Test: `backend/tests/test_penalty.py`

- [ ] **Step 1: Write failing tests**

Add to `backend/tests/test_penalty.py`:

```python
def _make_up_with_mode(penalty_mode="exponential", failure_count=0, shield_tokens=0,
                       shields_used=0, total_days=75, base_days=75,
                       current_day=10, total_points=0, points_per_shield=1500):
    return UserProgram(
        id="up1", user_uid="u1", program_id="p1",
        program_snapshot={"penalty_mode": penalty_mode, "points_per_shield": points_per_shield},
        start_date=date(2026, 1, 1), base_days=base_days,
        total_days_required=total_days, current_day=current_day,
        failure_count=failure_count,
        shield_tokens_available=shield_tokens,
        shields_used=shields_used,
        total_points_earned=total_points,
    )


def test_reset_mode_resets_program():
    up = _make_up_with_mode(penalty_mode="reset", current_day=30, total_days=80, base_days=75)
    updated, event = apply_to_user_program(up, missed_task_ids=["t1"], log_date=date(2026, 1, 31))
    assert updated.current_day == 1
    assert updated.total_days_required == 75
    assert updated.failure_count == 1
    assert event.days_added == 0
    assert event.reset_triggered is True


def test_reset_mode_with_shield_no_reset():
    up = _make_up_with_mode(
        penalty_mode="reset", current_day=30, shield_tokens=1,
        total_points=3000, points_per_shield=1500,
    )
    updated, event = apply_to_user_program(up, missed_task_ids=["t1"], log_date=date(2026, 1, 31))
    assert updated.current_day == 30  # not reset
    assert event.shield_used is True
    assert event.reset_triggered is False
    assert updated.total_points_earned == 1500  # 3000 - 1500
    assert updated.shield_tokens_available == 1  # floor(1500/1500)
    assert updated.shields_used == 1


def test_exponential_mode_shield_deducts_points():
    up = _make_up_with_mode(
        penalty_mode="exponential", shield_tokens=1,
        total_points=3000, points_per_shield=1500,
    )
    updated, event = apply_to_user_program(up, missed_task_ids=["t1"], log_date=date(2026, 1, 2))
    assert event.shield_used is True
    assert updated.total_points_earned == 1500  # 3000 - 1500
    assert updated.shield_tokens_available == 1  # floor(1500/1500)
    assert updated.shields_used == 1


def test_exponential_mode_no_shield_adds_days():
    up = _make_up_with_mode(penalty_mode="exponential", failure_count=0, shield_tokens=0)
    updated, event = apply_to_user_program(up, missed_task_ids=["t1"], log_date=date(2026, 1, 2))
    assert event.days_added == 1
    assert updated.failure_count == 1
    assert updated.total_days_required == 76
    assert event.reset_triggered is False
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd backend && pytest tests/test_penalty.py -x -v
```
Expected: FAIL — `reset_triggered` field missing, `apply_to_user_program` doesn't read `penalty_mode`.

- [ ] **Step 3: Add `reset_triggered` to `PenaltyEvent`**

In `backend/app/models/user_program.py`:

```python
class PenaltyEvent(BaseModel):
    date: date
    failure_number: int
    days_added: int
    missed_task_ids: list[str]
    shield_used: bool = False
    reset_triggered: bool = False
```

- [ ] **Step 4: Rewrite `apply_to_user_program`**

```python
# backend/app/services/penalty.py
import math
from datetime import date
from app.models.user_program import UserProgram, PenaltyEvent


def compute_penalty(up: UserProgram, failure_number: int) -> int:
    """Return days to add for failure_number-th failure. Formula: 2^(N-1)."""
    return 2 ** (failure_number - 1)


def apply_to_user_program(
    up: UserProgram,
    missed_task_ids: list[str],
    log_date: date,
) -> tuple[UserProgram, PenaltyEvent]:
    up = up.model_copy(deep=True)
    failure_number = up.failure_count + 1
    penalty_mode = up.program_snapshot.get("penalty_mode", "exponential")
    points_per_shield = up.program_snapshot.get("points_per_shield", 1500)

    use_shield = up.shield_tokens_available > 0
    days_added = 0
    reset_triggered = False

    if use_shield:
        up.total_points_earned -= points_per_shield
        up.shields_used += 1
        up.shield_tokens_available = math.floor(up.total_points_earned / points_per_shield)
    else:
        if penalty_mode == "reset":
            up.current_day = 1
            up.total_days_required = up.base_days
            up.failure_count += 1
            reset_triggered = True
        else:  # exponential
            days_added = compute_penalty(up, failure_number)
            up.failure_count += 1
            up.total_days_required += days_added

    event = PenaltyEvent(
        date=log_date,
        failure_number=failure_number,
        days_added=days_added,
        missed_task_ids=missed_task_ids,
        shield_used=use_shield,
        reset_triggered=reset_triggered,
    )
    up.penalty_log.append(event)
    return up, event
```

- [ ] **Step 5: Fix existing penalty tests**

Update `_make_up` in `test_penalty.py` to include `program_snapshot`:

```python
def _make_up(failure_count=0, shield_tokens=0, shields_used=0, total_days=75):
    return UserProgram(
        id="up1", user_uid="u1", program_id="p1",
        program_snapshot={"penalty_mode": "exponential", "points_per_shield": 1500},
        start_date=date(2026, 1, 1), base_days=75,
        total_days_required=total_days, current_day=1,
        failure_count=failure_count,
        shield_tokens_available=shield_tokens,
        shields_used=shields_used,
        total_points_earned=1500 if shield_tokens > 0 else 0,
    )
```

Update `test_shield_absorbs_penalty`:

```python
def test_shield_absorbs_penalty():
    up = _make_up(failure_count=0, shield_tokens=1)
    up.total_points_earned = 1500
    updated, event = apply_to_user_program(
        up, missed_task_ids=["t1"], log_date=date(2026, 1, 2)
    )
    assert event.shield_used is True
    assert event.days_added == 0
    assert updated.total_days_required == 75
    assert updated.total_points_earned == 0
    assert updated.shield_tokens_available == 0
    assert updated.shields_used == 1
    assert updated.failure_count == 0
```

- [ ] **Step 6: Run all penalty tests**

```bash
cd backend && pytest tests/test_penalty.py -x -v
```
Expected: ALL PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/user_program.py backend/app/services/penalty.py backend/tests/test_penalty.py
git commit -m "feat: penalty reset mode, shield usage deducts points from total_points_earned"
```

---

## Task 5: Frequency-aware completion check in daily logs

**Files:**
- Modify: `backend/app/routers/daily_logs.py`
- Test: `backend/tests/test_daily_logs.py`

- [ ] **Step 1: Write failing test**

Add to `backend/tests/test_daily_logs.py`:

```python
def _make_up_with_frequency(frequency="daily", failure_count=0, shield_tokens=0):
    task_snap = {
        "id": "t1", "program_id": "p1", "name": "Workout", "category": "fitness",
        "type": "duration", "target_value": 20, "is_required": True,
        "completion_points": 0, "bonus_points": 0, "bonus_threshold_pct": 1.0,
        "min_completion_pct": 1.0, "times_per_day": 1, "order": 0,
        "sub_options": [], "tags": [], "evidence_types": [],
        "evidence_required": False, "created_at": datetime.utcnow().isoformat(),
        "unit": "min", "frequency": frequency,
    }
    return UserProgram(
        id="up1", user_uid="user123", program_id="p1",
        program_snapshot={
            "tasks": [task_snap],
            "points_per_shield": 1500,
            "penalty_mode": "exponential",
        },
        start_date=date(2026, 1, 1), base_days=75, total_days_required=75,
        failure_count=failure_count, shield_tokens_available=shield_tokens,
    )


async def test_weekly_task_not_penalized_if_done_earlier_this_week(client, auth_headers, mock_db):
    """A required weekly task completed earlier this week is satisfied — no penalty today."""
    up = _make_up_with_frequency(frequency="weekly")
    _setup_up_mock(mock_db, up)

    # Earlier log this week had the task completed
    earlier_log = DailyLog(
        user_program_id="up1", date=date(2026, 1, 5),
        is_complete=True, task_completions=[
            TaskCompletion(task_id="t1", completed=True, logged_value=25,
                           points_earned=0, bonus_earned=False, evidence=[])
        ], summary_points=0,
    )
    earlier_doc = MagicMock()
    earlier_doc.to_dict.return_value = earlier_log.model_dump(mode="json")

    # Mock the date-range query for the weekly lookback
    mock_db.collection.return_value.document.return_value.collection.return_value \
        .where.return_value.where.return_value.stream.return_value = [earlier_doc]
    mock_db.collection.return_value.document.return_value.collection.return_value \
        .document.return_value.get.return_value.exists = False
    mock_db.collection.return_value.document.return_value.collection.return_value \
        .document.return_value.set.return_value = None

    log_date = date(2026, 1, 7)  # same ISO week as Jan 5 (Mon Jan 5 – Sun Jan 11)
    resp = await client.put(
        f"/api/v1/user-programs/up1/logs/{log_date}",
        json={"task_completions": [{
            "task_id": "t1", "completed": False,
            "bonus_earned": False, "points_earned": 0, "evidence": []
        }]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_complete"] is True
    assert data["penalty_applied"] == 0
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend && pytest tests/test_daily_logs.py::test_weekly_task_not_penalized_if_done_earlier_this_week -x -v
```
Expected: FAIL — no frequency-aware logic exists.

- [ ] **Step 3: Add frequency-aware helper and update completion check**

In `backend/app/routers/daily_logs.py`, add after imports:

```python
from datetime import timedelta
```

Add helper function:

```python
def _is_task_satisfied_by_frequency(
    db,
    up_id: str,
    task: TaskDefinition,
    log_date: date,
    current_tc_completed: bool,
    start_date: date,
) -> bool:
    """Return True if the task's frequency requirement is already satisfied for this window."""
    if current_tc_completed:
        return True

    freq = getattr(task, 'frequency', 'daily')
    if freq == "daily":
        return False

    if freq == "weekly":
        week_start = log_date - timedelta(days=log_date.weekday())
        window_start = week_start
    elif freq == "monthly":
        window_start = log_date.replace(day=1)
    elif freq == "period":
        window_start = start_date
    else:
        return False

    logs_ref = (
        db.collection("userPrograms").document(up_id).collection("dailyLogs")
    )
    docs = (
        logs_ref
        .where("date", ">=", str(window_start))
        .where("date", "<", str(log_date))
        .stream()
    )
    for doc in docs:
        for tc_data in doc.to_dict().get("task_completions", []):
            if tc_data.get("task_id") == task.id and tc_data.get("completed"):
                return True
    return False
```

Replace the completeness check in `upsert_log`:

```python
# Determine completeness: all required tasks met (frequency-aware)
required_ids = {tid for tid, t in task_map.items() if t.is_required}
tc_by_id = {tc.task_id: tc for tc in enriched}
completed_ids = set()
for tid in required_ids:
    task = task_map[tid]
    tc = tc_by_id.get(tid)
    tc_completed = tc.completed if tc else False
    if _is_task_satisfied_by_frequency(db, up_id, task, log_date, tc_completed, up.start_date):
        completed_ids.add(tid)
is_complete = required_ids.issubset(completed_ids)
```

- [ ] **Step 4: Update existing daily log tests**

Update `_make_up` in `test_daily_logs.py` to include `frequency: "daily"` in the task snapshot and `penalty_mode` in the program snapshot:

```python
def _make_up(failure_count=0, shield_tokens=0):
    task_snap = {
        "id": "t1", "program_id": "p1", "name": "Workout", "category": "fitness",
        "type": "duration", "target_value": 20, "is_required": True,
        "completion_points": 100, "bonus_points": 50, "bonus_threshold_pct": 1.5,
        "min_completion_pct": 1.0, "times_per_day": 1, "order": 0,
        "sub_options": [], "tags": [], "evidence_types": [],
        "evidence_required": False, "created_at": datetime.utcnow().isoformat(),
        "unit": "min", "frequency": "daily",
    }
    return UserProgram(
        id="up1", user_uid="user123", program_id="p1",
        program_snapshot={
            "tasks": [task_snap],
            "points_per_shield": 1500,
            "penalty_mode": "exponential",
        },
        start_date=date.today(), base_days=75, total_days_required=75,
        failure_count=failure_count, shield_tokens_available=shield_tokens,
    )
```

Update `test_upsert_complete_day` — required task now earns 0 points:

```python
assert data["summary_points"] == 0  # required task earns 0 points
```

- [ ] **Step 5: Run all daily log tests**

```bash
cd backend && pytest tests/test_daily_logs.py -x -v
```
Expected: ALL PASS.

- [ ] **Step 6: Run full backend suite**

```bash
cd backend && pytest -x -v
```
Expected: ALL PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/daily_logs.py backend/tests/test_daily_logs.py
git commit -m "feat: frequency-aware required task completion (weekly/monthly/period)"
```

---

## Task 6: Frontend types update

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Update types**

```typescript
// frontend/src/types/index.ts

export type TaskFrequency = 'daily' | 'weekly' | 'monthly' | 'period'

export type TaskCategory =
  | 'health'
  | 'fitness'
  | 'nutrition'
  | 'mindset'
  | 'personal_development'
  | 'professional_development'
  | 'finance'
  | 'relationships'
  | 'creativity'
  | 'other'

export type PenaltyMode = 'exponential' | 'reset'
```

On `TaskDefinition`:
- `category: string` → `category: TaskCategory`
- Add `frequency: TaskFrequency`

On `Program`:
- `penalty_mode: string` → `penalty_mode: PenaltyMode`

On `PenaltyEvent`:
- Add `reset_triggered: boolean`

- [ ] **Step 2: Check for TypeScript errors**

```bash
cd frontend && npx tsc --noEmit
```
Expected: No errors (or only pre-existing unrelated errors).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat: add TaskFrequency, TaskCategory, PenaltyMode types"
```

---

## Task 7: Frontend — multi-step program creation (Step 1: Details + Step 2: Task Builder)

**Files:**
- Modify: `frontend/src/pages/Programs.tsx`

- [ ] **Step 1: Replace Programs.tsx with multi-step form**

Replace the entire content of `frontend/src/pages/Programs.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '@/firebase'
import { api } from '@/api/client'
import type { Program, UserProgram, TaskCategory, TaskFrequency, PenaltyMode } from '@/types'

interface TaskDraft {
  name: string
  category: TaskCategory
  type: 'boolean' | 'duration' | 'measurement'
  is_required: boolean
  frequency: TaskFrequency
  completion_points: number
  target_value?: number
  unit?: string
}

const CATEGORIES: { value: TaskCategory; label: string }[] = [
  { value: 'health', label: 'Health' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'nutrition', label: 'Nutrition' },
  { value: 'mindset', label: 'Mindset' },
  { value: 'personal_development', label: 'Personal Development' },
  { value: 'professional_development', label: 'Professional Development' },
  { value: 'finance', label: 'Finance' },
  { value: 'relationships', label: 'Relationships' },
  { value: 'creativity', label: 'Creativity' },
  { value: 'other', label: 'Other' },
]

const BLANK_TASK: TaskDraft = {
  name: '',
  category: 'health',
  type: 'boolean',
  is_required: true,
  frequency: 'daily',
  completion_points: 0,
}

export default function Programs() {
  const navigate = useNavigate()
  const [programs, setPrograms] = useState<Program[]>([])
  const [activeRunProgramIds, setActiveRunProgramIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [step, setStep] = useState(1)

  // Step 1: details
  const [name, setName] = useState('My Program')
  const [durationDays, setDurationDays] = useState(75)

  // Step 2: tasks
  const [tasks, setTasks] = useState<TaskDraft[]>([])
  const [addingTask, setAddingTask] = useState(false)
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(BLANK_TASK)

  // Step 3: penalty
  const [penaltyMode, setPenaltyMode] = useState<PenaltyMode>('exponential')
  const [pointsPerShield, setPointsPerShield] = useState(1500)
  const [maxShieldsPerWeek, setMaxShieldsPerWeek] = useState(1)

  const [creating, setCreating] = useState(false)

  useEffect(() => { loadData() }, [])

  function loadData() {
    setLoading(true)
    Promise.all([
      api.get<Program[]>('/programs'),
      api.get<UserProgram[]>('/user-programs'),
    ]).then(([progRes, runsRes]) => {
      setPrograms(progRes.data)
      const activeIds = new Set(
        runsRes.data.filter((r) => r.status === 'active').map((r) => r.program_id),
      )
      setActiveRunProgramIds(activeIds)
    }).finally(() => setLoading(false))
  }

  function addTask() {
    if (!taskDraft.name.trim()) return
    setTasks((prev) => [...prev, { ...taskDraft }])
    setTaskDraft(BLANK_TASK)
    setAddingTask(false)
  }

  function removeTask(i: number) {
    setTasks((prev) => prev.filter((_, idx) => idx !== i))
  }

  function updateDraft<K extends keyof TaskDraft>(field: K, value: TaskDraft[K]) {
    setTaskDraft((prev) => {
      const updated = { ...prev, [field]: value }
      if (field === 'is_required') {
        if (value) {
          updated.completion_points = 0
          updated.frequency = 'daily'
        }
      }
      return updated
    })
  }

  async function createProgram() {
    setCreating(true)
    try {
      const prog = await api.post<Program>('/programs', {
        name,
        duration_days: durationDays,
        penalty_mode: penaltyMode,
        points_per_shield: pointsPerShield,
        max_shields_per_week: maxShieldsPerWeek,
      })
      for (const [i, task] of tasks.entries()) {
        await api.post(`/programs/${prog.data.id}/tasks`, {
          name: task.name,
          category: task.category,
          type: task.type,
          is_required: task.is_required,
          frequency: task.is_required ? task.frequency : 'daily',
          completion_points: task.is_required ? 0 : task.completion_points,
          target_value: task.target_value,
          unit: task.unit,
          order: i + 1,
          bonus_points: 0,
          bonus_threshold_pct: 1.0,
          min_completion_pct: 1.0,
          sub_options: [],
        })
      }
      setShowForm(false)
      setStep(1)
      setTasks([])
      setName('My Program')
      setDurationDays(75)
      setPenaltyMode('exponential')
      setPointsPerShield(1500)
      setMaxShieldsPerWeek(1)
      loadData()
    } finally {
      setCreating(false)
    }
  }

  async function startProgram(programId: string) {
    setStarting(programId)
    try {
      const today = new Date().toISOString().split('T')[0]
      await api.post('/user-programs', { program_id: programId, start_date: today })
      navigate('/dashboard')
    } finally {
      setStarting(null)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Programs</h1>
        <div className="flex gap-3 items-center">
          <button onClick={() => { setShowForm(true); setStep(1) }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
            New Program
          </button>
          <button onClick={() => signOut(auth)} className="text-sm underline">Sign out</button>
        </div>
      </div>

      {showForm && (
        <div className="border rounded-lg p-5 mb-6 bg-gray-50">
          {/* Stepper */}
          <div className="flex items-center gap-2 mb-5 text-sm">
            {['Details', 'Tasks', 'Penalties'].map((label, idx) => (
              <div key={label} className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === idx + 1 ? 'bg-blue-600 text-white' : step > idx + 1 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {step > idx + 1 ? '✓' : idx + 1}
                </span>
                <span className={step === idx + 1 ? 'font-semibold text-gray-800' : 'text-gray-400'}>{label}</span>
                {idx < 2 && <span className="text-gray-300">→</span>}
              </div>
            ))}
          </div>

          {/* Step 1: Details */}
          {step === 1 && (
            <div>
              <h2 className="font-semibold mb-4">Program Details</h2>
              <div className="flex gap-4 mb-5">
                <div className="flex-1">
                  <label className="text-sm text-gray-600 block mb-1">Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                    className="border rounded px-3 py-1.5 w-full text-sm" />
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Duration (days)</label>
                  <input type="number" value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))}
                    className="border rounded px-3 py-1.5 w-24 text-sm" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button onClick={() => setStep(2)} disabled={!name} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                  Next: Tasks
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Tasks */}
          {step === 2 && (
            <div>
              <h2 className="font-semibold mb-4">Tasks <span className="text-gray-400 font-normal text-sm">({tasks.length} added)</span></h2>

              {tasks.length === 0 && !addingTask && (
                <p className="text-sm text-gray-400 mb-4">No tasks yet. Add at least one to continue.</p>
              )}

              {/* Added tasks list */}
              <div className="flex flex-col gap-2 mb-3">
                {tasks.map((t, i) => (
                  <div key={i} className="bg-white border rounded-lg px-3 py-2 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">{t.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{CATEGORIES.find(c => c.value === t.category)?.label} · {t.type}</span>
                      {t.target_value && <span className="text-xs text-gray-400 ml-1">· {t.target_value} {t.unit}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${t.is_required ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                        {t.is_required ? 'Required' : `Optional · ${t.completion_points}pts`}
                      </span>
                      <button onClick={() => removeTask(i)} className="text-gray-400 hover:text-red-500 text-xs">✕</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add task form */}
              {addingTask ? (
                <div className="bg-white border rounded-lg p-4 mb-3">
                  <h3 className="text-sm font-semibold mb-3">New Task</h3>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 block mb-1">Task name</label>
                      <input type="text" value={taskDraft.name} onChange={(e) => updateDraft('name', e.target.value)}
                        placeholder="e.g. Morning workout" className="border rounded px-3 py-1.5 w-full text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Category</label>
                      <select value={taskDraft.category} onChange={(e) => updateDraft('category', e.target.value as TaskCategory)}
                        className="border rounded px-3 py-1.5 w-full text-sm">
                        {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Type</label>
                      <select value={taskDraft.type} onChange={(e) => updateDraft('type', e.target.value as TaskDraft['type'])}
                        className="border rounded px-3 py-1.5 w-full text-sm">
                        <option value="boolean">Boolean (yes/no)</option>
                        <option value="duration">Duration (time)</option>
                        <option value="measurement">Measurement (value)</option>
                      </select>
                    </div>
                  </div>

                  {/* Target + unit */}
                  {(taskDraft.type === 'duration' || taskDraft.type === 'measurement') && (
                    <div className="flex gap-3 mb-3">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 block mb-1">Target value</label>
                        <input type="number" value={taskDraft.target_value ?? ''} onChange={(e) => updateDraft('target_value', Number(e.target.value))}
                          className="border rounded px-3 py-1.5 w-full text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Unit</label>
                        <input type="text" value={taskDraft.unit ?? ''} onChange={(e) => updateDraft('unit', e.target.value)}
                          placeholder="min / kg / L" className="border rounded px-3 py-1.5 w-24 text-sm" />
                      </div>
                    </div>
                  )}

                  {/* Required / Optional toggle */}
                  <div className="flex items-center gap-3 mb-3">
                    <label className="text-xs text-gray-500">Required</label>
                    <button
                      type="button"
                      onClick={() => updateDraft('is_required', !taskDraft.is_required)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${taskDraft.is_required ? 'bg-red-500' : 'bg-blue-500'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${taskDraft.is_required ? 'left-0.5' : 'left-5'}`} />
                    </button>
                    <label className="text-xs text-gray-500">Optional</label>
                  </div>

                  {/* Frequency — only for required tasks */}
                  {taskDraft.is_required && (
                    <div className="mb-3">
                      <label className="text-xs text-gray-500 block mb-1">Frequency</label>
                      <select value={taskDraft.frequency} onChange={(e) => updateDraft('frequency', e.target.value as TaskFrequency)}
                        className="border rounded px-3 py-1.5 w-full text-sm">
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly (at least once per week)</option>
                        <option value="monthly">Monthly (at least once per month)</option>
                        <option value="period">Once per program</option>
                      </select>
                    </div>
                  )}

                  {/* Points — only for optional tasks */}
                  {!taskDraft.is_required && (
                    <div className="mb-3">
                      <div className="flex justify-between mb-1">
                        <label className="text-xs text-gray-500">Points for completion</label>
                        <span className="text-xs font-medium text-gray-700">{taskDraft.completion_points} pts</span>
                      </div>
                      <input type="range" min={10} max={500} step={10} value={taskDraft.completion_points}
                        onChange={(e) => updateDraft('completion_points', Number(e.target.value))}
                        className="w-full accent-blue-600" />
                    </div>
                  )}

                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setAddingTask(false); setTaskDraft(BLANK_TASK) }} className="px-3 py-1.5 border rounded text-sm">Cancel</button>
                    <button onClick={addTask} disabled={!taskDraft.name.trim()} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50">
                      Add Task
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingTask(true)} className="w-full border-2 border-dashed border-gray-300 rounded-lg py-2 text-sm text-gray-400 hover:border-blue-400 hover:text-blue-500 mb-3">
                  + Add Task
                </button>
              )}

              <div className="flex gap-2 justify-between">
                <button onClick={() => setStep(1)} className="px-4 py-2 border rounded-lg text-sm">← Back</button>
                <button onClick={() => setStep(3)} disabled={tasks.length === 0} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                  Next: Penalties
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Penalty Config — see Task 8 */}
          {step === 3 && (
            <div>
              <h2 className="font-semibold mb-4">Penalty Configuration</h2>
              <p className="text-sm text-gray-500 mb-4">What happens when you miss a required task?</p>

              {/* Mode selection */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <button
                  type="button"
                  onClick={() => setPenaltyMode('exponential')}
                  className={`border-2 rounded-lg p-4 text-left ${penaltyMode === 'exponential' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}
                >
                  <p className="font-semibold text-sm mb-1">Exponential Days</p>
                  <p className="text-xs text-gray-500 mb-2">Each failure adds more days</p>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded">extra = 2^(N-1)</code>
                  <div className="mt-2 text-xs text-gray-400 space-y-0.5">
                    <div>Fail 1 → +1 day</div>
                    <div>Fail 2 → +2 days</div>
                    <div>Fail 3 → +4 days</div>
                    <div>Fail 4 → +8 days</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPenaltyMode('reset')}
                  className={`border-2 rounded-lg p-4 text-left ${penaltyMode === 'reset' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}
                >
                  <p className="font-semibold text-sm mb-1">Program Reset</p>
                  <p className="text-xs text-gray-500 mb-2">Miss a task, start from Day 1</p>
                  <p className="text-xs text-gray-400 mt-2">The ultimate commitment mode. One miss resets all progress.</p>
                  <p className="text-xs text-gray-400 mt-1">Failures are tracked for history.</p>
                </button>
              </div>

              {/* Shield config */}
              <div className="bg-white border rounded-lg p-4 mb-5">
                <p className="text-sm font-semibold mb-1">Shields</p>
                <p className="text-xs text-gray-500 mb-3">Earn points from optional tasks to buy shields. A shield absorbs one penalty.</p>
                <div className="mb-3">
                  <div className="flex justify-between mb-1">
                    <label className="text-xs text-gray-500">Points cost per shield</label>
                    <span className="text-xs font-medium text-gray-700">{pointsPerShield.toLocaleString()} pts</span>
                  </div>
                  <input type="range" min={100} max={5000} step={100} value={pointsPerShield}
                    onChange={(e) => setPointsPerShield(Number(e.target.value))}
                    className="w-full accent-blue-600" />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs text-gray-500">Max shields per week</label>
                    <span className="text-xs font-medium text-gray-700">{maxShieldsPerWeek}</span>
                  </div>
                  <input type="range" min={0} max={5} step={1} value={maxShieldsPerWeek}
                    onChange={(e) => setMaxShieldsPerWeek(Number(e.target.value))}
                    className="w-full accent-blue-600" />
                </div>
              </div>

              <div className="flex gap-2 justify-between">
                <button onClick={() => setStep(2)} className="px-4 py-2 border rounded-lg text-sm">← Back</button>
                <button onClick={createProgram} disabled={creating} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                  {creating ? 'Creating...' : 'Create Program'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {loading && <p className="text-gray-500">Loading...</p>}
      {!loading && programs.length === 0 && !showForm && (
        <p className="text-gray-500">No programs yet. Create one to get started.</p>
      )}

      <div className="flex flex-col gap-4">
        {programs.map((p) => {
          const isActive = activeRunProgramIds.has(p.id)
          return (
            <div key={p.id} className="border rounded-lg p-4 flex justify-between items-center">
              <div>
                <p className="font-semibold">{p.name}</p>
                <p className="text-sm text-gray-500">{p.duration_days} days · {p.penalty_mode === 'reset' ? 'Reset on miss' : 'Exponential days'}</p>
              </div>
              {isActive ? (
                <button onClick={() => navigate('/dashboard')} className="px-4 py-2 border rounded-lg text-sm">
                  View Active
                </button>
              ) : (
                <button
                  onClick={() => startProgram(p.id)}
                  disabled={starting === p.id}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {starting === p.id ? 'Starting...' : 'Start'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the frontend builds**

```bash
cd frontend && npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Programs.tsx
git commit -m "feat: multi-step program creation — user-defined tasks, category, frequency, penalty config"
```

---

## Task 8: End-to-end validation

- [ ] **Step 1: Run full backend suite**

```bash
cd backend && pytest -x -v
```
Expected: ALL PASS across `test_models.py`, `test_points.py`, `test_penalty.py`, `test_daily_logs.py`.

- [ ] **Step 2: Start local stack**

```bash
docker compose up
```

- [ ] **Step 3: Manual smoke test**

1. Open `http://localhost:5173` → sign in
2. Go to Programs → New Program
3. **Step 1**: Enter name "My 75 Hard", duration 75 → click Next
4. **Step 2**: Add a required boolean task "No Sugar" (Health, daily). Add a required duration task "Workout" (Fitness, weekly, 45 min). Add an optional boolean task "Podcast" (Mindset) with 100 pts
5. Verify required tasks show no points slider; "Podcast" shows points slider
6. Verify frequency dropdown only shows on required tasks
7. Click Next
8. **Step 3**: Select "Exponential Days", confirm formula table shows. Adjust shield cost to 2000
9. Click Create Program — verify success
10. Start the program → navigate to Log Today
11. Complete all tasks → save → verify summary_points only counts optional task points (Podcast = 100 pts max, required tasks = 0 pts)

- [ ] **Step 4: Commit if any fixes were needed**

```bash
git add -p
git commit -m "fix: post-integration fixes from smoke test"
```

---

## Summary of all changed files

| File | Change |
|------|--------|
| `backend/app/models/program.py` | Add `TaskCategory`, `TaskFrequency` enums; `frequency` + `category` type on both Task models; `penalty_mode` on `ProgramCreate` |
| `backend/app/models/user_program.py` | Add `reset_triggered` to `PenaltyEvent` |
| `backend/app/services/points.py` | Required tasks return 0 points; `calc_shields` drops `shields_used` param |
| `backend/app/services/penalty.py` | `"reset"` penalty mode; shield usage deducts points from `total_points_earned` |
| `backend/app/routers/daily_logs.py` | Frequency-aware completion check; updated `calc_shields` call |
| `backend/tests/test_models.py` | New tests for enums and frequency |
| `backend/tests/test_points.py` | Updated for required=0, new shield calc, `_task` default changed |
| `backend/tests/test_penalty.py` | Reset mode tests, shield deduction tests, `_make_up` updated |
| `backend/tests/test_daily_logs.py` | Frequency-aware test, updated point expectations, `_make_up` updated |
| `frontend/src/types/index.ts` | Add `TaskFrequency`, `TaskCategory`, `PenaltyMode` types; update interfaces |
| `frontend/src/pages/Programs.tsx` | Remove `DEFAULT_TASKS`; full multi-step form (details → tasks → penalty) |
