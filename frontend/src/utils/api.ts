import axios from 'axios'
import type { Article, ArticleListResponse, CrisisAlert, AlertSummary, NewsSource, Stats, ReportRequest, ReportResponse } from '../types'

const BASE_URL = `${import.meta.env.VITE_API_URL}/api/v1`

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept-Language': 'ar',
  },
})

// Articles
export const fetchArticles = async (params: {
  page?: number
  page_size?: number
  sentiment?: string
  crisis_only?: boolean
  source_name?: string
  search?: string
  hours?: number
}): Promise<ArticleListResponse> => {
  const { data } = await api.get('/articles/', { params })
  return data
}

export const fetchArticle = async (id: number): Promise<Article> => {
  const { data } = await api.get(`/articles/${id}`)
  return data
}

export const fetchStats = async (hours?: number): Promise<Stats> => {
  const { data } = await api.get('/articles/stats', { params: { hours } })
  return data
}

// Alerts
export const fetchAlerts = async (params?: {
  active_only?: boolean
  crisis_type?: string
  severity?: string
}): Promise<CrisisAlert[]> => {
  const { data } = await api.get('/alerts/', { params })
  return data
}

export const fetchAlertsSummary = async (): Promise<AlertSummary> => {
  const { data } = await api.get('/alerts/summary')
  return data
}

export const acknowledgeAlert = async (id: number, acknowledgedBy: string): Promise<void> => {
  await api.post(`/alerts/${id}/acknowledge`, { acknowledged_by: acknowledgedBy })
}

export const resolveAlert = async (id: number): Promise<void> => {
  await api.post(`/alerts/${id}/resolve`)
}

// Sources
export const fetchSources = async (): Promise<NewsSource[]> => {
  const { data } = await api.get('/sources/')
  return data
}

export const toggleSource = async (id: number): Promise<void> => {
  await api.patch(`/sources/${id}/toggle`)
}

// Reports
export const generateReport = async (request: ReportRequest): Promise<ReportResponse> => {
  const { data } = await api.post('/reports/generate', request)
  return data
}

export const fetchReportTypes = async (): Promise<Array<{ id: string; label: string }>> => {
  const { data } = await api.get('/reports/types')
  return data
}

// Manual triggers
export const triggerCollection = async (): Promise<void> => {
  await api.post('/collect')
}

export const triggerAnalysis = async (): Promise<void> => {
  await api.post('/analyze')
}
