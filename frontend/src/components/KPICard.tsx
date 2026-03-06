import { motion } from 'framer-motion'
import clsx from 'clsx'

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: string
  trend?: 'up' | 'down' | 'stable'
  trendValue?: string
  color?: 'blue' | 'green' | 'red' | 'orange' | 'purple'
  loading?: boolean
}

const colorConfig = {
  blue:   { card: 'card-cyan',   accent: '#00d4ff', bg: 'rgba(0,212,255,0.08)',   glow: 'rgba(0,212,255,0.3)',   label: 'text-[#00d4ff]',  bar: 'from-[#00d4ff] to-[#0070aa]' },
  green:  { card: 'card-green',  accent: '#00ff94', bg: 'rgba(0,255,148,0.08)',   glow: 'rgba(0,255,148,0.3)',   label: 'text-[#00ff94]',  bar: 'from-[#00ff94] to-[#059669]' },
  red:    { card: 'card-red',    accent: '#ff4d6d', bg: 'rgba(255,77,109,0.1)',   glow: 'rgba(255,77,109,0.4)',  label: 'text-[#ff4d6d]',  bar: 'from-[#ff4d6d] to-[#991b1b]' },
  orange: { card: 'card-orange', accent: '#ff8c00', bg: 'rgba(255,140,0,0.08)',   glow: 'rgba(255,140,0,0.3)',   label: 'text-[#ff8c00]',  bar: 'from-[#ff8c00] to-[#b45309]' },
  purple: { card: 'card-purple', accent: '#a855f7', bg: 'rgba(168,85,247,0.08)', glow: 'rgba(168,85,247,0.3)',  label: 'text-[#a855f7]',  bar: 'from-[#a855f7] to-[#7c3aed]' },
}

const trendConfig = {
  up:     { icon: '▲', style: 'text-[#ff4d6d] bg-[#ff4d6d]/10 border border-[#ff4d6d]/20' },
  down:   { icon: '▼', style: 'text-[#00ff94] bg-[#00ff94]/10 border border-[#00ff94]/20' },
  stable: { icon: '●', style: 'text-[#5a7a9a] bg-white/5 border border-white/10' },
}

export const KPICard = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  color = 'blue',
  loading = false,
}: KPICardProps) => {
  const cfg = colorConfig[color]

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={clsx('card relative overflow-hidden group cursor-default', cfg.card)}
      style={{ padding: '1.25rem' }}
    >
      {/* Top accent line */}
      <div className="top-accent-line" style={{ background: `linear-gradient(90deg, ${cfg.accent}, transparent)` }} />

      {/* Scan line animation */}
      <div className="scan-line" />

      {/* Corner decoration */}
      <div className="absolute top-0 left-0 w-8 h-8 opacity-20 pointer-events-none"
           style={{ borderBottom: `1px solid ${cfg.accent}`, borderRight: `1px solid ${cfg.accent}` }} />

      <div className="relative flex items-start justify-between gap-3">
        {/* Icon */}
        <div className="w-11 h-11 rounded-lg flex items-center justify-center text-xl flex-shrink-0 transition-transform group-hover:scale-110"
             style={{ background: cfg.bg, boxShadow: `0 0 16px ${cfg.glow}` }}>
          {icon}
        </div>

        {/* Trend */}
        {trend && trendValue && (
          <div className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex-shrink-0', trendConfig[trend].style)}>
            <span>{trendConfig[trend].icon}</span>
            <span>{trendValue}</span>
          </div>
        )}
      </div>

      {/* Value */}
      <div className="mt-4">
        <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>{title}</p>
        {loading ? (
          <div className="h-9 rounded-lg w-28 animate-pulse" style={{ background: 'var(--border)' }} />
        ) : (
          <motion.p
            key={String(value)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={clsx('text-3xl font-bold metric-number leading-none', cfg.label)}
          >
            {value}
          </motion.p>
        )}
        {subtitle && (
          <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
        )}
      </div>

      {/* Bottom gradient bar */}
      <div className="mt-4 h-0.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <motion.div
          className={clsx('h-full rounded-full bg-gradient-to-l', cfg.bar)}
          initial={{ width: 0 }}
          animate={{ width: loading ? '10%' : '100%' }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
        />
      </div>
    </motion.div>
  )
}
