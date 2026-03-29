# 75 Hard Challenge Tracker — Plan & Spec

## Overview

A web application to track personal challenge programs (inspired by 75 Hard) with flexible task definitions, an exponential penalty system, Gemini-powered coaching, and a GCP-native deployment.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui |
| Backend | Python 3.11+ + FastAPI + Pydantic v2 |
| Database | Google Cloud Firestore |
| Auth | Firebase Auth (Google SSO) |
| File Storage | Google Cloud Storage (evidence photos) |
| AI | Google Gemini API |
| Infrastructure | GCP Cloud Run (backend) + GCS Bucket + CDN (frontend) |
| IaC | Terraform |
| CI/CD | GitHub Actions |

---

## Project Structure

```
75-hard/
├── backend/
│   ├── app/
│   │   ├── auth/               # Firebase token verification
│   │   ├── models/             # Pydantic models
│   │   ├── routers/            # API route handlers
│   │   ├── services/           # Business logic
│   │   │   ├── penalty.py      # Exponential penalty engine
│   │   │   ├── points.py       # Points + shield calculation
│   │   │   ├── gemini.py       # Gemini API integration
│   │   │   └── storage.py      # GCS signed URLs
│   │   ├── config.py
│   │   └── main.py
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── pages/              # Route-level page components
│   │   ├── services/           # API client (axios)
│   │   ├── store/              # Zustand state management
│   │   └── types/              # TypeScript definitions
│   ├── public/
│   ├── index.html
│   └── vite.config.ts
├── terraform/
│   ├── main/
│   └── workspaces/             # dev / prod configs
├── .github/
│   └── workflows/
│       ├── backend.yml
│       └── frontend.yml
└── PLAN.md
```

---

## Data Models

### Firestore Collections

```
users/{uid}
programs/{programId}
  └── tasks/{taskId}
userPrograms/{userProgramId}
  └── dailyLogs/{YYYY-MM-DD}
      └── taskCompletions/{taskId}
      └── evidence/{evidenceId}
budgetStates/{userProgramId}_{taskId}
friendships/{uid}
  └── friends/{friendUid}
```

---

### Task Types

```python
class TaskType(str, Enum):
    boolean     = "boolean"      # did / didn't — e.g. "No added sugar"
    duration    = "duration"     # time in minutes — e.g. "Workout 20 min"
    count       = "count"        # integer — e.g. "Read 10 pages"
    measurement = "measurement"  # float snapshot — e.g. weight, water intake
    budget      = "budget"       # program-level quota — e.g. "10 beers total"
```

---

### TaskDefinition

```python
class TaskDefinition(BaseModel):
    id: str
    program_id: str

    # Identity
    name: str
    description: str | None = None
    category: str                       # "fitness" | "nutrition" | "mindset" | "health"
    icon: str | None = None             # emoji or icon key
    order: int                          # display order in daily checklist

    # Type + target
    type: TaskType
    target_value: float | None = None   # 20 (min), 10 (pages), 3 (ltr), None for boolean
    unit: str | None = None             # "min" | "ltr" | "pages" | "lbs" | "kg" | "beers"
    min_completion_pct: float = 1.0     # 0.8 = 80% of target counts as complete

    # Budget-specific (only for type=budget)
    total_budget: int | None = None     # e.g. 10 beers for entire program
    warn_at_pct: float | None = 0.8    # warn user at 80% of budget consumed

    # Sub-options (for boolean tasks with choices)
    sub_options: list[str] = []         # e.g. ["news", "finance", "podcast"]

    # Scheduling
    times_per_day: int = 1             # 2 = two separate completions required
    is_required: bool = True           # False = optional/bonus task

    # Points (all user-defined at program setup)
    completion_points: int = 0         # points for meeting target
    bonus_points: int = 0              # extra points for exceeding target
    bonus_threshold_pct: float = 1.0   # must reach this % of target to earn bonus
                                       # e.g. 1.5 = 150% of target

    # Evidence
    evidence_required: bool = False
    evidence_types: list[str] = []     # ["photo", "note"]

    # Metadata
    tags: list[str] = []               # ["outdoor", "non-fiction", etc.]
    created_at: datetime
```

---

### Program

```python
class Program(BaseModel):
    id: str
    owner_uid: str
    name: str
    description: str | None = None
    is_template: bool = False          # true = shareable template (e.g. "75 Hard Official")
    duration_days: int = 75

    # Penalty config
    penalty_mode: str = "exponential"  # only mode for now

    # Points economy (user-defined)
    points_per_shield: int             # e.g. 1500
    max_shields_per_week: int = 1
    max_shields_total: int | None = None

    created_at: datetime
    updated_at: datetime
```

---

### UserProgram

```python
class UserProgram(BaseModel):
    id: str
    user_uid: str
    program_id: str
    program_snapshot: dict             # copy of program+tasks at start time

    # Timeline
    start_date: date
    base_days: int                     # original duration (e.g. 75)
    total_days_required: int           # grows with penalties
    current_day: int
    status: str                        # "active" | "completed" | "abandoned"

    # Penalty tracking
    failure_count: int = 0             # cumulative failure days
    penalty_log: list[PenaltyEvent] = []

    # Points + shields
    total_points_earned: int = 0
    shield_tokens_available: int = 0
    shields_used: int = 0

    created_at: datetime
    updated_at: datetime


class PenaltyEvent(BaseModel):
    date: date
    failure_number: int                # N-th failure (determines days added)
    days_added: int                    # 2^(N-1)
    missed_task_ids: list[str]
    shield_used: bool = False          # true = shield absorbed this penalty
```

---

### DailyLog

```python
class DailyLog(BaseModel):
    user_program_id: str
    date: date
    is_complete: bool                  # all required tasks met
    penalty_applied: int = 0           # days added this day (0 if complete or shielded)

    task_completions: list[TaskCompletion]
    summary_points: int                # total points earned this day


class TaskCompletion(BaseModel):
    task_id: str
    completed: bool

    # Type-specific logged value
    logged_value: float | None = None  # actual minutes, litres, pages, weight
    logged_unit: str | None = None
    selected_option: str | None = None # for sub_options tasks

    # Overachievement
    bonus_earned: bool = False
    points_earned: int = 0

    completed_at: datetime | None = None
    notes: str | None = None
    evidence: list[Evidence] = []


class Evidence(BaseModel):
    id: str
    type: str                          # "photo" | "note"
    url: str | None = None             # GCS signed URL for photos
    caption: str | None = None
    created_at: datetime
```

---

### BudgetState (program-level quota tracking)

```python
class BudgetState(BaseModel):
    user_program_id: str
    task_id: str
    total_budget: int
    consumed: float = 0.0             # running total across all days
    last_logged_date: date | None = None
    log: list[BudgetEntry] = []       # daily entries for history


class BudgetEntry(BaseModel):
    date: date
    amount: float                     # logged on that day
```

---

## Penalty Engine

### Formula

Each **failure day** (day where ≥1 required task is missed, no shield used) adds:

```
days_added(N) = 2^(N-1)   where N = cumulative failure_count
```

| Failure # | Days Added | Total Extension |
|---|---|---|
| 1st | +1 day | 76 days |
| 2nd | +2 days | 78 days |
| 3rd | +4 days | 82 days |
| 5th | +16 days | 98+ days |
| 8th | +128 days | 280+ days |

### Shield Absorption

If the user has a shield token available when a failure is detected:
- 1 token is consumed
- `days_added = 0`
- `shield_used = true` on the `PenaltyEvent`
- Max 1 shield usable per week

### Budget Task Penalty

A `budget` task triggers a failure event the day the running total **exceeds** `total_budget`. Partial overages (e.g. logged 2 beers, only 1 was within budget) still count as a single failure event for that day.

---

## Points Economy

### Earning Points

- **Completion points**: earned when a task meets its target (required or optional)
- **Bonus points**: earned when a quantifiable task exceeds `bonus_threshold_pct` of target
- **Budget restraint bonus**: a `budget` task can award `bonus_points` when daily logged value is 0

### Shield Earning

```
shield_tokens = floor(total_points_earned / points_per_shield)
```

Recomputed after every daily log save. Tokens already spent are not re-earned.

### Sample Point Values (user-defined at program setup)

| Task | Completion pts | Bonus pts | Bonus triggers at |
|---|---|---|---|
| No added sugar | 100 | — | n/a (boolean) |
| Workout 20 min | 100 | 50 | 30+ min (150%) |
| Water 3 ltr | 50 | 25 | 4+ ltr |
| Study 20 min | 75 | 40 | 35+ min (175%) |
| Alcohol budget | 0 | 20 | 0 consumed today |
| Weight (optional) | 10 | — | n/a |
| News/Podcast (optional) | 20 | — | n/a |
| Skin care (optional) | 15 | — | n/a |

**Perfect day = 330 pts** (required) / **395 pts** (all optional)

At `points_per_shield = 1500` → ~5 perfect required-only days per shield.

---

## Sample Program: "My 75 Hard"

```json
{
  "name": "My 75 Hard",
  "duration_days": 75,
  "points_per_shield": 1500,
  "max_shields_per_week": 1,
  "tasks": [
    { "name": "No Added Sugar",       "type": "boolean",      "is_required": true,  "completion_points": 100 },
    { "name": "Workout",              "type": "duration",     "is_required": true,  "target_value": 20, "unit": "min", "completion_points": 100, "bonus_points": 50, "bonus_threshold_pct": 1.5 },
    { "name": "Water",                "type": "measurement",  "is_required": true,  "target_value": 3,  "unit": "ltr", "completion_points": 50,  "bonus_points": 25, "bonus_threshold_pct": 1.33 },
    { "name": "Study Session",        "type": "duration",     "is_required": true,  "target_value": 20, "unit": "min", "completion_points": 75,  "bonus_points": 40, "bonus_threshold_pct": 1.75, "tags": ["leetcode", "system-design"] },
    { "name": "Alcohol Allowance",    "type": "budget",       "is_required": true,  "total_budget": 10, "unit": "beers", "completion_points": 0, "bonus_points": 20 },
    { "name": "Weight",               "type": "measurement",  "is_required": false, "unit": "kg",  "completion_points": 10 },
    { "name": "News / Finance / Podcast", "type": "boolean",  "is_required": false, "completion_points": 20, "sub_options": ["news", "finance", "podcast"] },
    { "name": "Skin Care",            "type": "boolean",      "is_required": false, "completion_points": 15 }
  ]
}
```

---

## API Design

### Authentication
All endpoints require `Authorization: Bearer <firebase_id_token>` header.

### Endpoints

#### Programs
```
GET    /api/v1/programs                      # list templates + user's programs
POST   /api/v1/programs                      # create program
GET    /api/v1/programs/{program_id}         # get program + tasks
PUT    /api/v1/programs/{program_id}         # update program
DELETE /api/v1/programs/{program_id}         # delete program

POST   /api/v1/programs/{program_id}/tasks   # add task
PUT    /api/v1/programs/{program_id}/tasks/{task_id}
DELETE /api/v1/programs/{program_id}/tasks/{task_id}
```

#### User Programs (Runs)
```
GET    /api/v1/user-programs                 # list all runs (active + history)
POST   /api/v1/user-programs                 # start a new run
GET    /api/v1/user-programs/{up_id}         # get run details + stats
PATCH  /api/v1/user-programs/{up_id}         # update status (abandon)

GET    /api/v1/user-programs/{up_id}/summary # dashboard stats
GET    /api/v1/user-programs/{up_id}/penalty-log
```

#### Daily Logs
```
GET    /api/v1/user-programs/{up_id}/logs/{date}        # get day's log
PUT    /api/v1/user-programs/{up_id}/logs/{date}        # save/update day's log
GET    /api/v1/user-programs/{up_id}/logs               # list all logs (for graphs)
```

#### Budget
```
GET    /api/v1/user-programs/{up_id}/budget/{task_id}   # get budget state
```

#### Evidence
```
POST   /api/v1/user-programs/{up_id}/logs/{date}/evidence        # upload (returns signed URL)
DELETE /api/v1/user-programs/{up_id}/logs/{date}/evidence/{id}
```

#### Dashboard & Graphs
```
GET    /api/v1/user-programs/{up_id}/stats/heatmap      # daily completion data
GET    /api/v1/user-programs/{up_id}/stats/streaks      # streak history
GET    /api/v1/user-programs/{up_id}/stats/task-rates   # per-task completion %
GET    /api/v1/user-programs/{up_id}/stats/weight       # weight trend over time
GET    /api/v1/user-programs/{up_id}/stats/points       # points + shields over time
```

#### Gemini
```
POST   /api/v1/ai/daily-coach                # daily motivational message
POST   /api/v1/ai/weekly-summary             # weekly recap
POST   /api/v1/ai/penalty-analysis           # pattern analysis on failures
POST   /api/v1/ai/program-builder            # describe goal → suggested tasks
POST   /api/v1/ai/chat                       # freeform Q&A
```

#### Friends
```
GET    /api/v1/friends                       # list friends
POST   /api/v1/friends/request              # send friend request by email
PUT    /api/v1/friends/request/{id}         # accept / decline
DELETE /api/v1/friends/{uid}               # remove friend
GET    /api/v1/friends/{uid}/progress       # view friend's active program progress
GET    /api/v1/friends/leaderboard          # friends ranked by current day
```

---

## Frontend Pages

| Route | Page | Description |
|---|---|---|
| `/` | Landing | Marketing + Google Sign In |
| `/dashboard` | Dashboard | Active program overview, today's tasks, points |
| `/log/:date` | Daily Log | Check off tasks, log values, attach evidence |
| `/programs` | Programs | Browse templates, manage own programs |
| `/programs/new` | Program Builder | Create + configure tasks + point values |
| `/programs/:id` | Program Detail | View tasks, edit |
| `/runs` | My Runs | History of all started programs |
| `/runs/:id` | Run Detail | Stats, penalty log, graphs |
| `/runs/:id/graphs` | Graphs | Heatmap, streaks, weight trend, task rates |
| `/friends` | Friends | Friend list, leaderboard, requests |
| `/friends/:uid` | Friend Profile | Their active run progress |
| `/settings` | Settings | Profile, units (kg/lbs, ltr/oz), timezone |

---

## Dashboard Components

- **Day counter**: "Day 14 of 82" (base 75 + penalties applied)
- **Today's checklist**: task cards with log input per type
- **Daily points**: today's earned vs. max possible
- **Shield status**: tokens available, progress to next shield
- **Budget bars**: running total for `budget` tasks (e.g. "7 / 10 beers")
- **Optional task streaks**: "Skin care: 12 days"
- **Gemini coach card**: daily personalized message
- **Penalty warning**: if it's past 9pm and required tasks are incomplete

---

## Graphs

| Graph | Type | Description |
|---|---|---|
| Completion heatmap | Calendar heatmap | GitHub-style, colored by % of tasks done |
| Streak timeline | Line chart | Current streak and resets over program |
| Task completion rates | Horizontal bar | Per-task % completion across all days |
| Weight trend | Line chart | Weight measurements over program duration |
| Points accumulation | Area chart | Cumulative points + shield thresholds |
| Penalty timeline | Bar chart | Days added per failure event |

---

## Gemini Integration

| Feature | Trigger | Context Sent |
|---|---|---|
| Daily coach | After daily log saved | Current day, streak, tasks completed/missed, patterns |
| Penalty analysis | After failure event | All penalty events, which tasks missed most |
| Weekly summary | Every 7 days | Full week log, points, optional streaks |
| Program builder | User describes goal | Free text → suggested task list with types |
| In-app chat | User sends message | Active program context + recent logs |

---

## Infrastructure (GCP)

```
Cloud Run          — FastAPI backend (min=0, max=10, 512Mi RAM)
Cloud Storage      — Frontend SPA (public bucket + CDN)
Cloud Storage      — Evidence uploads (private bucket, signed URLs)
Firestore          — Primary database (free tier: 1GB, 50K reads/day)
Firebase Auth      — Google SSO
Secret Manager     — API keys, service account credentials
Artifact Registry  — Docker images for Cloud Run
```

### Cost Profile (low traffic)
- Cloud Run: scales to zero — near zero cost at rest
- Firestore: free tier covers personal use comfortably
- GCS: cents per GB stored
- Gemini API: per-request, called only on user action

---

## Build Phases

### Phase 1 — Foundation
- [ ] Project scaffold (backend + frontend + terraform structure)
- [ ] Firebase Auth integration (Google SSO, token verification middleware)
- [ ] Firestore schema setup
- [ ] Program CRUD API + task management
- [ ] User program start/manage API
- [ ] React app shell: login page, dashboard shell, routing

### Phase 2 — Core Daily Loop
- [ ] Daily log API (save completions, calculate points)
- [ ] Penalty engine (detect failure, compute days added, apply shield)
- [ ] Budget task state tracking
- [ ] Daily log UI: checklist, value inputs per task type
- [ ] Shield token display + manual shield use

### Phase 3 — Dashboard & Graphs
- [ ] Dashboard stats API (summary, streaks, compliance)
- [ ] Graph data endpoints (heatmap, streaks, task rates, weight, points)
- [ ] Dashboard page with all components
- [ ] Graphs page (Recharts)

### Phase 4 — Evidence
- [ ] GCS signed URL upload API
- [ ] Evidence attach/view in daily log UI
- [ ] Photo timeline view in run detail

### Phase 5 — Gemini
- [ ] Daily coach endpoint + UI card
- [ ] Weekly summary
- [ ] Penalty pattern analysis
- [ ] Program builder assistant
- [ ] In-app chat

### Phase 6 — Friends
- [ ] Friend request / accept flow
- [ ] Friend progress view
- [ ] Leaderboard

### Phase 7 — Infrastructure
- [ ] Terraform: Cloud Run + GCS + Firestore + Secret Manager
- [ ] GitHub Actions: build + deploy backend (Cloud Run)
- [ ] GitHub Actions: build + deploy frontend (GCS bucket)
- [ ] Environment configs: dev / prod

---

## Out of Scope (v1)

- Push / email notifications
- Native mobile app (PWA only in v1)
- Social feed / comments
- Public program marketplace
