interface Props {
  tokensAvailable: number
  totalPointsEarned: number
  pointsPerShield: number
  shieldsUsed: number
}

export default function ShieldStatus({
  tokensAvailable,
  totalPointsEarned,
  pointsPerShield,
  shieldsUsed: _shieldsUsed,
}: Props) {
  const nextThreshold =
    (Math.floor(totalPointsEarned / pointsPerShield) + 1) * pointsPerShield
  const progress =
    Math.min(((totalPointsEarned % pointsPerShield) / pointsPerShield) * 100, 100)

  return (
    <div className="bg-white border border-[#c2c6d6] rounded-xl p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#545f73] mb-2">Shields</p>
      <p className="text-4xl font-bold text-[#171c1f] leading-none">
        🛡 {tokensAvailable}
        <span className="text-xl font-normal text-[#545f73] ml-1">available</span>
      </p>
      <div className="mt-4 h-2 rounded-full bg-[#eaeef2] overflow-hidden">
        <div
          className="h-full bg-[#facc15] rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-[#6f7a8d] mt-1.5">
        {totalPointsEarned.toLocaleString()} / {nextThreshold.toLocaleString()} pts to next shield
      </p>
    </div>
  )
}
