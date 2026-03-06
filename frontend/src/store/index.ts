import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CrisisAlert } from '../types'

interface AppState {
  // Dark Mode
  darkMode: boolean
  toggleDarkMode: () => void

  // WebSocket
  wsConnected: boolean
  setWsConnected: (connected: boolean) => void

  // Alerts
  activeAlerts: CrisisAlert[]
  setActiveAlerts: (alerts: CrisisAlert[]) => void
  addAlert: (alert: CrisisAlert) => void
  lastAlertCount: number
  setLastAlertCount: (n: number) => void

  // Notifications
  notifications: Array<{ id: string; message: string; type: 'info' | 'warning' | 'error'; timestamp: string }>
  addNotification: (message: string, type: 'info' | 'warning' | 'error') => void
  removeNotification: (id: string) => void

  // Refresh triggers
  statsRefreshTrigger: number
  triggerStatsRefresh: () => void
  articlesRefreshTrigger: number
  triggerArticlesRefresh: () => void

  // Filters
  selectedHours: number
  setSelectedHours: (hours: number) => void
  searchQuery: string
  setSearchQuery: (query: string) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      darkMode: false,
      toggleDarkMode: () =>
        set((state) => {
          const next = !state.darkMode
          document.documentElement.classList.toggle('dark', next)
          return { darkMode: next }
        }),

      wsConnected: false,
      setWsConnected: (connected) => set({ wsConnected: connected }),

      activeAlerts: [],
      setActiveAlerts: (alerts) => set({ activeAlerts: alerts }),
      addAlert: (alert) =>
        set((state) => ({
          activeAlerts: [alert, ...state.activeAlerts.filter((a) => a.id !== alert.id)],
        })),
      lastAlertCount: 0,
      setLastAlertCount: (n) => set({ lastAlertCount: n }),

      notifications: [],
      addNotification: (message, type) =>
        set((state) => ({
          notifications: [
            ...state.notifications,
            { id: Date.now().toString(), message, type, timestamp: new Date().toISOString() },
          ].slice(-10),
        })),
      removeNotification: (id) =>
        set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) })),

      statsRefreshTrigger: 0,
      triggerStatsRefresh: () => set((s) => ({ statsRefreshTrigger: s.statsRefreshTrigger + 1 })),
      articlesRefreshTrigger: 0,
      triggerArticlesRefresh: () => set((s) => ({ articlesRefreshTrigger: s.articlesRefreshTrigger + 1 })),

      selectedHours: 24,
      setSelectedHours: (hours) => set({ selectedHours: hours }),
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),
    }),
    {
      name: 'media-monitor-prefs',
      partialize: (s) => ({ darkMode: s.darkMode, selectedHours: s.selectedHours }),
      onRehydrateStorage: () => (state) => {
        // تطبيق dark mode عند تحميل الصفحة
        if (state?.darkMode) document.documentElement.classList.add('dark')
      },
    }
  )
)
