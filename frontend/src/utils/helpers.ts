import { formatDistanceToNow, parseISO, format } from 'date-fns'
import { ar } from 'date-fns/locale'

export const formatRelativeTime = (dateStr: string | null): string => {
  if (!dateStr) return 'غير محدد'
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true, locale: ar })
  } catch {
    return 'غير محدد'
  }
}

export const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return 'غير محدد'
  try {
    return format(parseISO(dateStr), 'dd MMMM yyyy - HH:mm', { locale: ar })
  } catch {
    return 'غير محدد'
  }
}

export const getSentimentColor = (sentiment: string | null): string => {
  switch (sentiment) {
    case 'positive': return 'text-green-600 bg-green-50'
    case 'negative': return 'text-red-600 bg-red-50'
    case 'neutral': return 'text-gray-600 bg-gray-50'
    default: return 'text-gray-400 bg-gray-50'
  }
}

export const getSentimentLabel = (sentiment: string | null): string => {
  switch (sentiment) {
    case 'positive': return 'إيجابي'
    case 'negative': return 'سلبي'
    case 'neutral': return 'محايد'
    default: return 'غير محدد'
  }
}

export const getSeverityColor = (severity: string): string => {
  switch (severity) {
    case 'critical': return 'bg-red-900 text-white'
    case 'high': return 'bg-red-500 text-white'
    case 'medium': return 'bg-orange-500 text-white'
    case 'low': return 'bg-yellow-500 text-white'
    default: return 'bg-gray-500 text-white'
  }
}

export const getSeverityLabel = (severity: string): string => {
  switch (severity) {
    case 'critical': return 'حرج'
    case 'high': return 'عالٍ'
    case 'medium': return 'متوسط'
    case 'low': return 'منخفض'
    default: return 'غير محدد'
  }
}

export const getCrisisTypeLabel = (type: string | null): string => {
  switch (type) {
    // محاور منتدى الإعلام السعودي
    case 'direct_mention':  return 'ذكر مباشر للمنتدى'
    case 'participants':    return 'شخصيات وضيوف'
    case 'topics_sessions': return 'جلسات ومحاور'
    // توافق مع بيانات قديمة
    case 'security':  return 'أمني'
    case 'political': return 'سياسي'
    case 'economic':  return 'اقتصادي'
    case 'health':    return 'صحي'
    case 'natural':   return 'طبيعي'
    default: return 'منتدى الإعلام'
  }
}

export const getCrisisTypeIcon = (type: string | null): string => {
  switch (type) {
    case 'direct_mention':  return '◈'
    case 'participants':    return '◉'
    case 'topics_sessions': return '◎'
    case 'security':  return '🔴'
    case 'political': return '🏛️'
    case 'economic':  return '📉'
    case 'health':    return '🏥'
    case 'natural':   return '🌊'
    default: return '✦'
  }
}

export const parseKeywords = (keywordsJson: string | null): string[] => {
  if (!keywordsJson) return []
  try {
    return JSON.parse(keywordsJson)
  } catch {
    return []
  }
}
