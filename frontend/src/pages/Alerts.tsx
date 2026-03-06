import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { fetchAlerts, acknowledgeAlert, resolveAlert } from '../utils/api'
import { getSeverityColor, getSeverityLabel, getCrisisTypeLabel, getCrisisTypeIcon, formatDateTime, formatRelativeTime } from '../utils/helpers'
import { Header } from '../components/Header'
import { motion } from 'framer-motion'
import { useAppStore } from '../store'
import clsx from 'clsx'
import toast from 'react-hot-toast'

export const Alerts = () => {
  const { statsRefreshTrigger } = useAppStore()
  const queryClient = useQueryClient()

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['all-alerts', statsRefreshTrigger],
    queryFn: () => fetchAlerts({ active_only: false }),
    refetchInterval: 15000,
    placeholderData: keepPreviousData,
  })

  const acknowledgeMutation = useMutation({
    mutationFn: (id: number) => acknowledgeAlert(id, 'مسؤول النظام'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-alerts'] })
      queryClient.invalidateQueries({ queryKey: ['alerts-summary'] })
      toast.success('تم الإقرار بالتنبيه')
    },
  })

  const resolveMutation = useMutation({
    mutationFn: resolveAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-alerts'] })
      queryClient.invalidateQueries({ queryKey: ['alerts-summary'] })
      toast.success('تم إغلاق التنبيه')
    },
  })

  const activeAlerts = alerts?.filter((a) => a.is_active) || []
  const resolvedAlerts = alerts?.filter((a) => !a.is_active) || []

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="تنبيهات منتدى الإعلام السعودي" />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-4 gap-4">
          {([
            { sev: 'critical', color: '#ff4d6d', label: 'حرج' },
            { sev: 'high',     color: '#ff8c00', label: 'عالٍ' },
            { sev: 'medium',   color: '#fbbf24', label: 'متوسط' },
            { sev: 'low',      color: '#00d4ff', label: 'منخفض' },
          ] as const).map(({ sev, color, label }) => {
            const count = activeAlerts.filter((a) => a.severity === sev).length
            return (
              <div key={sev} className="card text-center py-4 px-2"
                   style={{ borderColor: `${color}30` }}>
                <div className="top-accent-line"
                     style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
                <div className="text-2xl font-bold metric-number" style={{ color }}>{count}</div>
                <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
              </div>
            )
          })}
        </div>

        {/* Active Alerts */}
        <div>
          <div className="section-header mb-3">
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              التنبيهات النشطة
            </h3>
            <span className="mr-auto text-[10px] font-mono-soc px-2 py-0.5 rounded"
                  style={{ background: 'rgba(0,212,255,0.08)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.15)' }}>
              {activeAlerts.length} نشط
            </span>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="card h-24 animate-pulse" />
              ))}
            </div>
          ) : activeAlerts.length === 0 ? (
            <div className="card p-10 text-center">
              <div className="text-3xl mb-2 opacity-20">◈</div>
              <p className="text-xs font-mono-soc" style={{ color: 'var(--text-muted)' }}>
                لا توجد تنبيهات نشطة — النظام يرصد منتدى الإعلام السعودي
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeAlerts.map((alert) => {
                const sevColor = {
                  critical: '#ff4d6d', high: '#ff8c00',
                  medium: '#fbbf24', low: '#00d4ff',
                }[alert.severity] ?? '#5a7a9a'
                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card p-4 relative overflow-hidden"
                    style={{ borderColor: `${sevColor}30` }}
                  >
                    <div className="top-accent-line"
                         style={{ background: `linear-gradient(90deg, ${sevColor}, transparent)` }} />
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono-soc"
                                style={{ background: `${sevColor}15`, color: sevColor, border: `1px solid ${sevColor}30` }}>
                            {getSeverityLabel(alert.severity)}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {getCrisisTypeIcon(alert.crisis_type)} {getCrisisTypeLabel(alert.crisis_type)}
                          </span>
                          {alert.is_acknowledged && (
                            <span className="px-2 py-0.5 rounded text-[10px]"
                                  style={{ background: 'rgba(0,212,255,0.08)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)' }}>
                              ✓ تم الإقرار
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                          {alert.title}
                        </h4>
                        {alert.description && (
                          <p className="text-xs mb-2 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                            {alert.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-[10px] font-mono-soc"
                             style={{ color: 'var(--text-muted)' }}>
                          <span>{alert.articles_count} مقالة</span>
                          <span>صلة: {(alert.severity_score * 100).toFixed(0)}%</span>
                          <span>{formatRelativeTime(alert.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {!alert.is_acknowledged && (
                          <button
                            onClick={() => acknowledgeMutation.mutate(alert.id)}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                            style={{ background: 'rgba(0,212,255,0.08)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)' }}
                          >
                            إقرار
                          </button>
                        )}
                        <button
                          onClick={() => resolveMutation.mutate(alert.id)}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                          style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                        >
                          إغلاق
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        {/* Resolved Alerts */}
        {resolvedAlerts.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-500 mb-3">التنبيهات المغلقة ({resolvedAlerts.length})</h3>
            <div className="space-y-2">
              {resolvedAlerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className="bg-gray-50 rounded-xl p-4 opacity-60">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>{getCrisisTypeIcon(alert.crisis_type)}</span>
                    <span>{alert.title}</span>
                    <span className="mr-auto text-xs">{formatDateTime(alert.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
