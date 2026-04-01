# TODO

## UI — Hardcoded / Placeholder Data

- [x] **Dashboard completion % card** — currently `current_day / total_days_required * 100` (days elapsed ratio), not actual log completion rate. Should be `complete_days / total_logged * 100` from the `/summary` endpoint to reflect how many logged days were actually completed.

- [x] **Dashboard category performance grid** — fixed to 4 categories (Fitness, Nutrition, Mindset, Development). Tasks in other categories (e.g. `health`, `finance`, `personal_development`) are silently excluded. Should dynamically render all categories that have tasks in the active program.

- [x] **Profile page** — no real stats shown beyond active program name and day count. Could show total points earned, shields available, streak, completion rate pulled from `/summary`.
