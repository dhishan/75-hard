interface Props {
  currentDay: number
  totalDaysRequired: number
}

export default function DayCounter({ currentDay, totalDaysRequired }: Props) {
  const pct = Math.round((currentDay / totalDaysRequired) * 100)
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-gray-500">Progress</p>
      <p className="text-3xl font-bold mt-1">
        Day {currentDay}{' '}
        <span className="text-gray-400 text-xl">/ {totalDaysRequired}</span>
      </p>
      <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
