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
    ((totalPointsEarned % pointsPerShield) / pointsPerShield) * 100
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-gray-500">Shields</p>
      <p className="text-3xl font-bold mt-1">🛡 {tokensAvailable} available</p>
      <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-yellow-400 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">
        {totalPointsEarned} / {nextThreshold} pts to next shield
      </p>
    </div>
  )
}
