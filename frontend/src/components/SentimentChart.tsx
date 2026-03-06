import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import type { Stats } from '../types'
import { motion } from 'framer-motion'

const SENTIMENT_COLORS = {
  positive: '#00ff94',
  negative: '#ff4d6d',
  neutral:  '#5a7a9a',
}

const SENTIMENT_LABELS: Record<string, string> = {
  positive: 'إيجابي',
  negative: 'سلبي',
  neutral:  'محايد',
}

interface SentimentChartProps {
  stats: Stats
}

/* Custom tooltip for charts */
const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="px-3 py-2 rounded-lg text-xs"
         style={{
           background: 'rgba(10,22,40,0.95)',
           border: '1px solid rgba(0,212,255,0.3)',
           boxShadow: '0 0 20px rgba(0,212,255,0.15)',
           direction: 'rtl',
         }}>
      {label && <p className="mb-1 font-mono-soc" style={{ color: '#5a7a9a' }}>{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="font-bold font-mono-soc" style={{ color: p.color || '#00d4ff' }}>
          {p.value} مقالة
        </p>
      ))}
    </div>
  )
}

/* Custom pie legend */
const CustomLegend = ({ payload }: { payload?: { value: string; color: string }[] }) => {
  if (!payload) return null
  return (
    <div className="flex justify-center gap-4 mt-2">
      {payload.map((entry) => (
        <div key={entry.value} className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: entry.color, boxShadow: `0 0 6px ${entry.color}` }} />
          <span className="text-[11px]" style={{ color: '#94a3b8' }}>{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export const SentimentChart = ({ stats }: SentimentChartProps) => {
  const pieData = Object.entries(stats.sentiment_distribution).map(([key, value]) => ({
    name: SENTIMENT_LABELS[key] || key,
    value,
    color: SENTIMENT_COLORS[key as keyof typeof SENTIMENT_COLORS] || '#5a7a9a',
  }))

  const hourlyData = stats.hourly_data.slice(-12).map((d) => ({
    hour: new Date(d.hour).getHours() + ':00',
    count: d.count,
  }))

  const total = pieData.reduce((s, d) => s + d.value, 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

      {/* ── Donut: Sentiment ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="chart-container"
      >
        <div className="section-header">
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>توزيع المشاعر</h3>
          <span className="mr-auto text-[10px] font-mono-soc px-2 py-0.5 rounded"
                style={{ background: 'rgba(0,212,255,0.08)', color: 'rgba(0,212,255,0.6)', border: '1px solid rgba(0,212,255,0.12)' }}>
            SENTIMENT
          </span>
        </div>

        {pieData.length > 0 ? (
          <div className="relative">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={88}
                  paddingAngle={3}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color}
                          style={{ filter: `drop-shadow(0 0 6px ${entry.color})` }} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend content={<CustomLegend />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                 style={{ top: '-10px' }}>
              <p className="text-2xl font-bold font-mono-soc" style={{ color: '#00d4ff', textShadow: '0 0 16px rgba(0,212,255,0.8)' }}>
                {total}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>إجمالي</p>
            </div>
          </div>
        ) : (
          <NoData />
        )}

        {/* Stats row */}
        {pieData.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            {pieData.map((d) => (
              <div key={d.name} className="text-center py-2 rounded-lg"
                   style={{ background: `${d.color}0f`, border: `1px solid ${d.color}20` }}>
                <p className="text-sm font-bold font-mono-soc" style={{ color: d.color }}>{d.value}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{d.name}</p>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* ── Area: Hourly Activity ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="chart-container"
      >
        <div className="section-header">
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>النشاط بالساعة</h3>
          <span className="mr-auto text-[10px] font-mono-soc px-2 py-0.5 rounded"
                style={{ background: 'rgba(168,85,247,0.08)', color: 'rgba(168,85,247,0.7)', border: '1px solid rgba(168,85,247,0.15)' }}>
            ACTIVITY
          </span>
        </div>

        {hourlyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={hourlyData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#a855f7" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0.02} />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(26,47,74,0.6)" />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 10, fill: '#5a7a9a', fontFamily: 'JetBrains Mono' }}
                axisLine={{ stroke: 'rgba(26,47,74,0.8)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#5a7a9a', fontFamily: 'JetBrains Mono' }}
                axisLine={{ stroke: 'rgba(26,47,74,0.8)' }}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="count"
                name="المقالات"
                stroke="#a855f7"
                strokeWidth={2}
                fill="url(#areaGradient)"
                dot={{ fill: '#a855f7', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, fill: '#a855f7', stroke: 'rgba(168,85,247,0.3)', strokeWidth: 4 }}
                filter="url(#glow)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <NoData />
        )}
      </motion.div>
    </div>
  )
}

const NoData = () => (
  <div className="h-52 flex flex-col items-center justify-center gap-2">
    <div className="text-3xl opacity-20">◈</div>
    <p className="text-xs font-mono-soc" style={{ color: 'var(--text-muted)' }}>NO DATA AVAILABLE</p>
  </div>
)
