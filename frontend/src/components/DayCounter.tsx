interface Props {
  currentDay: number
  totalDaysRequired: number
}

export default function DayCounter({ currentDay, totalDaysRequired }: Props) {
  const pct = Math.min(Math.round((currentDay / totalDaysRequired) * 100), 100)
  return (
    <div className="bg-white border border-[#c2c6d6] rounded-xl p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#545f73] mb-2">Progress</p>
      <p className="text-4xl font-bold text-[#171c1f] leading-none">
        Day {currentDay}
        <span className="text-xl font-normal text-[#545f73] ml-1">/ {totalDaysRequired}</span>
      </p>
      <div className="mt-4 h-2 rounded-full bg-[#eaeef2] overflow-hidden">
        <div
          className="h-full bg-[#0058be] rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-[#6f7a8d] mt-1.5">{pct}% complete</p>
    </div>
  )
}
