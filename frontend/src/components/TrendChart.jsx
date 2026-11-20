import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const HB_DOMAIN = 'hollywoodbets.net'
const RANK_TICKS = Array.from({ length: 10 }, (_, index) => index + 1)

// Deliberately high-contrast, non-repeating palette for competitor series.
const PALETTE = [
  '#00E676', '#FF1744', '#2979FF', '#FF6D00', '#00E5FF', '#FF4081',
  '#FFD740', '#8D6E63', '#00BFA5', '#76FF03', '#B0BEC5', '#FF5252',
  '#40C4FF', '#A1887F', '#D4E157', '#78909C',
]
const PRINT_PALETTE = ['#168A52', '#D13B47', '#2862BE', '#C6781A', '#008A9A', '#A33F77']

const DOMAIN_COLORS = {
  'hollywoodbets.net': '#5C2D91',
  'betway.co.za': '#00E676',
  'betway.com': '#00E676',
  '10bet.co.za': '#FF1744',
  '10bet.com': '#FF1744',
  'spribe.co': '#2979FF',
  'spribe.com': '#2979FF',
  'livescore.com': '#FF6D00',
}

const BRAND_COLORS = {
  betway: '#00E676',
  '10bet': '#FF1744',
  spribe: '#2979FF',
  livescore: '#FF6D00',
}

function isHollywoodbets(value, name = '') {
  const values = [value, name].map((item) => (item || '').toLowerCase().replace(/^www\./, ''))
  return values.some((domain) => domain === HB_DOMAIN || domain.endsWith(`.${HB_DOMAIN}`) || domain.includes('hollywoodbets'))
}

function labelFor(point) {
  return isHollywoodbets(point.domain) || isHollywoodbets(point.name) ? 'Hollywoodbets' : point.name || point.domain || 'Unknown'
}

function normalizeSeriesLabel(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const BRAND_ALIASES = [
  { match: /hollywoodbets/, identity: 'hollywoodbets', name: 'Hollywoodbets' },
  { match: /betway/, identity: 'betway', name: 'Betway' },
  { match: /google play|play google com/, identity: 'google play', name: 'Google Play' },
  { match: /10bet/, identity: '10bet', name: '10bet' },
  { match: /spribe/, identity: 'spribe', name: 'SPRIBE' },
  { match: /livescore/, identity: 'livescore', name: 'LiveScore' },
]

function seriesFor(point) {
  const originalName = labelFor(point)
  const normalizedName = normalizeSeriesLabel(originalName)
  const source = normalizeSeriesLabel(`${originalName} ${point.domain || ''}`)
  const knownBrand = BRAND_ALIASES.find((brand) => brand.match.test(source))
  const fallback = normalizedName || normalizeSeriesLabel(point.domain) || 'unknown'
  return knownBrand
    ? { identity: knownBrand.identity, name: knownBrand.name }
    : { identity: fallback, name: originalName || 'Unknown' }
}


export function buildColorMap(items = [], printFriendly = false) {
  const map = new Map()
  const used = new Set()
  const unique = [...new Set(items.map((item) => (item?.identity || item?.domain || item?.name || '').toLowerCase()).filter(Boolean))]

  for (const identity of unique) {
    if (identity === HB_DOMAIN || identity.endsWith(`.${HB_DOMAIN}`) || identity.includes('hollywoodbets')) {
      map.set(identity, '#5C2D91')
      used.add('#5C2D91')
    }
  }

  for (const identity of unique) {
    if (map.has(identity)) continue
    const fixed = DOMAIN_COLORS[identity] || BRAND_COLORS[identity]
    if (!printFriendly && fixed && !used.has(fixed)) {
      map.set(identity, fixed)
      used.add(fixed)
    }
  }

  const palette = printFriendly ? PRINT_PALETTE : PALETTE
  let cursor = 0
  for (const identity of unique) {
    if (map.has(identity)) continue
    while (cursor < palette.length && used.has(palette[cursor])) cursor += 1
    if (cursor >= palette.length) {
      let fallback = null
      for (let step = 0; step < 36 && !fallback; step += 1) {
        const hue = (17 + step * 53) % 360
        const candidate = `hsl(${hue} 75% 58%)`
        if (!used.has(candidate)) fallback = candidate
      }
      map.set(identity, fallback || '#B0BEC5')
      used.add(fallback || '#B0BEC5')
      continue
    }
    map.set(identity, palette[cursor])
    used.add(palette[cursor])
    cursor += 1
  }
  return map
}

function formatTick(value, resolution) {
  const dt = new Date(value)
  if (resolution === 'hourly') {
    return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  if (resolution === 'monthly') {
    return dt.toLocaleDateString([], { month: 'short', year: '2-digit' })
  }
  return dt.toLocaleDateString([], { day: '2-digit', month: 'short' })
}

function RankedTooltip({ active, label, payload = [] }) {
  const actualPayload = payload.filter((entry) => Number(entry.value) > 0)
  if (!active || !actualPayload.length) return null
  const ordered = [...actualPayload].sort((a, b) => {
    const rankA = Number(a.value) > 0 ? Number(a.value) : 999
    const rankB = Number(b.value) > 0 ? Number(b.value) : 999
    return rankA - rankB || String(a.name).localeCompare(String(b.name))
  })

  return (
    <div className="ranked-tooltip">
      <div className="ranked-tooltip-date">{new Date(label).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div>
      {ordered.map((entry) => (
        <div className="ranked-tooltip-row" key={entry.dataKey}>
          <i style={{ background: entry.color || entry.stroke }}></i>
          <span>{entry.value > 0 ? `#${entry.value}` : 'Not in Top 10'}</span>
          <strong>{entry.name}</strong>
        </div>
      ))}
    </div>
  )
}

export default function TrendChart({ data = [], resolution = 'hourly', resultLimit = 5, pdf = false }) {
  const scrollRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(0)

  const model = useMemo(() => {
    const grouped = new Map()
    const identities = new Map()

    for (const point of data) {
      const series = seriesFor(point)
      const identity = series.identity
      if (!identity) continue
      const timestamp = new Date(point.captured_at).toISOString()
      if (!grouped.has(timestamp)) grouped.set(timestamp, { captured_at: point.captured_at })

      const existing = grouped.get(timestamp)[identity]
      if (existing == null || point.rank < existing) {
        grouped.get(timestamp)[identity] = point.rank
      }

      if (!identities.has(identity)) {
        identities.set(identity, {
          identity,
          name: series.name,
          domain: point.domain || '',
        })
      }
    }

    const rows = [...grouped.values()].sort((a, b) => new Date(a.captured_at) - new Date(b.captured_at))
    const plotted = [...identities.values()].filter((item) =>
      rows.some((row) => Number.isFinite(row[item.identity]))
    )

    const orderedPlotted = plotted.sort((a, b) => {
      const aBest = Math.min(...rows.map((row) => Number.isFinite(row[a.identity]) && row[a.identity] > 0 ? row[a.identity] : 99))
      const bBest = Math.min(...rows.map((row) => Number.isFinite(row[b.identity]) && row[b.identity] > 0 ? row[b.identity] : 99))
      return aBest - bBest || a.name.localeCompare(b.name)
    })
    const hollywoodbets = orderedPlotted.find((item) => isHollywoodbets(item.domain))
    const competitors = orderedPlotted.filter((item) => !isHollywoodbets(item.domain))
    // Hollywoodbets is the focal series and must remain visible in every view.
    // The limit applies to competitors, so the default Top 5 never hides it.
    const visible = resultLimit === 'all'
      ? orderedPlotted
      : [hollywoodbets, ...competitors.slice(0, Math.max(0, Number(resultLimit) - 1))].filter(Boolean)
    const colorMap = buildColorMap(visible, pdf)
    return {
      rows,
      plotted: visible.map((item) => ({ ...item, color: colorMap.get(item.identity) })),
    }
  }, [data, resultLimit, pdf])

  const chartWidth = useMemo(() => {
    const points = model.rows.length
    // Width follows the number of buckets in the selected resolution, not a
    // single fixed width for all date ranges. Small ranges fill the viewport.
    const spacing = {
      hourly: 74,
      daily: 84,
      weekly: 106,
      monthly: 124,
    }[resolution] ?? 84
    const chartPadding = 100 // axes and edge labels
    return Math.max(viewportWidth || 320, points * spacing + chartPadding)
  }, [model.rows.length, resolution, viewportWidth])

  const updateScrollState = () => {
    const node = scrollRef.current
    if (!node) return
    const maxScroll = Math.max(0, node.scrollWidth - node.clientWidth)
    setCanScrollLeft(node.scrollLeft > 2)
    setCanScrollRight(node.scrollLeft < maxScroll - 2)
  }

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return undefined
    const measure = () => {
      setViewportWidth(node.clientWidth)
      updateScrollState()
    }
    measure()
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(measure)
      : null
    if (observer) observer.observe(node)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [model.rows.length, resolution])

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    // A new range/resolution starts at the beginning of its own timeline.
    node.scrollLeft = 0
    const frame = requestAnimationFrame(updateScrollState)
    return () => cancelAnimationFrame(frame)
  }, [resolution, data])

  useEffect(() => {
    const frame = requestAnimationFrame(updateScrollState)
    return () => cancelAnimationFrame(frame)
  }, [chartWidth])

  const scrollByAmount = (direction) => {
    const node = scrollRef.current
    if (!node) return
    node.scrollBy({
      left: direction * Math.max(320, Math.round(node.clientWidth * 0.72)),
      behavior: 'smooth',
    })
  }

  if (!model.rows.length || !model.plotted.length) {
    return <div className="chart-empty"><span>No ranking history for this view.</span><small>Adjust the date, resolution or hour filter to view real captures.</small></div>
  }

  return (
    <div className={`trend-chart-inner${pdf ? ' pdf-trend-chart' : ''}`}>
      <div className="trend-chart-scroll-wrap">
        {!pdf && (
          <div className="trend-rank-axis" aria-hidden="true">
            {RANK_TICKS.map((rank) => <span key={rank}>{rank}</span>)}
          </div>
        )}
        <button
          type="button"
          className="trend-scroll-button left"
          aria-label="Scroll ranking chart left"
          title="Scroll left"
          disabled={!canScrollLeft}
          onClick={() => scrollByAmount(-1)}
        >
          ‹
        </button>

        <div
          className="trend-chart-scroll"
          ref={scrollRef}
          onScroll={updateScrollState}
        >
          <div className={`trend-chart-canvas${pdf ? ' pdf-trend-chart-canvas' : ''}`} style={{ width: pdf ? '100%' : `${chartWidth}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={model.rows} margin={pdf ? { top: 14, right: 22, bottom: 16, left: 2 } : { top: 12, right: 20, bottom: 16, left: 0 }}>
                <defs>
                  <linearGradient id="hbRankGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5C2D91" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#5C2D91" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#6F6178" strokeOpacity={0.28} strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="captured_at"
                  stroke="#51445A"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#51445A', fontSize: pdf ? 9 : 10 }}
                  tickFormatter={(value) => formatTick(value, resolution)}
                  minTickGap={pdf ? 62 : resolution === 'hourly' ? 8 : 34}
                  interval={pdf ? 'preserveStartEnd' : resolution === 'hourly' ? 0 : 'preserveStartEnd'}
                />
                <YAxis
                  reversed
                  domain={[1, 10]}
                  ticks={RANK_TICKS}
                  stroke="#51445A"
                  tickLine={false}
                  axisLine={false}
                  tick={pdf ? { fill: '#51445A', fontSize: 11 } : false}
                  width={34}
                />
                {!pdf && <Tooltip content={<RankedTooltip />} />}
                {model.plotted.map((item) => {
      const hb = isHollywoodbets(item.domain, item.name)
                  const stroke = hb ? '#5C2D91' : item.color
                  return (
                    <Area
                      key={item.identity}
                      type="monotone"
                      dataKey={item.identity}
                      name={item.name}
                      stroke={stroke}
                      strokeWidth={hb ? 3.5 : pdf ? 2.4 : 1.8}
                      fill={hb && !pdf ? 'url(#hbRankGlow)' : 'transparent'}
                      fillOpacity={1}
                      dot={hb ? { r: 4, strokeWidth: 1.5, fill: '#000000', stroke: '#5C2D91' } : false}
                      activeDot={{ r: hb ? 5 : 4, strokeWidth: 1.5 }}
                      isAnimationActive={!pdf}
                      animationDuration={700}
                    />
                  )
                })}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <button
          type="button"
          className="trend-scroll-button right"
          aria-label="Scroll ranking chart right"
          title="Scroll right"
          disabled={!canScrollRight}
          onClick={() => scrollByAmount(1)}
        >
          ›
        </button>
      </div>
      <div className="chart-legend" aria-label="Graph series">
        {model.plotted.map((item) => {
          const hb = isHollywoodbets(item.domain, item.name)
          return (
            <div className={`chart-legend-item${hb ? ' hb' : ''}`} key={item.identity}>
              <i style={{ background: hb ? '#5C2D91' : item.color }} />
              <span>{item.name}</span>
            </div>
          )
        })}
      </div>

    </div>
  )
}
