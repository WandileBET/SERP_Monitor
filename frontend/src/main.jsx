import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import TrendChart, { buildColorMap } from './components/TrendChart'
import RankingHeatmap from './components/RankingHeatmap'
import { getDashboard, getKeywords, getMonitorStatus } from './lib/api'
import './styles.css'

const HB_DOMAIN = 'hollywoodbets.net'
const RESOLUTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

function isHollywoodbets(value, name = '') {
  const values = [value, name].map((item) => (item || '').toLowerCase().replace(/^www\./, ''))
  return values.some((domain) => domain === HB_DOMAIN || domain.endsWith(`.${HB_DOMAIN}`) || domain.includes('hollywoodbets'))
}

function formatDate(value) {
  if (!value) return '—'
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
}

function dateFromInput(value) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function inputDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function clampDate(value, min, max) {
  if (!value) return ''
  if (min && value < min) return min
  if (max && value > max) return max
  return value
}

function shiftDate(value, days) {
  const date = dateFromInput(value)
  date.setDate(date.getDate() + days)
  return inputDate(date)
}

function shiftMonths(value, months) {
  const date = dateFromInput(value)
  date.setMonth(date.getMonth() + months)
  return inputDate(date)
}

function periodTitle(start, end, hour, view = 'period') {
  const range = start && end ? `${formatDate(start)} — ${formatDate(end)}` : 'Selected reporting period'
  if (view === 'hourly-day' && start) return `${formatDate(start)} · 24-hour view`
  return hour == null ? range : `${range} · ${String(hour).padStart(2, '0')}:00 view`
}

function insightTrendText(movement) {
  if (movement > 0) return `That is a net improvement of ${movement} position${movement === 1 ? '' : 's'} from the first to the latest observation.`
  if (movement < 0) return `That is a net decline of ${Math.abs(movement)} position${Math.abs(movement) === 1 ? '' : 's'} from the first to the latest observation.`
  return 'There was no net change between the first and latest observations.'
}

function MovementIcon({ direction }) {
  if (direction === 'up') return <span className="movement up">↑</span>
  if (direction === 'down') return <span className="movement down">↓</span>
  return <span className="movement flat">—</span>
}

function App() {
  const [keywords, setKeywords] = useState([])
  const [selected, setSelected] = useState('')
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastRefresh, setLastRefresh] = useState(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [resolution, setResolution] = useState('hourly')
  const [hourFilter] = useState('')
  const [chartView, setChartView] = useState('period')
  const [hourlyDate, setHourlyDate] = useState('')
  const [heatmapDate, setHeatmapDate] = useState('')
  const [rangePreset, setRangePreset] = useState('7d')
  const [trendResultLimit, setTrendResultLimit] = useState('all')
  const [rangeInitialized, setRangeInitialized] = useState(false)
  const [monitorStatus, setMonitorStatus] = useState({ items: [], bot_detected: [] })

  const loadKeywords = useCallback(async () => {
    const rows = await getKeywords()
    setKeywords(rows)
    if (!selected && rows.length) setSelected(rows[0].keyword)
  }, [selected])

  const refresh = useCallback(async (override = {}) => {
    try {
      setError('')
      const rows = await getKeywords()
      setKeywords(rows)
      const activeKeyword = selected || rows[0]?.keyword || ''
      if (!selected && activeKeyword) setSelected(activeKeyword)
      if (!activeKeyword) {
        setDashboard(null)
        setLastRefresh(new Date())
        setLoading(false)
        return null
      }

      const activeChartView = override.chartView ?? chartView
      const queryStartDate = activeChartView === 'hourly-day'
        ? (override.hourlyDate ?? hourlyDate ?? override.endDate ?? endDate)
        : (override.startDate ?? startDate)
      const queryEndDate = activeChartView === 'hourly-day'
        ? queryStartDate
        : (override.endDate ?? endDate)
      const queryResolution = activeChartView === 'hourly-day'
        ? 'hourly'
        : (override.resolution ?? resolution)
      const queryHour = null
      const activeHeatmapDate = override.heatmapDate ?? heatmapDate
      const data = await getDashboard(activeKeyword, queryStartDate, queryEndDate, queryResolution, queryHour, activeHeatmapDate)
      setDashboard(data)
      setLastRefresh(new Date())

      if (!rangeInitialized && data.report_end) {
        const defaultEnd = data.report_end
        const defaultStart = shiftDate(defaultEnd, -6)
        setStartDate(defaultStart)
        setEndDate(defaultEnd)
        setRangePreset('7d')
        setHourlyDate(defaultEnd)
        setHeatmapDate(defaultEnd)
        setRangeInitialized(true)
        setLoading(true)
        const refined = await getDashboard(activeKeyword, defaultStart, defaultEnd, resolution, null)
        setDashboard(refined)
        setLastRefresh(new Date())
      }

      return data
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [selected, startDate, endDate, resolution, hourFilter, chartView, hourlyDate, heatmapDate, rangeInitialized])

  useEffect(() => {
    loadKeywords().catch((err) => {
      setError(err.message)
      setLoading(false)
    })
  }, [loadKeywords])

  useEffect(() => {
    if (!selected) return
    setLoading(true)
    refresh()
  }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!rangeInitialized || !selected) return
    setLoading(true)
    const timer = setTimeout(() => refresh(), 120)
    return () => clearTimeout(timer)
  }, [startDate, endDate, resolution, hourFilter, chartView, hourlyDate, heatmapDate]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setInterval(() => {
      if (selected) refresh()
    }, 5 * 60 * 1000)
    return () => clearInterval(timer)
  }, [selected, refresh])

  useEffect(() => {
    const loadStatus = () => getMonitorStatus().then(setMonitorStatus).catch(() => {})
    loadStatus()
    const timer = setInterval(loadStatus, 5 * 60 * 1000)
    return () => clearInterval(timer)
  }, [])

  function applyPreset(preset) {
    if (!dashboard?.report_end) return
    const end = dashboard.report_end
    let start = end
    if (preset === '24h') start = shiftDate(end, -0)
    if (preset === '7d') start = shiftDate(end, -6)
    if (preset === '30d') start = shiftDate(end, -29)
    if (preset === '3m') start = shiftMonths(end, -3)
    if (preset === '6m') start = shiftMonths(end, -6)
    setRangePreset(preset)
    setStartDate(start)
    setEndDate(end)
  }

  function applyCustomRange() {
    if (!startDate || !endDate) return
    setRangePreset('custom')
  }

  const latest = dashboard?.latest_capture
  const latestResults = dashboard?.latest_results || []
  const trend = dashboard?.trend || []
  const heatmap = dashboard?.heatmap || []
  const effectiveResolution = dashboard?.resolution || resolution

  const insights = useMemo(() => {
    const hbSeries = trend
      .filter((p) => isHollywoodbets(p.domain, p.name))
      .sort((a, b) => new Date(a.captured_at) - new Date(b.captured_at))
    const first = hbSeries[0]?.rank ?? null
    const last = dashboard?.hollywoodbets_current_rank ?? hbSeries.at(-1)?.rank ?? null
    const movement = first != null && last != null ? first - last : 0
    const competitorMoves = latestResults
      .filter((r) => !isHollywoodbets(r.domain, r.name))
      .map((r) => {
        const identity = r.domain || r.name
        const history = trend.filter((p) => (p.domain || p.name) === identity).sort((a, b) => new Date(a.captured_at) - new Date(b.captured_at))
        if (history.length < 2) return null
        return { name: r.name, change: history[0].rank - history.at(-1).rank }
      })
      .filter(Boolean)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))[0]

    const ordered = hbSeries
    const rankChanges = []
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1]
      const current = ordered[index]
      if (previous.rank !== current.rank) rankChanges.push({ from: previous.rank, to: current.rank, at: current.captured_at })
    }
    const rankCounts = new Map()
    ordered.forEach((point) => rankCounts.set(point.rank, (rankCounts.get(point.rank) || 0) + 1))
    const mode = [...rankCounts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]
    const firstPoint = ordered[0]
    const lastPoint = ordered.at(-1)
    const summary = !ordered.length
      ? 'Hollywoodbets was not found in the captured organic results during this reporting period.'
      : `Hollywoodbets ${first === last ? `opened and closed at position #${first}` : `moved from position #${first} to #${last}`} across ${ordered.length} observed capture${ordered.length === 1 ? '' : 's'}. ${insightTrendText(movement)} It reached a best position of #${Math.min(...ordered.map((point) => point.rank))} and appeared in the top three in ${dashboard?.top3_capture_count ?? 0} capture${dashboard?.top3_capture_count === 1 ? '' : 's'}.`

    return {
      first,
      last,
      movement,
      best: dashboard?.hollywoodbets_best_rank ?? null,
      worst: dashboard?.hollywoodbets_worst_rank ?? null,
      top3: dashboard?.top3_capture_count ?? 0,
      competitorMoves,
      rankChanges,
      rankCounts,
      mode,
      captureCount: dashboard?.capture_count ?? ordered.length,
      trendObservationCount: ordered.length,
      firstAt: firstPoint?.captured_at,
      lastAt: dashboard?.latest_capture?.captured_at ?? lastPoint?.captured_at,
      summary,
    }
  }, [dashboard, latestResults, trend])

  function printReport() {
    if (!dashboard) return
    window.print()
  }

  const reportPeriod = periodTitle(dashboard?.report_start || (chartView === 'hourly-day' ? hourlyDate : startDate), dashboard?.report_end || (chartView === 'hourly-day' ? hourlyDate : endDate), dashboard?.hour_filter, chartView)
  const competitorCount = latestResults.filter((r) => !isHollywoodbets(r.domain, r.name)).length
  const latestColorMap = useMemo(() => buildColorMap(latestResults), [latestResults])

  return (
    <div className="shell">
      <div className="screen-app">
        <header className="header">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div>
            <div>
              <div className="eyebrow">HOLLYWOODBETS · SEO MONITOR</div>
              <div className="brand-title">SEO Performance Monitor</div>
            </div>
          </div>
          <div className="header-tools">
            <div className="live-status"><i></i><span>Live dataset</span></div>
            <label className="keyword-control"><span>Keyword</span><select value={selected} onChange={(e) => setSelected(e.target.value)} disabled={!keywords.length}><option value="">No keyword</option>{keywords.map((item) => <option value={item.keyword} key={item.id}>{item.keyword}</option>)}</select></label>
            <button className="ghost-button" onClick={() => refresh()} disabled={loading}><span className={loading ? 'spin' : ''}>↻</span> Refresh</button>
            <button className="primary-button" onClick={printReport} disabled={!dashboard || loading}>Export PDF</button>
          </div>
        </header>

        <main className="main">
          {error && <div className="error-banner">{error}</div>}

          {!!monitorStatus.bot_detected?.length && (
            <div className="bot-alert" role="alert">
              <div className="bot-alert-icon">!</div>
              <div className="bot-alert-content">
                <strong>Bot detection detected</strong>
                <div className="bot-alert-items">
                  {monitorStatus.bot_detected.map((item) => (
                    <span className="bot-alert-keyword" key={`${item.keyword}-${item.date}-${item.hour}-${item.attempt}`}>{item.keyword}</span>
                  ))}
                </div>
              </div>
              <span className="bot-alert-note">Check the keyword Chrome profile.</span>
            </div>
          )}

          {!keywords.length && !loading ? (
            <section className="empty-state"><div className="empty-orbit"><span></span><span></span><b>+</b></div><div><div className="eyebrow">NO LIVE DATA</div><h2>Waiting for the first real SERP capture.</h2><p>Add a real keyword to PostgreSQL and let the existing Excel sync populate the dashboard.</p></div></section>
          ) : (
            <>
              <section className="executive-hero">
                <div className="hero-copy"><div className="eyebrow">HOLLYWOODBETS SEO PERFORMANCE MONITOR</div><h1>{selected || 'Select a keyword'}</h1><p>Organic search ranking performance</p></div>
                <div className="hero-meta-grid"><div><span>REPORTING PERIOD</span><strong>{reportPeriod}</strong></div><div><span>LAST REFRESH</span><strong>{formatDateTime(lastRefresh)}</strong></div><div><span>ORGANIC RESULTS</span><strong>{latestResults.length || '—'}</strong></div></div>
              </section>

              <section className="filter-bar panel">
                <div className="filter-group"><span>Quick range</span><div className="preset-group">{[['24h', '1 Day'], ['7d', '7 Days'], ['30d', '30 Days'], ['3m', '3 Months'], ['6m', '6 Months']].map(([value, label]) => <button key={value} className={rangePreset === value ? 'preset active' : 'preset'} onClick={() => applyPreset(value)}>{label}</button>)}</div></div>
                <div className="filter-group date-fields"><label><span>From</span><input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setRangePreset('custom') }} /></label><label><span>To</span><input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setRangePreset('custom') }} /></label><button className="apply-button" onClick={applyCustomRange}>Apply</button></div>
                <div className="filter-group select-filter"><label><span>Chart view</span><select value={chartView} onChange={(e) => { const next = e.target.value; setChartView(next); if (next === 'hourly-day' && !hourlyDate) setHourlyDate(endDate || dashboard?.report_end || '') }}>{[['period', 'Period trend'], ['hourly-day', 'Hourly day']].map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
                {chartView === 'period' ? (
                  <div className="filter-group select-filter"><label><span>Chart resolution</span><select value={resolution} onChange={(e) => setResolution(e.target.value)}>{RESOLUTIONS.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label></div>
                ) : (
                  <div className="filter-group select-filter"><label><span>Data day</span><input className="day-picker" type="date" value={hourlyDate} onChange={(e) => setHourlyDate(e.target.value)} /></label></div>
                )}
                <div className="filter-group select-filter"><label><span>Results shown</span><select value={trendResultLimit} onChange={(e) => setTrendResultLimit(e.target.value)}><option value="5">Top 5</option><option value="all">All</option></select></label></div>
              </section>

                            <section className="kpi-grid">
                <article className="kpi kpi-hb"><div className="kpi-top"><span>Current Hollywoodbets Rank</span><span className="kpi-dot"></span></div><div className="kpi-main">{dashboard?.hollywoodbets_current_rank != null ? `#${dashboard.hollywoodbets_current_rank}` : '—'}</div><div className="kpi-foot"><MovementIcon direction={insights.movement > 0 ? 'up' : insights.movement < 0 ? 'down' : 'flat'} /> {insights.movement > 0 ? `${insights.movement} positions improved across the period` : insights.movement < 0 ? `${Math.abs(insights.movement)} positions lower across the period` : 'No net movement across the period'}</div></article>
                <article className="kpi"><span>Best Rank in Period</span><strong>{insights.best != null ? `#${insights.best}` : '—'}</strong><small>Lowest observed position</small></article>
                <article className="kpi"><span>Worst Rank in Period</span><strong>{insights.worst != null ? `#${insights.worst}` : '—'}</strong><small>Highest observed position</small></article>
                <article className="kpi"><span>Average Rank</span><strong>{dashboard?.hollywoodbets_average_rank != null ? `#${dashboard.hollywoodbets_average_rank}` : '—'}</strong><small>Across selected captures</small></article>
                <article className="kpi"><span>Competitors in Latest Top 10</span><strong>{dashboard?.competitors_tracked ?? competitorCount}</strong><small>Unique domains</small></article>
              </section>

              <section className="panel trend-panel">
                <div className="panel-heading"><div><div className="eyebrow">SECTION 01 · RANK TREND ANALYSIS</div><h2>{chartView === 'hourly-day' ? 'Hourly ranking movement' : 'Ranking movement over time'}</h2></div><div className="chart-badge"><i></i>{chartView === 'hourly-day' ? '24 hours' : effectiveResolution}</div></div>
                <div className="trend-chart"><TrendChart data={trend} resolution={effectiveResolution} resultLimit={trendResultLimit} /></div>
              </section>

              <section className="panel heat-panel"><div className="panel-heading heat-heading"><div><div className="eyebrow">SECTION 03 · RANKING HEATMAP</div><h2>24-hour position map</h2></div><label className="heatmap-date-control"><span>Latest captured day</span><input type="date" value={heatmapDate || dashboard?.heatmap_date || ''} min={dashboard?.report_start || undefined} max={dashboard?.report_end || undefined} onChange={(e) => setHeatmapDate(clampDate(e.target.value, dashboard?.report_start, dashboard?.report_end))} /><strong>{heatmapDate || dashboard?.heatmap_date ? formatDate(heatmapDate || dashboard?.heatmap_date) : '—'}</strong></label></div><RankingHeatmap data={heatmap} /></section>
            </>
          )}
        </main>
      </div>

      <div className="print-report" aria-hidden="true">
        <section className="print-page executive-report"><header className="report-header"><div className="print-brand">HOLLYWOODBETS <span>SEO PERFORMANCE</span></div><div className="report-label">EXECUTIVE REPORT</div><h1>Search performance</h1><p className="report-keyword">{selected}</p><p className="report-period">{reportPeriod} <span>·</span> Prepared {formatDateTime(lastRefresh)}</p></header><section className="report-summary"><h2>Executive summary</h2><p>{insights.summary}</p><small>Based on observed SERP captures during the selected period.</small></section><section className="report-metrics"><div><span>Latest rank</span><strong>{insights.last != null ? `#${insights.last}` : 'Not observed'}</strong></div><div><span>Best rank</span><strong>{insights.best != null ? `#${insights.best}` : '—'}</strong></div><div><span>Average rank</span><strong>{dashboard?.hollywoodbets_average_rank != null ? `#${dashboard.hollywoodbets_average_rank}` : '—'}</strong></div><div><span>Top 3 captures</span><strong>{insights.top3} / {insights.captureCount}</strong></div></section><section className="report-section"><h2>Period performance</h2><p className="report-opening">Hollywoodbets was first observed at <b>{insights.first != null ? `#${insights.first} on ${formatDateTime(insights.firstAt)}` : 'no recorded position'}.</b> The latest capture shows <b>{insights.last != null ? `#${insights.last} on ${formatDateTime(insights.lastAt)}` : 'no recorded position'}.</b> The observed range was <b>{insights.best != null ? `#${insights.best} to #${insights.worst}` : 'not available'}.</b></p><p>{insights.mode ? `The most frequently observed position was #${insights.mode[0]} (${insights.mode[1]} of ${insights.trendObservationCount} trend observations).` : 'There are not enough observations to identify a typical position.'} {insights.top3} of {insights.captureCount} SERP captures placed Hollywoodbets in the top three.</p></section><section className="report-section"><h2>Movement during the period</h2>{insights.rankChanges.length ? <table className="executive-movement-table"><thead><tr><th>Date and time observed</th><th>From</th><th>To</th><th>Movement</th></tr></thead><tbody>{insights.rankChanges.slice(0, 8).map((move, index) => <tr key={`${move.at}-${index}`}><td>{formatDateTime(move.at)}</td><td>#{move.from}</td><td>#{move.to}</td><td>{move.to < move.from ? `Improved ${move.from - move.to}` : `Declined ${move.to - move.from}`}</td></tr>)}</tbody></table> : <p>No position changes were recorded in the observed trend points; Hollywoodbets held the same rank whenever it appeared in captured results.</p>}{insights.rankChanges.length > 8 && <small>Showing 8 of {insights.rankChanges.length} observed position changes.</small>}</section><section className="report-section report-competitor"><h2>Market context</h2><p>{insights.competitorMoves ? `${insights.competitorMoves.name} had the largest observed competitor movement, changing ${Math.abs(insights.competitorMoves.change)} position${Math.abs(insights.competitorMoves.change) === 1 ? '' : 's'} over this period.` : 'Competitor movement could not be compared from the available ranking history.'}</p></section><footer className="report-footer">Source: SERP Monitor capture history <span>·</span> Rankings are point-in-time observations; gaps between captures are not monitored continuously.</footer></section>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
