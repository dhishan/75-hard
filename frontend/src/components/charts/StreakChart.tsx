import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { api } from '@/api/client'

interface StreakData {
  current_streak: number
  best_streak: number
  streak_history: number[]
}

export default function StreakChart({ upId }: { upId: string }) {
  const [data, setData] = useState<StreakData>({
    current_streak: 0,
    best_streak: 0,
    streak_history: [],
  })

  useEffect(() => {
    api.get<StreakData>(`/user-programs/${upId}/stats/streaks`).then((r) =>
      setData(r.data)
    )
  }, [upId])

  const chartData = data.streak_history.map((v, i) => ({ streak: i + 1, days: v }))

  return (
    <div>
      <h3 className="font-semibold mb-1">Streaks</h3>
      <p className="text-sm text-gray-500 mb-3">
        Current: {data.current_streak} days · Best: {data.best_streak} days
      </p>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={chartData}>
          <XAxis dataKey="streak" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="days" stroke="#6366f1" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
