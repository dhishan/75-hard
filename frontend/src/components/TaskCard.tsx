import type { TaskDefinition, TaskCompletion } from '@/types'

interface Props {
  task: TaskDefinition
  completion: TaskCompletion
  onChange: (updated: TaskCompletion) => void
}

export default function TaskCard({ task, completion, onChange }: Props) {
  const update = (patch: Partial<TaskCompletion>) =>
    onChange({ ...completion, ...patch })

  return (
    <div
      className={`rounded-lg border p-4 ${
        completion.completed ? 'border-green-500 bg-green-50' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">
            {task.icon} {task.name}
          </p>
          {task.target_value != null && (
            <p className="text-xs text-gray-500">
              Target: {task.target_value} {task.unit}
            </p>
          )}
        </div>
        {task.type === 'boolean' && (
          <input
            type="checkbox"
            checked={completion.completed}
            onChange={(e) => update({ completed: e.target.checked })}
            className="w-5 h-5 mt-1"
          />
        )}
      </div>

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
                  ? v >= task.target_value * (task.min_completion_pct ?? 1)
                  : v > 0
              update({
                logged_value: v,
                logged_unit: task.unit ?? undefined,
                completed,
              })
            }}
            placeholder={`Enter ${task.unit ?? 'value'}`}
            className="border rounded px-2 py-1 w-32 text-sm"
          />
          <span className="text-sm text-gray-500">{task.unit}</span>
        </div>
      )}

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
            className="border rounded px-2 py-1 w-32 text-sm"
          />
          <span className="text-xs text-gray-400">
            of {task.total_budget} total {task.unit}
          </span>
        </div>
      )}

      {task.sub_options.length > 0 && (
        <div className="mt-2 flex gap-2 flex-wrap">
          {task.sub_options.map((opt) => (
            <button
              key={opt}
              onClick={() => update({ selected_option: opt, completed: true })}
              className={`px-2 py-1 text-xs rounded border ${
                completion.selected_option === opt
                  ? 'bg-blue-600 text-white'
                  : ''
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {completion.completed && !task.is_required && task.completion_points > 0 && (
        <p className="text-xs text-green-600 mt-2 font-medium">
          +{completion.points_earned > 0 ? completion.points_earned : task.completion_points} pts
        </p>
      )}
    </div>
  )
}
