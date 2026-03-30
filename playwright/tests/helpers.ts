import axios from 'axios'

const API = 'http://localhost:8000/api/v1'

export async function getTestToken(): Promise<string> {
  const resp = await axios.post(
    'http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',
    { email: 'e2e-test@75hard.local', password: 'test-password-123', returnSecureToken: true },
  )
  return resp.data.idToken
}

export const SAMPLE_TASKS = [
  { name: 'No added sugar', category: 'nutrition', type: 'boolean', is_required: true, completion_points: 100, bonus_points: 0, order: 1 },
  { name: 'Workout', category: 'fitness', type: 'duration', target_value: 20, unit: 'min', is_required: true, completion_points: 100, bonus_points: 50, bonus_threshold_pct: 1.5, min_completion_pct: 1.0, order: 2 },
  { name: 'Water', category: 'health', type: 'measurement', target_value: 3, unit: 'ltr', is_required: true, completion_points: 50, bonus_points: 0, min_completion_pct: 1.0, order: 3 },
  { name: 'Study session', category: 'mindset', type: 'duration', target_value: 20, unit: 'min', is_required: true, completion_points: 75, bonus_points: 0, min_completion_pct: 1.0, order: 4 },
  { name: 'Alcohol budget', category: 'nutrition', type: 'budget', total_budget: 10, unit: 'beers', is_required: true, completion_points: 0, bonus_points: 0, order: 5 },
  { name: 'Weight', category: 'health', type: 'measurement', unit: 'kg', is_required: false, completion_points: 10, bonus_points: 0, order: 6 },
  { name: 'News/Finance/Podcast', category: 'mindset', type: 'boolean', is_required: false, completion_points: 20, bonus_points: 0, sub_options: ['news', 'finance', 'podcast'], order: 7 },
  { name: 'Skin care', category: 'health', type: 'boolean', is_required: false, completion_points: 15, bonus_points: 0, order: 8 },
]

export async function createSampleProgram(): Promise<{ programId: string; taskMap: Record<string, string> }> {
  const token = await getTestToken()
  const headers = { Authorization: `Bearer ${token}` }

  const prog = await axios.post(`${API}/programs`, {
    name: 'E2E Sample 75 Hard',
    duration_days: 75,
    points_per_shield: 1500,
    max_shields_per_week: 1,
  }, { headers })
  const programId = prog.data.id

  const taskMap: Record<string, string> = {}
  for (const task of SAMPLE_TASKS) {
    const t = await axios.post(`${API}/programs/${programId}/tasks`, task, { headers })
    taskMap[task.name] = t.data.id
  }

  return { programId, taskMap }
}

export async function startRun(programId: string, startDate: string): Promise<string> {
  const token = await getTestToken()
  const resp = await axios.post(`${API}/user-programs`,
    { program_id: programId, start_date: startDate },
    { headers: { Authorization: `Bearer ${token}` } },
  )
  return resp.data.id
}

export async function cleanupRun(upId: string): Promise<void> {
  const token = await getTestToken()
  await axios.delete(`${API}/user-programs/${upId}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {})
}

export async function cleanupProgram(programId: string): Promise<void> {
  const token = await getTestToken()
  await axios.delete(`${API}/programs/${programId}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {})
}
