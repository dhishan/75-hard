import { useEffect, useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { api } from '@/api/client'

interface PointsEntry {
  date: string
  daily_points: number
  cumulative_points: number
}

export default function PointsChart({
  upId,
  pointsPerShield,
}: {
  upId: string
  pointsPerShield: number
}) {
  const [data, setData] = useState<PointsEntry[]>([])

  useEffect(() => {
    api
      .get<PointsEntry[]>(`/user-programs/${upId}/stats/points`)
      .then((r) => setData(r.data))
  }, [upId])

  const maxPoints = data.length
    ? Math.max(...data.map((d) => d.cumulative_points))
    : 0
  const shieldLines = Array.from(
    { length: Math.ceil(maxPoints / pointsPerShield) },
    (_, i) => (i + 1) * pointsPerShield
  )

  return (
    <div>
      <h3 className="font-semibold mb-2">Points Accumulation</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} />
          <YAxis />
          <Tooltip />
          {shieldLines.map((v) => (
            <ReferenceLine
              key={v}
              y={v}
              stroke="#f59e0b"
              strokeDasharray="4 2"
              label="🛡"
            />
          ))}
          <Area
            type="monotone"
            dataKey="cumulative_points"
            stroke="#6366f1"
            fill="#e0e7ff"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
