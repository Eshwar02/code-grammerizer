export default function ScoreRing({ score }) {
  const s = Math.round(score ?? 0)
  const color = s >= 75 ? '#B5E61D' : s >= 50 ? '#f59e0b' : '#ef4444'
  const r = 36
  const circ = 2 * Math.PI * r
  const offset = circ - (s / 100) * circ

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="90" height="90" viewBox="0 0 90 90">
        <circle cx="45" cy="45" r={r} fill="none" stroke="#ebebed" strokeWidth="7" />
        <circle cx="45" cy="45" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="square" transform="rotate(-90 45 45)"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
        <text x="45" y="50" textAnchor="middle" fontSize="20" fontWeight="700" fill={color}
          fontFamily="Inter, sans-serif">{s}</text>
      </svg>
      <span className="text-xs text-ink-400 font-medium uppercase tracking-wide">Score</span>
    </div>
  )
}
