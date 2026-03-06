import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { fetchStats } from '../utils/api'
import { Header } from '../components/Header'
import { useAppStore } from '../store'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts'

const SOC_COLORS = ['#00d4ff', '#00ff94', '#ff4d6d', '#ff8c00', '#a855f7']

const SENTIMENT_SOC = {
  positive: '#00ff94',
  negative: '#ff4d6d',
  neutral:  '#5a7a9a',
}

const chartTooltipStyle = {
  background: 'rgba(10,22,40,0.96)',
  border: '1px solid rgba(0,212,255,0.25)',
  borderRadius: '8px',
  boxShadow: '0 0 20px rgba(0,212,255,0.12)',
  color: '#e2e8f0',
  direction: 'rtl' as const,
  fontSize: '12px',
}

const axisStyle = { fontSize: 10, fill: '#5a7a9a', fontFamily: 'JetBrains Mono, monospace' }

/* ── Reusable chart panel ── */
const Panel = ({ title, tag, tagColor, children }: {
  title: string
  tag: string
  tagColor: string
  children: React.ReactNode
}) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    className="chart-container"
  >
    <div className="flex items-center gap-2 mb-4">
      <div className="w-0.5 h-4 rounded-full flex-shrink-0"
           style={{ background: `linear-gradient(180deg, ${tagColor}, transparent)` }} />
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <span className="mr-auto text-[9px] font-mono-soc px-1.5 py-0.5 rounded"
            style={{ background: `${tagColor}12`, color: tagColor, border: `1px solid ${tagColor}25` }}>
        {tag}
      </span>
    </div>
    {children}
  </motion.div>
)

const NoData = ({ label = 'NO DATA' }: { label?: string }) => (
  <div className="h-44 flex flex-col items-center justify-center gap-2">
    <div className="text-2xl opacity-15">◈</div>
    <p className="text-[11px] font-mono-soc" style={{ color: 'var(--text-muted)' }}>{label}</p>
  </div>
)

export const Analytics = () => {
  const { selectedHours, statsRefreshTrigger } = useAppStore()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats-analytics', selectedHours, statsRefreshTrigger],
    queryFn: () => fetchStats(selectedHours),
    refetchInterval: 120000,
    placeholderData: keepPreviousData,
  })

  const sentimentData = stats
    ? Object.entries(stats.sentiment_distribution).map(([k, v]) => ({
        name: k === 'positive' ? 'إيجابي' : k === 'negative' ? 'سلبي' : 'محايد',
        value: v,
        color: SENTIMENT_SOC[k as keyof typeof SENTIMENT_SOC] ?? '#5a7a9a',
      }))
    : []

  const crisisData = stats
    ? Object.entries(stats.crisis_types).map(([k, v]) => ({
        name: k === 'security' ? 'أمني' : k === 'political' ? 'سياسي'
            : k === 'economic' ? 'اقتصادي' : k === 'health' ? 'صحي' : 'طبيعي',
        count: v,
      }))
    : []

  const hourlyData = stats?.hourly_data.map((d) => ({
    hour: new Date(d.hour).getHours() + ':00',
    count: d.count,
  })) ?? []

  const sourcesData = stats?.top_sources.slice(0, 6).map((s) => ({
    name: s.name.length > 14 ? s.name.substring(0, 14) + '…' : s.name,
    count: s.count,
  })) ?? []

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Header title="التحليلات والإحصائيات" />

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card h-56 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* ── Summary KPIs ── */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: 'إجمالي المقالات',
                  value: stats?.total_articles?.toLocaleString('ar') ?? '0',
                  sub: `آخر ${selectedHours} ساعة`,
                  color: '#00d4ff',
                  icon: '◈',
                },
                {
                  label: 'نسبة الأزمات',
                  value: `${stats?.crisis_rate ?? 0}%`,
                  sub: `${stats?.crisis_articles ?? 0} مقالة أزمة`,
                  color: '#ff4d6d',
                  icon: '⚠',
                },
                {
                  label: 'معدل الأخبار',
                  value: stats ? Math.round(stats.total_articles / selectedHours) : 0,
                  sub: 'مقالة / ساعة',
                  color: '#00ff94',
                  icon: '◎',
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="card relative overflow-hidden"
                  style={{ padding: '1rem', borderColor: `${item.color}30` }}
                >
                  {/* Top line */}
                  <div className="top-accent-line"
                       style={{ background: `linear-gradient(90deg, ${item.color}, transparent)` }} />
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                      <p className="text-2xl font-bold metric-number" style={{ color: item.color }}>
                        {item.value}
                      </p>
                      <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{item.sub}</p>
                    </div>
                    <span className="text-xl opacity-20">{item.icon}</span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* ── Charts 2×2 ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Hourly Area */}
              <Panel title="معدل الأخبار بالساعة" tag="HOURLY" tagColor="#a855f7">
                {hourlyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={hourlyData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                      <defs>
                        <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#a855f7" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0.02} />
                        </linearGradient>
                        <filter id="glw"><feGaussianBlur stdDeviation="2.5" result="c"/><feMerge><feMergeNode in="c"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" stroke="rgba(26,47,74,0.7)" />
                      <XAxis dataKey="hour" tick={axisStyle} axisLine={{ stroke: '#1a2f4a' }} tickLine={false} />
                      <YAxis tick={axisStyle} axisLine={{ stroke: '#1a2f4a' }} tickLine={false} />
                      <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [v, 'مقالة']} />
                      <Area type="monotone" dataKey="count" stroke="#a855f7" strokeWidth={2}
                            fill="url(#aGrad)" filter="url(#glw)"
                            dot={false} activeDot={{ r: 4, fill: '#a855f7', stroke: 'rgba(168,85,247,0.3)', strokeWidth: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <NoData label="لا توجد بيانات" />}
              </Panel>

              {/* Sentiment Bar */}
              <Panel title="توزيع المشاعر" tag="SENTIMENT" tagColor="#00d4ff">
                {sentimentData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={sentimentData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="4 4" stroke="rgba(26,47,74,0.7)" />
                      <XAxis dataKey="name" tick={axisStyle} axisLine={{ stroke: '#1a2f4a' }} tickLine={false} />
                      <YAxis tick={axisStyle} axisLine={{ stroke: '#1a2f4a' }} tickLine={false} />
                      <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [v, 'مقالة']} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
                        {sentimentData.map((e, i) => (
                          <Cell key={i} fill={e.color}
                                style={{ filter: `drop-shadow(0 0 5px ${e.color}80)` }} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <NoData label="لا توجد بيانات" />}
              </Panel>

              {/* Crisis Types (horizontal) */}
              <Panel title="أنواع الأزمات المرصودة" tag="CRISIS" tagColor="#ff4d6d">
                {crisisData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={crisisData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="4 4" stroke="rgba(26,47,74,0.7)" horizontal={false} />
                      <XAxis type="number" tick={axisStyle} axisLine={{ stroke: '#1a2f4a' }} tickLine={false} />
                      <YAxis dataKey="name" type="category" tick={{ ...axisStyle, fontSize: 11 }}
                             width={55} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [v, 'أزمة']} />
                      <Bar dataKey="count" fill="#ff4d6d" radius={[0, 4, 4, 0]} maxBarSize={20}>
                        {crisisData.map((_, i) => (
                          <Cell key={i} fill={['#ff4d6d','#ff8c00','#a855f7','#00d4ff','#00ff94'][i % 5]}
                                style={{ filter: `drop-shadow(0 0 4px rgba(255,77,109,0.5))` }} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <NoData label="لا توجد أزمات مرصودة" />}
              </Panel>

              {/* Top Sources (horizontal) */}
              <Panel title="أكثر المصادر إنتاجاً" tag="SOURCES" tagColor="#00ff94">
                {sourcesData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={sourcesData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="4 4" stroke="rgba(26,47,74,0.7)" horizontal={false} />
                      <XAxis type="number" tick={axisStyle} axisLine={{ stroke: '#1a2f4a' }} tickLine={false} />
                      <YAxis dataKey="name" type="category" tick={{ ...axisStyle, fontSize: 10 }}
                             width={70} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [v, 'مقالة']} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
                        {sourcesData.map((_, i) => (
                          <Cell key={i} fill={SOC_COLORS[i % SOC_COLORS.length]}
                                style={{ filter: `drop-shadow(0 0 4px ${SOC_COLORS[i % SOC_COLORS.length]}80)` }} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <NoData label="لا توجد بيانات" />}
              </Panel>

            </div>
          </>
        )}
      </main>
    </div>
  )
}
