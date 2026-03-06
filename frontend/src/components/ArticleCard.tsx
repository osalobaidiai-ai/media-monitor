import { motion } from 'framer-motion'
import clsx from 'clsx'
import type { Article } from '../types'
import {
  formatRelativeTime,
  getSentimentColor,
  getSentimentLabel,
  getCrisisTypeLabel,
  getCrisisTypeIcon,
  parseKeywords,
} from '../utils/helpers'

interface ArticleCardProps {
  article: Article
  onClick?: () => void
}

const SENTIMENT_SOC: Record<string, { bg: string; color: string; border: string }> = {
  positive: { bg: 'rgba(0,255,148,0.08)',  color: '#00ff94', border: 'rgba(0,255,148,0.2)' },
  negative: { bg: 'rgba(255,77,109,0.08)', color: '#ff4d6d', border: 'rgba(255,77,109,0.2)' },
  neutral:  { bg: 'rgba(90,122,154,0.08)', color: '#5a7a9a', border: 'rgba(90,122,154,0.2)' },
}

export const ArticleCard = ({ article, onClick }: ArticleCardProps) => {
  const keywords = parseKeywords(article.keywords).slice(0, 4)
  const sentStyle = SENTIMENT_SOC[article.sentiment ?? 'neutral'] ?? SENTIMENT_SOC.neutral
  const crisisScore = article.crisis_score ?? 0
  const crisisLevel = crisisScore > 0.7 ? 'high' : crisisScore > 0.4 ? 'medium' : 'low'
  const crisisColor = crisisLevel === 'high' ? '#ff4d6d' : crisisLevel === 'medium' ? '#ff8c00' : '#fbbf24'

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ x: -3 }}
      transition={{ duration: 0.25 }}
      className={clsx(
        'card p-4 cursor-pointer transition-all duration-200 group',
        article.is_crisis ? 'card-red' : ''
      )}
      onClick={onClick}
    >
      {/* Crisis top bar */}
      {article.is_crisis && (
        <div className="absolute top-0 right-0 left-0 h-0.5"
             style={{ background: `linear-gradient(90deg, ${crisisColor}, transparent)` }} />
      )}

      <div className="flex items-start gap-3">
        {/* Thumbnail */}
        {article.image_url && (
          <div className="w-16 h-14 rounded-lg overflow-hidden flex-shrink-0"
               style={{ border: '1px solid var(--border)' }}>
            <img
              src={article.image_url}
              alt=""
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Tags row */}
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            {article.is_crisis && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono-soc"
                    style={{ background: 'rgba(255,77,109,0.12)', color: '#ff4d6d', border: '1px solid rgba(255,77,109,0.25)' }}>
                ⚠ {getCrisisTypeIcon(article.crisis_type)} {getCrisisTypeLabel(article.crisis_type)}
              </span>
            )}
            {article.sentiment && (
              <span className="px-2 py-0.5 rounded text-[10px] font-medium"
                    style={{ background: sentStyle.bg, color: sentStyle.color, border: `1px solid ${sentStyle.border}` }}>
                {getSentimentLabel(article.sentiment)}
              </span>
            )}
            {article.source_name && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono-soc"
                    style={{ background: 'rgba(0,212,255,0.06)', color: 'rgba(0,212,255,0.7)', border: '1px solid rgba(0,212,255,0.12)' }}>
                {article.source_name}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-sm font-semibold leading-relaxed line-clamp-2" style={{ color: 'var(--text-primary)' }}>
            {article.title}
          </h3>
        </div>
      </div>

      {/* Summary */}
      {article.summary && (
        <p className="text-xs mt-2 line-clamp-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {article.summary}
        </p>
      )}

      {/* Keywords */}
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {keywords.map((kw) => (
            <span key={kw} className="px-1.5 py-0.5 text-[10px] font-mono-soc rounded"
                  style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              # {kw}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-2.5"
           style={{ borderTop: '1px solid var(--border)' }}>
        <span className="text-[11px] font-mono-soc" style={{ color: 'var(--text-muted)' }}>
          {formatRelativeTime(article.fetched_at)}
        </span>

        {crisisScore > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>خطورة</span>
            <div className="flex gap-0.5 items-center">
              {[1, 2, 3, 4, 5].map((i) => {
                const filled = i <= Math.ceil(crisisScore * 5)
                return (
                  <div key={i}
                       className="w-1 rounded-sm transition-all"
                       style={{
                         height: `${8 + i * 2}px`,
                         background: filled ? crisisColor : 'var(--border)',
                         boxShadow: filled ? `0 0 4px ${crisisColor}` : 'none',
                       }} />
                )
              })}
            </div>
            <span className="text-[10px] font-mono-soc font-bold" style={{ color: crisisColor }}>
              {Math.round(crisisScore * 100)}%
            </span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
