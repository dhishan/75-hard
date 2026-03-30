import { useEffect, useState } from 'react'
import { api } from '@/api/client'

interface HeatmapEntry {
  date: string
  is_complete: boolean
  summary_points: number
}

export default function CompletionHeatmap({ upId }: { upId: string }) {
  const [data, setData] = useState<HeatmapEntry[]>([])

  useEffect(() => {
    api
      .get<HeatmapEntry[]>(`/user-programs/${upId}/stats/heatmap`)
      .then((r) => setData(r.data))
  }, [upId])

  return (
    <div>
      <h3 className="font-semibold mb-2">Completion Heatmap</h3>
      <div className="flex flex-wrap gap-1">
        {data.map((d) => (
          <div
            key={d.date}
            title={`${d.date}: ${d.summary_points} pts`}
            className={`w-4 h-4 rounded-sm ${
              d.is_complete ? 'bg-green-500' : 'bg-red-400'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
