import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchSources, toggleSource } from '../utils/api'
import { Header } from '../components/Header'
import { formatRelativeTime } from '../utils/helpers'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  official:      { label: 'رسمي',  color: '#a855f7' },
  general:       { label: 'عام',   color: '#00d4ff' },
  international: { label: 'دولي',  color: '#00ff94' },
}

const COUNTRY_FLAG: Record<string, string> = {
  'Saudi Arabia': '🇸🇦',
  'Qatar':        '🇶🇦',
  'UAE':          '🇦🇪',
  'UK':           '🇬🇧',
  'France':       '🇫🇷',
  'Russia':       '🇷🇺',
}

export const Sources = () => {
  const queryClient = useQueryClient()

  const { data: sources, isLoading } = useQuery({
    queryKey: ['sources'],
    queryFn: () => fetchSources(),
  })

  const toggleMutation = useMutation({
    mutationFn: toggleSource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      toast.success('تم تحديث حالة المصدر')
    },
  })

  const activeCount  = sources?.filter((s) => s.is_active).length ?? 0
  const totalCount   = sources?.length ?? 0
  const totalArticles = sources?.reduce((s, src) => s + src.articles_count, 0) ?? 0

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Header title="مصادر الأخبار" />

      <main className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ── Summary bar ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'إجمالي المصادر', value: totalCount,   color: '#00d4ff', icon: '◎' },
            { label: 'مصادر نشطة',     value: activeCount,  color: '#00ff94', icon: '◉' },
            { label: 'إجمالي المقالات', value: totalArticles.toLocaleString('ar'), color: '#a855f7', icon: '◈' },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="card relative overflow-hidden"
              style={{ padding: '0.875rem', borderColor: `${item.color}25` }}
            >
              <div className="top-accent-line"
                   style={{ background: `linear-gradient(90deg, ${item.color}, transparent)` }} />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                  <p className="text-xl font-bold metric-number" style={{ color: item.color }}>{item.value}</p>
                </div>
                <span className="text-2xl opacity-15">{item.icon}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Sources grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {isLoading
            ? Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="card h-36 animate-pulse" />
              ))
            : sources?.map((source, idx) => {
                const catCfg: { label: string; color: string } = CATEGORY_CONFIG[source.category ?? ''] ?? { label: source.category ?? '', color: '#5a7a9a' }
                const flag   = COUNTRY_FLAG[source.country ?? ''] ?? '🌐'
                const reliabilityDots = Math.round((source.reliability_score ?? 0.8) * 5)

                return (
                  <motion.div
                    key={source.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className={clsx(
                      'card p-4 transition-all duration-200',
                      !source.is_active && 'opacity-50'
                    )}
                    style={source.is_active ? { borderColor: `${catCfg.color}20` } : {}}
                  >
                    {/* Top accent */}
                    {source.is_active && (
                      <div className="top-accent-line"
                           style={{ background: `linear-gradient(90deg, ${catCfg.color}, transparent)` }} />
                    )}

                    {/* Header row */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">{flag}</span>
                          <h3 className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                            {source.name_ar || source.name}
                          </h3>
                        </div>
                        <p className="text-[10px] mt-0.5 font-mono-soc truncate" style={{ color: 'var(--text-muted)' }}>
                          {source.name}
                        </p>
                      </div>

                      {/* Toggle */}
                      <button
                        onClick={() => toggleMutation.mutate(source.id)}
                        className="relative w-10 h-5 rounded-full transition-all flex-shrink-0"
                        style={{
                          background: source.is_active
                            ? 'linear-gradient(90deg, #00b86b, #00ff94)'
                            : 'rgba(255,255,255,0.08)',
                          border: `1px solid ${source.is_active ? 'rgba(0,255,148,0.4)' : 'rgba(255,255,255,0.1)'}`,
                          boxShadow: source.is_active ? '0 0 10px rgba(0,255,148,0.3)' : 'none',
                        }}
                      >
                        <div
                          className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                          style={{ transform: source.is_active ? 'translateX(20px)' : 'translateX(2px)' }}
                        />
                      </button>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                            style={{ background: `${catCfg.color}10`, color: catCfg.color, border: `1px solid ${catCfg.color}20` }}>
                        {catCfg.label}
                      </span>
                      {source.country && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-soc"
                              style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                          {source.country}
                        </span>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex justify-between items-center">
                        <span style={{ color: 'var(--text-muted)' }}>مقالات</span>
                        <span className="font-bold font-mono-soc" style={{ color: '#00d4ff' }}>
                          {source.articles_count.toLocaleString('ar')}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span style={{ color: 'var(--text-muted)' }}>آخر جلب</span>
                        <span className="font-mono-soc" style={{ color: 'var(--text-muted)' }}>
                          {source.last_fetched ? formatRelativeTime(source.last_fetched) : '—'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span style={{ color: 'var(--text-muted)' }}>الثقة</span>
                        <div className="flex gap-0.5 items-center">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div
                              key={i}
                              className="w-2 h-2 rounded-full"
                              style={{
                                background: i <= reliabilityDots ? catCfg.color : 'var(--border)',
                                boxShadow: i <= reliabilityDots ? `0 0 4px ${catCfg.color}80` : 'none',
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })
          }
        </div>
      </main>
    </div>
  )
}
