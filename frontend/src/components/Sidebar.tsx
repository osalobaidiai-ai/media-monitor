import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { useAppStore } from '../store'

const navItems = [
  { path: '/',          label: 'لوحة التحكم', icon: '▦', desc: 'Dashboard'  },
  { path: '/articles',  label: 'الأخبار',      icon: '▤', desc: 'Feed'       },
  { path: '/alerts',    label: 'التنبيهات',   icon: '◈', desc: 'Alerts'     },
  { path: '/sources',   label: 'المصادر',      icon: '◉', desc: 'Sources'    },
  { path: '/analytics', label: 'التحليلات',   icon: '◐', desc: 'Analytics'  },
  { path: '/reports',   label: 'تقارير AI',    icon: '✦', desc: 'AI Reports' },
  { path: '/x-analysis', label: 'تحليل X',    icon: '✕', desc: 'X Analysis' },
]

export const Sidebar = () => {
  // Selective subscriptions — avoids re-render on unrelated store changes
  const wsConnected  = useAppStore((s) => s.wsConnected)
  const activeAlerts = useAppStore((s) => s.activeAlerts)
  const criticalCount = activeAlerts.filter((a) => a.severity === 'critical').length

  return (
    <aside className="w-56 flex flex-col flex-shrink-0 relative z-10 circuit-bg"
           style={{
             background: 'linear-gradient(180deg, #060c18 0%, #07101e 100%)',
             borderLeft: '1px solid rgba(0,212,255,0.12)',
             boxShadow: '-4px 0 24px rgba(0,0,0,0.5)',
           }}>

      {/* Scan line animation */}
      <div className="scan-line" />

      {/* ── Logo ── */}
      <div className="px-4 py-5 relative"
           style={{ borderBottom: '1px solid rgba(0,212,255,0.08)' }}>
        <div className="flex items-center gap-3">
          {/* Logo icon */}
          <div className="relative w-10 h-10 flex-shrink-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                 style={{
                   background: 'linear-gradient(135deg, rgba(0,108,53,0.6), rgba(0,180,90,0.3))',
                   border: '1px solid rgba(0,255,148,0.3)',
                   boxShadow: '0 0 16px rgba(0,255,148,0.2)',
                 }}>
              🇸🇦
            </div>
            {/* Online dot */}
            <div className="absolute -bottom-0.5 -left-0.5 w-3 h-3 rounded-full border-2"
                 style={{
                   background: wsConnected ? '#00ff94' : '#ff4d6d',
                   borderColor: '#060c18',
                   boxShadow: wsConnected ? '0 0 8px rgba(0,255,148,0.8)' : '0 0 8px rgba(255,77,109,0.8)',
                 }} />
          </div>

          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight" style={{ color: '#e2e8f0' }}>رصد الإعلام</p>
            <p className="text-[10px] font-mono-soc mt-0.5" style={{ color: 'rgba(0,212,255,0.6)' }}>
              KSA MEDIA OPS
            </p>
          </div>
        </div>

        {/* System status bar */}
        <div className="mt-3 flex items-center gap-1.5 px-2 py-1.5 rounded-lg"
             style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.08)' }}>
          <div className="w-1.5 h-1.5 rounded-full"
               style={{ background: wsConnected ? '#00ff94' : '#ff4d6d', boxShadow: wsConnected ? '0 0 6px #00ff94' : '0 0 6px #ff4d6d', animation: wsConnected ? 'pulse 2s infinite' : 'none' }} />
          <span className="text-[10px] font-mono-soc" style={{ color: wsConnected ? '#00ff94' : '#ff4d6d' }}>
            {wsConnected ? 'SYSTEM ONLINE' : 'DISCONNECTED'}
          </span>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] px-2 mb-3"
           style={{ color: 'rgba(0,212,255,0.4)' }}>
          ◈ القوائم الرئيسية
        </p>

        {navItems.map((item, idx) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              clsx(
                'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative overflow-hidden',
                isActive ? 'nav-active' : ''
              )
            }
            style={({ isActive }) => !isActive ? {
              color: 'rgba(148,163,184,0.7)',
            } : {}}
          >
            {({ isActive }) => (
              <>
                {/* Active glow bg — pure CSS, no layout animation */}
                {isActive && (
                  <div
                    className="absolute inset-0 rounded-lg"
                    style={{ background: 'linear-gradient(90deg, rgba(0,212,255,0.08), transparent)' }}
                  />
                )}

                <span className={clsx(
                  'w-5 text-center text-base flex-shrink-0 relative z-10 transition-colors duration-150',
                  isActive ? 'text-[#00d4ff]' : 'opacity-50 group-hover:opacity-80'
                )}>
                  {item.icon}
                </span>

                <div className="flex-1 min-w-0 relative z-10">
                  <span className="block text-xs leading-tight">{item.label}</span>
                  <span className="block text-[9px] font-mono-soc mt-0.5 opacity-50">{item.desc}</span>
                </div>

                {/* Badges */}
                {item.path === '/alerts' && criticalCount > 0 && (
                  <span className="relative z-10 text-[9px] font-mono-soc font-bold px-1.5 py-0.5 rounded-md animate-pulse"
                        style={{ background: 'rgba(255,77,109,0.2)', color: '#ff4d6d', border: '1px solid rgba(255,77,109,0.3)' }}>
                    {criticalCount}
                  </span>
                )}
                {item.path === '/reports' && (
                  <span className="relative z-10 text-[9px] font-mono-soc font-bold px-1.5 py-0.5 rounded-md"
                        style={{ background: 'rgba(168,85,247,0.2)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)' }}>
                    AI
                  </span>
                )}
                {item.path === '/x-analysis' && (
                  <span className="relative z-10 text-[9px] font-mono-soc font-bold px-1.5 py-0.5 rounded-md"
                        style={{ background: 'rgba(29,155,240,0.2)', color: '#1d9bf0', border: '1px solid rgba(29,155,240,0.3)' }}>
                    X
                  </span>
                )}

                {/* Hover indicator */}
                {!isActive && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-0 group-hover:h-1/2 transition-all duration-200 rounded-full"
                       style={{ background: 'rgba(0,212,255,0.5)' }} />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Footer ── */}
      <div className="px-4 py-4 space-y-3"
           style={{ borderTop: '1px solid rgba(0,212,255,0.08)' }}>

        {/* System metrics */}
        <div className="grid grid-cols-3 gap-1">
          {[
            { label: 'CPU',  value: '12%', color: '#00ff94' },
            { label: 'MEM',  value: '64%', color: '#00d4ff' },
            { label: 'NET',  value: '↑↓',  color: '#a855f7' },
          ].map((m) => (
            <div key={m.label} className="text-center px-1 py-1.5 rounded"
                 style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-[9px] font-mono-soc mb-0.5" style={{ color: 'rgba(148,163,184,0.4)' }}>{m.label}</p>
              <p className="text-[10px] font-mono-soc font-bold" style={{ color: m.color }}>{m.value}</p>
            </div>
          ))}
        </div>

        <p className="text-[9px] font-mono-soc text-center"
           style={{ color: 'rgba(0,212,255,0.25)' }}>
          SMM v1.0 · CLASSIFIED
        </p>
      </div>
    </aside>
  )
}
