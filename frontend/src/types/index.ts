export type TaskType = 'boolean' | 'duration' | 'count' | 'measurement' | 'budget'

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

export interface TaskDefinition {
  id: string
  program_id: string
  name: string
  description?: string
  category: TaskCategory
  frequency: TaskFrequency
  icon?: string
  order: number
  type: TaskType
  target_value?: number
  unit?: string
  min_completion_pct: number
  total_budget?: number
  warn_at_pct?: number
  sub_options: string[]
  times_per_day: number
  is_required: boolean
  completion_points: number
  bonus_points: number
  bonus_threshold_pct: number
  evidence_required: boolean
  evidence_types: string[]
  tags: string[]
  created_at: string
}

export interface Program {
  id: string
  owner_uid: string
  name: string
  description?: string
  is_template: boolean
  duration_days: number
  penalty_mode: PenaltyMode
  points_per_shield: number
  max_shields_per_week: number
  max_shields_total?: number
  created_at: string
  updated_at: string
}

export interface ProgramWithTasks extends Program {
  tasks: TaskDefinition[]
}

export interface PenaltyEvent {
  date: string
  failure_number: number
  days_added: number
  missed_task_ids: string[]
  shield_used: boolean
  reset_triggered: boolean
}

export interface UserProgram {
  id: string
  user_uid: string
  program_id: string
  program_snapshot: Record<string, unknown>
  start_date: string
  base_days: number
  total_days_required: number
  current_day: number
  status: 'active' | 'completed' | 'abandoned'
  failure_count: number
  penalty_log: PenaltyEvent[]
  total_points_earned: number
  shield_tokens_available: number
  shields_used: number
  created_at: string
  updated_at: string
}

export interface Evidence {
  id: string
  type: 'photo' | 'note'
  url?: string
  caption?: string
  created_at: string
}

export interface TaskCompletion {
  task_id: string
  completed: boolean
  logged_value?: number
  logged_unit?: string
  selected_option?: string
  bonus_earned: boolean
  points_earned: number
  completed_at?: string
  notes?: string
  evidence: Evidence[]
}

export interface DailyLog {
  user_program_id: string
  date: string
  is_complete: boolean
  penalty_applied: number
  task_completions: TaskCompletion[]
  summary_points: number
}

export interface BudgetState {
  user_program_id: string
  task_id: string
  total_budget: number
  consumed: number
  last_logged_date?: string
  log: { date: string; amount: number }[]
}
