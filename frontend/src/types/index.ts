export interface Article {
  id: number
  title: string
  summary: string | null
  url: string
  image_url: string | null
  source_name: string | null
  published_at: string | null
  sentiment: 'positive' | 'negative' | 'neutral' | null
  sentiment_score: number | null
  is_crisis: boolean
  crisis_score: number
  crisis_type: string | null
  keywords: string | null
  fetched_at: string
}

export interface ArticleListResponse {
  articles: Article[]
  total: number
  page: number
  page_size: number
}

export interface CrisisAlert {
  id: number
  title: string
  description: string | null
  crisis_type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  severity_score: number
  articles_count: number
  is_active: boolean
  is_acknowledged: boolean
  trigger_keywords: string | null
  created_at: string
  updated_at: string | null
}

export interface AlertSummary {
  total_active: number
  by_severity: {
    critical: number
    high: number
    medium: number
    low: number
  }
  by_type: Record<string, number>
  has_critical: boolean
  latest_alert: CrisisAlert | null
}

export interface NewsSource {
  id: number
  name: string
  name_ar: string | null
  url: string
  rss_url: string
  category: string | null
  country: string | null
  is_active: boolean
  reliability_score: number
  last_fetched: string | null
  articles_count: number
  created_at: string
}

export interface Stats {
  total_articles: number
  crisis_articles: number
  crisis_rate: number
  sentiment_distribution: Record<string, number>
  top_sources: Array<{ name: string; count: number }>
  crisis_types: Record<string, number>
  hourly_data: Array<{ hour: string; count: number }>
  period_hours: number
  generated_at: string
}

export interface ReportRequest {
  report_type: string
  hours: number
  language?: string
}

export interface ReportResponse {
  report_type: string
  title: string
  content: string
  generated_at: string
  data_period_hours: number
  total_articles: number
  model_used: string
}

export interface WebSocketMessage {
  type: 'connected' | 'new_article' | 'crisis_alert' | 'stats_update' | 'crisis_detected' | 'heartbeat' | 'pong'
  data?: unknown
  message?: string
  timestamp: string
}
