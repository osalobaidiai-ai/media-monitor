import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { fetchStats, fetchArticles, fetchAlerts } from '../utils/api'
import { KPICard } from '../components/KPICard'
import { ArticleCard } from '../components/ArticleCard'
import { SentimentChart } from '../components/SentimentChart'
import { CrisisAlertBanner } from '../components/CrisisAlertBanner'
import { Header } from '../components/Header'
import { useAppStore } from '../store'
import { motion } from 'framer-motion'

const CRISIS_LABELS: Record<string, string> = {
  direct_mention:  'ذكر مباشر',
  participants:    'شخصيات',
  topics_sessions: 'جلسات ومحاور',
  // توافق مع بيانات قديمة
  security: 'أمني', political: 'سياسي',
  economic: 'اقتصادي', health: 'صحي', natural: 'طبيعي',
}
const CRISIS_COLORS: Record<string, string> = {
  direct_mention:  '#00d4ff',
  participants:    '#a855f7',
  topics_sessions: '#00ff94',
  security: '#ff4d6d', political: '#a855f7',
  economic: '#ff8c00', health: '#00d4ff', natural: '#00ff94',
}

const MONITOR_RANGE = '20 يناير — 20 فبراير 2026'

export const Dashboard = () => {
  const { selectedHours, statsRefreshTrigger, articlesRefreshTrigger } = useAppStore()

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats', selectedHours, statsRefreshTrigger],
    queryFn: () => fetchStats(selectedHours),
    refetchInterval: 60000,
    placeholderData: keepPreviousData,
  })
  const { data: articlesData, isLoading: articlesLoading } = useQuery({
    queryKey: ['articles', articlesRefreshTrigger, selectedHours],
    queryFn: () => fetchArticles({ page_size: 10, hours: selectedHours }),
    refetchInterval: 30000,
    placeholderData: keepPreviousData,
  })
  const { data: alerts } = useQuery({
    queryKey: ['alerts', statsRefreshTrigger],
    queryFn: () => fetchAlerts({ active_only: true }),
    refetchInterval: 30000,
    placeholderData: keepPreviousData,
  })

  const criticalAlerts = alerts?.filter((a) => a.severity === 'critical') || []

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Header title="لوحة التحكم" />

      <main className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Monitor scope banner */}
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
             style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)' }}>
          <span className="text-base">◈</span>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold" style={{ color: '#00d4ff' }}>
              منتدى الإعلام السعودي — النسخة الثالثة
            </span>
            <span className="mx-2 opacity-30">|</span>
            <span className="text-xs font-mono-soc" style={{ color: 'var(--text-muted)' }}>
              {MONITOR_RANGE}
            </span>
          </div>
          <span className="text-[10px] font-mono-soc px-2 py-0.5 rounded"
                style={{ background: 'rgba(0,255,148,0.1)', color: '#00ff94', border: '1px solid rgba(0,255,148,0.2)' }}>
            ACTIVE MONITOR
          </span>
        </div>

        {/* Alert Banner */}
        <CrisisAlertBanner />

        {/* KPI Row */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <KPICard
            title="إجمالي الأخبار"
            value={stats?.total_articles?.toLocaleString('ar') ?? '0'}
            subtitle={`آخر ${selectedHours} ساعة`}
            icon="◈" color="blue" loading={statsLoading}
          />
          <KPICard
            title="مقالات ذات صلة"
            value={stats?.crisis_articles?.toLocaleString('ar') ?? '0'}
            subtitle={`${stats?.crisis_rate ?? 0}% من الإجمالي`}
            icon="◈" color="blue" loading={statsLoading}
            trend={stats && stats.crisis_articles > 5 ? 'up' : 'stable'}
            trendValue={stats?.crisis_rate ? `${stats.crisis_rate}%` : undefined}
          />
          <KPICard
            title="تنبيهات نشطة"
            value={alerts?.length ?? 0}
            subtitle={`${criticalAlerts.length} حرجة`}
            icon="◉" color={criticalAlerts.length > 0 ? 'red' : 'orange'} loading={false}
          />
          <KPICard
            title="مصادر مراقبة"
            value={stats?.top_sources?.length ?? 0}
            subtitle="مصدر إخباري" icon="◎" color="green" loading={statsLoading}
          />
        </div>

        {/* Charts Row */}
        {stats && <SentimentChart stats={stats} />}

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          {/* Live News Feed */}
          <div className="xl:col-span-2 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <div className="section-header mb-0">
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  آخر الأخبار
                </h3>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono-soc px-2.5 py-1 rounded-lg"
                   style={{ background: 'rgba(0,255,148,0.08)', border: '1px solid rgba(0,255,148,0.2)', color: '#00ff94' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#00ff94] animate-pulse inline-block"
                      style={{ boxShadow: '0 0 6px #00ff94' }} />
                LIVE FEED
              </div>
            </div>

            {articlesLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="card p-4 animate-pulse space-y-2">
                    <div className="h-3 rounded w-3/4" style={{ background: 'var(--border)' }} />
                    <div className="h-3 rounded w-1/2" style={{ background: 'var(--border)' }} />
                  </div>
                ))
              : articlesData?.articles.length === 0
              ? (
                <div className="card p-10 text-center">
                  <div className="text-4xl mb-3 opacity-20">◈</div>
                  <p className="text-xs font-mono-soc" style={{ color: 'var(--text-muted)' }}>
                    NO ARTICLES — اضغط "جمع الأخبار"
                  </p>
                </div>
              )
              : articlesData?.articles.map((article) => (
                  <ArticleCard key={article.id} article={article}
                    onClick={() => window.open(article.url, '_blank')} />
                ))
            }
          </div>

          {/* Right Column */}
          <div className="space-y-4">

            {/* Crisis Types */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="card p-5"
            >
              <div className="section-header">
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>محاور التغطية</h3>
                <span className="mr-auto text-[9px] font-mono-soc px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(0,212,255,0.08)', color: 'rgba(0,212,255,0.6)', border: '1px solid rgba(0,212,255,0.15)' }}>
                  FORUM
                </span>
              </div>

              {stats?.crisis_types && Object.keys(stats.crisis_types).length > 0 ? (
                <div className="space-y-3.5">
                  {Object.entries(stats.crisis_types).map(([type, count]) => {
                    const max = Math.max(...Object.values(stats.crisis_types))
                    const pct = (count / max) * 100
                    const color = CRISIS_COLORS[type] ?? '#ff4d6d'
                    return (
                      <div key={type}>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
                            {CRISIS_LABELS[type] ?? type}
                          </span>
                          <span className="font-bold text-xs font-mono-soc" style={{ color }}>
                            {count}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full overflow-hidden"
                             style={{ background: 'var(--border)' }}>
                          <motion.div
                            className="h-full rounded-full"
                            style={{
                              background: `linear-gradient(90deg, ${color}, ${color}60)`,
                              boxShadow: `0 0 6px ${color}50`,
                            }}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.9, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-xs font-mono-soc" style={{ color: 'var(--text-muted)' }}>
                    ✓ NO ACTIVE CRISES
                  </p>
                </div>
              )}
            </motion.div>

            {/* Top Sources */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="card p-5"
            >
              <div className="section-header">
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>أكثر المصادر نشاطاً</h3>
                <span className="mr-auto text-[9px] font-mono-soc px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(0,212,255,0.06)', color: 'rgba(0,212,255,0.6)', border: '1px solid rgba(0,212,255,0.12)' }}>
                  TOP
                </span>
              </div>

              {stats?.top_sources?.length ? (
                <div className="space-y-2.5">
                  {stats.top_sources.slice(0, 7).map((src, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * i }}
                      className="flex items-center gap-2.5 group"
                    >
                      <span className="text-[9px] font-mono-soc w-4 text-center flex-shrink-0"
                            style={{ color: i < 3 ? '#00d4ff' : 'var(--text-muted)' }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>
                          {src.name}
                        </div>
                        {/* Mini bar */}
                        <div className="mt-0.5 h-px rounded-full overflow-hidden"
                             style={{ background: 'var(--border)' }}>
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: i < 3 ? '#00d4ff' : '#1a2f4a' }}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max(10, (src.count / (stats.top_sources[0]?.count || 1)) * 100)}%` }}
                            transition={{ duration: 0.8, delay: 0.05 * i }}
                          />
                        </div>
                      </div>
                      <span className="font-bold text-xs font-mono-soc flex-shrink-0"
                            style={{ color: i < 3 ? '#00d4ff' : 'var(--text-muted)' }}>
                        {src.count}
                      </span>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-xs font-mono-soc text-center py-4" style={{ color: 'var(--text-muted)' }}>
                  NO DATA YET
                </p>
              )}
            </motion.div>

          </div>
        </div>
      </main>
    </div>
  )
}
