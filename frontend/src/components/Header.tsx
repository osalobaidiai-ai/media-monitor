import { useAppStore } from '../store'
import { triggerCollection, triggerAnalysis } from '../utils/api'
import toast from 'react-hot-toast'
import { useState, useEffect, memo } from 'react'
import { motion } from 'framer-motion'

interface HeaderProps {
  title: string
}

export const Header = ({ title }: HeaderProps) => {
  // Selective subscriptions — avoids re-render on every store change (statsRefreshTrigger etc.)
  const selectedHours    = useAppStore((s) => s.selectedHours)
  const setSelectedHours = useAppStore((s) => s.setSelectedHours)
  const searchQuery      = useAppStore((s) => s.searchQuery)
  const setSearchQuery   = useAppStore((s) => s.setSearchQuery)
  const wsConnected      = useAppStore((s) => s.wsConnected)
  const [collecting, setCollecting] = useState(false)

  const handleCollect = async () => {
    setCollecting(true)
    try {
      await triggerCollection()
      await triggerAnalysis()
      toast.success('بدأت عملية جمع وتحليل الأخبار')
    } catch {
      toast.error('فشل في بدء الجمع')
    } finally {
      setCollecting(false)
    }
  }

  const now = new Date()
  const timeStr = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const dateStr = now.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <header className="relative border-b px-6 py-3 flex-shrink-0 z-10"
            style={{
              background: 'linear-gradient(180deg, rgba(6,12,24,0.98) 0%, rgba(10,22,40,0.95) 100%)',
              borderColor: 'var(--border)',
              boxShadow: '0 1px 0 rgba(0,212,255,0.08), 0 4px 24px rgba(0,0,0,0.4)',
            }}>

      {/* Top cyan line */}
      <div className="absolute top-0 left-0 right-0 h-px"
           style={{ background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.6) 30%, rgba(0,212,255,0.6) 70%, transparent)' }} />

      <div className="flex items-center justify-between gap-4">

        {/* Left: Title */}
        <div className="flex items-center gap-4 min-w-0">
          <div>
            <h2 className="text-base font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h2>
            <p className="text-[10px] font-mono-soc mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {dateStr}
            </p>
          </div>
          {/* Live clock */}
          <LiveClock />
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">

          {/* Search */}
          <div className="relative group">
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
                  style={{ color: 'var(--text-muted)' }}>⌕</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في الأخبار..."
              className="input-field pr-8 pl-3 w-44"
              dir="rtl"
            />
          </div>

          {/* Time Filter */}
          <select
            value={selectedHours}
            onChange={(e) => setSelectedHours(Number(e.target.value))}
            className="input-field text-xs cursor-pointer"
            dir="rtl"
            style={{ minWidth: '110px' }}
          >
            <option value={6}>آخر 6 ساعات</option>
            <option value={24}>آخر 24 ساعة</option>
            <option value={48}>آخر 48 ساعة</option>
            <option value={168}>آخر أسبوع</option>
          </select>

          {/* Collect Button */}
          <motion.button
            onClick={handleCollect}
            disabled={collecting}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="btn-primary flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span className={collecting ? 'animate-spin inline-block' : 'inline-block'}>
              {collecting ? '◌' : '⟳'}
            </span>
            <span className="text-xs">{collecting ? 'جارٍ الجمع...' : 'جمع الأخبار'}</span>
          </motion.button>

          {/* WS Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono-soc"
               style={{
                 background: wsConnected ? 'rgba(0,255,148,0.08)' : 'rgba(255,77,109,0.08)',
                 border: `1px solid ${wsConnected ? 'rgba(0,255,148,0.2)' : 'rgba(255,77,109,0.2)'}`,
               }}>
            <div className={`status-dot ${wsConnected ? 'online' : 'offline'}`}
                 style={wsConnected ? { animation: 'pulse 2s infinite' } : {}} />
            <span style={{ color: wsConnected ? '#00ff94' : '#ff4d6d' }}>
              {wsConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}

/* Live real-time clock — memo prevents re-render when Header re-renders */
const LiveClock = memo(() => {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  )

  // Update every second
  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
         style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.12)' }}>
      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>⏱</span>
      <span className="text-sm font-mono-soc font-bold" style={{ color: '#00d4ff', letterSpacing: '0.05em' }}>
        {time}
      </span>
    </div>
  )
})
