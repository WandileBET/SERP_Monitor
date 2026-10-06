const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

async function request(path) {
  const response = await fetch(`${API_BASE}${path}`)
  if (!response.ok) {
    let message = 'Request failed'
    try {
      const body = await response.json()
      message = body.detail || message
    } catch {
      // Keep fallback message.
    }
    throw new Error(message)
  }
  return response.json()
}

export const getKeywords = () => request('/api/keywords')

export const getDashboard = (keyword, startDate = '', endDate = '', resolution = 'auto', hour = null, heatmapDate = '') => {
  const params = new URLSearchParams({ keyword, resolution })
  if (startDate) params.set('start_date', startDate)
  if (endDate) params.set('end_date', endDate)
  if (hour !== null && hour !== undefined && hour !== '') params.set('hour', String(hour))
  if (heatmapDate) params.set('heatmap_date', heatmapDate)
  return request(`/api/dashboard?${params.toString()}`)
}

export const getCaptures = (keyword, limit = 168) => request(`/api/captures?keyword=${encodeURIComponent(keyword)}&limit=${limit}`)

export const getMonitorStatus = () => request('/api/monitor-status')
