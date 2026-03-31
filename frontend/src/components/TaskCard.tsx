import type { TaskDefinition, TaskCompletion } from '@/types'

interface Props {
  task: TaskDefinition
  completion: TaskCompletion
  onChange: (updated: TaskCompletion) => void
}

export default function TaskCard({ task, completion, onChange }: Props) {
  const update = (patch: Partial<TaskCompletion>) =>
    onChange({ ...completion, ...patch })

  const isCompleted = completion.completed

  return (
    <div
      className={`rounded-xl border p-4 mb-3 shadow-sm transition-colors ${
        isCompleted
          ? 'bg-[#f0f4f8] border-[#c2c6d6]'
          : 'bg-white border-[#c2c6d6]'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox (boolean) or completion indicator */}
        {task.type === 'boolean' ? (
          <button
            onClick={() => update({ completed: !isCompleted })}
            className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors mt-0.5 ${
              isCompleted
                ? 'bg-[#0058be] border-[#0058be]'
                : 'border-[#c2c6d6] bg-white'
            }`}
          >
            {isCompleted && (
              <span className="material-symbols-outlined text-white" style={{ fontSize: '14px' }}>
                check
              </span>
            )}
          </button>
        ) : (
          <div
            className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center mt-0.5 ${
              isCompleted
                ? 'bg-[#0058be] border-[#0058be]'
                : 'border-[#c2c6d6] bg-white'
            }`}
          >
            {isCompleted && (
              <span className="material-symbols-outlined text-white" style={{ fontSize: '14px' }}>
                check
              </span>
            )}
          </div>
        )}

        {/* Task info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p
                className={`font-semibold text-[#171c1f] text-sm leading-tight ${
                  isCompleted ? 'line-through text-[#545f73]' : ''
                }`}
              >
                {task.icon && <span className="mr-1">{task.icon}</span>}
                {task.name}
              </p>
              <p className="text-xs text-[#545f73] uppercase tracking-wide mt-0.5">
                {task.category.replace('_', ' ')}
              </p>
              {task.target_value != null && (
                <p className="text-xs text-[#6f7a8d] mt-0.5">
                  {task.target_direction === 'max' ? 'Limit' : 'Target'}: {task.target_value} {task.unit}
                </p>
              )}
            </div>

            {/* Optional task badge */}
            {!task.is_required && task.completion_points > 0 && (
              <span className="flex-shrink-0 bg-[#fef3c7] text-[#92400e] text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap">
                ⚡ {completion.points_earned > 0 ? completion.points_earned : task.completion_points} PTS
              </span>
            )}
          </div>

          {/* Duration / count / measurement input */}
          {(task.type === 'duration' ||
            task.type === 'count' ||
            task.type === 'measurement') && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={completion.logged_value ?? ''}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  const completed =
                    task.target_value != null
                      ? task.target_direction === 'max'
                        ? v <= task.target_value
                        : v >= task.target_value * (task.min_completion_pct ?? 1)
                      : v > 0
                  update({
                    logged_value: v,
                    logged_unit: task.unit ?? undefined,
                    completed,
                  })
                }}
                placeholder={`Enter ${task.unit ?? 'value'}`}
                className="border border-[#c2c6d6] rounded px-3 py-1.5 w-36 text-sm bg-white text-[#171c1f] focus:outline-none focus:border-[#0058be] focus:ring-1 focus:ring-[#0058be]"
              />
              <span className="text-sm text-[#545f73]">{task.unit}</span>
            </div>
          )}

          {/* Budget input */}
          {task.type === 'budget' && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={completion.logged_value ?? ''}
                onChange={(e) =>
                  update({
                    logged_value: parseFloat(e.target.value),
                    logged_unit: task.unit ?? undefined,
                  })
                }
                placeholder={`${task.unit} today`}
                className="border border-[#c2c6d6] rounded px-3 py-1.5 w-36 text-sm bg-white text-[#171c1f] focus:outline-none focus:border-[#0058be] focus:ring-1 focus:ring-[#0058be]"
              />
              <span className="text-xs text-[#6f7a8d]">
                of {task.total_budget} total {task.unit}
              </span>
            </div>
          )}

          {/* Sub-options */}
          {task.sub_options.length > 0 && (
            <div className="mt-3 flex gap-2 flex-wrap">
              {task.sub_options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => update({ selected_option: opt, completed: true })}
                  className={`px-3 py-1 text-xs rounded-full border font-medium transition-colors ${
                    completion.selected_option === opt
                      ? 'bg-[#0058be] text-white border-[#0058be]'
                      : 'bg-white text-[#545f73] border-[#c2c6d6] hover:border-[#0058be]'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
