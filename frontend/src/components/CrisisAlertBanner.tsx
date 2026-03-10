import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { fetchAlertsSummary, acknowledgeAlert, resolveAlert } from '../utils/api'
import { getSeverityLabel, getCrisisTypeIcon, formatRelativeTime } from '../utils/helpers'
import { useAppStore } from '../store'
import clsx from 'clsx'

function playAlertSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const beep = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.3, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + dur)
    }
    beep(880, 0, 0.15)
    beep(660, 0.2, 0.15)
    beep(880, 0.4, 0.25)
  } catch (_) { /* audio not supported */ }
}

const SEVERITY_STYLES: Record<string, { color: string; bg: string; border: string; glow: string }> = {
  critical: { color: '#ff4d6d', bg: 'rgba(255,77,109,0.08)',  border: 'rgba(255,77,109,0.4)',  glow: '0 0 30px rgba(255,77,109,0.2)' },
  high:     { color: '#ff8c00', bg: 'rgba(255,140,0,0.06)',   border: 'rgba(255,140,0,0.3)',   glow: '0 0 20px rgba(255,140,0,0.15)' },
  medium:   { color: '#fbbf24', bg: 'rgba(251,191,36,0.06)',  border: 'rgba(251,191,36,0.25)', glow: '0 0 16px rgba(251,191,36,0.1)' },
  low:      { color: '#00d4ff', bg: 'rgba(0,212,255,0.05)',   border: 'rgba(0,212,255,0.2)',   glow: '0 0 12px rgba(0,212,255,0.1)' },
}

export const CrisisAlertBanner = () => {
  const { statsRefreshTrigger, lastAlertCount, setLastAlertCount } = useAppStore()
  const queryClient = useQueryClient()
  const initialized = useRef(false)

  const { data: summary } = useQuery({
    queryKey: ['alerts-summary', statsRefreshTrigger],
    queryFn: fetchAlertsSummary,
    refetchInterval: 30000,
    placeholderData: keepPreviousData,
  })

  useEffect(() => {
    if (!summary) return
    if (!initialized.current) {
      initialized.current = true
      setLastAlertCount(summary.total_active)
      return
    }
    if (summary.total_active > lastAlertCount) {
      playAlertSound()
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200, 100, 300])
    }
    setLastAlertCount(summary.total_active)
  }, [summary?.total_active]) // eslint-disable-line react-hooks/exhaustive-deps

  const acknowledgeMutation = useMutation({
    mutationFn: (id: number) => acknowledgeAlert(id, 'مسؤول النظام'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts-summary'] }),
  })

  const resolveMutation = useMutation({
    mutationFn: resolveAlert,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts-summary'] }),
  })

  if (!summary?.total_active) return null

  const alert = summary.latest_alert
  const isCritical = summary.has_critical
  const topSeverity = isCritical ? 'critical' : summary.by_severity.high > 0 ? 'high' : summary.by_severity.medium > 0 ? 'medium' : 'low'
  const style = SEVERITY_STYLES[topSeverity]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0, y: -10 }}
        animate={{ height: 'auto', opacity: 1, y: 0 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-xl"
        style={{
          background: style.bg,
          border: `1px solid ${style.border}`,
          boxShadow: style.glow,
        }}
      >
        {/* Scan line */}
        <div className="scan-line" />

        {/* Left accent bar */}
        <div className="absolute right-0 top-0 bottom-0 w-1 rounded-r-xl"
             style={{ background: `linear-gradient(180deg, ${style.color}, transparent)` }} />

        {/* Pulsing background — CSS animation only, no JS per-frame */}
        {isCritical && (
          <div
            className="absolute inset-0 rounded-xl pointer-events-none crisis-pulse"
            style={{ background: style.color }}
          />
        )}

        <div className="p-4 pr-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div
                className={clsx('text-2xl flex-shrink-0 mt-0.5', isCritical && 'alert-icon-pulse')}
              >
                🚨
              </div>

              <div>
                {/* Header row */}
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-bold text-base font-mono-soc" style={{ color: style.color }}>
                    {summary.total_active}
                  </span>
                  <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                    تنبيه نشط
                  </span>
                  {isCritical && (
                    <span className="text-[10px] font-bold font-mono-soc px-2 py-0.5 rounded"
                          style={{ background: 'rgba(255,77,109,0.15)', color: '#ff4d6d', border: '1px solid rgba(255,77,109,0.3)' }}>
                      ● CRITICAL
                    </span>
                  )}
                </div>

                {/* Latest alert */}
                {alert && (
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    {getCrisisTypeIcon(alert.crisis_type)}{' '}
                    <span style={{ color: style.color }}>{alert.title}</span>
                    <span className="mx-2 opacity-40">·</span>
                    <span className="text-xs font-mono-soc" style={{ color: 'var(--text-muted)' }}>
                      {formatRelativeTime(alert.created_at)}
                    </span>
                  </p>
                )}

                {/* Severity breakdown */}
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {Object.entries(summary.by_severity || {})
                    .filter(([, v]) => v > 0)
                    .map(([k, v]) => {
                      const s = SEVERITY_STYLES[k] ?? SEVERITY_STYLES.low
                      return (
                        <span key={k} className="text-[10px] font-mono-soc px-2 py-0.5 rounded"
                              style={{ background: `${s.color}10`, color: s.color, border: `1px solid ${s.color}25` }}>
                          {getSeverityLabel(k)}: {v}
                        </span>
                      )
                    })}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            {alert && (
              <div className="flex gap-2 flex-shrink-0">
                {!alert.is_acknowledged && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => acknowledgeMutation.mutate(alert.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: `${style.color}15`,
                      color: style.color,
                      border: `1px solid ${style.color}30`,
                    }}
                  >
                    إقرار
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => resolveMutation.mutate(alert.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    color: 'var(--text-muted)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  إغلاق
                </motion.button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
