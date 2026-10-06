import React, { useMemo } from 'react'

const HOURS = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`)
const HB_DOMAIN = 'hollywoodbets.net'

function isHollywoodbets(value) {
  const domain = (value || '').toLowerCase().replace(/^www\./, '')
  return domain === HB_DOMAIN || domain.endsWith(`.${HB_DOMAIN}`)
}

function cellClass(rank) {
  if (rank == null) return 'heat-cell missing'
  if (rank <= 2) return 'heat-cell elite'
  if (rank <= 5) return 'heat-cell strong'
  if (rank <= 8) return 'heat-cell mid'
  return 'heat-cell weak'
}

export default function RankingHeatmap({ data = [] }) {
  const model = useMemo(() => {
    const map = new Map()
    for (const point of data) {
      const identity = point.domain || point.name
      if (!identity) continue
      const hour = new Date(point.captured_at).getHours()
      if (!map.has(identity)) {
        map.set(identity, { name: point.name || identity, domain: point.domain || identity, hours: Array(24).fill(null) })
      }
      const current = map.get(identity).hours[hour]
      map.get(identity).hours[hour] = current == null ? point.rank : Math.min(current, point.rank)
    }
    return [...map.values()].sort((a, b) => {
      if (isHollywoodbets(a.domain) !== isHollywoodbets(b.domain)) return isHollywoodbets(a.domain) ? -1 : 1
      const ar = Math.min(...a.hours.filter((v) => v != null), 99)
      const br = Math.min(...b.hours.filter((v) => v != null), 99)
      return ar - br
    })
  }, [data])

  if (!model.length) return <div className="heat-empty">No hourly ranking history available for the selected period.</div>

  return (
    <div className="heatmap-wrap">
      <div className="heatmap-scroll">
        <div className="heatmap-grid heatmap-header">
          <div className="heat-label">Competitor</div>
          {HOURS.map((hour) => <div className="heat-hour" key={hour}>{hour}</div>)}
        </div>
        {model.map((row) => (
          <div className="heatmap-grid" key={row.domain || row.name}>
            <div className={`heat-label ${isHollywoodbets(row.domain) ? 'hb-label' : ''}`}>{row.name}</div>
            {row.hours.map((rank, index) => (
              <div
                className={cellClass(rank)}
                key={`${row.domain}-${index}`}
                title={rank == null ? `${HOURS[index]} — no capture` : `${HOURS[index]} — rank #${rank}`}
              >
                {rank ?? ''}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="heat-legend">
        <span><i className="legend-dot elite"></i> #1–2</span>
        <span><i className="legend-dot strong"></i> #3–5</span>
        <span><i className="legend-dot mid"></i> #6–8</span>
        <span><i className="legend-dot weak"></i> #9–10</span>
        <span><i className="legend-dot missing"></i> No capture</span>
      </div>
    </div>
  )
}
