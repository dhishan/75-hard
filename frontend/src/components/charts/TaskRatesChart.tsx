import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { api } from '@/api/client'

interface TaskRate {
  task_id: string
  name: string
  completion_rate: number
}

export default function TaskRatesChart({ upId }: { upId: string }) {
  const [data, setData] = useState<TaskRate[]>([])

  useEffect(() => {
    api
      .get<TaskRate[]>(`/user-programs/${upId}/stats/task-rates`)
      .then((r) => setData(r.data))
  }, [upId])

  return (
    <div>
      <h3 className="font-semibold mb-2">Task Completion Rates</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical">
          <XAxis type="number" domain={[0, 100]} unit="%" />
          <YAxis type="category" dataKey="name" width={120} />
          <Tooltip formatter={(v) => `${v}%`} />
          <Bar dataKey="completion_rate">
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={
                  entry.completion_rate >= 80
                    ? '#22c55e'
                    : entry.completion_rate >= 50
                    ? '#f59e0b'
                    : '#ef4444'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
